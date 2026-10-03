'use strict';

const BUILTIN_STATUS_BY_CODE = Object.freeze({
  malformed_request: 400,
  missing_idempotency_key: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  idempotency_key_reuse: 409,
  email_taken: 409,
  table_unavailable: 409,
  cutoff_passed: 409,
  reservation_cancelled: 409,
  validation_failed: 422,
  not_on_slot_grid: 422,
  outside_opening_hours: 422,
  party_exceeds_capacity: 422,
  invalid_local_time: 422,
  combination_not_allowed: 422,
  // Stage 3 codes. stale_revision is a conflict like the other 409s because the caller named a
  // revision that is not current; already_in_series is likewise a conflict with existing state.
  stale_revision: 409,
  already_in_series: 409,
  // fixture_unsupported is stage 3's own: a reset fixture described something the reset cannot seed.
  // It is a validation failure, not a malformed body, and it exists so that the refusal is legible
  // instead of a 204 that silently seeded nothing.
  fixture_unsupported: 422,
});

let catalogue = null;
try {
  const candidate = require('./messages.js');
  if (candidate && candidate.STATUS_BY_CODE && typeof candidate.STATUS_BY_CODE === 'object') catalogue = candidate;
} catch {
  catalogue = null;
}

// The catalogue owns the wording and may be edited independently of this file, so it wins
// wherever it speaks. A code the service can raise is never allowed to go missing just because
// the catalogue has not caught up: combination_not_allowed arrived in stage 2 and its sentence
// is still a placeholder, so merging keeps the status right and the placeholder reachable.
const STATUS_BY_CODE = catalogue
  ? Object.freeze({ ...BUILTIN_STATUS_BY_CODE, ...catalogue.STATUS_BY_CODE })
  : BUILTIN_STATUS_BY_CODE;
const CODES = catalogue && Array.isArray(catalogue.ERROR_CODES)
  ? Object.freeze([...new Set([...catalogue.ERROR_CODES, ...Object.keys(STATUS_BY_CODE)])])
  : Object.freeze(Object.keys(STATUS_BY_CODE));

class ApiError extends Error {
  constructor(code, context) {
    super(code);
    this.name = 'ApiError';
    this.code = STATUS_BY_CODE[code] === undefined ? 'validation_failed' : code;
    this.rawCode = code;
    this.status = STATUS_BY_CODE[this.code];
    this.context = context && typeof context === 'object' ? context : {};
  }
}

function fail(code, context) {
  throw new ApiError(code, context);
}

function statusForCode(code) {
  if (catalogue && typeof catalogue.statusFor === 'function') {
    const status = catalogue.statusFor(code);
    if (typeof status === 'number' && status >= 400 && status < 600) return status;
  }
  const status = STATUS_BY_CODE[code];
  if (status !== undefined) return status;
  return 422;
}

module.exports = { ApiError, fail, statusForCode, CODES, STATUS_BY_CODE };