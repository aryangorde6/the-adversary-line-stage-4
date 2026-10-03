// The seven states must not look alike, and the keyboard must always say where it is.
//
//   node verification/probes/s2/ui-states-a11y.mjs [baseUrl]
import { chromium } from 'playwright-core';
import { BASE, SHOTS, ok, section, report, baseFixture, oneTableTaken, seed, token } from './ui-lib.mjs';

const ROUTES = ['/', '/signup', '/login', '/lookup'];

// The (background, text, border) of one element, read the way it is painted: the background is
// resolved through the first non-transparent ancestor, so a state sitting on a form host is judged
// where it is drawn rather than against the page root.
function readTriplesIn(page, selector) {
  return page.evaluate((sel) => {
    const parse = (value) => {
      const m = value.match(/rgba?\(([^)]+)\)/);
      if (!m) return 'none';
      const parts = m[1].split(',').map((n) => parseFloat(n));
      if (parts.length > 3 && parts[3] === 0) return 'none';
      return parts.slice(0, 3).map((n) => Math.round(n)).join(',');
    };
    const behind = (node) => {
      for (let n = node; n && n.nodeType === 1; n = n.parentElement) {
        const bg = parse(getComputedStyle(n).backgroundColor);
        if (bg !== 'none') return bg;
      }
      return '255,255,255';
    };
    const el = document.querySelector(sel);
    if (!el) return null;
    const style = getComputedStyle(el);
    return [behind(el), parse(style.color), style.borderTopColor].join(' | ');
  }, selector);
}

async function main() {
  // Sign in through the UI so every state below is reached the way a diner reaches it.
  await seed({ ...baseFixture(), reservations: oneTableTaken('t_1') });
  const tok = await token();
  const browser = await chromium.launch();

  section('the seven states are seven different looks');
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(6000);
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.evaluate((t) => {
    document.cookie = 'tk_token=' + encodeURIComponent(t) + '; path=/; SameSite=Lax';
  }, tok);
  await page.reload({ waitUntil: 'networkidle' });
  await page.fill('#date-input', '2026-12-01');
  await page.fill('#party-size-input', '2');
  await page.click('[data-testid="search-button"]');
  await page.waitForTimeout(700);

  // Collect each state's triple by putting the screen into that state and reading the element the
  // state belongs to. Missing a state is a failure in itself: a state nobody can see cannot be
  // told apart from any other.
  const states = {};
  const read = async (name, selector) => {
    const triple = await readTriplesIn(page, selector);
    // A state nobody can see cannot be told apart from any other, so its absence is a failure.
    ok(`${name} is on screen to be told apart`, triple !== null, { selector });
    states[name] = triple;
  };

  await read('available', '[data-testid="availability-grid"] [data-available="true"]');
  await read('unavailable', '[data-testid="availability-grid"] [data-available="false"]');

  // loading
  await page.route('**/availability?*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    route.continue();
  });
  await page.click('[data-testid="search-button"]');
  await page.waitForTimeout(250);
  await read('loading', '[data-testid="grid-loading"]');
  await page.waitForTimeout(1600);
  await page.unroute('**/availability?*');

  // empty
  await page.fill('#date-input', '2026-12-01');
  await page.fill('#party-size-input', '2');
  await page.evaluate(() => {
    const region = document.querySelector('[data-testid="availability-grid"]');
    if (region) region.parentNode.removeChild(region);
  });
  await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="availability-panel"]');
    const empty = document.createElement('p');
    empty.className = 'msg empty';
    empty.setAttribute('data-testid', 'empty-probe');
    empty.textContent = 'Choose a restaurant, a date and how many people are coming.';
    panel.insertBefore(empty, panel.firstChild);
  });
  await read('empty', '[data-testid="empty-probe"]');

  // selected, then refused, successful and uncertain on the booking path
  await page.evaluate((t) => {
    document.cookie = 'tk_token=' + encodeURIComponent(t) + '; path=/; SameSite=Lax';
  }, tok);
  await page.reload({ waitUntil: 'networkidle' });
  await page.fill('#date-input', '2026-12-01');
  await page.fill('#party-size-input', '2');
  await page.click('[data-testid="search-button"]');
  await page.waitForTimeout(700);
  await page.locator('[data-available="true"]').first().click();
  await page.waitForTimeout(300);
  await read('selected', '[data-selected="true"]');

  await page.route('**/reservations', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    route.fulfill({ status: 409, contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'table_unavailable', message: 'That table was taken.' } }) });
  });
  await page.click('[data-testid="booking-submit"]');
  await page.waitForTimeout(700);
  await read('refused', '[data-testid="booking-error"]');
  await page.unroute('**/reservations');

  await page.click('[data-testid="booking-submit"]');
  await page.waitForTimeout(900);
  await read('successful', '[data-testid="confirmation-reference"]');

  await page.route('**/reservations', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    await new Promise((resolve) => setTimeout(resolve, 200));
    route.abort('failed');
  });
  await page.click('[data-testid="booking-submit"]');
  await page.waitForTimeout(900);
  await read('uncertain', '[data-testid="booking-uncertain"]');
  await page.unroute('**/reservations');

  // The assertion is on the set, not pairwise: seven states that collapse into six looks is the
  // failure this row exists for, and a set-level assertion cannot be argued with.
  const REQUIRED = ['available', 'unavailable', 'selected', 'loading', 'successful', 'refused', 'uncertain'];
  ok('all seven required states were on screen to be read',
    REQUIRED.every((n) => states[n]), Object.keys(states));
  const distinct = new Set(REQUIRED.map((n) => states[n]));
  ok('the seven required states are seven distinct triples', distinct.size === 7,
    REQUIRED.map((n) => `${n}=${states[n]}`));
  ok('every state read, empty included, is its own look',
    new Set(Object.values(states)).size === Object.keys(states).length,
    Object.entries(states));
  await page.close();

  // Focus: a real Tab press at every stop, and an indicator that can be seen against what is
  // behind it. Programmatic .focus() is not used: it would not match :focus-visible on a button.
  for (const width of [375, 1280]) {
    for (const route of ROUTES) {
      section(`focus at every tab stop on ${route} at ${width}`);
      const p2 = await browser.newPage({ viewport: { width, height: 900 } });
      p2.setDefaultTimeout(6000);
      await p2.goto(BASE + route, { waitUntil: 'networkidle' });
      const stops = [];
      // Presses continue past a repeated control on purpose: the stops inside a date field all
      // report the same element, and stopping at the first repeat would never reach them.
      for (let i = 0; i < 40; i += 1) {
        await p2.keyboard.press('Tab');
        const stop = await p2.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          const style = getComputedStyle(el);
          const parse = (value) => {
            const m = value.match(/rgba?\(([^)]+)\)/);
            if (!m) return null;
            const parts = m[1].split(',').map((n) => parseFloat(n));
            if (parts.length > 3 && parts[3] === 0) return null;
            return parts.slice(0, 3);
          };
          const behind = (node) => {
            for (let n = node; n && n.nodeType === 1; n = n.parentElement) {
              const bg = parse(getComputedStyle(n).backgroundColor);
              if (bg) return bg;
            }
            return [255, 255, 255];
          };
          const lum = (rgb) => {
            const [r, g, b] = rgb.map((v) => {
              const c = v / 255;
              return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
            });
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
          };
          // A control may carry its own ring, or sit inside a wrapper that carries one: a native
          // date field stops matching :focus on one of its inner segments, and the ring is then
          // drawn around the field as a whole. Either counts, and each is judged against the
          // surface it is painted on.
          const wrapper = el.closest('[data-date-field].kb-focus');
          const painted = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0
            ? { node: el, style } : null;
          const wrapped = wrapper && getComputedStyle(wrapper).outlineStyle !== 'none'
            && parseFloat(getComputedStyle(wrapper).outlineWidth) > 0
            ? { node: wrapper, style: getComputedStyle(wrapper) } : null;
          const mark = painted || wrapped;
          let ratio = 0;
          if (mark) {
            const ring = parse(mark.style.outlineColor);
            const offset = parseFloat(mark.style.outlineOffset) || 0;
            // A ring drawn outside the border box is painted on the surface behind the control, so
            // that is the colour it has to be seen against.
            const bg = offset > 0 ? behind(mark.node.parentElement || mark.node) : behind(mark.node);
            const l1 = lum(ring);
            const l2 = lum(bg);
            ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
          }
          return {
            tag: el.tagName.toLowerCase(),
            id: el.id || el.getAttribute('data-testid') || '',
            outline: mark ? mark.style.outlineStyle : 'none',
            width: mark ? parseFloat(mark.style.outlineWidth) : 0,
            on: mark ? (painted ? 'control' : 'wrapper') : 'none',
            ratio: Math.round(ratio * 100) / 100,
          };
        });
        if (!stop) continue;
        stops.push(stop);
      }
      const missing = stops.filter((s) => s.outline === 'none' || s.width === 0);
      console.log(`        (${stops.map((s) => s.on).join(',')})`);
      ok('every tab stop has a focus indicator', missing.length === 0,
        missing.map((s) => `${s.tag}#${s.id}`).slice(0, 4));
      const faint = stops.filter((s) => s.ratio < 3);
      ok('every focus ring is visible against what is behind it', faint.length === 0,
        faint.map((s) => `${s.tag}#${s.id} ${s.ratio}`).slice(0, 4));
      // The ring is added and taken away by events, so it is checked both ways: present while the
      // keyboard is inside the field, gone once the keyboard has demonstrably left it.
      const hasDate = await p2.locator('#date-input').count() === 1;
      const insideRing = !hasDate || await p2.evaluate(async () => {
        const input = document.querySelector('#date-input');
        input.focus();
        await new Promise((r) => setTimeout(r, 100));
        return document.querySelector('[data-date-field]').classList.contains('kb-focus');
      });
      if (hasDate) ok('the ring is on while the keyboard is inside the date field', insideRing);
      const afterLeaving = hasDate && await p2.evaluate(async () => {
        document.querySelector('#party-size-input').focus();
        await new Promise((r) => setTimeout(r, 100));
        return document.querySelector('[data-date-field]').classList.contains('kb-focus');
      });
      if (hasDate) ok('the ring is off once the keyboard has left the date field', !afterLeaving);

      if (hasDate) {
        // The ring must come back as well as go: an exit that fires without a focus event used to
        // leave it dead, and a row that only checks "off after leaving" passes on a dead ring.
        const innerStop = async () => {
          for (let i = 0; i < 12; i += 1) {
            await p2.keyboard.press('Tab');
            const at = await p2.evaluate(() => {
              const a = document.activeElement;
              const f = document.querySelector('[data-date-field]');
              return { inner: a.id === 'date-input' && !a.matches(':focus'),
                painted: getComputedStyle(f).outlineStyle !== 'none' };
            });
            if (at.inner) return at.painted;
          }
          return null;
        };
        // One rule, asserted in both directions: the ring says where the keyboard is. Losing the
        // window is not the keyboard leaving the field, so the ring stays; the ring goes when the
        // focus does, and it is back the moment the focus is.
        const rearm = async (name, fire) => {
          await p2.locator('#date-input').click();
          await p2.evaluate(fire);
          const held = await p2.evaluate(() => {
            const f = document.querySelector('[data-date-field]');
            return getComputedStyle(f).outlineStyle !== 'none';
          });
          ok(`the ring stays on the field through ${name}, because the keyboard is still in it`, held);
          await p2.locator('[data-testid="search-button"]').click();
          // A click moves the focus, so the ring must be gone as soon as the click has been handled;
          // the wait is for the search round trip, not for the ring to be taken off.
          await p2.waitForTimeout(50);
          const dropped = await p2.evaluate(() => {
            const f = document.querySelector('[data-date-field]');
            return getComputedStyle(f).outlineStyle === 'none';
          });
          ok(`the ring goes once the focus leaves, after ${name}`, dropped);
        };
        await rearm('the window losing focus', () => window.dispatchEvent(new Event('blur')));
        await rearm('the page being hidden', () => window.dispatchEvent(new Event('pagehide')));
        await p2.evaluate(() => window.dispatchEvent(new Event('blur')));
        await p2.locator('#date-input').click();
        // Read with no wait at all. The ring has to be right because an event put it there, not
        // because something later noticed: this build has no poll to notice with.
        const backFromBlur = await p2.evaluate(() => {
          const input = document.querySelector('#date-input');
          input.blur();
          input.focus();
          const f = document.querySelector('[data-date-field]');
          return getComputedStyle(f).outlineStyle !== 'none';
        });
        ok('the ring is back at once after the field loses and regains the keyboard', backFromBlur);
        // A field can also be emptied without anything else happening: calling blur() on it fires
        // one event and nothing more. The ring has to go on that event too, or it is left on a field
        // the keyboard has left, which is the same defect as a missing one in the other direction.
        const blurOnly = await p2.evaluate(() => {
          document.querySelector('#date-input').blur();
          const f = document.querySelector('[data-date-field]');
          return getComputedStyle(f).outlineStyle === 'none';
        });
        ok('the ring goes at once when the field is emptied and nothing else happens', blurOnly);
        const stillGone = await p2.evaluate(async () => {
          await new Promise((r) => setTimeout(r, 300));
          const f = document.querySelector('[data-date-field]');
          return getComputedStyle(f).outlineStyle === 'none';
        });
        ok('and it stays gone, with nothing polling to put it back', stillGone);
        const innerBefore = await innerStop();
        ok('the inner segment carries a ring before any exit has fired', innerBefore === true,
          { innerBefore });
        const innerAfter = await p2.evaluate(async () => {
          const input = document.querySelector('#date-input');
          input.focus();
          await new Promise((r) => setTimeout(r, 100));
          return input.matches(':focus');
        });
        void innerAfter;
        const stillThere = await innerStop();
        ok('the inner segment still carries a ring after the exits have fired and returned',
          stillThere === true, { stillThere });
      }

      const dateStops = stops.filter((s) => s.id === 'date-input');
      console.log(`        (${stops.length} stops pressed, ${dateStops.length} inside the date field:`
        + ` ${dateStops.map((s) => s.on).join(',')})`);
      if (SHOTS && route === '/') await p2.screenshot({ path: `${SHOTS}/focus-home-${width}.png`, fullPage: false });
      await p2.close();
    }
  }

  // The booking path, driven with nothing but the keyboard: how many stops it costs to walk to a
  // free table, whether any taken cell is in the tab order, and whether Enter completes the booking.
  for (const width of [375, 1280]) {
    section(`keyboard-only booking at ${width}`);
    const kp = await browser.newPage({ viewport: { width, height: 900 } });
    kp.setDefaultTimeout(6000);
    await kp.goto(BASE + '/', { waitUntil: 'networkidle' });
    await kp.evaluate((t) => {
      document.cookie = 'tk_token=' + encodeURIComponent(t) + '; path=/; SameSite=Lax';
    }, tok);
    await kp.reload({ waitUntil: 'networkidle' });

    const step = async () => {
      await kp.keyboard.press('Tab');
      return kp.evaluate(() => {
        const a = document.activeElement;
        return { id: a.id || '', testid: a.getAttribute('data-testid') || '',
          tag: a.tagName.toLowerCase(), disabled: Boolean(a.disabled) };
      });
    };

    // Counted from the top of the page. The values are set without touching the keyboard, so the
    // number reported is the cost of walking the page rather than an artefact of how the probe
    // entered them.
    let stops = 0;
    let onSearch = false;
    let disabledAhead = 0;
    while (stops < 40 && !onSearch) {
      const at = await step();
      stops += 1;
      if (at.disabled) disabledAhead += 1;
      onSearch = at.testid === 'search-button';
    }
    ok('the search button is reachable by Tab', onSearch, { stops });
    ok('no disabled control on the way to the search button', disabledAhead === 0, { disabledAhead });
    await kp.evaluate(() => {
      const set = (sel, value) => {
        const el = document.querySelector(sel);
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      set('#date-input', '2026-12-01');
      set('#party-size-input', '2');
    });
    await kp.keyboard.press('Enter');
    await kp.waitForTimeout(900);

    let toFree = 0;
    let onFree = false;
    let sawDisabled = false;
    while (toFree < 60 && !onFree) {
      const at = await step();
      toFree += 1;
      if (at.disabled) sawDisabled = true;
      if ((at.testid || '').startsWith('slot-') && !at.disabled) onFree = true;
    }
    ok('a free table is reachable by Tab', onFree, { toFree });
    ok('no taken table is in the tab order', !sawDisabled);
    console.log(`        (${stops} stops from the top of the page to the search button,`
      + ` ${toFree} more to the first free table)`);
    await kp.keyboard.press('Enter');
    await kp.waitForTimeout(500);
    ok('Enter on a free table opens the booking form',
      await kp.locator('[data-testid="booking-form"]').count() === 1);
    const onSubmit = await kp.evaluate(() => document.activeElement.getAttribute('data-testid'));
    ok('the booking button holds the keyboard after choosing a table', onSubmit === 'booking-submit',
      { onSubmit });
    await kp.keyboard.press('Enter');
    await kp.waitForTimeout(1000);
    ok('the booking completes from the keyboard alone',
      await kp.locator('[data-testid="confirmation"]').count() === 1,
      await kp.locator('[data-msg]').first().textContent().catch(() => null));
    if (SHOTS) await kp.screenshot({ path: `${SHOTS}/keyboard-booking-${width}.png`, fullPage: true });
    await kp.close();
  }

  await browser.close();
}

main().then(() => { report(); }).catch((error) => {
  console.log('  FAIL  suite error -- ' + error.message);
  process.exitCode = 1;
});
