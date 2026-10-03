'use strict';

let userText = null;
try {
  const candidate = require('./messages.js');
  if (candidate && typeof candidate.message === 'function') userText = candidate;
} catch {
  userText = null;
}

if (!userText) {
  console.warn('[tablekeeper] src/messages.js is absent or has no message(): using fallback error text.');
}

const PLAIN = 'Something went wrong at our end and we could not finish that. Please try again in a moment.';

// The catalogue owns the wording and is edited independently of this file, so a code it does not
// carry yet is a known gap rather than a fault. Saying our own end is broken would be a lie, so
// such a code gets a sentence that is plainly marked as unfinished: a placeholder for the seat that
// owns the wording, not something to ship to a diner.
const UNWRITTEN = '[placeholder] We cannot use that table combination here. Please pick another seating choice.';

function catalogueCarries(code) {
  if (!userText) return false;
  if (Array.isArray(userText.ERROR_CODES)) return userText.ERROR_CODES.includes(code);
  return Boolean(userText.STATUS_BY_CODE) && Object.prototype.hasOwnProperty.call(userText.STATUS_BY_CODE, code);
}

function text(code, context) {
  const details = context && typeof context === 'object' ? context : {};
  if (userText && catalogueCarries(code)) {
    try {
      const value = userText.message(code, details);
      if (typeof value === 'string' && value.trim() !== '') return value;
    } catch (err) {
      console.warn('[tablekeeper] message("' + code + '") threw: ' + err.message);
    }
  }
  if (code === 'combination_not_allowed') return UNWRITTEN;
  return PLAIN;
}

module.exports = { text };