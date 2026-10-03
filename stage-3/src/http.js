'use strict';

const { ApiError } = require('./errors');
const { text } = require('./text');

const JSON_TYPE = 'application/json; charset=utf-8';
const MAX_BODY_BYTES = 1024 * 1024;

function sendNoContent(res) {
  res.writeHead(204, { 'Cache-Control': 'no-store' });
  res.end();
}

function sendJson(res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload === undefined ? null : payload), 'utf8');
  res.writeHead(status, {
    'Content-Type': JSON_TYPE,
    'Content-Length': String(body.length),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

// A screen is not an API response, so it does not go out as JSON. no-store is the default because
// a page carries whoever is signed in; the client script passes its own type and no cache header,
// which leaves the browser free to cache it however it likes.
function sendHtml(res, status, html, type) {
  const body = Buffer.from(String(html), 'utf8');
  const headers = {
    'Content-Type': type || 'text/html; charset=utf-8',
    'Content-Length': String(body.length),
  };
  if (type === undefined) headers['Cache-Control'] = 'no-store';
  res.writeHead(status, headers);
  res.end(body);
}

function sendError(res, err) {
  const apiError = err instanceof ApiError ? err : null;
  const code = apiError ? apiError.code : 'validation_failed';
  const context = apiError ? apiError.context : {};
  sendJson(res, apiError ? apiError.status : 422, {
    error: { code, message: text(code, context) },
  });
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    req.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        settled = true;
        reject(new ApiError('malformed_request'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks));
    });
    req.on('error', () => {
      if (settled) return;
      settled = true;
      reject(new ApiError('malformed_request'));
    });
  });
}

function parseJsonObject(raw) {
  if (raw.length === 0) throw new ApiError('malformed_request');
  let parsed;
  try {
    parsed = JSON.parse(raw.toString('utf8'));
  } catch {
    throw new ApiError('malformed_request');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ApiError('malformed_request');
  }
  return parsed;
}

function parseJsonValue(raw) {
  if (raw.length === 0) throw new ApiError('malformed_request');
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch {
    throw new ApiError('malformed_request');
  }
}

module.exports = { sendJson, sendHtml, sendNoContent, sendError, readRawBody, parseJsonObject, parseJsonValue };