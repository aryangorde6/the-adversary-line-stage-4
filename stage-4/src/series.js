'use strict';

// A series adopts an existing booking as occurrence zero and generates the rest. Two decisions
// shape it.
//
// Occurrence zero is not re-created. The anchor keeps its reference, its identity, its revision, its
// terms, its history, its timestamps and its original idempotent replay, because the specification
// says the adoption adopts it rather than supersedes it (S3-100, S3-105). Everything generated is an
// ordinary reservation, which is why occurrences appear in `GET /reservations`, occupy tables and
// have ordinary histories (S3-112).
//
// Adoption is all or nothing. The generated occurrences are booked against a snapshot of the store
// and only committed once every one of them has succeeded, because the specification requires that
// no reservation, history, counter or idempotency claim survives a failure (S3-109). Working on a
// copy and swapping it in is what makes that true rather than hopeful; the alternative, undoing
// writes one by one, is where a half-rolled-back transaction gives itself away.

const { fail } = require('./errors');
const time = require('./time');
const store = require('./state');
const domain = require('./domain');
const policy = require('./policy');
const { has } = require('./fields');

const MIN_COUNT = 2;
const MAX_COUNT = 12;
const MIN_INTERVAL_WEEKS = 1;
const MAX_INTERVAL_WEEKS = 4;

function requireCount(body) {
  if (!has(body, 'count')) fail('validation_failed', { field: 'count' });
  const value = body.count;
  if (typeof value !== 'number' || !Number.isInteger(value)) fail('validation_failed', { field: 'count' });
  if (value < MIN_COUNT || value > MAX_COUNT) fail('validation_failed', { field: 'count' });
  return value;
}

function requireIntervalWeeks(body) {
  if (!has(body, 'interval_weeks')) fail('validation_failed', { field: 'interval_weeks' });
  const value = body.interval_weeks;
  if (typeof value !== 'number' || !Number.isInteger(value)) fail('validation_failed', { field: 'interval_weeks' });
  if (value < MIN_INTERVAL_WEEKS || value > MAX_INTERVAL_WEEKS) fail('validation_failed', { field: 'interval_weeks' });
  return value;
}

// Occurrence i starts on the anchor's local calendar date plus i * interval_weeks * 7 days, at the
// same local clock time. The arithmetic is done on the local date and never on an instant, because
// a booking whose UTC date is the previous day must still land on the intended local day.
function addLocalDays(startsAtLocal, days) {
  const wall = time.parseWall(startsAtLocal);
  const base = Date.UTC(wall.y, wall.mo - 1, wall.d) + days * 24 * 60 * 60 * 1000;
  const moved = new Date(base);
  return `${moved.getUTCFullYear()}-${String(moved.getUTCMonth() + 1).padStart(2, '0')}-${String(moved.getUTCDate()).padStart(2, '0')}T${String(wall.h).padStart(2, '0')}:${String(wall.mi).padStart(2, '0')}`;
}

function requireAnchor(state, user, body) {
  if (!has(body, 'anchor_reference')) fail('validation_failed', { field: 'anchor_reference' });
  const reference = body.anchor_reference;
  if (typeof reference !== 'string') fail('malformed_request', { field: 'anchor_reference' });
  // Unknown and another owner's are the same 404, so adoption cannot be used to discover that a
  // reference exists (S3-102).
  const anchor = store.findOwnReservation(state, user.id, reference);
  if (!anchor) fail('not_found', { resource: 'reservation', reference });
  return anchor;
}

function alreadyAdopted(state, anchor) {
  const existing = state.series.find((entry) => entry.anchor_reference === anchor.reference);
  if (existing) fail('already_in_series', { series_id: existing.series_id });
  return existing;
}

function allocateSeriesId(state) {
  let id = store.randomId ? store.randomId('ser_') : `ser_${state.series.length + 1}`;
  while (state.series.some((entry) => entry.series_id === id)) {
    id = store.randomId ? store.randomId('ser_') : `${id}_`;
  }
  return id;
}

// The batch counter S3-118 and S3-139 name. One counter per restaurant, moved by exactly one per
// operation, which is the only reading under which "increments once for the whole operation" is
// checkable from outside.
function moveRestaurantBatchCounter(state, restaurantId) {
  const current = state.batch_counters[restaurantId] || 0;
  state.batch_counters[restaurantId] = current + 1;
  return state.batch_counters[restaurantId];
}

function adopt(state, user, body, nowMs) {
  const anchor = requireAnchor(state, user, body);
  const count = requireCount(body);
  const intervalWeeks = requireIntervalWeeks(body);

  if (anchor.status === 'cancelled') {
    fail('reservation_cancelled', { reference: anchor.reference });
  }
  const restaurant = domain.requireRestaurant(state, anchor.restaurant_id);
  // The anchor's own accepted cutoff, checked against the current time. This is a separate refusal
  // from adoption itself and fails independently (S3-101).
  if (domain.cutoffHasPassed(anchor, nowMs)) {
    fail('cutoff_passed', domain.reservationContext(restaurant, anchor));
  }
  alreadyAdopted(state, anchor);

  // Everything generated is booked on a copy. A failure inside the loop therefore leaves the real
  // store untouched, which is what S3-109 asks for, rather than relying on an undo path.
  // The draft carries everything a booking reads: the restaurants it resolves against, the
  // policies it selects from, the reservations it checks occupancy against, and the history it
  // appends to. A copy missing any of those would not fail loudly, it would fail as a missing
  // lookup, which is how the first version of this went wrong.
  const draft = JSON.parse(JSON.stringify({
    restaurants: state.restaurants,
    reservations: state.reservations,
    policies: state.policies,
    history: state.history,
  }));

  const generated = [];
  for (let index = 1; index < count; index += 1) {
    const days = index * intervalWeeks * 7;
    const startsAtLocal = addLocalDays(anchor.starts_at_local, days);
    const created = domain.createReservation(draft, user, {
      restaurant_id: anchor.restaurant_id,
      table_id: anchor.table_ids[0],
      starts_at_local: startsAtLocal,
      party_size: anchor.party_size,
    }, nowMs, { recordHistory: true });
    generated.push(created);
  }

  const seriesId = allocateSeriesId(state);
  const entries = [anchor].concat(generated);
  entries.forEach((reservation, index) => {
    reservation.series_id = seriesId;
    reservation.series_index = index;
  });
  const seriesRecord = {
    series_id: seriesId,
    user_id: user.id,
    restaurant_id: anchor.restaurant_id,
    anchor_reference: anchor.reference,
    count,
    interval_weeks: intervalWeeks,
    revision: 1,
    // index is the occurrence's position and never changes, even if the occurrence's date or table
    // is later amended: S3-111 asserts a stable reference per index across an amendment.
    occurrences: entries.map((reservation, index) => ({
      index,
      reference: reservation.reference,
      exception: false,
    })),
    created_at: time.formatUtc(nowMs),
  };
  // Commit: the draft's new reservations and their history become real, then the series exists.
  for (const reservation of generated) state.reservations.push(reservation);
  for (const entry of draft.history) {
    if (entry.reference === anchor.reference) continue;
    state.history.push(entry);
  }
  state.series.push(seriesRecord);
  moveRestaurantBatchCounter(state, anchor.restaurant_id);
  return seriesRecord;
}

function findSeries(state, seriesId) {
  return state.series.find((entry) => entry.series_id === seriesId) || null;
}

function requireOwnSeries(state, user, seriesId) {
  const found = findSeries(state, seriesId);
  if (!found || !user || found.user_id !== user.id) fail('not_found', { resource: 'series', series_id: seriesId });
  return found;
}

// The shape reports current reservation states, not adoption-time states: a cancelled occurrence is
// still in the array with its current status (S3-113, S3-115).
// The occurrence carries its own reference beside index and exception, and it is the same value as
// the nested reservation's. It was stored on the record all along and simply was not copied into the
// view, so a client reading the shape the specification shows found the information one level down
// instead of where it was told to look — a value in the wrong place rather than a wrong value. The
// reference is emitted from the record, not read back off the reservation, so it still names the
// occurrence if the reservation is ever absent.
function seriesView(state, seriesRecord) {
  const occurrences = seriesRecord.occurrences.map((entry) => {
    const reservation = store.findReservation(state, entry.reference);
    return {
      index: entry.index,
      reference: entry.reference,
      exception: entry.exception,
      reservation: reservation ? store.reservationView(state, reservation) : null,
    };
  });
  return {
    series_id: seriesRecord.series_id,
    restaurant_id: seriesRecord.restaurant_id,
    anchor_reference: seriesRecord.anchor_reference,
    count: seriesRecord.count,
    interval_weeks: seriesRecord.interval_weeks,
    revision: seriesRecord.revision,
    created_at: seriesRecord.created_at,
    occurrences,
  };
}

// Marks the occurrence permanently and reports whether this call was the one that set the flag.
// The caller decides how the series revision moves: a single amendment moves it once, and a batch
// moving two occurrences of one series moves it once for the batch rather than twice (S3-140). That
// is why this returns a boolean instead of touching the revision itself.
function markException(state, reservation) {
  if (!reservation.series_id) return false;
  const found = findSeries(state, reservation.series_id);
  if (!found) return false;
  const entry = found.occurrences.find((candidate) => candidate.reference === reservation.reference);
  // Permanently: once a diner has really amended an occurrence it stays an exception even after a
  // later amendment (S3-114). Cancelling is not an amendment and never sets this.
  if (!entry || entry.exception) return false;
  entry.exception = true;
  return true;
}

// The clock time of a series: the time of day every occurrence is laid out on. The dates are derived
// from the anchor and the interval and are NOT the caller's to state, because a series whose dates
// could be moved piecemeal is a list of bookings rather than a series.
//
// Changing the clock time moves every occurrence that is not an exception, re-adopting the terms of the
// date each occurrence lands on -- the same re-adoption a single amendment does, because an occurrence
// that lands on a different date is a booking under different rules (S3-056, S3-057).
//
// The revision moves ONCE for the amendment however many occurrences moved. A no-op amendment, where
// the new clock time is the one already in force, moves nothing and moves the revision zero times: the
// caller asked for no change and got none, which is the only honest reading of a revision.
// POST /series/{id}/amend, built to tablekeeper/spec/stage-4.md.
//
// The caller names WHICH occurrence moves (from_index), only the TIME OF DAY (local_time, exactly HH:MM),
// and the revision they believe the series is at. Everything else is derived: each eligible occurrence keeps
// its own reference, owner, party size and current table selection, and moves on its ORIGINAL SCHEDULED
// local date -- not on whatever date it currently sits, because a seating repair may have moved an
// occurrence and a series amendment is not a second repair.
//
// The revision precondition is checked BEFORE any occurrence is validated. That order is the
// specification's and it is observable: a body that is both stale and out-of-range must answer stale, or a
// caller cannot tell "the world moved" from "you sent nonsense".
//
// A no-op -- local_time already in force, or no eligible occurrence -- SUCCEEDS and changes no revision.
// Refusing it would be refusing a true statement, and the same rule already governs a no-op patch on a
// single booking. A reader who assumes refusal is the stricter and safer choice would get this backwards.
function requirePositiveInteger(value, field) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    fail('validation_failed', { field });
  }
  return value;
}

function readLocalTime(value) {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) {
    fail('validation_failed', { field: 'local_time' });
  }
  const hours = Number(value.slice(0, 2));
  const minutes = Number(value.slice(3, 5));
  if (hours > 23 || minutes > 59) fail('validation_failed', { field: 'local_time' });
  return hours * 60 + minutes;
}

function amendClockTime(state, seriesRecord, body, nowMs) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    fail('malformed_request', { field: 'body' });
  }
  const wantedRevision = requirePositiveInteger(body.expected_revision, 'expected_revision');
  // Unknown fields are ignored, so a caller may send fields this service does not implement.
  if (!Number.isInteger(body.from_index) || body.from_index < 0 || body.from_index >= seriesRecord.count) {
    fail('validation_failed', { field: 'from_index' });
  }
  const fromIndex = body.from_index;
  const minutes = readLocalTime(body.local_time);

  // Stale before anything else, as the specification orders it.
  if (wantedRevision !== seriesRecord.revision) {
    fail('stale_revision', { series_id: seriesRecord.series_id, revision: seriesRecord.revision });
  }

  const anchor = store.findReservation(state, seriesRecord.anchor_reference);
  if (!anchor) fail('not_found', { resource: 'reservation', reference: seriesRecord.anchor_reference });
  const anchorWall = time.parseWall(anchor.starts_at_local);

  const eligible = seriesRecord.occurrences.filter((entry) => (
    entry.index >= fromIndex && !entry.exception
  ));

  // Every change is computed and checked BEFORE anything is written, so a conflict at index 3 leaves
  // indices 0 to 2 untouched. Non-occupancy failures take precedence in occurrence-index order, and an
  // occupancy conflict answers table_unavailable -- so the two passes are ordered, not interleaved.
  const prepared = [];
  for (const entry of eligible) {
    const reservation = store.findReservation(state, entry.reference);
    if (!reservation || reservation.status !== 'confirmed') continue;
    // The ORIGINAL SCHEDULED date, from the anchor and the interval, not the reservation's current date.
    const days = entry.index * seriesRecord.interval_weeks * 7;
    const scheduledDate = addLocalDays(anchor.starts_at_local, days).slice(0, 10);
    const parts = scheduledDate.split('-').map(Number);
    const wall = time.wallFromMinutes(parts[0], parts[1], parts[2], minutes);
    const next = time.wallToString(wall);
    // Identical resulting fields is a no-op and retains its terms -- checked here so a no-op is never
    // written and never consumes a cutoff.
    const unchanged = next === reservation.starts_at_local;
    prepared.push({ entry, reservation, next, unchanged });
  }

  for (const step of prepared) {
    if (step.unchanged) continue;
    const wall = time.parseWall(step.reservation.starts_at_local);
    const startMs = domain.resolveStartMs(requireRestaurantSafe(state, step.reservation), wall);
    const selected = policy.policyForStart(state, requireRestaurantSafe(state, step.reservation), step.next);
    const endMs = startMs + selected.reservation_duration_minutes * domain.MILLIS_PER_MINUTE;
    if (domain.occupiedTableId(
      state,
      step.reservation.restaurant_id,
      step.reservation.table_ids || [],
      startMs,
      endMs,
      step.reservation.reference,
    ) !== null) {
      fail('table_unavailable', { reference: step.reservation.reference });
    }
    if (store.isTableClosed(
      state,
      step.reservation.restaurant_id,
      (step.reservation.table_ids || [])[0],
      startMs,
      endMs,
    )) {
      fail('table_unavailable', { reference: step.reservation.reference });
    }
  }

  let changed = 0;
  for (const step of prepared) {
    if (step.unchanged) continue;
    domain.amendReservation(state, step.reservation, { starts_at_local: step.next }, nowMs,
      { seriesTravel: false });
    changed += 1;
  }

  // Once for the whole operation, and only if something really changed. Series amendments do not mark
  // exceptions: the occurrences moved together, and none of them diverged from the series.
  if (changed > 0) {
    seriesRecord.revision += 1;
    const restaurantId = seriesRecord.restaurant_id;
    store.bumpRestaurantRevision(state, restaurantId);
  }
  return seriesView(state, seriesRecord);
}

function requireRestaurantSafe(state, reservation) {
  return store.findRestaurant(state, reservation.restaurant_id);
}

function bumpSeriesRevision(state, seriesId) {
  const found = findSeries(state, seriesId);
  if (found) found.revision += 1;
  return found;
}

function moveSeriesRevision(state, reservation) {
  if (!reservation.series_id) return;
  const found = findSeries(state, reservation.series_id);
  if (found) found.revision += 1;
}

module.exports = {
  bumpSeriesRevision,
  MIN_COUNT,
  MAX_COUNT,
  MIN_INTERVAL_WEEKS,
  MAX_INTERVAL_WEEKS,
  addLocalDays,
  allocateSeriesId,
  moveRestaurantBatchCounter,
  adopt,
  amendClockTime,
  findSeries,
  requireOwnSeries,
  seriesView,
  markException,
  moveSeriesRevision,
};