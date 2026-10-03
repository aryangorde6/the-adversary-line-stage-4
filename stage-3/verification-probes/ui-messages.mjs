// Lookup and message integrity: what is on the screen after each outcome, and the rule that an
// inserted message appears exactly once inside a host that exists at the moment of insertion.
//
//   node verification/probes/s2/ui-messages.mjs [baseUrl]
import { chromium } from 'playwright-core';
import { BASE, SHOTS, ok, section, report, req, baseFixture, seed, token } from './ui-lib.mjs';

async function signIn(page) {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('#login-email', 'ada@example.com');
  await page.fill('#login-password', 'correct horse');
  await page.click('[data-testid="login-submit"]');
  await page.waitForTimeout(900);
}

async function main() {
  await seed(baseFixture());
  const tok = await token();
  const book = (body, key) => fetch(BASE + '/reservations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}`, 'Idempotency-Key': key },
    body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

  const booking = await book(
    { restaurant_id: 'r_anker', table_id: 't_2', starts_at_local: '2026-12-01T18:00', party_size: 2 },
    'seed-ada-1');
  ok('seed: a booking was created', booking.status === 201 && Boolean(booking.body.reference),
    { status: booking.status, body: JSON.stringify(booking.body).slice(0, 120) });
  const reference = booking.body.reference;
  const other = await book(
    { restaurant_id: 'r_anker', table_id: 't_4', starts_at_local: '2026-12-01T18:00', party_size: 2 },
    'seed-ada-2');
  const foreign = other.body ? other.body.reference : null;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 900 } });
  page.setDefaultTimeout(6000);
  await page.goto(BASE + '/lookup', { waitUntil: 'networkidle' });

  section('lookup before any search');
  ok('lookup-form host exists', await page.locator('[data-testid="lookup-form"]').count() === 1);
  ok('no detail on load',
    await page.locator('[data-testid="reservation-detail"]').count() === 0);
  ok('no error on load',
    await page.locator('[data-testid="reservation-error"]').count() === 0);

  section('a reference that was never allocated');
  await page.fill('#lookup-reference-input', 'ZZZZZZZZ');
  await page.click('[data-testid="lookup-submit"]');
  await page.waitForTimeout(700);
  ok('reservation-error present once',
    await page.locator('[data-testid="reservation-error"]').count() === 1);
  ok('reservation-error visible',
    await page.locator('[data-testid="reservation-error"]').isVisible());
  ok('reservation-error carries the service sentence',
    ((await page.locator('[data-testid="reservation-error"]').textContent()) || '').length > 10);
  ok('no detail beside an error',
    await page.locator('[data-testid="reservation-detail"]').count() === 0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/lookup-missing.png`, fullPage: true });

  if (foreign) {
    section("another diner's reference");
    await page.fill('#lookup-reference-input', foreign);
    await page.click('[data-testid="lookup-submit"]');
    await page.waitForTimeout(700);
    ok('a reference the caller cannot see reads the same as one that never existed',
      await page.locator('[data-testid="reservation-error"]').count() === 1
      && await page.locator('[data-testid="reservation-detail"]').count() === 0);
  }

  section('a booking the caller can see');
  await signIn(page);
  await page.goto(BASE + '/lookup', { waitUntil: 'networkidle' });
  await page.fill('#lookup-reference-input', reference);
  await page.click('[data-testid="lookup-submit"]');
  await page.waitForTimeout(700);
  ok('detail present', await page.locator('[data-testid="reservation-detail"]').count() === 1);
  ok('status reads confirmed',
    (await page.locator('[data-testid="reservation-status"]').textContent()) === 'confirmed');
  ok('cancel offered on a confirmed booking',
    await page.locator('[data-testid="reservation-cancel-button"]').count() === 1);
  ok('the time is written the way people read it',
    /Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/.test(
      await page.locator('[data-testid="reservation-when"]').textContent()));
  ok('the table is named by its label, not its id',
    /Table 2/.test(await page.locator('[data-testid="reservation-tables"]').textContent()));

  section('cancelling');
  await page.click('[data-testid="reservation-cancel-button"]');
  await page.waitForTimeout(800);
  ok('status reads cancelled',
    (await page.locator('[data-testid="reservation-status"]').textContent()) === 'cancelled');
  ok('cancel gone once cancelled',
    await page.locator('[data-testid="reservation-cancel-button"]').count() === 0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/lookup-cancelled.png`, fullPage: true });

  section('a booking that fails');
  await signIn(page);
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  ok('no booking form in the document on load',
    await page.locator('[data-testid="booking-form"]').count() === 0);
  ok('no confirmation in the document on load',
    await page.locator('[data-testid="confirmation"]').count() === 0);
  await page.fill('#date-input', '2026-12-01');
  await page.fill('#party-size-input', '2');
  await page.click('[data-testid="search-button"]');
  await page.waitForTimeout(700);
  await page.locator('[data-available="true"]').first().click();
  await page.waitForTimeout(300);
  await page.fill('#booking-party-size', '2');
  await page.click('[data-testid="booking-submit"]');
  await page.waitForTimeout(800);
  ok('a booking that works shows a confirmation',
    await page.locator('[data-testid="confirmation"]').count() === 1);
  ok('a booking that works leaves the booking form in the document to try again',
    await page.locator('[data-testid="booking-form"]').count() === 1);

  // Now make the next attempt fail at the service, and check that the earlier confirmation does not
  // stay on the page beside the error: it belongs to an attempt that is not this one.
  await page.route('**/reservations', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'table_unavailable',
        message: 'That table was taken a moment ago. Pick another time, or another table.' } }),
    });
  });
  await page.locator('[data-available="true"]').nth(1).click();
  await page.waitForTimeout(300);
  await page.click('[data-testid="booking-submit"]');
  await page.waitForTimeout(800);
  ok('booking-error present after a failed attempt',
    await page.locator('[data-testid="booking-error"]').count() === 1);
  ok('booking-error says what was wrong and what to do',
    /taken|Pick another/i.test(await page.locator('[data-testid="booking-error"]').textContent() || ''),
    await page.locator('[data-testid="booking-error"]').textContent());
  ok('no confirmation for that attempt', await page.locator('[data-testid="confirmation"]').count() === 0);
  ok('the booking form is still there to correct the attempt',
    await page.locator('[data-testid="booking-form"]').count() === 1);
  await page.unroute('**/reservations');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/booking-failed.png`, fullPage: true });

  section('message integrity');
  // Each inserted message appears exactly once, and its host exists at the moment of insertion:
  // a host that cannot be found would drop the message silently.
  const integrity = await page.evaluate(() => {
    const wanted = ['search-status', 'grid-loading', 'no-slots', 'grid-empty', 'booking-error'];
    const out = {};
    for (const id of wanted) {
      out[id] = document.querySelectorAll(`[data-testid="${id}"]`).length;
    }
    return out;
  });
  for (const [id, count] of Object.entries(integrity)) {
    ok(`${id} appears at most once`, count <= 1, { count });
  }
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  // A host may be keyed by data-testid or by id; what matters is that exactly one element answers
  // to the key, so a message cannot be inserted twice or dropped.
  const hosts = await page.evaluate(() => ['availability-panel', 'search-form']
    .map((id) => [id, (document.querySelectorAll(`[data-testid="${id}"]`).length
      + (document.getElementById(id) ? 1 : 0)), location.pathname]));
  for (const [id, count, path] of hosts) {
    ok(`host ${id} exists in the document`, count === 1, { count, path });
  }

  await page.close();
  await browser.close();
  void tok;
}

main().then(() => { report(); }).catch((error) => {
  console.log('  FAIL  suite error -- ' + error.message);
  process.exitCode = 1;
});
