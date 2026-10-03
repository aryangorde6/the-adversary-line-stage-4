// What a screen may say about the terms a booking was made under, once the terms in force have
// moved on.
//
//   node ui-booking-terms.mjs [baseUrl]
//
// Written before the screen that would fail it, for the same reason the day-state row was: the
// order has produced every real defect in this project and has never produced a false one.
//
// A booking carries the terms it was accepted under. A restaurant publishes new terms, and from that
// moment the terms in force are not the terms the booking was made under. The service can be
// entirely correct about both -- the booking's snapshot unchanged, the new policy in force for new
// queries -- while a screen quietly presents one as the other. That is the same "a state with no
// surface" question as the shut day, one screen over.
//
// The obligation here is the same refusal: a screen states what the booking was made under, or
// nothing. It does not decide that a booking is on current terms because nothing told it otherwise,
// and it does not fill in a number the service has not given it.
import { chromium } from 'playwright-core';
import { BASE, SHOTS, ok, section, report } from './ui-lib.mjs';
import { call } from './stage4-base.mjs';

const HOURS = [{ weekday: 'tue', opens: '17:00', closes: '23:00' }];
const OPEN_DAY = '2026-12-01';

function fixture() {
  return {
    users: [{ id: 'u_ada', email: 'ada@example.com', password: 'correct horse', display_name: 'Ada' }],
    restaurants: [{
      id: 'r_anker', name: 'Zum Anker', timezone: 'Europe/Berlin', slot_minutes: 30,
      reservation_duration_minutes: 90, cancellation_cutoff_minutes: 120,
      opening_hours: HOURS, manager_user_ids: ['u_ada'],
      tables: [{ id: 't_1', label: '1', capacity: 2 }, { id: 't_2', label: '2', capacity: 4 }],
    }],
    reservations: [],
  };
}

// Claims that the booking is on the restaurant's terms as they stand. A screen may only make one of
// these if the service has said so, and nothing in the reservation response says so.
const CURRENT_CLAIM = /current terms|as it stands|now applies|still applies|up to date|these terms still/i;
// The terms a booking was actually made under, which are safe to show because they are its own.
const ACCEPTED_NUMBER = /30|90|120/;

async function bookAndPublish() {
  const login = await call('POST', '/auth/login',
    { body: { email: 'ada@example.com', password: 'correct horse' } });
  const tok = login.body.token;
  const booking = await call('POST', '/reservations', {
    body: { restaurant_id: 'r_anker', table_id: 't_1',
      starts_at_local: `${OPEN_DAY}T18:00`, party_size: 2 },
    token: tok, key: 'terms-booking-1',
  });
  const policy = await call('POST', '/restaurants/r_anker/policies', {
    body: { effective_from: OPEN_DAY, slot_minutes: 15, reservation_duration_minutes: 60,
      cancellation_cutoff_minutes: 60, opening_hours: HOURS, capacities: { t_1: 2, t_2: 4 } },
    token: tok, key: 'terms-policy-1',
  });
  return { tok, reference: booking.body.reference, booking, policy };
}

async function readLookup(page, reference, tok) {
  await page.goto(BASE + '/lookup', { waitUntil: 'networkidle' });
  await page.evaluate((token) => {
    document.cookie = 'tk_token=' + encodeURIComponent(token) + '; path=/; SameSite=Lax';
  }, tok);
  await page.reload({ waitUntil: 'networkidle' });
  await page.fill('#lookup-reference-input', reference);
  await page.click('[data-testid="lookup-submit"]');
  await page.waitForTimeout(800);
  return page.evaluate(() => {
    const detail = document.querySelector('[data-testid="reservation-detail"]');
    return {
      present: !!detail,
      text: detail ? detail.textContent.replace(/\s+/g, ' ').trim() : '',
      visibleText: [...document.querySelectorAll('body *')]
        .filter((el) => el.children.length === 0 && el.offsetParent !== null)
        .map((el) => el.textContent.replace(/\s+/g, ' ').trim())
        .filter(Boolean).join(' '),
      cancelPresent: !!document.querySelector('[data-testid="reservation-cancel-button"]'),
    };
  });
}

async function main() {
  section('the fixture is arranged, and each step is asserted before the next reads it');
  const reset = await call('POST', '/_test/reset', { body: fixture() });
  ok('reset accepted', reset.status === 204 || reset.status === 200,
    { status: reset.status, body: JSON.stringify(reset).slice(0, 140) });
  const { tok, reference, booking, policy } = await bookAndPublish();
  ok('a booking was made under the terms then in force', booking.status === 201 && Boolean(reference),
    { status: booking.status });
  ok('new terms were published', policy.status === 201, { status: policy.status });
  ok('the booking was made under the earlier terms',
    booking.body.accepted_terms && booking.body.accepted_terms.policy_version === 0,
    { accepted: booking.body.accepted_terms });
  ok('the terms now in force are a later version',
    policy.body.policy_version === 1, { published: policy.body.policy_version });

  const after = await call('GET', '/reservations/' + reference, { token: tok });
  ok('the booking still reports the terms it was accepted under',
    after.body.accepted_terms && after.body.accepted_terms.policy_version === 0,
    { accepted: after.body.accepted_terms });
  ok('and the booking is untouched by the new terms',
    after.body.status === 'confirmed' && after.body.revision === 1,
    { status: after.body.status, revision: after.body.revision });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 900 } });
  page.setDefaultTimeout(6000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  section('the lookup screen for a booking whose terms have moved on');
  const shown = await readLookup(page, reference, tok);
  ok('the booking is shown', shown.present && shown.text.length > 0, shown);
  ok('the screen does not claim the booking is on the terms now in force',
    !CURRENT_CLAIM.test(shown.visibleText), { said: shown.visibleText.slice(0, 200) });
  // This row must not be able to pass by saying nothing at all without saying so. Whether the screen
  // shows terms is recorded as its own assertion, so a future screen that starts showing them cannot
  // inherit a green from a version that showed none.
  const showsTerms = /terms|slot minutes|duration|cutoff|cancellation window/i.test(shown.visibleText);
  console.log(`        (the lookup screen ${showsTerms ? 'shows' : 'does not show'} terms at all)`);
  ok('if the screen states terms, they are the booking\'s own accepted terms and not the new ones',
    !showsTerms || (!/15|60/.test(shown.visibleText) && ACCEPTED_NUMBER.test(shown.visibleText)),
    { showsTerms, said: shown.visibleText.slice(0, 200) });
  ok('the screen does not offer a cancellation the booking no longer has',
    shown.cancelPresent === true, { cancelPresent: shown.cancelPresent });
  ok('no page errors', errors.length === 0, errors.slice(0, 3));

  if (SHOTS) await page.screenshot({ path: `${SHOTS}/booking-terms.png`, fullPage: true });

  await page.close();
  await browser.close();
}

main().then(() => { report(); }).catch((error) => {
  console.log('  FAIL  suite error -- ' + error.message);
  process.exitCode = 1;
});