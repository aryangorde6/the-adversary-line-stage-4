'use strict';

const { fail } = require('./errors');
const store = require('./state');
const domain = require('./domain');
const { has, isPlainObject, optionalPartySize, optionalStartsAtLocal } = require('./fields');

const MIN_MOVES = 1;
const MAX_MOVES = 8;

function validateMoveList(body) {
  if (!has(body, 'moves')) fail('validation_failed', { field: 'moves', reason: 'moves_shape' });
  const moves = body.moves;
  if (!Array.isArray(moves)) fail('validation_failed', { field: 'moves', reason: 'moves_shape' });
  if (moves.length < MIN_MOVES || moves.length > MAX_MOVES) fail('validation_failed', { field: 'moves', reason: 'moves_shape' });
  const seen = new Set();
  const items = [];
  for (const move of moves) {
    if (!isPlainObject(move)) fail('validation_failed', { field: 'moves' });
    const reference = move.reference;
    if (typeof reference !== 'string' || reference.length === 0 || reference.length > 64) {
      fail('validation_failed', { field: 'reference' });
    }
    if (seen.has(reference)) fail('validation_failed', { field: 'reference' });
    seen.add(reference);
    items.push(move);
  }
  return items;
}

function sharesTable(a, b) {
  return a.table_ids.some((id) => b.table_ids.includes(id));
}

// Two resulting bookings may not hold the same table at the same time. With sets that means any
// member in common, so moving t_1 onto a slot where another booking holds t_2 as half of the pair
// t_1+t_2 is still a conflict, because that booking holds t_1 too.
function overlaps(a, b) {
  return a.restaurant_id === b.restaurant_id &&
    sharesTable(a, b) &&
    a.starts_at_ms < b.ends_at_ms &&
    b.starts_at_ms < a.ends_at_ms;
}

function occupiedByUnlisted(state, plan, listed) {
  return state.reservations.some(
    (reservation) =>
      reservation.status === 'confirmed' &&
      reservation.restaurant_id === plan.restaurant_id &&
      sharesTable(plan, reservation) &&
      !listed.has(reservation.reference) &&
      reservation.starts_at_ms < plan.ends_at_ms &&
      plan.starts_at_ms < reservation.ends_at_ms,
  );
}

// A move may name its tables as table_id or table_ids, judged by the same rules as a create, and
// may leave them out to keep the ones the booking already has.
function moveTableSet(move, restaurant) {
  const requested = domain.tableSetFromRequest(move);
  if (requested === undefined) return undefined;
  return domain.canonicalTableSet(restaurant, requested);
}

function applyMoves(state, user, body, nowMs) {
  const moves = validateMoveList(body);

  const targets = moves.map((move) => {
    const reservation = store.findOwnReservation(state, user.id, move.reference);
    if (!reservation) fail('not_found', { resource: 'reservation', reference: move.reference });
    return reservation;
  });

  const firstRestaurantId = targets[0].restaurant_id;
  for (const reservation of targets) {
    if (reservation.restaurant_id !== firstRestaurantId) {
      fail('validation_failed', { field: 'moves', reason: 'single_restaurant' });
    }
  }
  const restaurant = domain.requireRestaurant(state, firstRestaurantId);

  const plans = [];
  for (let index = 0; index < targets.length; index += 1) {
    const reservation = targets[index];
    if (reservation.status === 'cancelled') fail('reservation_cancelled', { reference: reservation.reference });
    if (domain.cutoffHasPassed(restaurant, reservation, nowMs)) {
      fail('cutoff_passed', domain.reservationContext(restaurant, reservation));
    }
    const move = moves[index];
    plans.push(
      domain.planAmendment(state, reservation, restaurant, {
        table_ids: moveTableSet(move, restaurant),
        starts_at_local: optionalStartsAtLocal(move),
        party_size: optionalPartySize(move),
      }),
    );
  }

  const listed = new Set(targets.map((reservation) => reservation.reference));
  for (let index = 0; index < plans.length; index += 1) {
    const plan = plans[index];
    if (occupiedByUnlisted(state, plan, listed)) {
      fail('table_unavailable', { reference: targets[index].reference, table_ids: plan.table_ids.slice() });
    }
    for (let other = index + 1; other < plans.length; other += 1) {
      if (overlaps(plan, plans[other])) {
        fail('table_unavailable', { reference: targets[index].reference, table_ids: plan.table_ids.slice() });
      }
    }
  }

  return targets.map((reservation, index) => domain.applyPlan(reservation, plans[index]));
}

module.exports = { applyMoves };