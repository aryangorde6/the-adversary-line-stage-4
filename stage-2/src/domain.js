'use strict';

const { fail } = require('./errors');
const time = require('./time');
const store = require('./state');
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

function dayOpeningHours(restaurant, wall) {
  const name = time.WEEKDAY_NAMES[time.weekdayOf(wall.y, wall.mo, wall.d)];
  const entry = restaurant.opening_hours.find((day) => day.weekday === name);
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
// the context names every member of the set rather than only the first.
function placeSetContext(restaurant, tableIds, wall) {
  const tables = tableIds.map((id) => store.findTable(restaurant, id)).filter(Boolean);
  const context = placeContext(restaurant, tables.length > 0 ? tables[0] : null, wall);
  if (tables.length > 1) context.tables = tables.map(tableLabel).join(' and ');
  return context;
}

function reservationContext(restaurant, reservation) {
  const context = placeSetContext(restaurant, tableIdsOf(reservation), time.parseWall(reservation.starts_at_local));
  context.reference = reservation.reference;
  context.cutoff_minutes = restaurant.cancellation_cutoff_minutes;
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

function requireSlotInsideOpeningHours(restaurant, wall) {
  const day = dayOpeningHours(restaurant, wall);
  if (!day || day.opens === null || day.closes === null) {
    fail('outside_opening_hours', hoursContext(restaurant, wall, null));
  }
  const minutesOfDay = wall.h * 60 + wall.mi;
  const step = restaurant.slot_minutes;
  const offset = minutesOfDay - day.opens;
  if (offset < 0) {
    fail('outside_opening_hours', hoursContext(restaurant, wall, day));
  }
  if (step <= 0 || offset % step !== 0) {
    const context = hoursContext(restaurant, wall, day);
    context.slot_minutes = step;
    fail('not_on_slot_grid', context);
  }
  if (minutesOfDay + restaurant.reservation_duration_minutes > day.closes) {
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

function capacityOf(restaurant, tableIds) {
  return tableIds.reduce((total, id) => {
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
    fail('combination_not_allowed', { restaurant: restaurant.name, table_ids: requested });
  }
  if (new Set(requested).size !== requested.length) {
    fail('validation_failed', { field: 'table_ids', reason: 'duplicate_table' });
  }
  for (const id of requested) requireTable(restaurant, id);
  if (requested.length === MAX_TABLES_PER_BOOKING) {
    const pair = declaredPair(restaurant, requested);
    if (!pair) {
      fail('combination_not_allowed', {
        restaurant: restaurant.name,
        table_ids: requested.slice().sort(),
      });
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
    fail('combination_not_allowed', { restaurant: restaurant.name, table_ids: requested });
  }
  if (new Set(requested).size !== requested.length) {
    fail('validation_failed', { field: 'table_ids', reason: 'duplicate_table' });
  }
  for (const id of requested) {
    if (!store.findTable(restaurant, id)) fail('validation_failed', { field: 'table_id' });
  }
  if (requested.length === MAX_TABLES_PER_BOOKING) {
    const pair = declaredPair(restaurant, requested);
    if (!pair) fail('combination_not_allowed', { restaurant: restaurant.name, table_ids: requested.slice().sort() });
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

function cutoffHasPassed(restaurant, reservation, nowMs) {
  const cutoff = restaurant.cancellation_cutoff_minutes * MILLIS_PER_MINUTE;
  return nowMs >= reservation.starts_at_ms - cutoff;
}

function createReservation(state, user, body, nowMs) {
  const restaurantId = requireId(body, 'restaurant_id');
  const restaurant = requireRestaurant(state, restaurantId);
  const tableIds = requireTableSet(body, restaurant);
  const wall = requireStartsAtLocal(body);
  const partySize = requirePartySize(body);
  const startMs = resolveStartMs(restaurant, wall);
  requireSlotInsideOpeningHours(restaurant, wall);
  const capacity = capacityOf(restaurant, tableIds);
  if (partySize > capacity) {
    fail('party_exceeds_capacity', Object.assign(placeSetContext(restaurant, tableIds, wall), { capacity }));
  }
  const endMs = startMs + restaurant.reservation_duration_minutes * MILLIS_PER_MINUTE;
  const taken = occupiedTableId(state, restaurant.id, tableIds, startMs, endMs, null);
  if (taken !== null) {
    fail('table_unavailable', placeContext(restaurant, store.findTable(restaurant, taken), wall));
  }
  const reservation = {
    id: store.allocateReservationId(state),
    reference: store.allocateReference(state),
    user_id: user.id,
    restaurant_id: restaurant.id,
    table_ids: tableIds,
    party_size: partySize,
    status: 'confirmed',
    starts_at_local: time.wallToString(wall),
    starts_at_ms: startMs,
    ends_at_ms: endMs,
    created_at: time.formatUtc(nowMs),
  };
  state.reservations.push(reservation);
  return reservation;
}

function planAmendment(state, reservation, restaurant, changes) {
  const wall = changes.starts_at_local === undefined
    ? time.parseWall(reservation.starts_at_local)
    : changes.starts_at_local;
  const tableIds = changes.table_ids === undefined ? tableIdsOf(reservation) : changes.table_ids;
  const partySize = changes.party_size === undefined ? reservation.party_size : changes.party_size;
  const startMs = resolveStartMs(restaurant, wall);
  requireSlotInsideOpeningHours(restaurant, wall);
  const capacity = capacityOf(restaurant, tableIds);
  if (partySize > capacity) {
    fail('party_exceeds_capacity', Object.assign(placeSetContext(restaurant, tableIds, wall), { capacity }));
  }
  return {
    restaurant_id: restaurant.id,
    table_ids: tableIds,
    party_size: partySize,
    starts_at_local: time.wallToString(wall),
    starts_at_ms: startMs,
    ends_at_ms: startMs + restaurant.reservation_duration_minutes * MILLIS_PER_MINUTE,
  };
}

function applyPlan(reservation, plan) {
  reservation.table_ids = plan.table_ids;
  reservation.party_size = plan.party_size;
  reservation.starts_at_local = plan.starts_at_local;
  reservation.starts_at_ms = plan.starts_at_ms;
  reservation.ends_at_ms = plan.ends_at_ms;
  return reservation;
}

function amendReservation(state, reservation, body, nowMs) {
  const restaurant = requireRestaurant(state, reservation.restaurant_id);
  if (cutoffHasPassed(restaurant, reservation, nowMs)) {
    fail('cutoff_passed', reservationContext(restaurant, reservation));
  }
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
  return applyPlan(reservation, plan);
}

// An amendment that does not mention tables keeps the ones it has; one that does is judged by the
// same rules as a create, so a booking can become a pair and a pair can become a single table.
function amendmentsForTable(state, restaurant, body, reservation) {
  const requested = tableSetFromRequest(body);
  if (requested === undefined) return undefined;
  return canonicalTableSet(restaurant, requested);
}

function cancelReservation(state, reservation, nowMs) {
  if (reservation.status === 'cancelled') return reservation;
  const restaurant = requireRestaurant(state, reservation.restaurant_id);
  if (cutoffHasPassed(restaurant, reservation, nowMs)) {
    fail('cutoff_passed', reservationContext(restaurant, reservation));
  }
  reservation.status = 'cancelled';
  return reservation;
}

function availabilityFor(state, restaurant, date, partySize) {
  const slots = [];
  const day = dayOpeningHours(restaurant, { y: date.y, mo: date.mo, d: date.d, h: 0, mi: 0 });
  const step = restaurant.slot_minutes;
  const duration = restaurant.reservation_duration_minutes;
  if (day && day.opens !== null && day.closes !== null && step > 0) {
    for (let minutes = day.opens; minutes + duration <= day.closes; minutes += step) {
      const wall = time.wallFromMinutes(date.y, date.mo, date.d, minutes);
      const instants = time.wallToInstants(restaurant.timezone, wall.y, wall.mo, wall.d, wall.h, wall.mi);
      if (instants.length === 0) continue;
      const startMs = instants[0];
      const endMs = startMs + duration * MILLIS_PER_MINUTE;
      const available = [];
      for (const table of restaurant.tables) {
        if (table.capacity >= partySize && !isOccupied(state, restaurant.id, [table.id], startMs, endMs, null)) {
          available.push(table.id);
        }
      }
      // available_table_ids stays singles-only and exactly as it was. available_options is the
      // wider answer: singles in the restaurant's own table order, then the declared pairs in the
      // order the restaurant declared them, each option offered only if every table it needs is
      // free for the whole interval and its summed capacity covers the party.
      const options = [];
      for (const table of restaurant.tables) {
        if (table.capacity >= partySize && !isOccupied(state, restaurant.id, [table.id], startMs, endMs, null)) {
          options.push({ table_ids: [table.id], capacity: table.capacity });
        }
      }
      for (const pair of restaurant.combinable || []) {
        const capacity = capacityOf(restaurant, pair);
        if (capacity < partySize) continue;
        if (isOccupied(state, restaurant.id, pair, startMs, endMs, null)) continue;
        options.push({ table_ids: [pair[0], pair[1]], capacity });
      }
      slots.push({
        starts_at_local: time.wallToString(wall),
        starts_at: time.formatInZone(restaurant.timezone, startMs),
        available_table_ids: available,
        available_options: options,
      });
    }
  }
  return {
    restaurant_id: restaurant.id,
    date: time.dateToString(date),
    timezone: restaurant.timezone,
    slots,
  };
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
  dayOpeningHours,
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
};