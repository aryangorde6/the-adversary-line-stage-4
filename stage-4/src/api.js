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
const policyRules = require('./policy');
const historyRules = require('./history');
const series = require('./series');
const replans = require('./replans');

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

// Returns null instead of failing. Used by the three endpoints whose answer for a stranger and for an
// anonymous caller must be the same 404, so that the status itself cannot be used to learn whether
// a reference exists.
function authenticateIfPresent(req, state) {
  const header = req.headers.authorization;
  if (typeof header !== 'string' || header.length === 0) return null;
  const match = /^Bearer +(.+)$/i.exec(header.trim());
  if (!match) return null;
  const entry = state.tokens.find((candidate) => candidate.token === match[1].trim());
  if (!entry) return null;
  return store.findUserById(state, entry.user_id);
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
  const explain = fields.explainFlag(ctx.url);
  return {
    status: 200,
    body: domain.availabilityFor(ctx.state, restaurant, date, partySize, { explain }),
  };
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

// Cancelling an occurrence retains it in the series with its current status and moves the series
// revision once, but never marks it an exception: a cancellation is not a diner amending their own
// arrangement, and conflating the two is exactly what S3-115 separates.
function cancelReservation(ctx) {
  const reservation = ownReservationOrFail(ctx.state, ctx.user, ctx.params.reference);
  const wasConfirmed = reservation.status === 'confirmed';
  domain.cancelReservation(ctx.state, reservation, ctx.nowMs);
  if (wasConfirmed && reservation.series_id) {
    require('./series').bumpSeriesRevision(ctx.state, reservation.series_id);
  }
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

function publishPolicy(ctx) {
  const restaurant = domain.requireRestaurant(ctx.state, ctx.params.id);
  policyRules.requireManager(ctx.state, restaurant, ctx.user);
  const policy = policyRules.publishPolicy(ctx.state, restaurant, ctx.body);
  return { status: 201, body: policyRules.acceptedTermsOf(policy) };
}

// A replan is a manager's closure and its consequences, so it is manager-scoped like policy
// publication. The preview is a separate request from the apply on purpose: the caller can read the
// plan, show it to whoever asked for the closure, and only then write.
function previewReplan(ctx) {
  const restaurant = domain.requireRestaurant(ctx.state, ctx.params.id);
  policyRules.requireManager(ctx.state, restaurant, ctx.user);
  return { status: 201, body: replans.previewReplan(ctx.state, ctx.user, restaurant, ctx.body, ctx.nowMs) };
}

function applyReplan(ctx) {
  const restaurant = domain.requireRestaurant(ctx.state, ctx.params.id);
  policyRules.requireManager(ctx.state, restaurant, ctx.user);
  return { status: 200, body: replans.applyReplan(ctx.state, ctx.user, restaurant, ctx.params.planId, ctx.nowMs) };
}

function listPolicies(ctx) {
  const restaurant = domain.requireRestaurant(ctx.state, ctx.params.id);
  return { status: 200, body: { policies: policyRules.listPolicies(ctx.state, restaurant) } };
}

// History and decision answer 404 for a stranger and for a missing reference alike, and 404 rather
// than 401 with no token at all. That is a deliberate exception to stage 1's rule for private reads
// (S3-081): the endpoint must not tell an unauthenticated caller that the reference exists.
function ownerOnly(ctx, reference) {
  const reservation = store.findOwnReservation(ctx.state, ctx.user && ctx.user.id, reference);
  if (!reservation) fail('not_found', { resource: 'reservation', reference });
  return reservation;
}

function reservationHistory(ctx) {
  const reservation = ownerOnly(ctx, ctx.params.reference);
  // The key is entries: history is the record, and the reference is already in the path, so the body
  // is the ordered record and nothing else. Naming the key "history" would read as the record of a
  // history rather than the history itself.
  return { status: 200, body: { entries: historyRules.historyFor(ctx.state, reservation.reference) } };
}

function reservationDecision(ctx) {
  const reservation = ownerOnly(ctx, ctx.params.reference);
  return {
    status: 200,
    body: {
      reference: reservation.reference,
      revision: reservation.revision,
      accepted_terms: reservation.accepted_terms,
    },
  };
}

function adoptSeries(ctx) {
  const created = series.adopt(ctx.state, ctx.user, ctx.body, ctx.nowMs);
  return { status: 201, body: series.seriesView(ctx.state, created) };
}

// A series amendment changes the clock time its occurrences are laid out on: the time of day is the
// caller's, the dates are derived from the anchor, and the whole series moves together or not at all.
// The series revision moves once per amendment whether one occurrence or all of them moved, because a
// series is one booking intent.
function amendSeries(ctx) {
  const found = series.requireOwnSeries(ctx.state, ctx.user, ctx.params.seriesId);
  return { status: 200, body: series.amendClockTime(ctx.state, found, ctx.body, ctx.nowMs) };
}

function getSeries(ctx) {
  const found = series.requireOwnSeries(ctx.state, ctx.user, ctx.params.seriesId);
  return { status: 200, body: series.seriesView(ctx.state, found) };
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
  authenticateIfPresent,
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
  previewReplan,
  applyReplan,
  amendSeries,
  publishPolicy,
  listPolicies,
  reservationHistory,
  reservationDecision,
  adoptSeries,
  getSeries,
  reset,
  exportState,
  importState,
  health,
};