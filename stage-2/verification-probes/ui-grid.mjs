// The search results region, driven through the three states it can be in, at 375 and 1280.
//
//   node verification/probes/s2/ui-grid.mjs [baseUrl]
import { chromium } from 'playwright-core';
import { BASE, SHOTS, ok, section, report, baseFixture, bookedDay, seed } from './ui-lib.mjs';

const vis = (handle, sel) => handle.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return 'absent';
  return el.offsetParent !== null && getComputedStyle(el).display !== 'none' ? 'visible' : 'hidden';
}, sel);

const text = (handle, sel) => handle.evaluate((s) => {
  const el = document.querySelector(s);
  return el ? el.textContent.replace(/\s+/g, ' ').trim() : null;
}, sel);

async function search(page, { date, party }) {
  await page.fill('#date-input', date);
  await page.fill('#party-size-input', String(party));
  await page.click('[data-testid="search-button"]');
  await page.waitForTimeout(600);
}

async function main() {
  const browser = await chromium.launch();

  // A fully-booked day: every table committed at every slot.
  await seed({ ...baseFixture(), reservations: ['t_1', 't_2', 't_3', 't_4'].flatMap(bookedDay) });

  for (const width of [375, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });

    section(`empty state at ${width}`);
    ok('results region visible on load', await vis(page, '[data-testid="availability-grid"]') === 'visible');
    ok('no-slots absent before any search', await vis(page, '[data-testid="no-slots"]') === 'absent');
    const emptyText = await text(page, '[data-testid="grid-empty"]');
    ok('empty state says what to do', typeof emptyText === 'string' && emptyText.length > 20
      && /choose/i.test(emptyText), emptyText);

    section(`loading state at ${width}`);
    await page.route('**/availability?*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      route.continue();
    });
    await page.click('[data-testid="search-button"]');
    await page.waitForTimeout(250);
    ok('results region stays visible while loading',
      await vis(page, '[data-testid="availability-grid"]') === 'visible');
    ok('loading message visible in flight',
      await vis(page, '[data-testid="grid-loading"]') === 'visible');
    ok('no-slots absent while loading', await vis(page, '[data-testid="no-slots"]') === 'absent');
    await page.waitForTimeout(1600);
    await page.unroute('**/availability?*');

    section(`fully-booked day at ${width}`);
    await search(page, { date: '2026-12-01', party: 2 });
    const cells = await page.evaluate(() => [...document.querySelectorAll('[data-available]')]
      .map((c) => [c.getAttribute('data-testid'), c.getAttribute('data-available')]));
    ok('cells rendered', cells.length > 0, { cells: cells.length });
    ok('every cell unavailable', cells.every((c) => c[1] === 'false'),
      cells.filter((c) => c[1] !== 'false').slice(0, 4));
    ok('grid still visible', await vis(page, '[data-testid="availability-grid"]') === 'visible');
    ok('no-slots absent when a full day returns slots',
      await vis(page, '[data-testid="no-slots"]') === 'absent');
    ok('no sideways scrolling', await page.evaluate(() => document.documentElement.scrollWidth)
      <= width, await page.evaluate(() => document.documentElement.scrollWidth));

    section(`an unavailable cell is inert at ${width}`);
    const cell = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="slot-t_1-17:00"]');
      if (!el) return null;
      el.click();
      return { available: el.getAttribute('data-available'), disabled: el.disabled };
    });
    ok('a cell the service says is taken is disabled', cell && cell.available === 'false'
      && cell.disabled === true, cell);
    await page.waitForTimeout(300);
    ok('clicking it opens no booking form',
      await page.locator('[data-testid="booking-form"]').count() === 0
      || !(await page.locator('[data-testid="booking-section"]').isVisible()));
    ok('clicking it leaves the grid alone',
      await vis(page, '[data-testid="availability-grid"]') === 'visible');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/grid-booked-${width}.png`, fullPage: true });

    section(`day with no slots at ${width}`);
    await search(page, { date: '2026-12-06', party: 2 });
    ok('no-slots visible when the day has no slots',
      await vis(page, '[data-testid="no-slots"]') === 'visible');
    ok('no-slots does not sit beside the grid',
      await vis(page, '[data-testid="availability-grid"]') !== 'visible');
    ok('no-slots explains the next step',
      /another date|smaller party/i.test(await text(page, '[data-testid="no-slots"]') || ''),
      await text(page, '[data-testid="no-slots"]'));
    ok('no-slots says the restaurant is closed, not that no tables are free',
      /closed/i.test(await text(page, '[data-testid="no-slots"]') || ''),
      await text(page, '[data-testid="no-slots"]'));
    ok('the closed day is named as a person reads it',
      /Sunday/.test(await text(page, '[data-testid="no-slots"]') || ''),
      await text(page, '[data-testid="no-slots"]'));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/grid-noslots-${width}.png`, fullPage: true });

    await page.close();
  }

  await browser.close();
}

main().then(() => {
  report();
}).catch((error) => {
  console.log('  FAIL  suite error -- ' + error.message);
  process.exitCode = 1;
});
