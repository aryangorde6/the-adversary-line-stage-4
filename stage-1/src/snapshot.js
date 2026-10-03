'use strict';

const { fail } = require('./errors');
const time = require('./time');
const store = require('./state');
const { parseRestaurant } = require('./fixture');
const { isPlainObject, has } = require('./fields');

const TRACK = 'tablekeeper';
const FORMAT_VERSION = 1;
const REFERENCE_PATTERN = /^[A-Z0-9]{6,12}$/;

function requireString(value, field, allowEmpty) {
  if (typeof value !== 'string') fail('validation_failed', { field });
  if (!allowEmpty && value.length === 0) fail('validation_failed', { field });
  return value;
}

function requireInteger(value, field) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) fail('validation_failed', { field });
  return value;
}

function snapshotState(state) {
  return JSON.parse(
    JSON.stringify({
      users: state.users,
      tokens: state.tokens,
      restaurants: state.restaurants,
      reservations: state.reservations,
      idempotency: state.idempotency,
    }),
  );
}

function exportDocument(state) {
  return { track: TRACK, format_version: FORMAT_VERSION, state: snapshotState(state) };
}

function validateUsers(raw) {
  if (!Array.isArray(raw)) fail('validation_failed', { field: 'users' });
  return raw.map((entry) => {
    if (!isPlainObject(entry)) fail('validation_failed', { field: 'users' });
    return {
      id: requireString(entry.id, 'user_id'),
      email: requireString(entry.email, 'email'),
      display_name: requireString(entry.display_name, 'display_name', true),
      password_hash: requireString(entry.password_hash, 'password_hash'),
    };
  });
}

function validateTokens(raw) {
  if (!Array.isArray(raw)) fail('validation_failed', { field: 'tokens' });
  return raw.map((entry) => {
    if (!isPlainObject(entry)) fail('validation_failed', { field: 'tokens' });
    return {
      token: requireString(entry.token, 'token'),
      user_id: requireString(entry.user_id, 'user_id'),
    };
  });
}

function validateReservations(raw, restaurants) {
  if (!Array.isArray(raw)) fail('validation_failed', { field: 'reservations' });
  const references = new Set();
  return raw.map((entry) => {
    if (!isPlainObject(entry)) fail('validation_failed', { field: 'reservations' });
    const restaurantId = requireString(entry.restaurant_id, 'restaurant_id');
    const restaurant = restaurants.find((candidate) => candidate.id === restaurantId);
    if (!restaurant) fail('validation_failed', { field: 'restaurant_id' });
    const tableId = requireString(entry.table_id, 'table_id');
    if (!store.findTable(restaurant, tableId)) fail('validation_failed', { field: 'table_id' });
    const startsAtLocal = requireString(entry.starts_at_local, 'starts_at_local');
    const wall = time.parseWall(startsAtLocal);
    if (!wall) fail('validation_failed', { field: 'starts_at_local' });
    const startsAtMs = requireInteger(entry.starts_at_ms, 'starts_at_ms');
    const endsAtMs = requireInteger(entry.ends_at_ms, 'ends_at_ms');
    if (endsAtMs <= startsAtMs) fail('validation_failed', { field: 'ends_at_ms' });
    if (time.wallToInstants(restaurant.timezone, wall.y, wall.mo, wall.d, wall.h, wall.mi)[0] !== startsAtMs) {
      fail('validation_failed', { field: 'starts_at_ms' });
    }
    const reference = requireString(entry.reference, 'reference');
    if (!REFERENCE_PATTERN.test(reference) || references.has(reference)) {
      fail('validation_failed', { field: 'reference' });
    }
    references.add(reference);
    const status = entry.status === 'cancelled' ? 'cancelled' : 'confirmed';
    const reservation = {
      id: requireString(entry.id, 'reservation_id'),
      reference,
      user_id: entry.user_id === null ? null : requireString(entry.user_id, 'user_id'),
      restaurant_id: restaurantId,
      table_id: tableId,
      party_size: requireInteger(entry.party_size, 'party_size'),
      status,
      starts_at_local: startsAtLocal,
      starts_at_ms: startsAtMs,
      ends_at_ms: endsAtMs,
      created_at: requireString(entry.created_at, 'created_at', true),
    };
    if (reservation.party_size < 1) fail('validation_failed', { field: 'party_size' });
    return reservation;
  });
}

function validateIdempotency(raw) {
  if (!Array.isArray(raw)) fail('validation_failed', { field: 'idempotency' });
  return raw.map((entry) => {
    if (!isPlainObject(entry)) fail('validation_failed', { field: 'idempotency' });
    const status = requireInteger(entry.status, 'status');
    if (!has(entry, 'body')) fail('validation_failed', { field: 'body' });
    if (!has(entry, 'response')) fail('validation_failed', { field: 'response' });
    return {
      user_id: requireString(entry.user_id, 'user_id'),
      key: requireString(entry.key, 'key'),
      method: requireString(entry.method, 'method'),
      path: requireString(entry.path, 'path'),
      body: JSON.parse(JSON.stringify(entry.body)),
      status,
      response: JSON.parse(JSON.stringify(entry.response)),
    };
  });
}

function stateFromDocument(document) {
  if (!isPlainObject(document)) fail('validation_failed', { field: 'document' });
  if (document.track !== TRACK) fail('validation_failed', { field: 'track' });
  if (document.format_version !== FORMAT_VERSION) fail('validation_failed', { field: 'format_version' });
  const raw = document.state;
  if (!isPlainObject(raw)) fail('validation_failed', { field: 'state' });
  const state = store.emptyState();
  state.users = validateUsers(raw.users === undefined ? [] : raw.users);
  state.tokens = validateTokens(raw.tokens === undefined ? [] : raw.tokens);
  state.restaurants = (raw.restaurants === undefined ? [] : raw.restaurants).map(parseRestaurant);
  const restaurantIds = new Set();
  for (const restaurant of state.restaurants) {
    if (restaurantIds.has(restaurant.id)) fail('validation_failed', { field: 'restaurant_id' });
    restaurantIds.add(restaurant.id);
  }
  state.reservations = validateReservations(raw.reservations === undefined ? [] : raw.reservations, state.restaurants);
  state.idempotency = validateIdempotency(raw.idempotency === undefined ? [] : raw.idempotency);
  return state;
}

module.exports = {
  TRACK,
  FORMAT_VERSION,
  snapshotState,
  exportDocument,
  stateFromDocument,
  validateUsers,
  validateTokens,
  validateReservations,
  validateIdempotency,
  requireString,
  requireInteger,
};