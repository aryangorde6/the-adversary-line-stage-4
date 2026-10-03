'use strict';

// Stage 4's write family: a manager closes some tables on a date, and the service computes where every
// affected booking goes instead. The plan is previewed, stored, and applied later — so the two halves
// are separate requests and can disagree, which is the whole reason this file computes the plan twice
// rather than replaying what it stored.
//
// The rule that matters and is easy to get wrong: apply does NOT trust the preview. It recomputes the
// plan from current state and compares. A stored preview is a claim about what the service said earlier;
// if the state has moved since, replaying the claim writes a booking the service would not have planned.
// S4-153d is about exactly this, and inertness cannot see it: comparing the applied result to the
// preview would agree even if both were wrong in the same way.
//
// A preview therefore carries the expected_revision of every booking it touches. Applying re-derives
// each target and refuses the whole plan if any booking has moved on, because a partial closure would
// leave half the restaurant reseated and half not.

const { fail } = require('./errors');
const domain = require('./domain');
const policy = require('./policy');
const store = require('./state');
const time = require('./time');
const history = require('./history');
const seriesRules = require('./series');

const MAX_CLOSED_TABLES = 8;

// A closure names a date and the tables unavailable on it. It does not name bookings: which bookings
// are affected is the service's answer to compute, not the caller's to assert, and a closure that named
// them would be a second way in to the same state.
function readClosure(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    fail('malformed_request', { field: 'closure' });
  }
  const date = raw.date;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    fail('validation_failed', { field: 'closure.date' });
  }
  if (!Array.isArray(raw.table_ids) || raw.table_ids.length === 0) {
    fail('validation_failed', { field: 'closure.table_ids' });
  }
  if (raw.table_ids.length > MAX_CLOSED_TABLES) {
    fail('validation_failed', { field: 'closure.table_ids' });
  }
  const ids = [];
  for (const value of raw.table_ids) {
    if (typeof value !== 'string' || value.length === 0) fail('malformed_request', { field: 'closure.table_ids' });
    if (ids.indexOf(value) !== -1) fail('validation_failed', { field: 'closure.table_ids' });
    ids.push(value);
  }
  return { date, table_ids: ids.slice().sort(), reason: typeof raw.reason === 'string' ? raw.reason : null };
}

function overlapsDate(reservation, date) {
  return reservation.starts_at_local.slice(0, 10) === date;
}

// A booking is caught by the closure when it holds any closed table. Cancelled bookings hold nothing,
// so they are not caught and are not moved: re-seating a booking nobody holds would put a row in history
// for a change no person made.
function affectedBy(reservation, closure) {
  if (reservation.status !== 'confirmed') return false;
  if (!overlapsDate(reservation, closure.date)) return false;
  const held = reservation.table_ids || [];
  return held.some((tableId) => closure.table_ids.indexOf(tableId) !== -1);
}

// The candidate table sets for a booking, widest first: the tables it already holds (minus the closed
// ones), then every pair the restaurant declares combinable, then every single table. Order is
// deliberate -- a booking that can keep its own table keeps it, because moving a party to a different
// table for no reason is a worse outcome for the diner than the closure strictly requires.
function candidatesFor(restaurant, closed, held) {
  const open = restaurant.tables.filter((table) => closed.indexOf(table.id) === -1);
  const out = [];
  const keep = held.filter((tableId) => closed.indexOf(tableId) === -1);
  if (keep.length > 0) out.push(keep.slice());
  for (const pair of restaurant.combinable || []) {
    if (pair.some((tableId) => closed.indexOf(tableId) !== -1)) continue;
    out.push(pair.slice());
  }
  for (const table of open) out.push([table.id]);
  return out;
}

// Placement is computed here and nowhere else, so the preview and the apply derive it identically or
// not at all. The probe that checks them compares against ITS OWN derivation, never against whichever
// of the two the service happened to return.
function reseat(state, restaurant, reservation, closure, selected) {
  const duration = selected.reservation_duration_minutes;
  const held = reservation.table_ids || [];
  const candidates = candidatesFor(restaurant, closure.table_ids, held);
  const originalWall = time.parseWall(reservation.starts_at_local);

  // First preference: the same start, on any open set that fits. Most closures are partial, and this is
  // the case that keeps a booking where the diner chose to put it.
  for (const tableIds of candidates) {
    const capacity = domain.capacityOf(selected, restaurant, tableIds);
    if (capacity < reservation.party_size) continue;
    const startMs = domain.resolveStartMs(restaurant, originalWall);
    if (occupied(state, restaurant.id, tableIds, startMs, startMs + duration * domain.MILLIS_PER_MINUTE, reservation.reference)) continue;
    return placement(tableIds, startMs, originalWall, selected, reservation.party_size);
  }

  // Otherwise the earliest slot on that date that can hold the party, walking the date's own terms.
  const day = domain.dayOpeningHours(selected, restaurant, { y: originalWall.y, mo: originalWall.mo, d: originalWall.d, h: 0, mi: 0 });
  if (day && day.opens !== null && day.closes !== null) {
    const step = selected.slot_minutes;
    for (let minutes = day.opens; minutes + duration <= day.closes; minutes += step) {
      const wall = time.wallFromMinutes(originalWall.y, originalWall.mo, originalWall.d, minutes);
      const startMs = domain.resolveStartMs(restaurant, wall);
      for (const tableIds of candidates) {
        const capacity = domain.capacityOf(selected, restaurant, tableIds);
        if (capacity < reservation.party_size) continue;
        if (occupied(state, restaurant.id, tableIds, startMs, startMs + duration * domain.MILLIS_PER_MINUTE, reservation.reference)) continue;
        return placement(tableIds, startMs, wall, selected, reservation.party_size);
      }
    }
  }
  return null;
}

function occupied(state, restaurantId, tableIds, startMs, endMs, ignoreReference) {
  return state.reservations.some((other) => {
    if (other.status !== 'confirmed') return false;
    if (other.restaurant_id !== restaurantId) return false;
    if (other.reference === ignoreReference) return false;
    const held = other.table_ids || [];
    if (!held.some((tableId) => tableIds.indexOf(tableId) !== -1)) return false;
    return other.starts_at_ms < endMs && startMs < other.ends_at_ms;
  });
}

// `to` carries every element the booking is written from, party_size included. applyPlan assigns
// party_size from the plan, so a placement without it would blank the party's size on the floor -- and
// S4-153d asks for equality on the write, not on a summary that happens to omit a field.
function placement(tableIds, startMs, wall, selected, partySize) {
  return {
    table_ids: tableIds.slice(),
    party_size: partySize,
    starts_at_local: time.wallToString(wall),
    starts_at_ms: startMs,
    ends_at_ms: startMs + selected.reservation_duration_minutes * domain.MILLIS_PER_MINUTE,
    accepted_terms: policy.acceptedTermsOf(selected),
  };
}

// The single derivation both halves call. Everything a booking is written from is inside `to`, so an
// equality check on `to` is an equality check on the write, and not on a summary of it.
function computePlan(state, restaurant, closure, planId, createdAt) {
  const selected = policy.policyForDate(state, restaurant, closure.date);
  const moves = [];
  for (const reservation of state.reservations) {
    if (reservation.restaurant_id !== restaurant.id) continue;
    if (!affectedBy(reservation, closure)) continue;
    const to = reseat(state, restaurant, reservation, closure, selected);
    if (!to) continue;
    moves.push({
      reference: reservation.reference,
      expected_revision: reservation.revision,
      from: {
        table_ids: (reservation.table_ids || []).slice(),
        starts_at_local: reservation.starts_at_local,
        // party_size is in `from` because the history helper compares it: a `from` without it would make
        // every closure look like it also changed the party size, and the record would be a lie about a
        // change nobody made.
        party_size: reservation.party_size,
        starts_at_ms: reservation.starts_at_ms,
        ends_at_ms: reservation.ends_at_ms,
        accepted_terms: JSON.parse(JSON.stringify(reservation.accepted_terms)),
      },
      to,
    });
  }
  // Reference order, so two derivations of the same plan are comparable as text and not merely as sets.
  moves.sort((a, b) => (a.reference < b.reference ? -1 : a.reference > b.reference ? 1 : 0));
  return {
    plan_id: planId,
    restaurant_id: restaurant.id,
    closure,
    policy_version: selected.policy_version,
    created_at: createdAt,
    moves,
  };
}

function previewReplan(state, user, restaurant, body, nowMs) {
  const closure = readClosure(body === null || body === undefined ? {} : body.closure);
  for (const tableId of closure.table_ids) domain.requireTable(restaurant, tableId);
  const createdAt = time.formatUtc(nowMs);
  const plan = computePlan(state, restaurant, closure, store.allocatePlanId(state), createdAt);
  store.rememberPlan(state, plan);
  return plan;
}

function requirePlan(state, restaurant, planId) {
  const found = state.replans.find((plan) => plan.plan_id === planId);
  if (!found) fail('not_found', { resource: 'replan', plan_id: planId });
  if (found.restaurant_id !== restaurant.id) {
    fail('not_found', { resource: 'replan', plan_id: planId });
  }
  return found;
}

// S4-153d. The applied plan is derived again from current state and compared element by element against
// what was previewed. If they differ the whole plan is refused: a closure that half applied is worse
// than one that did not, and the caller can preview again to see the new truth.
function applyReplan(state, user, restaurant, planId, nowMs) {
  const stored = requirePlan(state, restaurant, planId);
  const recomputed = computePlan(state, restaurant, stored.closure, stored.plan_id, stored.created_at);

  const before = JSON.stringify(stored.moves);
  const after = JSON.stringify(recomputed.moves);
  if (before !== after) {
    fail('stale_plan', { plan_id: planId, planned: stored.moves.length, now: recomputed.moves.length });
  }

  // Every affected booking must still be at the revision the plan was built against. The equality above
  // already implies this for the bookings the plan carries, so this is the assertion that the two
  // derivations are compared and not merely trusted -- a stale plan whose text happens to match is
  // refused here rather than applied.
  for (const move of recomputed.moves) {
    const reservation = store.findReservation(state, move.reference);
    if (!reservation) fail('not_found', { resource: 'reservation', reference: move.reference });
    if (reservation.revision !== move.expected_revision) {
      fail('stale_revision', { reference: move.reference, revision: reservation.revision });
    }
  }

  const moved = [];
  for (const move of recomputed.moves) {
    const reservation = store.findReservation(state, move.reference);
    domain.applyPlan(reservation, move.to);
    // Once for the whole plan, per booking: a booking's revision counts the amendments applied to it,
    // and a closure is one amendment however many tables it touches.
    reservation.revision += 1;
    // The same helper the single-booking amendment path uses, so a closure and a patch cannot describe
    // the same change two different ways in the history.
    history.append(state, reservation, 'changed', history.amendmentChanges(move.from, reservation), nowMs);
    moved.push(reservation);
  }

  // The series revision moves once per application if at least one of its members moved, not once per
  // member. A series is one booking intent, and a closure touching three of its occurrences is one
  // event to the person who made it.
  const touched = new Set();
  for (const reservation of moved) {
    if (reservation.series_id) touched.add(reservation.series_id);
  }
  for (const seriesId of touched) {
    const found = state.series.find((entry) => entry.series_id === seriesId);
    if (found) found.revision += 1;
  }

  // The closure outlives the plan. A plan is spent once; the fact that a table was out of service on a
  // date is true of that date afterwards, and it is what availability reads -- so an applied closure is
  // what can move a later search's day_state from open to nothing_free.
  state.closures.push({
    restaurant_id: restaurant.id,
    date: stored.closure.date,
    table_ids: stored.closure.table_ids.slice(),
    reason: stored.closure.reason,
    applied_at: time.formatUtc(nowMs),
  });
  state.replans = state.replans.filter((plan) => plan.plan_id !== planId);
  seriesRules.moveRestaurantBatchCounter(state, restaurant.id);
  return { plan_id: planId, moved: recomputed.moves.map((move) => move.reference), revision_bumped: true };
}

module.exports = {
  readClosure,
  affectedBy,
  computePlan,
  previewReplan,
  applyReplan,
  requirePlan,
  MAX_CLOSED_TABLES,
};
