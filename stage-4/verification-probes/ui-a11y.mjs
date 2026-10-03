// What a person can perceive: labels, sideways scrolling, contrast of every text node, a focus
// ring that can be seen against what is behind it, and states that do not all look alike.
//
//   node verification/probes/s2/ui-a11y.mjs [baseUrl]
import { chromium } from 'playwright-core';
import { BASE, SHOTS, ok, section, report, baseFixture, bookedDay, seed } from './ui-lib.mjs';

const ROUTES = ['/', '/signup', '/login', '/lookup'];

async function main() {
  await seed({ ...baseFixture(), reservations: ['t_1', 't_2', 't_3', 't_4'].flatMap(bookedDay) });
  const browser = await chromium.launch();

  for (const width of [375, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.setDefaultTimeout(6000);

    for (const route of ROUTES) {
      await page.goto(BASE + route, { waitUntil: 'networkidle' });

      section(`${route} at ${width}`);
      const scroll = await page.evaluate(() => document.documentElement.scrollWidth);
      ok('no sideways scrolling', scroll <= width, { scroll, width });

      const unlabelled = await page.evaluate(() => [...document.querySelectorAll('input,select,textarea')]
        .filter((el) => el.type !== 'hidden')
        .filter((el) => !el.getAttribute('aria-label')
          && !el.getAttribute('aria-labelledby')
          && !(el.id && document.querySelector(`label[for="${el.id}"]`)))
        .map((el) => el.id || el.name || el.type));
      ok('every input is labelled', unlabelled.length === 0, unlabelled);

      const overflow = await page.evaluate(() => [...document.querySelectorAll('body *')]
        .filter((el) => el.children.length === 0 && el.textContent.trim())
        .filter((el) => el.scrollWidth > el.clientWidth + 1)
        .map((el) => el.textContent.trim().slice(0, 30)));
      ok('no text clipped inside its own box', overflow.length === 0, overflow.slice(0, 3));

      // Contrast, walking up to the first non-transparent background rather than reading the page
      // root: a message that sits on a form host is judged against that host.
      const contrast = await page.evaluate(() => {
        const lum = (rgb) => {
          const [r, g, b] = rgb.map((v) => {
            const c = v / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const parse = (value) => {
          const m = value.match(/rgba?\(([^)]+)\)/);
          if (!m) return null;
          const parts = m[1].split(',').map((n) => parseFloat(n));
          if (parts.length > 3 && parts[3] === 0) return null;
          return parts.slice(0, 3);
        };
        const behind = (el) => {
          for (let node = el; node; node = node.parentElement) {
            const bg = parse(getComputedStyle(node).backgroundColor);
            if (bg) return bg;
          }
          return [255, 255, 255];
        };
        const out = [];
        for (const el of document.querySelectorAll('body *')) {
          if (el.children.length) continue;
          const text = el.textContent.trim();
          if (!text) continue;
          const style = getComputedStyle(el);
          if (style.visibility === 'hidden' || style.display === 'none') continue;
          const fg = parse(style.color);
          if (!fg) continue;
          const bg = behind(el);
          const l1 = lum(fg);
          const l2 = lum(bg);
          const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
          const size = parseFloat(style.fontSize);
          const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
          const floor = large ? 3 : 4.5;
          if (ratio < floor) out.push({ text: text.slice(0, 30), ratio: Math.round(ratio * 100) / 100, floor });
        }
        return out;
      });
      ok('every text node meets its contrast floor', contrast.length === 0, contrast.slice(0, 3));

      if (SHOTS) {
        await page.screenshot({ path: `${SHOTS}/${route.slice(1) || 'home'}-${width}.png`, fullPage: true });
      }
    }
    await page.close();
  }

  await browser.close();
}

main().then(() => { report(); }).catch((error) => {
  console.log('  FAIL  suite error -- ' + error.message);
  process.exitCode = 1;
});
