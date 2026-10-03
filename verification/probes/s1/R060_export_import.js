'use strict';
// R058 / mutant-09 — import is atomic REPLACEMENT, not merge. Repeating it restores the
// exported state without duplicating anything, and a refused import changes nothing.
// R060 / mutant-10 — import preserves accounts, hashed-password login, live bearer tokens,
// fixture configuration, reservations, references, statuses, created_at values, and every
// completed idempotent receipt with its original response body. Nothing is regenerated.

const { req, json, code, short, check, finish, reset, login, auth, book, booking, allWeek } = require('./lib');

async function run() {
  await reset(allWeek());
  const token = await login();

  // A completed receipt whose original body must survive the round trip.
  const created = await book(token, 'r60-key', booking('2026-09-24T19:00'));
  check('R060a', created.status === 201, `establish a receipt -> ${created.status} ${short(created.body)}`);
  if (created.status !== 201) return finish();
  const ref = json(created).reference;
  const createdAt = json(created).created_at;
  const resId = json(created).reservation_id;
  const originalBody = created.body;

  // A key whose request FAILED, so it must still be reusable after import.
  const failedKey = 'r60-failed';
  const failed = await book(token, failedKey, booking('2026-09-24T20:00', { table_id: 't_1', party_size: 99 }));
  check(
    'R060b',
    failed.status === 422,
    `establish a failed key (party_size 99) -> ${failed.status} code=${code(failed)} ${short(failed.body)} (expected a 4xx)`
  );

  const exportRes = await req('GET', '/_test/export');
  check('R060c', exportRes.status === 200, `GET /_test/export -> ${exportRes.status}`);
  const doc = json(exportRes) || {};
  check(
    'R060d',
    doc.track === 'tablekeeper' && doc.format_version === 1 && !!doc.state && typeof doc.state === 'object',
    `export envelope: track=${JSON.stringify(doc.track)} format_version=${JSON.stringify(doc.format_version)} ` +
      `state present=${!!doc.state} state type=${typeof doc.state}`
  );

  // ---- mutate: a second reservation, a second user, and a cancel -------------
  const extra = await book(token, 'r60-extra', booking('2026-09-24T21:00'));
  check('R060e', extra.status === 201, `mutate: second booking -> ${extra.status}`);
  const cancelled = await req('POST', `/reservations/${ref}/cancel`, auth(token));
  check('R060f', cancelled.status === 200, `mutate: cancel ${ref} -> ${cancelled.status}`);
  const bob = await req('POST', '/auth/signup', {}, { email: 'bob@example.com', password: 'password123', display_name: 'Bob' });
  check('R060g', bob.status === 201, `mutate: sign up Bob -> ${bob.status} ${short(bob.body)}`);
  const bobToken = bob.status === 201 ? json(bob).token : null;

  // The export must be a snapshot: it must not contain the later booking or Bob.
  const beforeImport = await req('GET', '/restaurants');
  check('R060h', beforeImport.status === 200, `mutation is visible before import -> ${beforeImport.status}`);

  // ---- import the export unchanged ------------------------------------------
  const imp = await req('POST', '/_test/import', { 'content-type': 'application/json' }, doc);
  check('R060i', imp.status === 204, `POST /_test/import of the export unchanged -> ${imp.status} ${short(imp.body)}`);

  // ---- R058: replacement, not merge -----------------------------------------
  const afterList = await req('GET', '/reservations', auth(token));
  const after = (json(afterList) || {}).reservations || [];
  check(
    'R058a',
    after.length === 1,
    `reservations after import = ${after.length} at ${JSON.stringify(after.map((r) => r.starts_at_local))} ` +
      `(expected exactly 1, the exported one at 19:00 — the mutation's 21:00 booking must be GONE, and a count of 2 or 3 means import merged)`
  );
  check(
    'R058b',
    after.length === 1 && after[0].status === 'confirmed',
    `the imported reservation's status = ${after.length ? after[0].status : 'absent'} ` +
      `(expected confirmed: the cancel happened after the export and must have been rolled back)`
  );

  // Bob must be gone: import removed all previous destination credentials.
  const bobLogin = await req('POST', '/auth/login', {}, { email: 'bob@example.com', password: 'password123' });
  check(
    'R058c',
    bobLogin.status === 401,
    `Bob signed up after the export -> login after import = ${bobLogin.status} code=${code(bobLogin)} ` +
      `(expected 401: import replaces all previous destination data, so Bob must not exist)`
  );
  if (bobToken) {
    const bobAuth = await req('GET', '/reservations', { authorization: `Bearer ${bobToken}` });
    check(
      'R058d',
      bobAuth.status === 401,
      `Bob's pre-import token -> GET /reservations = ${bobAuth.status} (expected 401)`
    );
  }

  // ---- R060: preservation ----------------------------------------------------
  const loginAgain = await req('POST', '/auth/login', {}, { email: 'ada@example.com', password: 'correct horse' });
  check(
    'R060j',
    loginAgain.status === 200,
    `the pre-export account still logs in with its original password -> ${loginAgain.status} ${short(loginAgain.body)}`
  );

  const withOldToken = await req('GET', '/reservations', auth(token));
  check(
    'R060k',
    withOldToken.status === 200,
    `the pre-export bearer token still authorises -> GET /reservations = ${withOldToken.status}`
  );

  const byRef = await req('GET', `/reservations/${ref}`, auth(token));
  check(
    'R060l',
    byRef.status === 200,
    `the pre-export reference ${ref} still resolves -> ${byRef.status} code=${code(byRef)} ${short(byRef.body)}`
  );
  check(
    'R060m',
    !!json(byRef) && json(byRef).reference === ref && json(byRef).reservation_id === resId && json(byRef).created_at === createdAt,
    `identities not regenerated: reference=${json(byRef) && json(byRef).reference} (want ${ref}), ` +
      `reservation_id=${json(byRef) && json(byRef).reservation_id} (want ${resId}), ` +
      `created_at=${json(byRef) && json(byRef).created_at} (want ${createdAt})`
  );

  const replay = await book(token, 'r60-key', booking('2026-09-24T19:00'));
  check(
    'R060n',
    replay.status === 200 && replay.body === originalBody,
    `a completed idempotent POST replays its ORIGINAL body after import -> ${replay.status}, ` +
      `byte-identical: ${replay.body === originalBody}. ${short(replay.body)}`
  );

  const reuseFailed = await book(token, failedKey, booking('2026-09-24T22:00', { party_size: 2 }));
  check(
    'R060o',
    reuseFailed.status === 201,
    `the key whose request had failed is still usable as a first use -> ${reuseFailed.status} code=${code(reuseFailed)} ${short(reuseFailed.body)} (expected 201)`
  );

  // ---- R058: a repeated identical import duplicates nothing ------------------
  const imp2 = await req('POST', '/_test/import', { 'content-type': 'application/json' }, doc);
  check('R058e', imp2.status === 204, `a second identical import -> ${imp2.status} ${short(imp2.body)} (expected 204)`);
  const list2 = await req('GET', '/reservations', auth(token));
  const all2 = (json(list2) || {}).reservations || [];
  check(
    'R058f',
    all2.length === 1 && all2[0].reference === ref,
    `after the second import -> ${all2.length} reservations ${JSON.stringify(all2.map((r) => r.reference))} ` +
      `(expected exactly 1, ${ref} — the 22:00 booking from R060o must be gone and nothing duplicated)`
  );

  // ---- a refused import changes nothing --------------------------------------
  const stateBefore = await req('GET', '/_test/export');
  const bad = [
    ['wrong track', Object.assign({}, doc, { track: 'other' })],
    ['wrong version', Object.assign({}, doc, { format_version: 2 })],
    ['missing state', { track: 'tablekeeper', format_version: 1 }],
    ['state not an object', Object.assign({}, doc, { state: 'nope' })],
  ];
  let refusedAll = true;
  const detail = [];
  for (const [label, payload] of bad) {
    const r = await req('POST', '/_test/import', { 'content-type': 'application/json' }, payload);
    const ok = r.status === 422 && code(r) === 'validation_failed';
    if (!ok) refusedAll = false;
    detail.push(`${label}: ${r.status}/${code(r)}`);
  }
  check('R058g', refusedAll, `refused imports -> ${detail.join('; ')} (each expected 422 validation_failed)`);

  const stateAfter = await req('GET', '/_test/export');
  check(
    'R058h',
    stateAfter.status === 200 && stateAfter.body === stateBefore.body,
    `the destination is unchanged after four refused imports: identical export = ${stateAfter.body === stateBefore.body}`
  );

  // An unparseable body is 400 malformed_request, not 422.
  const junk = await req('POST', '/_test/import', { 'content-type': 'application/json' }, '{not json');
  check(
    'R058i',
    junk.status === 400 && code(junk) === 'malformed_request',
    `unparseable import body -> ${junk.status} code=${code(junk)} ${short(junk.body)} (expected 400 malformed_request)`
  );

  // ---- reset still clears imported state -------------------------------------
  const fresh = allWeek();
  fresh.restaurants[0].name = 'After Import';
  await reset(fresh);
  const named = await req('GET', '/restaurants');
  check(
    'R058j',
    named.status === 200 && JSON.stringify(json(named)).includes('After Import'),
    `reset after import clears it -> restaurants=${short(named.body, 160)}`
  );

  finish();
}

run().catch((e) => {
  console.log('ROW R060 FAIL probe error: ' + e.message);
  process.exit(1);
});