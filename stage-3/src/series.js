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
function seriesView(state, seriesRecord) {
  const occurrences = seriesRecord.occurrences.map((entry) => {
    const reservation = store.findReservation(state, entry.reference);
    return {
      index: entry.index,
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
  findSeries,
  requireOwnSeries,
  seriesView,
  markException,
  moveSeriesRevision,
};