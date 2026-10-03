'use strict';

const { fail } = require('./errors');

const MIN_KEY_LENGTH = 1;
const MAX_KEY_LENGTH = 255;

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value === undefined ? null : value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}

function sameBody(left, right) {
  return canonical(left) === canonical(right);
}

function requireKey(headerValue) {
  if (headerValue === undefined || headerValue === null || headerValue === '') {
    fail('missing_idempotency_key');
  }
  if (headerValue.length < MIN_KEY_LENGTH || headerValue.length > MAX_KEY_LENGTH) {
    fail('validation_failed', { field: 'Idempotency-Key', reason: 'key_length' });
  }
  return headerValue;
}

function lookup(state, userId, key, method, path, body) {
  const record = state.idempotency.find(
    (entry) => entry.user_id === userId && entry.key === key && entry.method === method && entry.path === path,
  );
  if (!record) return null;
  if (!sameBody(record.body, body)) fail('idempotency_key_reuse', { idempotency_key: key });
  return record;
}

function remember(state, userId, key, method, path, body, status, response) {
  state.idempotency.push({
    user_id: userId,
    key,
    method,
    path,
    body: JSON.parse(JSON.stringify(body)),
    status,
    response: JSON.parse(JSON.stringify(response)),
  });
}

module.exports = { requireKey, lookup, remember, sameBody, canonical };