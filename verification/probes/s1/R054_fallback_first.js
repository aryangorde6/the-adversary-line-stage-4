'use strict';
// R054 / R055 / R056 — the repeated hour resolves to the FIRST occurrence, and the duration is
// absolute time across the fall-back.
//
// Mutant #3 (fall-back resolving to the second occurrence) was missed by every stage-1 probe, and the
// reason was the fixture rather than the assertions: with one restaurant in one timezone, no probe
// ever booked an ambiguous local time, so the rule had nothing to act on. `multiZone()` in lib.js
// fixes that, and this probe uses it.
//
// The ambiguous hours used here, computed from the IANA database by `instantOf()` inside the probe
// and never read back out of the service:
//
//   Europe/Berlin 2026-10-25 02:30 local occurs twice: 00:30Z (CEST, the first) and 01:30Z (CET)
//   America/New_York 2026-11-01 01:30 local occurs twice: 05:30Z (EDT, first) and 06:30Z (EST)
//   Asia/Tokyo has no fall-back at all, so an implementation that assumes one is wrong there.

const { req, json, check, finish, reset, login, book, multiZone, zonedBooking, instantOf } = require('./lib');

const CASES = [
  { name: 'berlin', r: 'r_berlin', zone: 'Europe/Berlin', ambiguous: '2026-10-25T02:30', plain: '2026-10-25T05:00' },
  { name: 'newyork', r: 'r_newyork', zone: 'America/New_York', ambiguous: '2026-11-01T01:30', plain: '2026-11-01T05:00' },
];

// Every instant a local wall clock can denote in that zone, earliest first. `instantOf` returns the
// first; this recomputes the whole set so the probe can assert that the local time really is
// ambiguous rather than assuming it.
function allInstants(timeZone, isoLocal) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(isoLocal);
  if (!m) return [];
  const [, y, mo, d, h, mi] = m.map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  const parts = (ms) => {
    const p = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date(ms));
    const o = {};
    for (const part of p) if (part.type !== 'literal') o[part.type] = Number(part.value);
    return o;
  };
  const offsets = new Set([0, 24, -24].map((h_) => naive - parts(naive + h_ * 3600000).hour * 0 -
    (naive - parts(naive + h_ * 3600000).hour * 3600000) + naive - naive));
  // Simpler and exact: try every real IANA offset in a ±36h window.
  const seen = new Set();
  for (let delta = -36 * 3600000; delta <= 36 * 3600000; delta += 60000) {
    const guess = naive + delta;
    const p = parts(guess);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    const offset = asUtc - guess;
    const candidate = naive - offset;
    const q = parts(candidate);
    if (q.year === y && q.month === mo && q.day === d && q.hour === h && q.minute === mi) {
      seen.add(candidate);
    }
  }
  void offsets;
  return [...seen].sort((a, b) => a - b);
}

async function run() {
  await reset(multiZone());
  const token = await login();

  for (const c of CASES) {
    const candidates = allInstants(c.zone, c.ambiguous);
    check(
      `R054a-${c.name}`,
      candidates.length === 2,
      `${c.zone} ${c.ambiguous} denotes ${candidates.length} instants ` +
        `(${candidates.map((ms) => new Date(ms).toISOString()).join(' and ')}) — the fixture must ` +
        `really produce a repeated hour, or every row below is vacuous (a probe that does not stage ` +
        `the condition it claims to test cannot fail)`
    );
    if (candidates.length !== 2) continue;
    const [first, second] = candidates;

    // ---- the booking resolves to the FIRST occurrence --------------------------
    const made = await book(token, `fb-${c.name}`, zonedBooking(c.r, 't_1', c.ambiguous));
    check(
      `R054b-${c.name}`,
      made.status === 201,
      `book ${c.zone} ${c.ambiguous} -> ${made.status} ${made.body.slice(0, 120)} (expected 201)`
    );
    if (made.status !== 201) continue;
    const body = json(made);
    const got = body.starts_at ? new Date(body.starts_at).getTime() : NaN;
    check(
      `R054c-${c.name}`,
      got === first,
      `${c.zone} ${c.ambiguous} reported starts_at ${body.starts_at} -> ` +
        `${new Date(got).toISOString()}; the FIRST occurrence is ${new Date(first).toISOString()} ` +
        `(the second would be ${new Date(second).toISOString()}). Equal to first = ${got === first}`
    );

    // ---- the slot appears ONCE, not twice ------------------------------------
    const avail = await req(
      'GET',
      `/availability?restaurant_id=${c.r}&date=${c.ambiguous.slice(0, 10)}&party_size=2`
    );
    const availability = json(avail);
    const slots = availability && Array.isArray(availability.slots) ? availability.slots : null;
    check(
      `R054d-${c.name}`,
      slots !== null,
      `GET /availability carries a slots array = ${slots !== null} (asserted before any count)`
    );
    if (slots) {
      const atThatTime = slots.filter((s) => s.starts_at_local === c.ambiguous);
      check(
        `R054e-${c.name}`,
        atThatTime.length === 1,
        `the repeated local hour appears ${atThatTime.length} time(s) in the grid, expected exactly 1 ` +
          `(a repeated hour is one bookable slot, not two)`
      );
      // With t_1 now booked at the first occurrence, the slot must offer no free table on t_1 —
      // which is only true if the grid reasoned about the same instant the booking used.
      const slot = atThatTime[0];
      check(
        `R054f-${c.name}`,
        slot && Array.isArray(slot.available_table_ids) && !slot.available_table_ids.includes('t_1'),
        `after booking the ambiguous hour, that slot's available_table_ids = ` +
          `${JSON.stringify(slot && slot.available_table_ids)} — t_1 must be absent, which it is only ` +
          `if the grid resolved the same (first) instant the booking did`
      );
    }

    // ---- the duration is absolute, so it crosses the change ------------------
    const expectedEnd = first + 90 * 60000;
    check(
      `R055a-${c.name}`,
      body.ends_at && new Date(body.ends_at).getTime() === expectedEnd,
      `90 minutes after ${new Date(first).toISOString()} ends at ${body.ends_at} -> ` +
        `${body.ends_at ? new Date(body.ends_at).toISOString() : 'null'}; absolute arithmetic says ` +
        `${new Date(expectedEnd).toISOString()}. A wall-clock addition would land an hour later.`
    );

    // ---- the second occurrence is not separately bookable ---------------------
    // Same TABLE, not a second one: occupancy is per table, so another table at the same local time
    // is a legitimate booking and my first version of this row asserted a 409 for it -- a red
    // against correct code, from asserting a rule the specification does not have.
    const secondTry = await book(token, `fb2-${c.name}`, zonedBooking(c.r, 't_1', c.ambiguous));
    check(
      `R054g-${c.name}`,
      secondTry.status === 409 && json(secondTry) && json(secondTry).error.code === 'table_unavailable',
      `the SAME table again at the same ambiguous local string -> ${secondTry.status} ` +
        `${secondTry.body.slice(0, 110)} (expected 409 table_unavailable: the local string names the ` +
        `same first occurrence, so it is the same slot and the same table is taken)`
    );
    const otherTable = await book(token, `fb3-${c.name}`, zonedBooking(c.r, 't_2', c.ambiguous));
    check(
      `R054h-${c.name}`,
      otherTable.status === 201,
      `a DIFFERENT table at the same local time -> ${otherTable.status} (expected 201: occupancy is ` +
        `per table, so this is a legal booking and asserting otherwise was my error)`
    );

    // ---- an unambiguous local time in the same zone still resolves normally ----
    const plainCandidates = allInstants(c.zone, c.plain);
    const plainMade = await book(token, `plain-${c.name}`, zonedBooking(c.r, 't_2', c.plain));
    check(
      `R056a-${c.name}`,
      plainCandidates.length === 1 && plainMade.status === 201 &&
        new Date(json(plainMade).starts_at).getTime() === plainCandidates[0],
      `unambiguous ${c.zone} ${c.plain} denotes ${plainCandidates.length} instant(s), booked -> ` +
        `${plainMade.status}, starts_at ${plainMade.status === 201 ? json(plainMade).starts_at : 'n/a'} ` +
        `(expected ${plainCandidates.length === 1 ? new Date(plainCandidates[0]).toISOString() : 'one instant'})`
    );
  }

  // ---- a zone with no fall-back at all -------------------------------------
  const tokyoAutumn = allInstants('Asia/Tokyo', '2026-10-25T02:30');
  const tokyoMade = await book(token, 'fb-tokyo', zonedBooking('r_tokyo', 't_1', '2026-10-25T02:30'));
  check(
    'R056b-tokyo',
    tokyoAutumn.length === 1 && tokyoMade.status === 201 &&
      new Date(json(tokyoMade).starts_at).getTime() === tokyoAutumn[0],
    `Asia/Tokyo 2026-10-25T02:30 denotes ${tokyoAutumn.length} instant(s) — Tokyo has no fall-back, so ` +
      `a resolver that assumes every zone has one is wrong here — booked -> ${tokyoMade.status}`
  );

  finish();
}

run();
