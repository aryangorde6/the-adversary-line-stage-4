'use strict';

const { fail } = require('./errors');
const time = require('./time');
const store = require('./state');
const domain = require('./domain');
const idem = require('./idempotency');
const fields = require('./fields');
const { hashPassword, verifyPassword } = require('./accounts');
const { stateFromFixture } = require('./fixture');
const { exportDocument, stateFromDocument } = require('./snapshot');
const moves = require('./moves');

const { has, optionalString, requireString, normaliseEmail } = fields;

function authenticate(req, state) {
  const header = req.headers.authorization;
  if (typeof header !== 'string' || header.length === 0) fail('unauthenticated');
  const match = /^Bearer +(.+)$/i.exec(header.trim());
  if (!match) fail('unauthenticated');
  const token = match[1].trim();
  if (token.length === 0) fail('unauthenticated');
  const entry = state.tokens.find((candidate) => candidate.token === token);
  if (!entry) fail('unauthenticated');
  const user = store.findUserById(state, entry.user_id);
  if (!user) fail('unauthenticated');
  return user;
}

async function signup(ctx) {
  if (!has(ctx.body, 'email')) fail('validation_failed', { field: 'email' });
  const email = normaliseEmail(ctx.body.email, 'email');
  const password = requireString(ctx.body, 'password');
  if (password.length < 8) fail('validation_failed', { field: 'password', reason: 'password_too_short' });
  const displayName = optionalString(ctx.body, 'display_name') || email.split('@')[0];

  let state = store.getState();
  if (store.findUserByEmail(state, email)) fail('email_taken', { field: 'email' });
  const passwordHash = await hashPassword(password);
  if (store.getState() !== state) state = store.getState();
  if (store.findUserByEmail(state, email)) fail('email_taken', { field: 'email' });
  const user = { id: store.allocateUserId(state), email, display_name: displayName, password_hash: passwordHash };
  state.users.push(user);
  const token = store.issueToken(state, user.id);
  return { status: 201, body: { user_id: user.id, display_name: user.display_name, token } };
}

async function login(ctx) {
  if (!has(ctx.body, 'email')) fail('validation_failed', { field: 'email' });
  const email = normaliseEmail(ctx.body.email, 'email');
  const password = requireString(ctx.body, 'password');
  let state = store.getState();
  let user = store.findUserByEmail(state, email);
  if (!user) fail('unauthenticated', { reason: 'sign_in' });
  if (!(await verifyPassword(password, user.password_hash))) fail('unauthenticated', { reason: 'sign_in' });
  if (store.getState() !== state) {
    state = store.getState();
    user = store.findUserByEmail(state, email);
    if (!user || !(await verifyPassword(password, user.password_hash))) fail('unauthenticated', { reason: 'sign_in' });
  }
  const token = store.issueToken(state, user.id);
  return { status: 200, body: { user_id: user.id, display_name: user.display_name, token } };
}

function listRestaurants(ctx) {
  return {
    status: 200,
    body: {
      restaurants: ctx.state.restaurants.map((restaurant) => ({
        id: restaurant.id,
        name: restaurant.name,
        timezone: restaurant.timezone,
      })),
    },
  };
}

function getRestaurant(ctx) {
  const restaurant = domain.requireRestaurant(ctx.state, ctx.params.id);
  return {
    status: 200,
    body: {
      id: restaurant.id,
      name: restaurant.name,
      timezone: restaurant.timezone,
      slot_minutes: restaurant.slot_minutes,
      reservation_duration_minutes: restaurant.reservation_duration_minutes,
      cancellation_cutoff_minutes: restaurant.cancellation_cutoff_minutes,
      opening_hours: restaurant.opening_hours,
      tables: restaurant.tables,
    },
  };
}

function availability(ctx) {
  const restaurantId = fields.requireQueryId(ctx.url, 'restaurant_id');
  const rawDate = fields.queryValue(ctx.url, 'date');
  if (rawDate === null) fail('validation_failed', { reason: 'missing_search_details', field: 'date' });
  const date = time.parseCalendarDate(rawDate);
  if (!date) fail('validation_failed', { field: 'date', reason: 'time_format', date: rawDate });
  const partySize = fields.requireQueryInteger(ctx.url, 'party_size', { min: 1 });
  const restaurant = domain.requireRestaurant(ctx.state, restaurantId);
  return { status: 200, body: domain.availabilityFor(ctx.state, restaurant, date, partySize) };
}

function createReservation(ctx) {
  const reservation = domain.createReservation(ctx.state, ctx.user, ctx.body, ctx.nowMs);
  return { status: 201, body: store.reservationView(ctx.state, reservation) };
}

function listReservations(ctx) {
  const mine = ctx.state.reservations.filter((reservation) => reservation.user_id === ctx.user.id);
  mine.sort((a, b) => b.starts_at_ms - a.starts_at_ms);
  return { status: 200, body: { reservations: mine.map((reservation) => store.reservationView(ctx.state, reservation)) } };
}

function ownReservationOrFail(state, user, reference) {
  const reservation = store.findOwnReservation(state, user.id, reference);
  if (!reservation) fail('not_found', { resource: 'reservation', reference });
  return reservation;
}

function getReservation(ctx) {
  const reservation = ownReservationOrFail(ctx.state, ctx.user, ctx.params.reference);
  return { status: 200, body: store.reservationView(ctx.state, reservation) };
}

function cancelReservation(ctx) {
  const reservation = ownReservationOrFail(ctx.state, ctx.user, ctx.params.reference);
  domain.cancelReservation(ctx.state, reservation, ctx.nowMs);
  return { status: 200, body: store.reservationView(ctx.state, reservation) };
}

function patchReservation(ctx) {
  const reservation = ownReservationOrFail(ctx.state, ctx.user, ctx.params.reference);
  if (reservation.status === 'cancelled') fail('reservation_cancelled', { reference: reservation.reference });
  domain.amendReservation(ctx.state, reservation, ctx.body, ctx.nowMs);
  return { status: 200, body: store.reservationView(ctx.state, reservation) };
}

function reservationMoves(ctx) {
  const reservations = moves.applyMoves(ctx.state, ctx.user, ctx.body, ctx.nowMs);
  return { status: 201, body: { reservations: reservations.map((reservation) => store.reservationView(ctx.state, reservation)) } };
}

async function reset(ctx) {
  const next = await stateFromFixture(ctx.body, ctx.nowMs);
  store.setState(next);
  return { status: 204 };
}

function exportState(ctx) {
  return { status: 200, body: exportDocument(store.getState()) };
}

function importState(ctx) {
  const next = stateFromDocument(ctx.body);
  store.setState(next);
  return { status: 204 };
}

function health() {
  return { status: 200, body: { status: 'ok' } };
}

module.exports = {
  authenticate,
  signup,
  login,
  createReservation,
  listReservations,
  getRestaurant,
  availability,
  listRestaurants,
  getRestaurant,
  getReservation,
  cancelReservation,
  patchReservation,
  reservationMoves,
  reset,
  exportState,
  importState,
  health,
};