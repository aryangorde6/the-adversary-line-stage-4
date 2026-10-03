// One place that decides which service a suite is talking to, and one place that decides what happens
// when there is nothing there.
//
// This exists because the folder carried three conventions for one argument -- TK_BASE_URL in one file,
// argv[2] in five, and a README showing one of them. An undocumented second convention is learnable only
// by reading the implementation, and it was got wrong twice: once reading a dead port as a slow suite,
// once as a flaky one. The precedence now lives here once and every call site imports it, so a fourth
// file cannot invent a fifth convention.
//
//   node ui-grid.mjs http://localhost:18099          argv[2] wins
//   BASE=http://localhost:18099 node ui-grid.mjs     or the environment
//   TK_BASE_URL=... node stage3-api.mjs              kept: an existing invocation must not silently
//                                                    start pointing somewhere else
// URL joining is concatenation, not path.join: path.join collapses the double slash in "http://" and
// turns a base into "http:/localhost", which fails in a way that looks like a dead service. That is
// exactly the confusion this module exists to remove, so it is worth a line of its own.
function at(base, path) {
  if (/^https?:\/\//.test(path)) return path;
  return base.replace(/\/+$/, '') + (path.startsWith('/') ? path : '/' + path);
}

export const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 5000);

export const BASE = process.argv[2]
  || process.env.BASE
  || process.env.TK_BASE_URL
  || 'http://localhost:18099';

export const DEFAULT_BASE = 'http://localhost:18099';

// The signal every request in this folder carries. A wrong URL is then a failure in seconds rather than
// a silence, and silence is indistinguishable from slowness -- the more comfortable of the two readings.
export function timeoutSignal() {
  return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
}

// fetch with the folder's conventions already applied: the resolved base, JSON handling, and a bounded
// signal. A call site that rolls its own fetch is how the conventions drifted in the first place.
export async function call(method, path, { body, token, key, base = BASE } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (key) headers['Idempotency-Key'] = key;
  const response = await fetch(at(base, path), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: timeoutSignal(),
  });
  const text = await response.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: response.status, body: parsed, raw: text };
}

// Reachability is asserted HERE, at import, rather than by each suite remembering to call something.
//
// A precheck a suite can forget to call is not a precheck, and the failure this exists to prevent is a
// suite silently not calling it. It also runs before this module's importers get to construct anything,
// so "I could not start it" can never look like "it found nothing": a suite that cannot reach its service
// exits in seconds naming the URL it tried, instead of hanging until someone kills it and the silence
// being read as a slow suite.
try {
  const probe = await fetch(at(BASE, '/health'), { signal: timeoutSignal() });
  if (!probe.ok) throw new Error(`HTTP ${probe.status}`);
} catch (cause) {
  console.error(
    `FATAL: cannot reach the service at ${BASE}.\n`
    + `  Pass it as argv[2] or set BASE. Checked GET ${BASE}/health within ${REQUEST_TIMEOUT_MS}ms.\n`
    + `  Cause: ${cause && cause.message ? cause.message : cause}\n`
    + `  Nothing was measured. This is a setup failure, not a result.`,
  );
  process.exit(1);
}

export const reachable = true;
