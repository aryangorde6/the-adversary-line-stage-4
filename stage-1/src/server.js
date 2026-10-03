'use strict';

const { ApiError, fail } = require('./errors');
const store = require('./state');
const idem = require('./idempotency');
const api = require('./api');
const { sendJson, sendNoContent, sendError, readRawBody, parseJsonObject, parseJsonValue } = require('./http');

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
];

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
  const run = () => route.handler(ctx);
  const result = route.key ? withIdempotency(ctx, run) : await run();
  return result;
}

async function handle(req, res) {
  try {
    const result = await dispatch(req);
    if (result.status === 204 || result.body === undefined) sendNoContent(res);
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