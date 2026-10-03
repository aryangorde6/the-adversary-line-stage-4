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

function text(code, context) {
  const details = context && typeof context === 'object' ? context : {};
  if (userText) {
    try {
      const value = userText.message(code, details);
      if (typeof value === 'string' && value.trim() !== '') return value;
    } catch (err) {
      console.warn('[tablekeeper] message("' + code + '") threw: ' + err.message);
    }
  }
  return PLAIN;
}

module.exports = { text };