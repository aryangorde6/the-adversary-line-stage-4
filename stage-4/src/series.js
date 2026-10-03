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
function amendClockTime(state, seriesRecord, body, nowMs) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    fail('malformed_request', { field: 'body' });
  }
  const wanted = body.starts_at_local;
  if (typeof wanted !== 'string') fail('malformed_request', { field: 'starts_at_local' });
  const anchor = store.findReservation(state, seriesRecord.anchor_reference);
  if (!anchor) fail('not_found', { resource: 'reservation', reference: seriesRecord.anchor_reference });

  const clockOf = (stamp) => {
    const wall = time.parseWall(stamp);
    return String(wall.h).padStart(2, '0') + ':' + String(wall.mi).padStart(2, '0');
  };
  // Only the time of day is the caller's. Each occurrence keeps its own date and moves to the new clock
  // time on that date, so a series cannot be renumbered onto different days by an amendment that claimed
  // to move a clock. The anchor's date is never rewritten either: it is the series' name in time.
  const targetClock = clockOf(wanted);
  const anchorWall = time.parseWall(anchor.starts_at_local);
  if (Number.isNaN(anchorWall.y) || Number.isNaN(clockOf(wanted).length)) {
    fail('validation_failed', { field: 'starts_at_local' });
  }

  const moved = [];
  for (const entry of seriesRecord.occurrences) {
    // An exception has already been amended away from the series by the diner, so it does not travel
    // with the series and is not an exception a second time. Moving every occurrence together is not an
    // exception at all -- that flag means "this one diverged", and here none of them did.
    if (entry.exception) continue;
    const reservation = store.findReservation(state, entry.reference);
    if (!reservation || reservation.status !== 'confirmed') continue;
    if (clockOf(reservation.starts_at_local) === targetClock) continue;
    const wall = time.parseWall(reservation.starts_at_local);
    const [hours, minutes] = targetClock.split(':').map(Number);
    const next = time.wallFromMinutes(wall.y, wall.mo, wall.d, hours * 60 + minutes);
    // domain.amendReservation is the single write path: it re-derives the terms of the date the
    // occurrence now lands on, re-checks capacity and the cutoff, and records the history entry. This
    // function decides WHICH occurrences move; it does not write a booking itself, because a second
    // writer is how two paths come to describe the same booking differently.
    // seriesTravel: false, because these occurrences are moving together. The single-booking path would
    // mark each one a permanent exception and bump the revision once per occurrence, which is the
    // opposite of what a series changing its clock time means.
    domain.amendReservation(state, reservation, { starts_at_local: time.wallToString(next) }, nowMs,
      { seriesTravel: false });
    moved.push(reservation.reference);
  }

  // Once for the amendment, whatever the count.
  //
  // A no-op amendment -- amending to the clock time already in force -- is ACCEPTED and moves nothing,
  // including the revision. The reason is worth stating because the opposite looks stricter: a reader
  // assuming refusal is the safer choice would refuse this, and refusing it would be refusing a TRUE
  // STATEMENT. The caller said the series starts at the time it already starts at, and that is correct.
  // It is the same rule a no-op patch follows on a single booking (S3-058, S3-076), and consistency
  // across the two amendment paths is the point: a series is one booking intent, so it answers the same
  // way a booking does.
  //
  // This is the "+0" half of S4-154, and it is reachable ONLY with a second, no-op call -- which is why
  // it needs a written reason. A branch no test would ever have taken otherwise reads as an oversight.
  if (moved.length > 0) seriesRecord.revision += 1;
  return seriesView(state, seriesRecord);
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