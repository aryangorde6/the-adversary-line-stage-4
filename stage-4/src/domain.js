'use strict';

const { fail } = require('./errors');
const time = require('./time');
const store = require('./state');
const policyRules = require('./policy');
const history = require('./history');
const explainRules = require('./explain');
const {
  requireId,
  requirePartySize,
  requireStartsAtLocal,
  optionalId,
  optionalPartySize,
  optionalStartsAtLocal,
  readTableIds,
  has,
} = require('./fields');

const MAX_TABLES_PER_BOOKING = 2;

const MILLIS_PER_MINUTE = time.MINUTE;

function placeContext(restaurant, table, wall) {
  const context = { restaurant: restaurant ? restaurant.name : '' };
  if (table) context.table = table.label === undefined || table.label === null ? table.id : table.label;
  if (wall) {
    const stamp = time.wallToString(wall);
    context.date = stamp.slice(0, 10);
    context.starts_at_local = stamp;
    context.weekday = time.WEEKDAY_NAMES[time.weekdayOf(wall.y, wall.mo, wall.d)];
  }
  return context;
}

// Opening hours are read from a policy rather than from the restaurant, because a published policy
// carries its own hours and a booking on that policy's date must be judged by them. The restaurant
// is still passed for the timezone and for context in a refusal.
function dayOpeningHours(selected, restaurant, wall) {
  const name = time.WEEKDAY_NAMES[time.weekdayOf(wall.y, wall.mo, wall.d)];
  const entry = selected.opening_hours.find((day) => day.weekday === name);
  if (!entry) return null;
  return { opens: time.parseHhmm(entry.opens), closes: time.parseHhmm(entry.closes) };
}

function resolveStartMs(restaurant, wall) {
  const instants = time.wallToInstants(restaurant.timezone, wall.y, wall.mo, wall.d, wall.h, wall.mi);
  if (instants.length === 0) {
    fail('invalid_local_time', placeContext(restaurant, null, wall));
  }
  return instants[0];
}

function tableIdsOf(reservation) {
  return Array.isArray(reservation.table_ids) ? reservation.table_ids : [];
}

function tableLabel(table) {
  return table.label === undefined || table.label === null ? table.id : table.label;
}

// A diner reading a sentence about a two-table booking should be able to hear which tables, so
// the context names every member of the set rather than only the first. The labels are handed over
// as an array and never as a joined string: a table labelled "Bar and Grill" is one table, and a
// sentence builder that cannot survive that label is a defect waiting for a fixture.
function placeSetContext(restaurant, tableIds, wall) {
  const tables = tableIds.map((id) => store.findTable(restaurant, id)).filter(Boolean);
  const context = placeContext(restaurant, tables.length > 0 ? tables[0] : null, wall);
  if (tables.length > 1) context.tables = tables.map(tableLabel);
  return context;
}

// A set the restaurant will not take is described exactly as a set it would, so the sentence can
// name the tables by the labels the diner chose. Handing over ids instead would put a t_N in front
// of someone who picked those tables by label.
function refusedSetContext(restaurant, tableIds) {
  const context = placeSetContext(restaurant, tableIds, undefined);
  context.table_ids = tableIds.slice();
  return context;
}

// The refusal names the cutoff the diner actually accepted rather than the restaurant's current
// one, so the sentence and the check cannot disagree after a policy is published.
function reservationContext(restaurant, reservation) {
  const context = placeSetContext(restaurant, tableIdsOf(reservation), time.parseWall(reservation.starts_at_local));
  context.reference = reservation.reference;
  const accepted = reservation.accepted_terms || {};
  context.cutoff_minutes = typeof accepted.cancellation_cutoff_minutes === 'number'
    ? accepted.cancellation_cutoff_minutes
    : restaurant.cancellation_cutoff_minutes;
  return context;
}

function hoursContext(restaurant, wall, day) {
  const context = placeContext(restaurant, null, wall);
  if (day && day.opens !== null && day.closes !== null) {
    context.opens = time.minutesToHhmm(day.opens);
    context.closes = time.minutesToHhmm(day.closes);
  }
  return context;
}

function requireSlotInsideOpeningHours(selected, restaurant, wall) {
  const day = dayOpeningHours(selected, restaurant, wall);
  if (!day || day.opens === null || day.closes === null) {
    fail('outside_opening_hours', hoursContext(restaurant, wall, null));
  }
  const minutesOfDay = wall.h * 60 + wall.mi;
  const step = selected.slot_minutes;
  const offset = minutesOfDay - day.opens;
  if (offset < 0) {
    fail('outside_opening_hours', hoursContext(restaurant, wall, day));
  }
  if (step <= 0 || offset % step !== 0) {
    const context = hoursContext(restaurant, wall, day);
    context.slot_minutes = step;
    fail('not_on_slot_grid', context);
  }
  if (minutesOfDay + selected.reservation_duration_minutes > day.closes) {
    fail('outside_opening_hours', hoursContext(restaurant, wall, day));
  }
}

// A booking holds every table in its set for its whole duration, so asking whether a set is free
// means asking whether any member is taken. The id of a taken member comes back so the caller can
// name it in the refusal.
function occupiedTableId(state, restaurantId, tableIds, startMs, endMs, ignoredReference) {
  for (const reservation of state.reservations) {
    if (reservation.status !== 'confirmed') continue;
    if (reservation.restaurant_id !== restaurantId) continue;
    if (ignoredReference !== null && reservation.reference === ignoredReference) continue;
    if (!(reservation.starts_at_ms < endMs && startMs < reservation.ends_at_ms)) continue;
    for (const held of tableIdsOf(reservation)) {
      if (tableIds.includes(held)) return held;
    }
  }
  return null;
}

function isOccupied(state, restaurantId, tableIds, startMs, endMs, ignoredReference) {
  return occupiedTableId(state, restaurantId, tableIds, startMs, endMs, ignoredReference) !== null;
}

function requireRestaurant(state, restaurantId) {
  const restaurant = store.findRestaurant(state, restaurantId);
  if (!restaurant) fail('not_found', { resource: 'restaurant', restaurant_id: restaurantId });
  return restaurant;
}

function requireTable(restaurant, tableId) {
  const table = store.findTable(restaurant, tableId);
  if (!table) fail('not_found', { resource: 'table', restaurant: restaurant.name, table_id: tableId });
  return table;
}

// The pair as the restaurant declared it, so the order a set is reported in is the restaurant's
// order rather than the order a caller happened to type. t_2+t_1 and t_1+t_2 are one pair.
function declaredPair(restaurant, tableIds) {
  if (tableIds.length !== MAX_TABLES_PER_BOOKING) return null;
  const [first, second] = tableIds;
  const wanted = first < second ? `${first}\u0000${second}` : `${second}\u0000${first}`;
  for (const pair of restaurant.combinable || []) {
    const key = pair[0] < pair[1] ? `${pair[0]}\u0000${pair[1]}` : `${pair[1]}\u0000${pair[0]}`;
    if (key === wanted) return [pair[0], pair[1]];
  }
  return null;
}

// Capacity is the selected policy's, not the fixture's. Under policy 0 the two agree because
// policy 0 is derived from the fixture, and under a published policy they deliberately do not,
// which is the whole point of S3-130.
function capacityOf(selected, restaurant, tableIds) {
  return tableIds.reduce((total, id) => {
    if (policyRules.policyCapacity(selected, id) > 0) return total + policyRules.policyCapacity(selected, id);
    const table = store.findTable(restaurant, id);
    return total + (table ? table.capacity : 0);
  }, 0);
}

// One place decides whether a set of ids is a bookable choice, so create, amend, move and seed
// cannot drift apart on what they accept. Order of judgement: how many, then a repeat, then
// whether the restaurant has the tables, then whether it declared the pair, then capacity. A set
// of three is refused before any of that, since no restaurant may declare one.
function canonicalTableSet(restaurant, requested) {
  if (requested.length > MAX_TABLES_PER_BOOKING) {
    fail('combination_not_allowed', refusedSetContext(restaurant, requested));
  }
  if (new Set(requested).size !== requested.length) {
    fail('validation_failed', { field: 'table_ids', reason: 'duplicate_table' });
  }
  for (const id of requested) requireTable(restaurant, id);
  if (requested.length === MAX_TABLES_PER_BOOKING) {
    const pair = declaredPair(restaurant, requested);
    if (!pair) {
      fail('combination_not_allowed', refusedSetContext(restaurant, requested));
    }
    return pair;
  }
  return [requested[0]];
}

// table_id and table_ids both name a set, and naming it twice is a contradiction rather than a
// preference, so it is refused instead of one silently winning.
function tableSetFromRequest(body) {
  const single = optionalId(body, 'table_id');
  const many = readTableIds(body, 'table_ids');
  if (single !== undefined && many !== undefined) {
    fail('validation_failed', { field: 'table_ids', reason: 'table_id_and_table_ids' });
  }
  if (single !== undefined) return [single];
  if (many !== undefined) return many;
  return undefined;
}

function requireTableSet(body, restaurant) {
  const requested = tableSetFromRequest(body);
  if (requested === undefined) {
    fail('validation_failed', { field: 'table_ids', reason: 'missing_table' });
  }
  return canonicalTableSet(restaurant, requested);
}

// A stored booking is read from a fixture or from an export, and neither of those is a request.
// A stage 2 export carries table_ids and, for a one-table booking, table_id as well, so a document
// naming both is describing the same set twice rather than contradicting itself, and is accepted
// as long as the two agree. Two names that disagree are still a contradiction.
function resolveSeededTableIds(raw, restaurant) {
  const single = raw.table_id === undefined ? undefined : fixtureIdOf(raw.table_id, 'table_id');
  const many = raw.table_ids === undefined ? undefined : fixtureIdsOf(raw.table_ids);
  if (single !== undefined && many !== undefined && !(many.length === 1 && many[0] === single)) {
    fail('validation_failed', { field: 'table_ids', reason: 'table_id_and_table_ids' });
  }
  const requested = single !== undefined ? [single] : many;
  if (requested === undefined || requested.length === 0) {
    fail('validation_failed', { field: 'table_ids', reason: 'missing_table' });
  }
  if (requested.length > MAX_TABLES_PER_BOOKING) {
    fail('combination_not_allowed', refusedSetContext(restaurant, requested));
  }
  if (new Set(requested).size !== requested.length) {
    fail('validation_failed', { field: 'table_ids', reason: 'duplicate_table' });
  }
  for (const id of requested) {
    if (!store.findTable(restaurant, id)) fail('validation_failed', { field: 'table_id' });
  }
  if (requested.length === MAX_TABLES_PER_BOOKING) {
    const pair = declaredPair(restaurant, requested);
    if (!pair) fail('combination_not_allowed', refusedSetContext(restaurant, requested));
    return pair;
  }
  return [requested[0]];
}

function fixtureIdOf(value, field) {
  if (typeof value !== 'string') fail('malformed_request', { field });
  if (value.length === 0 || value.length > 64) fail('validation_failed', { field });
  return value;
}

function fixtureIdsOf(value) {
  if (!Array.isArray(value)) fail('malformed_request', { field: 'table_ids' });
  if (value.length === 0) fail('validation_failed', { field: 'table_ids' });
  for (const member of value) {
    if (typeof member !== 'string') fail('malformed_request', { field: 'table_ids' });
    if (member.length === 0 || member.length > 64) fail('validation_failed', { field: 'table_ids' });
  }
  return value;
}

// The cutoff is the one the diner accepted, not the one in force now. Reading the current policy
// here is exactly the failure S3-055 constructs: a booking made under a 120-minute cutoff must
// still refuse a cancellation 121 minutes out after a shorter policy has been published.
function cutoffHasPassed(reservation, nowMs) {
  const accepted = reservation.accepted_terms || {};
  const minutes = typeof accepted.cancellation_cutoff_minutes === 'number'
    ? accepted.cancellation_cutoff_minutes
    : 0;
  return nowMs >= reservation.starts_at_ms - minutes * MILLIS_PER_MINUTE;
}

function createReservation(state, user, body, nowMs, options) {
  const settings = options || {};
  const restaurantId = requireId(body, 'restaurant_id');
  const restaurant = requireRestaurant(state, restaurantId);
  const tableIds = requireTableSet(body, restaurant);
  const wall = requireStartsAtLocal(body);
  const partySize = requirePartySize(body);
  // The policy is selected once, here, from the local start date, and everything below reads it.
  // Selecting again later would mean a publication landing mid-request could change the answer.
  const selected = policyRules.policyForStart(state, restaurant, time.wallToString(wall));
  const startMs = resolveStartMs(restaurant, wall);
  requireSlotInsideOpeningHours(selected, restaurant, wall);
  const capacity = capacityOf(selected, restaurant, tableIds);
  if (partySize > capacity) {
    fail('party_exceeds_capacity', Object.assign(placeSetContext(restaurant, tableIds, wall), { capacity }));
  }
  const endMs = startMs + selected.reservation_duration_minutes * MILLIS_PER_MINUTE;
  const taken = occupiedTableId(state, restaurant.id, tableIds, startMs, endMs, settings.ignoreReference || null);
  if (taken !== null) {
    fail('table_unavailable', placeContext(restaurant, store.findTable(restaurant, taken), wall));
  }
  const reservation = {
    id: store.allocateReservationId(state),
    reference: settings.reference || store.allocateReference(state),
    user_id: settings.userId || user.id,
    restaurant_id: restaurant.id,
    table_ids: tableIds,
    party_size: partySize,
    status: 'confirmed',
    starts_at_local: time.wallToString(wall),
    starts_at_ms: startMs,
    ends_at_ms: endMs,
    created_at: time.createdAt || time.formatUtc(nowMs),
    // Stage 3 fields. revision starts at 1 and accepted_terms is the snapshot taken now, so a later
    // publication cannot reach back and change what this booking agreed to.
    revision: 1,
    accepted_terms: policyRules.acceptedTermsOf(selected),
    series_id: settings.seriesId === undefined ? null : settings.seriesId,
    series_index: settings.seriesIndex === undefined ? null : settings.seriesIndex,
  };
  state.reservations.push(reservation);
  if (settings.recordHistory !== false) {
    history.append(state, reservation, 'created', history.creationChanges(reservation), nowMs);
  }
  return reservation;
}

function planAmendment(state, reservation, restaurant, changes) {
  const wall = changes.starts_at_local === undefined
    ? time.parseWall(reservation.starts_at_local)
    : changes.starts_at_local;
  const tableIds = changes.table_ids === undefined ? tableIdsOf(reservation) : changes.table_ids;
  const partySize = changes.party_size === undefined ? reservation.party_size : changes.party_size;
  const startsAtLocal = time.wallToString(wall);
  // The resulting date's policy, which is not necessarily the one the booking was accepted under.
  // S3-056 and S3-057 depend on this: an amendment across a boundary re-adopts terms and recomputes
  // the end time from the policy that now governs the new date.
  const selected = policyRules.policyForStart(state, restaurant, startsAtLocal);
  const startMs = resolveStartMs(restaurant, wall);
  requireSlotInsideOpeningHours(selected, restaurant, wall);
  const capacity = capacityOf(selected, restaurant, tableIds);
  if (partySize > capacity) {
    fail('party_exceeds_capacity', Object.assign(placeSetContext(restaurant, tableIds, wall), { capacity }));
  }
  return {
    restaurant_id: restaurant.id,
    table_ids: tableIds,
    party_size: partySize,
    starts_at_local: startsAtLocal,
    starts_at_ms: startMs,
    ends_at_ms: startMs + selected.reservation_duration_minutes * MILLIS_PER_MINUTE,
    accepted_terms: policyRules.acceptedTermsOf(selected),
  };
}

function applyPlan(reservation, plan) {
  reservation.table_ids = plan.table_ids;
  reservation.party_size = plan.party_size;
  reservation.starts_at_local = plan.starts_at_local;
  reservation.starts_at_ms = plan.starts_at_ms;
  reservation.ends_at_ms = plan.ends_at_ms;
  reservation.accepted_terms = plan.accepted_terms;
  return reservation;
}

function expectedRevision(body) {
  if (!has(body, 'expected_revision')) return undefined;
  const value = body.expected_revision;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    fail('validation_failed', { field: 'expected_revision' });
  }
  return value;
}

// The stale check runs before the cutoff and before validation, because that is what "before" in
// S3-061 means. Constructing a case where both would fire is the only way the order is observable,
// and the row asks for exactly that.
function checkExpectedRevision(reservation, body) {
  const wanted = expectedRevision(body);
  if (wanted === undefined) return;
  if (wanted !== reservation.revision) {
    fail('stale_revision', { reference: reservation.reference, revision: reservation.revision });
  }
}

function amendReservation(state, reservation, body, nowMs) {
  const restaurant = requireRestaurant(state, reservation.restaurant_id);
  checkExpectedRevision(reservation, body);
  if (reservation.status === 'cancelled') fail('reservation_cancelled', { reference: reservation.reference });
  if (cutoffHasPassed(reservation, nowMs)) {
    fail('cutoff_passed', reservationContext(restaurant, reservation));
  }
  const before = {
    table_ids: tableIdsOf(reservation).slice(),
    party_size: reservation.party_size,
    starts_at_local: reservation.starts_at_local,
  };
  const changes = {
    table_ids: amendmentsForTable(state, restaurant, body, reservation),
    starts_at_local: optionalStartsAtLocal(body),
    party_size: optionalPartySize(body),
  };
  const plan = planAmendment(state, reservation, restaurant, changes);
  const taken = occupiedTableId(state, restaurant.id, plan.table_ids, plan.starts_at_ms, plan.ends_at_ms, reservation.reference);
  if (taken !== null) {
    const target = store.findTable(restaurant, taken);
    fail('table_unavailable', placeContext(restaurant, target, time.parseWall(plan.starts_at_local)));
  }
  // A no-op is detected before anything is written, so it cannot consume a revision or a seq. This
  // is what S3-058 and S3-076 ask for and why the comparison is against the snapshot rather than
  // against the patch: a patch naming a field with its current value is not a change.
  const sameSet = before.table_ids.length === plan.table_ids.length
    && before.table_ids.every((id, index) => id === plan.table_ids[index]);
  const isNoOp = sameSet
    && before.party_size === plan.party_size
    && before.starts_at_local === plan.starts_at_local;
  if (isNoOp) return reservation;
  applyPlan(reservation, plan);
  reservation.revision += 1;
  history.append(state, reservation, 'changed', history.amendmentChanges(before, reservation), nowMs);
  // A real amendment of a series occurrence is a permanent exception and moves the series revision
  // once. A no-op returned above, and a failure threw, so neither can reach this line — which is the
  // negative half of S3-114 that a flag set before validation would get wrong.
  // Required lazily: series requires this module, so a top-level import would be a cycle. The
  // lookup happens on a path that only runs for a series occurrence, so the cost is paid only there.
  const series = require('./series');
  if (series.markException(state, reservation)) series.bumpSeriesRevision(state, reservation.series_id);
  return reservation;
}

// An amendment that does not mention tables keeps the ones it has; one that does is judged by the
// same rules as a create, so a booking can become a pair and a pair can become a single table.
function amendmentsForTable(state, restaurant, body, reservation) {
  const requested = tableSetFromRequest(body);
  if (requested === undefined) return undefined;
  return canonicalTableSet(restaurant, requested);
}

// A repeated cancel changes nothing: no second revision and no second history entry, which is the
// half of S3-060 that a plain status write gets wrong.
function cancelReservation(state, reservation, nowMs) {
  if (reservation.status === 'cancelled') return reservation;
  const restaurant = requireRestaurant(state, reservation.restaurant_id);
  if (cutoffHasPassed(reservation, nowMs)) {
    fail('cutoff_passed', reservationContext(restaurant, reservation));
  }
  reservation.status = 'cancelled';
  reservation.revision += 1;
  // changes is present and empty rather than absent, so a reader can tell a cancellation from an
  // entry that forgot to record what it changed (S3-077).
  history.append(state, reservation, 'cancelled', [], nowMs);
  return reservation;
}

function availabilityFor(state, restaurant, date, partySize, options) {
  const settings = options || {};
  const slots = [];
  const dateString = time.dateToString(date);
  // Availability is decided under the policy in force on the date being searched, so a search for a
  // future date sees that date's rules rather than today's.
  const selected = policyRules.policyForDate(state, restaurant, dateString);
  const day = dayOpeningHours(selected, restaurant, { y: date.y, mo: date.mo, d: date.d, h: 0, mi: 0 });
  const step = selected.slot_minutes;
  const duration = selected.reservation_duration_minutes;
  const hasHours = Boolean(day) && day.opens !== null && day.closes !== null;
  if (hasHours && step > 0) {
    for (let minutes = day.opens; minutes + duration <= day.closes; minutes += step) {
      const wall = time.wallFromMinutes(date.y, date.mo, date.d, minutes);
      const instants = time.wallToInstants(restaurant.timezone, wall.y, wall.mo, wall.d, wall.h, wall.mi);
      if (instants.length === 0) continue;
      const startMs = instants[0];
      const endMs = startMs + duration * MILLIS_PER_MINUTE;
      const available = [];
      for (const table of restaurant.tables) {
        const capacity = policyRules.policyCapacity(selected, table.id);
        if (capacity >= partySize && !isOccupied(state, restaurant.id, [table.id], startMs, endMs, null)) {
          available.push(table.id);
        }
      }
      // available_table_ids stays singles-only and in the restaurant's own table order. It is
      // computed here exactly as stage 2 computed it, so S3-002's byte-identical assertion holds
      // whether or not explain was requested.
      const options_ = [];
      for (const table of restaurant.tables) {
        const capacity = policyRules.policyCapacity(selected, table.id);
        if (capacity >= partySize && !isOccupied(state, restaurant.id, [table.id], startMs, endMs, null)) {
          options_.push({ table_ids: [table.id], capacity });
        }
      }
      for (const pair of restaurant.combinable || []) {
        const capacity = policyRules.capacityUnder(selected, pair);
        if (capacity < partySize) continue;
        if (isOccupied(state, restaurant.id, pair, startMs, endMs, null)) continue;
        options_.push({ table_ids: [pair[0], pair[1]], capacity });
      }
      const slot = {
        starts_at_local: time.wallToString(wall),
        starts_at: time.formatInZone(restaurant.timezone, startMs),
        available_table_ids: available,
        available_options: options_,
      };
      // explain is omitted entirely unless asked for. A response that always carried it would pass
      // every other row in this group and fail S3-002, which is why the key is added conditionally
      // rather than being written and then deleted.
      if (settings.explain) {
        const tables = explainRules.explainForSlot(state, restaurant, selected, partySize, startMs, endMs);
        const pairs = [];
        for (const pair of restaurant.combinable || []) {
          pairs.push(explainRules.explainForPair(state, restaurant, selected, pair, partySize, startMs, endMs));
        }
        slot.explain = tables.concat(pairs);
      }
      slots.push(slot);
    }
  }
  const body = {
    restaurant_id: restaurant.id,
    date: dateString,
    timezone: restaurant.timezone,
    slots,
  };
  // day_state is added under the same condition as slot.explain and for the same reason: the plain
  // response's key set is asserted by rows that already exist, and a discriminator is an explanation.
  // The cost is real and is written in the row: a client that does not pass explain=true cannot read
  // the day state at all.
  //
  // It is computed here from two independent questions rather than from `slots.length`, because the
  // three states it names include two that both present as slots: []. An implementation that answered
  // `shut` whenever slots came back empty would be green on presence and on distinguishability while
  // being wrong about half of them, so the branch order below is the requirement:
  //
  //   1. The terms in force for this date carry no hours for this weekday. Read from `day`, which comes
  //      from the selected policy and is computed before the slot loop runs, so it cannot be a restatement
  //      of the loop's output.
  //   2. The terms carry hours, and the slot arithmetic under them yields nothing at all -- a window
  //      shorter than one reservation. This is the case a shut day and an excluded day look identical for,
  //      and it is the reason this field exists.
  //   3. Slots exist and every one of them has nothing free, counting pairs, because a pair can be free
  //      when neither member is.
  //   4. Otherwise some slot has something free.
  if (settings.explain) {
    const somethingFree = slots.some(
      (slot) => slot.available_table_ids.length > 0 || slot.available_options.length > 0,
    );
    body.day_state = !hasHours
      ? 'shut'
      : slots.length === 0
        ? 'terms_exclude_all'
        : somethingFree ? 'open' : 'nothing_free';
  }
  return body;
}

module.exports = {
  MILLIS_PER_MINUTE,
  MAX_TABLES_PER_BOOKING,
  tableIdsOf,
  tableLabel,
  declaredPair,
  capacityOf,
  canonicalTableSet,
  tableSetFromRequest,
  requireTableSet,
  resolveSeededTableIds,
  occupiedTableId,
  placeSetContext,
  refusedSetContext,
  dayOpeningHours,
  policyForStart: policyRules.policyForStart,
  resolveStartMs,
  requireSlotInsideOpeningHours,
  isOccupied,
  requireRestaurant,
  requireTable,
  reservationContext,
  cutoffHasPassed,
  createReservation,
  planAmendment,
  applyPlan,
  amendReservation,
  cancelReservation,
  availabilityFor,
  expectedRevision,
  checkExpectedRevision,
};