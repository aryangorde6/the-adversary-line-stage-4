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
} = require('./fields');

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

function reservationContext(restaurant, reservation) {
  const table = store.findTable(restaurant, reservation.table_id);
  const context = placeContext(restaurant, table, time.parseWall(reservation.starts_at_local));
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

function isOccupied(state, restaurantId, tableId, startMs, endMs, ignoredReference) {
  return state.reservations.some(
    (reservation) =>
      reservation.status === 'confirmed' &&
      reservation.restaurant_id === restaurantId &&
      reservation.table_id === tableId &&
      reservation.reference !== ignoredReference &&
      reservation.starts_at_ms < endMs &&
      startMs < reservation.ends_at_ms,
  );
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

function cutoffHasPassed(restaurant, reservation, nowMs) {
  const cutoff = restaurant.cancellation_cutoff_minutes * MILLIS_PER_MINUTE;
  return nowMs >= reservation.starts_at_ms - cutoff;
}

function createReservation(state, user, body, nowMs) {
  const restaurantId = requireId(body, 'restaurant_id');
  const tableId = requireId(body, 'table_id');
  const wall = requireStartsAtLocal(body);
  const partySize = requirePartySize(body);
  const restaurant = requireRestaurant(state, restaurantId);
  const table = requireTable(restaurant, tableId);
  const startMs = resolveStartMs(restaurant, wall);
  requireSlotInsideOpeningHours(restaurant, wall);
  if (partySize > table.capacity) {
    fail('party_exceeds_capacity', Object.assign(placeContext(restaurant, table, wall), { capacity: table.capacity }));
  }
  const endMs = startMs + restaurant.reservation_duration_minutes * MILLIS_PER_MINUTE;
  if (isOccupied(state, restaurant.id, table.id, startMs, endMs, null)) {
    fail('table_unavailable', placeContext(restaurant, table, wall));
  }
  const reservation = {
    id: store.allocateReservationId(state),
    reference: store.allocateReference(state),
    user_id: user.id,
    restaurant_id: restaurant.id,
    table_id: table.id,
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
  const table = changes.table_id === undefined
    ? store.findTable(restaurant, reservation.table_id)
    : requireTable(restaurant, changes.table_id);
  const partySize = changes.party_size === undefined ? reservation.party_size : changes.party_size;
  const startMs = resolveStartMs(restaurant, wall);
  requireSlotInsideOpeningHours(restaurant, wall);
  if (partySize > table.capacity) {
    fail('party_exceeds_capacity', Object.assign(placeContext(restaurant, table, wall), { capacity: table.capacity }));
  }
  return {
    restaurant_id: restaurant.id,
    table_id: table.id,
    party_size: partySize,
    starts_at_local: time.wallToString(wall),
    starts_at_ms: startMs,
    ends_at_ms: startMs + restaurant.reservation_duration_minutes * MILLIS_PER_MINUTE,
  };
}

function applyPlan(reservation, plan) {
  reservation.table_id = plan.table_id;
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
    table_id: optionalId(body, 'table_id'),
    starts_at_local: optionalStartsAtLocal(body),
    party_size: optionalPartySize(body),
  };
  const plan = planAmendment(state, reservation, restaurant, changes);
  if (isOccupied(state, restaurant.id, plan.table_id, plan.starts_at_ms, plan.ends_at_ms, reservation.reference)) {
    const target = store.findTable(restaurant, plan.table_id);
    fail('table_unavailable', placeContext(restaurant, target, time.parseWall(plan.starts_at_local)));
  }
  return applyPlan(reservation, plan);
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
        if (table.capacity >= partySize && !isOccupied(state, restaurant.id, table.id, startMs, endMs, null)) {
          available.push(table.id);
        }
      }
      slots.push({
        starts_at_local: time.wallToString(wall),
        starts_at: time.formatInZone(restaurant.timezone, startMs),
        available_table_ids: available,
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