'use strict';

const { ApiError, fail } = require('./errors');
const store = require('./state');
const idem = require('./idempotency');
const api = require('./api');
const { sendJson, sendHtml, sendNoContent, sendError, readRawBody, parseJsonObject, parseJsonValue } = require('./http');
const ui = require('./ui');

const ROUTES = [
  { method: 'GET', path: ['health'], handler: api.health },
  { method: 'POST', path: ['_test', 'reset'], body: 'object', handler: api.reset },
  { method: 'GET', path: ['_test', 'export'], handler: api.exportState },
  { method: 'POST', path: ['_test', 'import'], body: 'value', handler: api.importState },
  { method: 'POST', path: ['auth', 'signup'], body: 'object', handler: api.signup },
  { method: 'POST', path: ['auth', 'login'], body: 'object', handler: api.login },
  { method: 'GET', path: ['restaurants'], handler: api.listRestaurants },
  { method: 'GET', path: ['restaurants', ':id'], handler: api.getRestaurant },
  { method: 'GET', path: ['availability'], handler: api.availability },
  { method: 'POST', path: ['reservations'], auth: true, key: true, body: 'object', handler: api.createReservation },
  { method: 'GET', path: ['reservations'], auth: true, handler: api.listReservations },
  { method: 'GET', path: ['reservations', ':reference'], auth: true, handler: api.getReservation },
  { method: 'POST', path: ['reservations', ':reference', 'cancel'], auth: true, handler: api.cancelReservation },
  { method: 'PATCH', path: ['reservations', ':reference'], auth: true, body: 'object', handler: api.patchReservation },
  { method: 'POST', path: ['reservation-moves'], auth: true, key: true, body: 'object', handler: api.reservationMoves },
  // Stage 3 routes. The three that answer a private read are marked optional rather than auth: a
  // caller with no token must receive the same 404 a stranger receives, not stage 1's 401, or the
  // status itself tells an unauthenticated caller the reference exists (S3-081).
  { method: 'POST', path: ['restaurants', ':id', 'policies'], auth: true, key: true, body: 'object', handler: api.publishPolicy },
  { method: 'GET', path: ['restaurants', ':id', 'policies'], handler: api.listPolicies },
  { method: 'GET', path: ['reservations', ':reference', 'history'], optionalAuth: true, handler: api.reservationHistory },
  { method: 'GET', path: ['reservations', ':reference', 'decision'], optionalAuth: true, handler: api.reservationDecision },
  { method: 'POST', path: ['series'], auth: true, key: true, body: 'object', handler: api.adoptSeries },
  { method: 'GET', path: ['series', ':seriesId'], optionalAuth: true, handler: api.getSeries },
  { method: 'POST', path: ['series', ':seriesId', 'amend'], auth: true, body: 'object', handler: api.amendSeries },
  { method: 'POST', path: ['restaurants', ':id', 'replans'], auth: true, key: true, body: 'object', handler: api.previewReplan },
  { method: 'POST', path: ['restaurants', ':id', 'replans', ':planId', 'apply'], auth: true, body: 'object', handler: api.applyReplan },
];

// The four screens and the one script they load. src/ui/ owns what a page says; this file only
// decides which paths are screens, and nothing here changes what the JSON API answers.
const SCREENS = ['/', '/signup', '/login', '/lookup'];
for (const screen of SCREENS) {
  ROUTES.push({
    method: 'GET',
    path: screen === '/' ? [] : screen.slice(1).split('/'),
    screen: screen,
    handler: (ctx) => {
      const html = ui.page(screen, ctx);
      // A screen the interface does not build is a 404, not a page whose body is the word null.
      if (typeof html !== 'string' || html === '') fail('not_found');
      return { status: 200, html };
    },
  });
}
ROUTES.push({
  method: 'GET',
  path: ['ui', 'client.js'],
  handler: () => {
    const asset = ui.asset('client.js');
    if (!asset) fail('not_found');
    return asset;
  },
});

function normalisePath(pathname) {
  let decoded;
  try {
    decoded = pathname
      .split('/')
      .map((segment) => decodeURIComponent(segment));
  } catch {
    return null;
  }
  const segments = [];
  for (const segment of decoded) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') return null;
    segments.push(segment);
  }
  return segments;
}

function matchRoute(segments, method) {
  for (const route of ROUTES) {
    if (route.path.length !== segments.length) continue;
    const params = {};
    let matched = true;
    for (let index = 0; index < route.path.length; index += 1) {
      const expected = route.path[index];
      if (expected.startsWith(':')) {
        params[expected.slice(1)] = segments[index];
      } else if (expected !== segments[index]) {
        matched = false;
        break;
      }
    }
    if (!matched) continue;
    if (route.method !== method) continue;
    return { route, params };
  }
  return null;
}

function withIdempotency(ctx, handler) {
  const key = idem.requireKey(ctx.keyHeader);
  const state = store.getState();
  const record = idem.lookup(state, ctx.user.id, key, ctx.method, ctx.path, ctx.body);
  if (record) return { status: 200, body: record.response };
  const result = handler(state);
  if (result.status >= 200 && result.status < 300) {
    idem.remember(state, ctx.user.id, key, ctx.method, ctx.path, ctx.body, result.status, result.body);
  }
  return result;
}

async function dispatch(req) {
  const url = new URL(req.url, 'http://tablekeeper.invalid');
  const segments = normalisePath(url.pathname);
  if (segments === null) fail('not_found');
  const found = matchRoute(segments, req.method);
  if (!found) fail('not_found');
  const { route, params } = found;

  let body;
  if (route.body) {
    const raw = await readRawBody(req);
    if (route.method === 'PATCH' && raw.length === 0) body = {};
    else body = route.body === 'object' ? parseJsonObject(raw) : parseJsonValue(raw);
  }

  const state = store.getState();
  const ctx = {
    req,
    url,
    method: req.method,
    path: url.pathname,
    params,
    body,
    state,
    nowMs: Date.now(),
    keyHeader: req.headers['idempotency-key'],
    user: null,
  };
  if (route.auth) ctx.user = api.authenticate(req, state);
  // An optional route authenticates only when a usable token is present. A malformed or unknown
  // token is treated as no token rather than as an error, because the answer for a stranger and for
  // an unauthenticated caller has to be the same 404.
  else if (route.optionalAuth) ctx.user = api.authenticateIfPresent(req, state);
  const run = () => route.handler(ctx);
  const result = route.key ? withIdempotency(ctx, run) : await run();
  return result;
}

async function handle(req, res) {
  try {
    const result = await dispatch(req);
    if (result.html !== undefined) sendHtml(res, result.status, result.html);
    else if (result.type !== undefined) sendHtml(res, result.status, result.body, result.type);
    else if (result.status === 204 || result.body === undefined) sendNoContent(res);
    else sendJson(res, result.status, result.body);
  } catch (err) {
    if (err instanceof ApiError) sendError(res, err);
    else {
      console.error('[tablekeeper] unexpected failure: ' + (err && err.stack ? err.stack : err));
      sendError(res, new ApiError('validation_failed'));
    }
  }
}

module.exports = { handle, dispatch, matchRoute, normalisePath, ROUTES };