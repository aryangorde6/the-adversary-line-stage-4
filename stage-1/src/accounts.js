'use strict';

const crypto = require('node:crypto');

const SCRYPT_PARAMS = Object.freeze({ N: 16384, r: 8, p: 1, maxmem: 96 * 1024 * 1024 });
const KEY_BYTES = 32;
const SALT_BYTES = 16;
const REFERENCE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const REFERENCE_LENGTH = 8;

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(SALT_BYTES);
    crypto.scrypt(password, salt, KEY_BYTES, SCRYPT_PARAMS, (err, derived) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(
        [
          'scrypt',
          SCRYPT_PARAMS.N,
          SCRYPT_PARAMS.r,
          SCRYPT_PARAMS.p,
          salt.toString('base64url'),
          derived.toString('base64url'),
        ].join('$'),
      );
    });
  });
}

function verifyPassword(password, stored) {
  return new Promise((resolve) => {
    if (typeof stored !== 'string') {
      resolve(false);
      return;
    }
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') {
      resolve(false);
      return;
    }
    const expected = Buffer.from(parts[5], 'base64url');
    if (expected.length !== KEY_BYTES) {
      resolve(false);
      return;
    }
    let salt;
    try {
      salt = Buffer.from(parts[4], 'base64url');
    } catch {
      resolve(false);
      return;
    }
    crypto.scrypt(password, salt, KEY_BYTES, {
      N: Number(parts[1]),
      r: Number(parts[2]),
      p: Number(parts[3]),
      maxmem: SCRYPT_PARAMS.maxmem,
    }, (err, derived) => {
      if (err || derived.length !== expected.length) {
        resolve(false);
        return;
      }
      resolve(crypto.timingSafeEqual(derived, expected));
    });
  });
}

function randomToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function randomId(prefix) {
  return prefix + crypto.randomBytes(9).toString('hex');
}

function newReference(isTaken) {
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const bytes = crypto.randomBytes(REFERENCE_LENGTH);
    let reference = '';
    for (let i = 0; i < REFERENCE_LENGTH; i += 1) {
      reference += REFERENCE_ALPHABET[bytes[i] % REFERENCE_ALPHABET.length];
    }
    if (!isTaken(reference)) return reference;
  }
  throw new Error('could not allocate a unique reference');
}

module.exports = {
  hashPassword,
  verifyPassword,
  randomToken,
  randomId,
  newReference,
  REFERENCE_LENGTH,
  REFERENCE_ALPHABET,
};