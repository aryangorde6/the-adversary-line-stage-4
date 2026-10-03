'use strict';

const { fail } = require('./errors');
const time = require('./time');
const store = require('./state');
const domain = require('./domain');
const { hashPassword, randomId, randomToken } = require('./accounts');
const { has, isPlainObject, normaliseEmail, MAX_ID_LENGTH } = require('./fields');

const REFERENCE_PATTERN = /^[A-Z0-9]{6,12}$/;

function expectObject(value, field) {
  if (!isPlainObject(value)) fail('malformed_request', { field });
  return value;
}

function expectArray(value, field) {
  if (!Array.isArray(value)) fail('malformed_request', { field });
  return value;
}

function fixtureArray(container, name) {
  if (!has(container, name)) return [];
  return expectArray(container[name], name);
}

function fixtureId(value, field) {
  if (typeof value !== 'string') fail('malformed_request', { field });
  if (value.length === 0 || value.length > MAX_ID_LENGTH) fail('validation_failed', { field });
  return value;
}

function integerAtLeast(value, field, minimum) {
  if (typeof value !== 'number') fail('malformed_request', { field });
  if (!Number.isInteger(value) || value < minimum) fail('validation_failed', { field });
  return value;
}

function textOr(value, fallback, field) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string') fail('malformed_request', { field });
  return value;
}

function parseOpeningHours(raw) {
  return fixtureArray({ opening_hours: raw }, 'opening_hours').map((entry) => {
    expectObject(entry, 'opening_hours');
    const weekday = entry.weekday;
    if (typeof weekday !== 'string') fail('malformed_request', { field: 'weekday' });
    const name = weekday.toLowerCase();
    if (!time.WEEKDAY_NAMES.includes(name)) fail('validation_failed', { field: 'weekday' });
    const opens = time.parseHhmm(entry.opens);
    const closes = time.parseHhmm(entry.closes);
    if (opens === null || closes === null) fail('validation_failed', { field: 'opening_hours' });
    if (closes <= opens) fail('validation_failed', { field: 'opening_hours' });
    return { weekday: name, opens: entry.opens, closes: entry.closes };
  });
}

function parseTables(raw) {
  const tables = fixtureArray({ tables: raw }, 'tables').map((entry) => {
    expectObject(entry, 'tables');
    const id = fixtureId(entry.id, 'table_id');
    const capacity = integerAtLeast(entry.capacity, 'capacity', 1);
    return { id, label: textOr(entry.label, id, 'label'), capacity };
  });
  const seen = new Set();
  for (const table of tables) {
    if (seen.has(table.id)) fail('validation_failed', { field: 'table_id' });
    seen.add(table.id);
  }
  return tables;
}

function parseRestaurant(raw) {
  expectObject(raw, 'restaurants');
  const id = fixtureId(raw.id, 'restaurant_id');
  const name = textOr(raw.name, id, 'name');
  if (typeof raw.timezone !== 'string') fail('malformed_request', { field: 'timezone' });
  if (!time.isValidTimeZone(raw.timezone)) fail('validation_failed', { field: 'timezone' });
  const slotMinutes = integerAtLeast(raw.slot_minutes, 'slot_minutes', 1);
  const duration = integerAtLeast(raw.reservation_duration_minutes, 'reservation_duration_minutes', 1);
  const cutoff = raw.cancellation_cutoff_minutes === undefined
    ? 0
    : integerAtLeast(raw.cancellation_cutoff_minutes, 'cancellation_cutoff_minutes', 0);
  return {
    id,
    name,
    timezone: raw.timezone,
    slot_minutes: slotMinutes,
    reservation_duration_minutes: duration,
    cancellation_cutoff_minutes: cutoff,
    opening_hours: parseOpeningHours(raw.opening_hours),
    tables: parseTables(raw.tables),
  };
}

function parseUser(raw, takenIds, takenEmails) {
  expectObject(raw, 'users');
  const email = normaliseEmail(raw.email, 'email');
  if (takenEmails.has(email)) fail('validation_failed', { field: 'email' });
  const id = raw.id === undefined ? randomId('u_') : fixtureId(raw.id, 'user_id');
  if (takenIds.has(id)) fail('validation_failed', { field: 'user_id' });
  const password = raw.password === undefined ? randomToken() : textOr(raw.password, null, 'password');
  const displayName = textOr(raw.display_name, email.split('@')[0], 'display_name');
  return { id, email, display_name: displayName, password, password_hash: null };
}

function requireReference(raw) {
  if (typeof raw !== 'string' || !REFERENCE_PATTERN.test(raw)) {
    fail('validation_failed', { field: 'reference' });
  }
  return raw;
}

function parseSeededReservation(raw, state, nowMs) {
  expectObject(raw, 'reservations');
  const restaurantId = fixtureId(raw.restaurant_id, 'restaurant_id');
  const restaurant = store.findRestaurant(state, restaurantId);
  if (!restaurant) fail('validation_failed', { field: 'restaurant_id' });
  const tableId = fixtureId(raw.table_id, 'table_id');
  if (!store.findTable(restaurant, tableId)) fail('validation_failed', { field: 'table_id' });
  if (!has(raw, 'starts_at_local')) fail('validation_failed', { field: 'starts_at_local' });
  const wall = time.parseWall(raw.starts_at_local);
  if (!wall) fail('validation_failed', { field: 'starts_at_local' });
  const startMs = domain.resolveStartMs(restaurant, wall);
  const partySize = raw.party_size === undefined ? 1 : integerAtLeast(raw.party_size, 'party_size', 1);
  const status = raw.status === 'cancelled' ? 'cancelled' : 'confirmed';
  const userId = raw.user_id === undefined ? null : fixtureId(raw.user_id, 'user_id');
  const reference = raw.reference === undefined ? store.allocateReference(state) : requireReference(raw.reference);
  if (store.isReferenceTaken(state, reference)) fail('validation_failed', { field: 'reference' });
  const id = raw.id === undefined ? store.allocateReservationId(state) : fixtureId(raw.id, 'reservation_id');
  if (state.reservations.some((reservation) => reservation.id === id)) {
    fail('validation_failed', { field: 'reservation_id' });
  }
  const createdAt = textOr(raw.created_at, time.formatUtc(nowMs), 'created_at');
  return {
    id,
    reference,
    user_id: userId,
    restaurant_id: restaurantId,
    table_id: tableId,
    party_size: partySize,
    status,
    starts_at_local: time.wallToString(wall),
    starts_at_ms: startMs,
    ends_at_ms: startMs + restaurant.reservation_duration_minutes * domain.MILLIS_PER_MINUTE,
    created_at: createdAt,
  };
}

async function stateFromFixture(fixture, nowMs) {
  expectObject(fixture, 'fixture');
  const state = store.emptyState();

  const takenIds = new Set();
  const takenEmails = new Set();
  for (const raw of fixtureArray(fixture, 'users')) {
    const user = parseUser(raw, takenIds, takenEmails);
    takenIds.add(user.id);
    takenEmails.add(user.email);
    user.password_hash = await hashPassword(user.password);
    delete user.password;
    state.users.push(user);
  }

  const restaurantIds = new Set();
  for (const raw of fixtureArray(fixture, 'restaurants')) {
    const restaurant = parseRestaurant(raw);
    if (restaurantIds.has(restaurant.id)) fail('validation_failed', { field: 'restaurant_id' });
    restaurantIds.add(restaurant.id);
    state.restaurants.push(restaurant);
  }

  for (const raw of fixtureArray(fixture, 'reservations')) {
    state.reservations.push(parseSeededReservation(raw, state, nowMs));
  }

  return state;
}

module.exports = {
  stateFromFixture,
  expectObject,
  expectArray,
  fixtureArray,
  fixtureId,
  integerAtLeast,
  textOr,
  parseOpeningHours,
  parseTables,
  parseRestaurant,
};