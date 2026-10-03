#!/usr/bin/env python3
"""Apply one stage-1 mutation to a scratch copy of stage-1, exactly.

Each mutation is an ordered list of (file, old, new) patches. Every `old` must occur exactly
once in the file or the run aborts: a patch that silently does not apply would "prove"
nothing. Writes go only to the directory passed as argv[2], which is always outside the
repository.

    patch.py <mutant-id> <target-dir>
"""

import os
import sys

# mutant id -> (probe file, [ (relative file, old, new), ... ])
MUTANTS = {
    # R006 half-open [start, start+duration) becomes a closed interval.
    'm01': ('R006_halfopen.js', [
        ('src/domain.js',
         '      reservation.starts_at_ms < endMs &&\n      startMs < reservation.ends_at_ms,',
         '      reservation.starts_at_ms <= endMs &&\n      startMs <= reservation.ends_at_ms,'),
    ]),
    # R005 an await between the receipt lookup and the handler lets two identical
    # concurrent requests both miss the receipt.
    'm02': ('R005_concurrency.js', [
        ('src/server.js',
         'function withIdempotency(ctx, handler) {',
         'async function withIdempotency(ctx, handler) {'),
        # The yield must sit BETWEEN the receipt lookup and the handler. A yield before the
        # lookup does not race: each continuation then runs lookup, handler and remember
        # synchronously, so the second request still finds the receipt and replays.
        ('src/server.js',
         '  if (record) return { status: 200, body: record.response };\n  const result = handler(state);',
         '  if (record) return { status: 200, body: record.response };\n'
         '  await new Promise((r) => setTimeout(r, 25));\n'
         '  const result = handler(state);'),
        ('src/server.js',
         '  const result = route.key ? withIdempotency(ctx, run) : await run();',
         '  const result = route.key ? await withIdempotency(ctx, run) : await run();'),
    ]),
    # R007 the reservation is persisted before validation, so a refused request leaves state.
    'm03': ('R007_no_partial.js', [
        ('src/domain.js',
         '  const endMs = startMs + restaurant.reservation_duration_minutes * MILLIS_PER_MINUTE;',
         '  const endMs = startMs + restaurant.reservation_duration_minutes * MILLIS_PER_MINUTE;\n'
         "  state.reservations.push({\n"
         "    id: 'res_partial_leak', reference: 'PARTIALLEAK', restaurant_id: restaurant.id,\n"
         '    table_id: table.id, user_id: 0, party_size: 999, status: \'confirmed\',\n'
         '    starts_at_local: startsAtLocal, starts_at_ms: startMs, ends_at_ms: endMs,\n'
         '    created_at_ms: Date.now(),\n'
         '  });'),
    ]),
    # R038 the stored body is no longer compared, so any body replays.
    'm04': ('R038_idem_order.js', [
        ('src/idempotency.js',
         "  if (!sameBody(record.body, body)) fail('idempotency_key_reuse', { idempotency_key: key });",
         '  void sameBody;'),
    ]),
    # R041 the receipt keeps a null response, so a replay returns nothing.
    'm05': ('R041_replay.js', [
        ('src/idempotency.js',
         '    response: JSON.parse(JSON.stringify(response)),',
         '    response: null,'),
    ]),
    # R053 a skipped local time is fabricated instead of rejected.
    'm06': ('R053_dst.js', [
        ('src/domain.js',
         '  const instants = time.wallToInstants(restaurant.timezone, wall.y, wall.mo, wall.d, wall.h, wall.mi);\n'
         '  if (instants.length === 0) {\n'
         "    fail('invalid_local_time', placeContext(restaurant, null, wall));\n"
         '  }',
         '  const instants = time.wallToInstants(restaurant.timezone, wall.y, wall.mo, wall.d, wall.h, wall.mi);\n'
         '  if (instants.length === 0) {\n'
         '    return Date.UTC(wall.y, wall.mo - 1, wall.d, wall.h, wall.mi);\n'
         '  }'),
    ]),
    # R055 the end time is one hour late on a Berlin October wall clock, as a wall-clock
    # addition across the fall-back transition would be.
    'm08': ('R053_dst.js', [
        ('src/domain.js',
         '  const endMs = startMs + restaurant.reservation_duration_minutes * MILLIS_PER_MINUTE;',
         '  const endMs = startMs + restaurant.reservation_duration_minutes * MILLIS_PER_MINUTE\n'
         "    + (restaurant.timezone === 'Europe/Berlin' && wall.mo === 10 ? 3600000 : 0);"),
    ]),
    # R058 import merges reservations into the destination instead of replacing them.
    'm09': ('R060_export_import.js', [
        ('src/snapshot.js',
         '  state.reservations = validateReservations(raw.reservations === undefined ? [] : raw.reservations, state.restaurants);',
         '  state.reservations = store.getState().reservations\n'
         '    .concat(validateReservations(raw.reservations === undefined ? [] : raw.reservations, state.restaurants));'),
    ]),
    # R060 import allocates a new reference instead of preserving it.
    'm10': ('R060_export_import.js', [
        ('src/snapshot.js',
         '      reference,\n      user_id: entry.user_id === null ? null : requireString(entry.user_id, \'user_id\'),',
         "      reference: 'ZZ' + String(references.size).padStart(4, '0'),\n"
         '      user_id: entry.user_id === null ? null : requireString(entry.user_id, \'user_id\'),'),
    ]),
    # R063 each move is applied as it is planned, so an earlier move survives a later failure.
    'm11': ('R063_moves.js', [
        ('src/moves.js',
         '    const move = moves[index];\n    plans.push(',
         '    const move = moves[index];\n'
         '    domain.applyPlan(reservation, domain.planAmendment(state, reservation, restaurant, {\n'
         "      table_id: optionalId(move, 'table_id'),\n"
         '      starts_at_local: optionalStartsAtLocal(move),\n'
         '      party_size: optionalPartySize(move),\n'
         '    }));\n'
         '    plans.push('),
    ]),
    # R029 the plain-decimal-digits rule for an integer query parameter is removed.
    'm12': ('R029_query_integer.js', [
        ('src/fields.js',
         "  if (!/^-?[0-9]+$/.test(raw)) fail('validation_failed', { field: name });",
         '  if (Number.isNaN(Number(raw))) fail(\'validation_failed\', { field: name });'),
    ]),
    # --- multi-timezone mutants ---
    # m13: occupancy decided on WALL-CLOCK values instead of absolute instants. The date
    # is dropped from the comparison, so the same clock time on a later day reads as an
    # overlap. A single-timezone fixture cannot catch this: it never books the same clock
    # time twice, and never crosses a zone whose local date differs from the UTC date.
    'm13': ('R006_occupancy_multizone.js', [
        ('src/domain.js',
         'function isOccupied(state, restaurantId, tableId, startMs, endMs, ignoredReference) {\n'
         '  return state.reservations.some(',
         'function wallClockOnly(ms, timezone) {\n'
         '  const p = time.partsInZone(timezone, ms);\n'
         '  return p.h * 3600000 + p.mi * 60000;\n'
         '}\n'
         '\n'
         'function isOccupied(state, restaurantId, tableId, startMs, endMs, ignoredReference) {\n'
         '  const zone = store.getState().restaurants.find((r) => r.id === restaurantId);\n'
         '  const tz = zone ? zone.timezone : \'UTC\';\n'
         '  return state.reservations.some('),
        ('src/domain.js',
         '      reservation.starts_at_ms < endMs &&\n      startMs < reservation.ends_at_ms,',
         '      wallClockOnly(reservation.starts_at_ms, tz) < wallClockOnly(endMs, tz) &&\n'
         '      wallClockOnly(startMs, tz) < wallClockOnly(reservation.ends_at_ms, tz),'),
    ]),
    # m14: the reservation list sorted on the local time STRING rather than on absolute time.
    'm14': ('R049_list_order_multizone.js', [
        ('src/api.js',
         '  mine.sort((a, b) => b.starts_at_ms - a.starts_at_ms);',
         '  mine.sort((a, b) => String(b.starts_at_local).localeCompare(String(a.starts_at_local)));'),
    ]),

    # m15: an ambiguous fall-back local time resolves to the SECOND occurrence instead of the
    # first. Every stage-1 probe missed this because no fixture ever booked a repeated local hour;
    # the multi-timezone fixture produces one, and the probe asserts the staged condition first.
    'm15': ('R054_fallback_first.js', [
        ('src/time.js',
         '  found.sort((a, b) => a - b);\n  return found;',
         '  found.sort((a, b) => b - a);\n  return found;'),
    ]),
    # m16: the receipt is stored on ANY completed request, so a key spent on a 4xx is spent. The
    # retry then replays the refusal and a diner who corrects their request is told they already tried.
    # The first attempt at this mutation was a NO-OP and the probe passed against it, which is worth
    # recording: a 4xx never RETURNS from the handler, it THROWS, so widening the status test on the
    # return path stores nothing. The mutation has to catch the failure and store the refusal, which
    # is what a real "receipt on every completed request" implementation looks like.
    'm16': ('R041_reuse_after_4xx.js', [
        ('src/server.js',
         '  const result = handler(state);',
         '  let result;\n'
         '  try {\n'
         '    result = handler(state);\n'
         '  } catch (err) {\n'
         '    if (err instanceof ApiError) {\n'
         '      const failure = { status: err.status, body: { error: { code: err.code, message: err.message } } };\n'
         '      idem.remember(state, ctx.user.id, key, ctx.method, ctx.path, ctx.body, failure.status, failure.body);\n'
         '      return failure;\n'
         '    }\n'
         '    throw err;\n'
         '  }'),
        ('src/server.js',
         '  if (result.status >= 200 && result.status < 300) {',
         '  if (result.status >= 200 && result.status < 600) {'),
    ]),
    # m17: the receipt store ignores the METHOD and the PATH, so a key used on one keyed write
    # satisfies the other. The harness caught this mutant and every stage-1 probe missed it at 14/14,
    # because no probe ever presented one key to two paths: the condition was never staged.
    'm17': ('R037_idempotency_scope.js', [
        ('src/idempotency.js',
         '    (entry) => entry.user_id === userId && entry.key === key && entry.method === method && entry.path === path,',
         '    (entry) => entry.user_id === userId && entry.key === key,'),
    ]),
    # m18: the exported document shares structure with the live state instead of being a copy, so a
    # write that lands afterwards is visible in a document the caller already received. Every earlier
    # export row asserted properties OF a document and passed against a live view, because a live view
    # is correct until something writes to it.
    'm18': ('R059_export_snapshot.js', [
        ('src/snapshot.js',
         'function snapshotState(state) {\n  return JSON.parse(\n    JSON.stringify({',
         'function snapshotState(state) {\n  if (true) {\n'
         '    return {\n'
         '      users: state.users,\n'
         '      tokens: state.tokens,\n'
         '      restaurants: state.restaurants,\n'
         '      reservations: state.reservations,\n'
         '      idempotency: state.idempotency,\n'
         '    };\n  }\n  return JSON.parse(\n    JSON.stringify({'),
    ]),
    # m19: the SABOTEUR'S PATCH, verbatim and byte-identical, as confirmed by the seat that wrote it.
    # It fabricates an instant INSIDE the wall-clock resolver where the product returns null, which is
    # a different file and a different mechanism from m06 (domain.js, fabricating where the product
    # calls fail()). This exists to settle whether R053's coverage rests on the product or on a mutant
    # that only ever existed in this tree.
    'm19': ('R053_dst.js', [
        ('src/time.js',
         '  return instants.length === 0 ? null : instants[0];',
         '  return instants.length === 0 ? Date.UTC(2026, 2, 29, 1, 30, 0) : instants[0];'),
    ]),
}

ORDER = ['m01', 'm02', 'm03', 'm04', 'm05', 'm06', 'm08', 'm09', 'm10', 'm11', 'm12', 'm13', 'm14', 'm15', 'm16', 'm17', 'm18', 'm19']


def probe_for(mid):
    return MUTANTS[mid][0]


def apply(mid, target):
    if mid not in MUTANTS:
        sys.exit('no mutation defined for %s' % mid)
    for rel, old, new in MUTANTS[mid][1]:
        path = os.path.join(target, rel)
        if not os.path.exists(path):
            sys.exit('PATCH FILE MISSING %s' % path)
        s = open(path).read()
        n = s.count(old)
        if n != 1:
            sys.exit('PATCH TARGET COUNT %d (want 1) in %s:\n---\n%s\n---' % (n, rel, old))
        open(path, 'w').write(s.replace(old, new, 1))


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit('usage: patch.py <mutant-id> <target-dir>')
    mid, target = sys.argv[1], sys.argv[2]
    apply(mid, target)
    print('%s -> %s' % (mid, target))