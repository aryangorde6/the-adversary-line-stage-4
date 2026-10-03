'use strict';
// R029 / mutant-12 — an integer-valued query parameter is written as plain decimal
// digits. "1e9", "4.0" and "+4" are 422 validation_failed whatever their numeric value.
// Also asserts the body-side rule that this row is easy to get backwards: in a JSON body
// "party_size": 4.0 parses to the number 4 and is valid, while "+4" does not parse at all.

const { req, json, code, short, check, finish, reset, login, book, booking, allWeek } = require('./lib');

async function run() {
  await reset(allWeek());
  const token = await login();

  const bad = ['1e9', '4.0', '%2B4', '0', '-1', 'abc', '', '2.5', '0x4', ' 4', '4 ', '+0', 'Infinity', 'NaN'];
  const observed = [];
  let allRejected = true;
  for (const v of bad) {
    const r = await req('GET', `/availability?restaurant_id=r_anker&date=2026-09-24&party_size=${v}`);
    const ok = r.status === 422 && code(r) === 'validation_failed';
    if (!ok) allRejected = false;
    observed.push(`${JSON.stringify(v)}->${r.status}/${code(r)}`);
  }
  check(
    'R029a',
    allRejected,
    `query party_size values ${JSON.stringify(bad)} -> ${observed.join(' ')} ` +
      `(each expected 422 validation_failed; a 200 means the decimal-digits rule is not enforced)`
  );

  // The negative half: valid plain decimal digits are accepted, and 1 and 4 both work.
  const one = await req('GET', '/availability?restaurant_id=r_anker&date=2026-09-24&party_size=1');
  const four = await req('GET', '/availability?restaurant_id=r_anker&date=2026-09-24&party_size=4');
  check(
    'R029b',
    one.status === 200 && four.status === 200,
    `query party_size=1 -> ${one.status}, party_size=4 -> ${four.status} (both expected 200)`
  );

  // Leading zeros are still plain decimal digits.
  const zero = await req('GET', '/availability?restaurant_id=r_anker&date=2026-09-24&party_size=04');
  check('R029c', zero.status === 200, `query party_size=04 -> ${zero.status}/${code(zero)} (expected 200)`);

  // A missing parameter is 422 too, and must not be reported as a bad integer.
  const missing = await req('GET', '/availability?restaurant_id=r_anker&date=2026-09-24');
  check(
    'R029d',
    missing.status === 422 && code(missing) === 'validation_failed',
    `query with no party_size -> ${missing.status}/${code(missing)} ${short(missing.body)}`
  );

  // An unknown query parameter is ignored.
  const extra = await req('GET', '/availability?restaurant_id=r_anker&date=2026-09-24&party_size=2&foo=bar');
  check(
    'R029e',
    extra.status === 200,
    `query with an unknown parameter foo=bar -> ${extra.status}/${code(extra)} (expected 200, ignored)`
  );

  // ---- the body side, which is where this row is commonly inverted ----------
  const bodyFloat = await book(token, 'q-1', JSON.stringify(booking('2026-09-24T19:00', { party_size: 4.0 })));
  check(
    'R029f',
    bodyFloat.status === 201,
    `JSON body party_size 4.0 -> ${bodyFloat.status}/${code(bodyFloat)} ${short(bodyFloat.body)} ` +
      `(expected 201: 4.0 parses to the number 4, and §5 makes only invalid values a 422)`
  );

  const bodyPlus = await book(token, 'q-2', JSON.stringify(booking('2026-09-24T21:00', { party_size: '+4' })));
  check(
    'R029g',
    bodyPlus.status === 400 && code(bodyPlus) === 'malformed_request',
    `JSON body party_size "+4" -> ${bodyPlus.status}/${code(bodyPlus)} ${short(bodyPlus.body)} ` +
      `(expected 400 malformed_request: that body does not parse at all)`
  );

  const bodyBool = await book(token, 'q-3', booking('2026-09-24T21:00', { party_size: true }));
  check(
    'R029h',
    bodyBool.status === 422 && code(bodyBool) === 'validation_failed',
    `JSON body party_size true -> ${bodyBool.status}/${code(bodyBool)} (expected 422: booleans are named in §5)`
  );

  const bodyString = await book(token, 'q-4', booking('2026-09-24T21:00', { party_size: 'four' }));
  check(
    'R029i',
    bodyString.status === 422 && code(bodyString) === 'validation_failed',
    `JSON body party_size "four" -> ${bodyString.status}/${code(bodyString)} (expected 422)`
  );

  const bodyZero = await book(token, 'q-5', booking('2026-09-24T21:00', { party_size: 0 }));
  check(
    'R029j',
    bodyZero.status === 422 && code(bodyZero) === 'validation_failed',
    `JSON body party_size 0 -> ${bodyZero.status}/${code(bodyZero)} (expected 422)`
  );

  // And the leaked-state negative: none of the refused bodies created a booking.
  const list = await req('GET', '/reservations', { authorization: `Bearer ${token}` });
  const all = (json(list) || {}).reservations || [];
  check(
    'R029k',
    all.length === 1 && all[0].starts_at_local === '2026-09-24T19:00',
    `reservations after four refused bodies = ${all.length} at ${JSON.stringify(all.map((r) => r.starts_at_local))} ` +
      `(expected exactly 1 at 19:00)`
  );

  finish();
}

run().catch((e) => {
  console.log('ROW R029 FAIL probe error: ' + e.message);
  process.exit(1);
});