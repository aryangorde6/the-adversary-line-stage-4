'use strict';

const { fail } = require('./errors');
const { parseWall } = require('./time');

const MAX_ID_LENGTH = 64;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function has(object, name) {
  return object !== null && typeof object === 'object' && object[name] !== undefined;
}

function requireId(object, name) {
  if (!has(object, name)) fail('validation_failed', { field: name });
  const value = object[name];
  if (typeof value !== 'string') fail('malformed_request', { field: name });
  if (value.length === 0 || value.length > MAX_ID_LENGTH) fail('validation_failed', { field: name });
  return value;
}

function optionalId(object, name) {
  if (!has(object, name)) return undefined;
  return requireId(object, name);
}

function requirePartySize(object) {
  if (!has(object, 'party_size')) fail('validation_failed', { field: 'party_size' });
  const value = object.party_size;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    fail('validation_failed', { field: 'party_size', reason: 'party_size' });
  }
  return value;
}

function optionalPartySize(object) {
  if (!has(object, 'party_size')) return undefined;
  return requirePartySize(object);
}

function requireStartsAtLocal(object) {
  if (!has(object, 'starts_at_local')) fail('validation_failed', { field: 'starts_at_local' });
  const value = object.starts_at_local;
  if (typeof value !== 'string') fail('malformed_request', { field: 'starts_at_local' });
  const wall = parseWall(value);
  if (!wall) fail('validation_failed', { field: 'starts_at_local', reason: 'time_format', date: value.slice(0, 10) });
  return wall;
}

function optionalStartsAtLocal(object) {
  if (!has(object, 'starts_at_local')) return undefined;
  return requireStartsAtLocal(object);
}

// A table set is one or two ids. Reading it is separate from checking it against a restaurant,
// because the shape is the request's business and the pairing is the model's.
function readTableIds(object, name) {
  if (!has(object, name)) return undefined;
  const value = object[name];
  if (!Array.isArray(value)) fail('malformed_request', { field: name });
  if (value.length === 0) fail('validation_failed', { field: name });
  for (const member of value) {
    if (typeof member !== 'string') fail('malformed_request', { field: name });
    if (member.length === 0 || member.length > MAX_ID_LENGTH) fail('validation_failed', { field: name });
  }
  return value;
}

function optionalString(object, name) {
  if (!has(object, name)) return undefined;
  const value = object[name];
  if (typeof value !== 'string') fail('malformed_request', { field: name });
  return value;
}

function requireString(object, name) {
  if (!has(object, name)) fail('validation_failed', { field: name });
  return optionalString(object, name);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

function normaliseEmail(value, name) {
  if (typeof value !== 'string') fail('malformed_request', { field: name });
  if (!EMAIL_PATTERN.test(value)) fail('validation_failed', { field: name, reason: 'email_format' });
  return value.toLowerCase();
}

function queryValue(url, name) {
  const values = url.searchParams.getAll(name);
  return values.length === 0 ? null : values[0];
}

function requireQueryId(url, name) {
  const raw = queryValue(url, name);
  if (raw === null) fail('validation_failed', { field: name });
  if (raw.length === 0 || raw.length > MAX_ID_LENGTH) fail('validation_failed', { field: name });
  return raw;
}

// `explain` has one accepted value and everything else is a 422, including false, 1 and the empty
// string. Reading it as a truthy flag would accept explain=0 and silently omit the explanation, so
// the parameter is compared as a string rather than coerced.
function explainFlag(url) {
  const raw = queryValue(url, 'explain');
  if (raw === null) return false;
  if (raw !== 'true') fail('validation_failed', { field: 'explain' });
  return true;
}

function requireQueryInteger(url, name, options) {
  const raw = queryValue(url, name);
  if (raw === null) fail('validation_failed', { field: name });
  if (!/^-?[0-9]+$/.test(raw)) fail('validation_failed', { field: name });
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) fail('validation_failed', { field: name });
  if (options && options.min !== undefined && value < options.min) {
    fail('validation_failed', { field: name });
  }
  if (options && options.max !== undefined && value > options.max) {
    fail('validation_failed', { field: name });
  }
  return value;
}

module.exports = {
  MAX_ID_LENGTH,
  isPlainObject,
  has,
  requireId,
  optionalId,
  readTableIds,
  requirePartySize,
  optionalPartySize,
  requireStartsAtLocal,
  optionalStartsAtLocal,
  optionalString,
  requireString,
  normaliseEmail,
  queryValue,
  explainFlag,
  requireQueryId,
  requireQueryInteger,
};