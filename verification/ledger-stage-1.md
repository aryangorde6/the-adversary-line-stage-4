# Tablekeeper Stage 1 - Requirements Ledger

Result repository: /home/aryan/band_hack/band-work/tablekeeper5
Specification: /home/aryan/band_hack/dark-factory-wearedevs/tablekeeper/spec/stage-1.md

| id | section | requirement | how_to_check | tag | risk |
|---|---|---|---|---|---|
| R001 | §1 | "Diners can search restaurant availability, book a table and receive a confirmation reference." | GET /availability with restaurant_id/date/party_size -> 200 with slots; POST /reservations with valid body and Idempotency-Key -> 201 including reference (A-Z0-9 6-12 chars), status confirmed, timestamps with explicit offset. | shipped | low |
| R002 | §1 | "They can cancel or amend their bookings, including changing several bookings together." | POST /reservations/{ref}/cancel -> 200 cancelled; PATCH /reservations/{ref} subset updates; POST /reservation-moves with >=2 moves -> 201 all-or-nothing in input order. | shipped | medium |
| R003 | §1 | "Each restaurant has table capacities, opening hours and cancellation policy." | GET /restaurants/{id} returns tables with capacity, opening_hours, cancellation_cutoff_minutes, slot_minutes, reservation_duration_minutes, timezone. | shipped | low |
| R004 | §1 | "Only the HTTP API is required." | HTTP API only (no UI for stage 1). | shipped | low |
| R005 | §1 | "Two confirmed reservations must never occupy the same table at overlapping times, including during concurrent requests." | Book t1 19:00-20:30 (90m); attempt t1 starting 19:30 -> 409 table_unavailable. 10 concurrent identical POST /reservations with unused Idempotency-Key -> exactly one 201, others 200 identical; only one confirmed. | hidden | high |
| R006 | §1 | "Occupancy is the half-open interval [starts_at, starts_at + reservation_duration). A 90-minute booking at 19:00 therefore does not overlap a booking starting at 20:30." | 90m at 19:00:00+02:00 ends 20:30:00+02:00; booking starting 20:30:00+02:00 does not overlap. | both | high |
| R007 | §1 | "Retries and rejected requests must not create duplicate or partial bookings." | After 4xx, reusing same Idempotency-Key treated as first use; no partial state persists. | hidden | high |
| R008 | §2 | "Deliver HTTP service, Dockerfile and RUN.md with command to build and start without manual setup." | Dockerfile and RUN.md present; docker build and run succeed. | shipped | low |
| R009 | §2 | "Image must run on its own with -e PORT=<port> and a port mapping." | docker run -e PORT=8081 -p 8081:8081 <img> responds on 8081. | shipped | low |
| R010 | §2 | "Runtime networking has no outbound access. All runtime dependencies, initialization and seed data must work within single container." | Self-contained; no runtime outbound. | shipped | low |
| R011 | §2 | "Start to first healthy 60s; up to 50 concurrent in-flight; 5s per request (10s for POST /_test/reset); never 5xx." | Health < 60s; 50 concurrent no 5xx; timeouts as specified. | both | high |
| R012 | §3.1 | "Listen on 0.0.0.0 using PORT env var, default 8080." | PORT unset -> 8080; PORT=9091 -> 9091. | shipped | low |
| R013 | §3.2 | "GET /health -> 200 {'status':'ok'}. Return 200 once ready within 60s; non-200 allowed before ready." | Health returns correct body when ready within 60s. | shipped | low |
| R014 | §3.3 | "POST /_test/reset replaces all state with fixture; returns 204; repeated resets supported; no auth required." | State replaced; repeats ok; works without auth. | shipped | high |
| R015 | §3.4 | "Requests/responses application/json; charset=utf-8. Timestamps RFC 3339 with explicit offset." | Content-Type correct; timestamps include explicit offset. | shipped | medium |
| R016 | §3.4 | "Unknown fields in request ignored; unknown query params ignored." | Extra fields/params do not error. | shipped | medium |
| R017 | §3.4 | "IDs opaque strings max 64 chars (including fixture IDs)." | ID length <= 64 enforced. | shipped | medium |
| R018 | §4 | "Restaurants/tables only via reset. Seeded users can login immediately." | Only fixture defines; seeded login works. | shipped | low |
| R019 | §4 | "Booking not rejected solely for past start (cutoffs apply). weekday mon..sun. opens/closes HH:MM 24h; closes>opens same day; never cross midnight." | Past dates allowed unless cutoffs; hours constraints. | shipped | medium |
| R020 | §5 | "Every 4xx/5xx has {error:{code,message}} with specified status and code." | Error shape and codes correct. | shipped | low |
| R021 | §5 | "400 malformed_request for unparseable body or wrong JSON type." | Bad JSON/wrong types -> 400. | shipped | medium |
| R022 | §5 | "400 missing_idempotency_key if header absent or empty." | Absent/empty -> 400. | shipped | low |
| R023 | §5 | "401 unauthenticated for missing/malformed/unknown token." | Auth failures -> 401. | shipped | low |
| R024 | §5 | "403 forbidden if authenticated but not permitted." | Forbidden -> 403. | shipped | low |
| R025 | §5 | "404 not_found if no such resource or not visible to caller (no leakage)." | Not found including ownership -> 404. | shipped | high |
| R026 | §5 | "409 idempotency_key_reuse if same key used by same caller with different request body." | Different body reuse -> 409. | shipped | high |
| R027 | §5 | "422 validation_failed for missing required field/param or stated violation." | Validation -> 422. | shipped | low |
| R028 | §5 | "Idempotency-Key 1..255 chars; >255 -> 422 (empty -> 400)." | Key length rules enforced. | shipped | medium |
| R029 | §5 | "Integer query params must be plain decimal digits (1e9, 4.0, +4 -> 422)." | Query param format enforced. | shipped | high |
| R030 | §5 | "No 5xx ever including concurrent load." | No 5xx under load. | both | high |
| R031 | §5 | "Endpoint-specific precedence: invalid party_size values (strings/booleans) and starts_at_local not bare YYYY-MM-DDTHH:MM -> 422 validation_failed (precedence)." | Type/format precedence correct. | shipped | high |
| R032 | §6 | "POST /auth/signup -> 201 {user_id,display_name,token}. POST /auth/login -> 200 same." | Auth responses correct. | shipped | low |
| R033 | §6 | "Email already registered -> 409 email_taken. Password < 8 -> 422 validation_failed. email not local@domain -> 422 validation_failed. Wrong password/unknown email -> 401 unauthenticated." | Auth cases correct. | shipped | medium |
| R034 | §6 | "Bearer token required except /health, /_test/reset, /auth/signup, /auth/login, GET /restaurants, GET /restaurants/{id}, GET /availability." | Scope enforced. | shipped | medium |
| R035 | §6 | "Tokens don't expire; multiple tokens/sessions allowed. Passwords hashed (not plaintext)." | Token behavior and hashing. | shipped | high |
| R036 | §7 | "POST /reservations and POST /reservation-moves require Idempotency-Key. Key scoped to authenticated user." | Both require key; per-user scope. | shipped | high |
| R037 | §7 | "Replay = same user/method/path/body. Same key on different path is different request (succeeds normally)." | Path boundary correct. | hidden | high |
| R038 | §7 | "Resolved after body parsed and authenticated, before endpoint validation/resource checks -> different body with used key returns 409 even if new body invalid." | Check order correct. | hidden | high |
| R039 | §7 | "First use -> 201. Replay same key same body -> 200 with identical body. Same body = same JSON after parsing (order/whitespace irrelevant)." | Replay identity correct. | shipped | high |
| R040 | §7 | "Concurrent identical unused key: exactly one 201, others 200 identical; op takes effect once." | Concurrency correct. | hidden | high |
| R041 | §7 | "Successful replay returns original response even after resource changed/cancelled; makes no state changes. Key reused after 4xx original -> treated as first use." | Stability and reuse after failure. | hidden | high |
| R042 | §8 GET /availability | "All three params required; missing any -> 422 validation_failed. date is local calendar date." | Required params enforced. | shipped | medium |
| R043 | §8 GET /availability | "Slot appears for every slot_minutes step from opens such that slot + reservation_duration_minutes <= closes." | Grid calculation correct. | shipped | high |
| R044 | §8 GET /availability | "available_table_ids lists tables with capacity >= party_size and no overlapping confirmed reservation, in fixture order; empty list if none. Slot with no available table still appears with empty list. Closed day returns slots: []." | Filtering/empty/closed correct. | shipped | high |
| R045 | §8 GET /availability | "starts_at_local is full YYYY-MM-DDTHH:MM; both starts_at_local and starts_at present; timezone echoed." | Formats and fields correct. | shipped | medium |
| R046 | §8 POST /reservations | "Idempotency-Key required. 201 includes reservation_id, reference, restaurant_id, table_id, party_size, status confirmed, starts_at_local, starts_at, ends_at, created_at with offsets." | Shape correct. | shipped | low |
| R047 | §8 POST /reservations | "reference 6-12 chars A-Z0-9, unique across all, never changes." | Ref constraints correct. | shipped | high |
| R048 | §8 POST /reservations | "Table taken for overlapping interval -> 409 table_unavailable. starts_at_local not on slot grid -> 422 not_on_slot_grid. Outside hours or ends after closes -> 422 outside_opening_hours. party_size exceeds capacity -> 422 party_exceeds_capacity. party_size < 1 or not integer -> 422 validation_failed. Skipped DST time -> 422 invalid_local_time. Unknown restaurant/table or table from different restaurant -> 404 not_found. Booking not rejected solely for past start." | All case table cases covered. | shipped | high |
| R049 | §8 GET /reservations | "Caller's reservations starts_at desc, confirmed and cancelled; empty list is {'reservations':[]}." | List semantics correct. | shipped | low |
| R050 | §8 GET /reservations/{reference} | "One reservation; 404 if not caller's (no leakage)." | Ownership enforced. | hidden | high |
| R051 | §8 cancel | "Frees table immediately (next availability offers slot). Already cancelled -> 200 current state. Within cutoff or later -> 409 cutoff_passed. Not caller's -> 404 not_found." | Cancel semantics correct. | shipped | high |
| R052 | §8 PATCH | "Any subset of table_id/starts_at_local/party_size; no idem key. Validation same as create. Cutoff measured against current start. Cancelled -> 409 reservation_cancelled. Success releases old and reserves new together (atomic). Failure leaves original unchanged. reference and reservation_id survive." | Amendment semantics correct. | hidden | high |
| R053 | §9 | "Spring forward: skipped local times never in availability; booking skipped -> 422 invalid_local_time." | DST spring handled. | both | high |
| R054 | §9 | "Fall back: repeated hour occurs twice; always resolve to first occurrence (before change); slot appears once; second not bookable." | DST fall ambiguity handled. | hidden | high |
| R055 | §9 | "reservation_duration_minutes is absolute time (01:30 + 90m on fall-back ends 02:00 local)." | Absolute duration correct. | hidden | high |
| R056 | §9 | "Europe/Berlin 2026-03-29 02:00->03:00, 2026-10-25 03:00->02:00. America/New_York 2026-03-08 02:00->03:00, 2026-11-01 02:00->01:00. Offsets follow IANA rules." | Transitions and zones correct. | both | high |
| R057 | §10 | "GET /_test/export and POST /_test/import unauthenticated. Export returns track='tablekeeper', format_version=1, state (opaque)." | Export format correct. | shipped | low |
| R058 | §10 | "Import takes entire object, atomically replaces state -> 204. Accepts unchanged export from same service; no deps on process/files/volume/port/network. Replacement not merge; repeat restores without duplication." | Import behavior correct. | hidden | high |
| R059 | §10 | "Invalid JSON/missing fields/wrong track/version/invalid state -> 422 without changing destination. Test control calls have 10s timeout. Export is atomic read-only snapshot; subsequent writes don't change it." | Validation/snapshot/timeout correct. | hidden | high |
| R060 | §10 | "Preserve accounts, hashed passwords, bearer tokens, fixture config, reservations, refs, completed idem request bodies and original responses. Identities/statuses/timestamps never regenerated. Failed keys reusable. Receipts/refs/tokens/retries remain valid after import. Import removes all previous; reset clears imported state. State need not survive restart." | Full preservation semantics correct. | hidden | high |
| R061 | §11 | "moves has 1..8 objects with distinct string references; invalid shape/duplicates -> 422. Every booking belongs to caller and same restaurant; unknown/other owner -> 404; different restaurants -> 422; no token -> 401." | Moves constraints correct. | shipped | high |
| R062 | §11 | "Each item accepts table_id/starts_at_local/party_size (subset); omitted retained; unknown ignored. Identity/owner/created_time never change. Cancelled -> 409 reservation_cancelled. Each booking's cutoff applies; cutoff errors precede other changes; non-occupancy errors in input order. Overlap among resulting or with unlisted -> 409. Unchanged retain occupancy." | Moves semantics correct. | hidden | high |
| R063 | §11 | "Either every move commits or nothing changes (occupancy, records, retry keys). 201 with reservations in input order including unchanged. Replays return original 200 even after changes; no-ops retain values. Export/import preserves batch receipts and resulting bookings." | Atomicity/replay/preservation correct. | hidden | high |

## Stage-1 probe evidence, extended: mutants 2, 14 and 3

Twelve probe files, 171 asserted rows, all green against the unmutated stage-1 build; each file's
target caught when the corresponding mutation is applied, on its own port, with the marker asserted in
the same run as the probe and an unmutated baseline required to pass.

| Probe file | Rows | Ledger rows it decides | Mutation caught |
| --- | --- | --- | --- |
| `R006_occupancy_multizone.js` | 9 | R006, R048 | m13: occupancy decided on wall-clock values, the date dropped |
| `R049_list_order_multizone.js` | 14 | R049 | m14: the list sorted on the local time **string** |
| `R054_fallback_first.js` | 21 | R053, R054, R055, R056 | m15: an ambiguous fall-back hour resolved to the **second** occurrence |
| `R041_reuse_after_4xx.js` | 8 | R041 (second half) | m16: the receipt is stored on a **failure**, so a key spent on a 4xx is spent |

**The fixture came first, and that is why these three exist.** All earlier probes ran against one
restaurant in one timezone, which masks three whole classes of defect: with one zone the local date
and the UTC date agree, so a resolver that gets the date wrong still answers correctly; local order
and absolute order are the same order; and no probe ever booked an **ambiguous local hour**, so the
first-occurrence rule had nothing to act on. `multiZone()` in `lib.js` fixes all three at once —
Berlin and New York with daylight saving, Tokyo without — and `instantOf()` computes expected instants
from the IANA database **inside the probe**, never read back out of the service.

**Three faults of my own while writing these, each recorded because each produced a confident number.**

1. **A row asserting a rule the specification does not have.** I asserted that a *second table* at an
   ambiguous local time must be refused. Occupancy is per table, so that booking is legal; my row
   reported a red against correct code. Split into two rows: the same table again must be 409, a
   different table must be 201.
2. **A comparison that could not distinguish the two cases.** The first sort row compared local time
   *strings*, and two of the four bookings share the string `2026-06-02T09:00` — so expected and
   actual were equal for the wrong reason and the row would have passed a service sorting on exactly
   the defect it exists to catch. Fixed by labelling every booking with restaurant **and** local time,
   and by printing what a local-string sort would have produced so the two orders can be seen to
   differ.
3. **The wrong quantity.** A row asserted that two dates six months apart in Tokyo are the same
   instant, which is false; the quantity that shows Tokyo has no daylight saving is the UTC **offset**,
   +540 minutes in both months. Asserting instants where offsets were meant is the ordinary
   wrong-quantity error, and it produced a red against a correct service.

**Two more faults of my own in this row, both caught by clause 1 rather than by reading.**

4. **My first mutation for #7 was a no-op and my probe passed against it.** I widened the status test
   on the return path (`< 300` to `< 600`), which stores nothing at all: a 4xx never *returns* from the
   handler, it **throws**. A mutation that cannot apply its own idea is worse than no mutation, because
   it makes a probe look adequate. The real mutation catches the failure and stores the refusal, and
   the probe then fails as it should: `R041k FAIL … -> 409 idempotency_key_reuse`.
5. **Two leftover servers from earlier runs were still listening on the ports**, so the last two
   verification runs never started their own service and the probes were answered by a **build that was
   no longer under test** — the same port collision that produced two false NOT CAUGHT readings on
   stage 1, now reproduced in my own harness. The runner now **refuses to start on a busy port**, and
   the corrected run reads **mutant 2/4, baseline 8/8**. Three instances of this in one project is
   enough to make it a standing requirement rather than a habit: *the service you measure must be the
   service you started, and the check that it is costs one `ss` line.*

**The general form, which is the same one stage 2 arrived at from the other end:** a probe that does
not stage the condition it claims to test cannot fail, and the tell is always the marker and the
result disagreeing. Every one of these three probes now asserts its staged condition **first** — that
the local time really denotes two instants, that the two orders really differ, that the delay really
happened — and only then asserts what the service did about it.

Total rows: 63

## Stage-1 probe evidence (my own probes, added after the sabotage report)

Nine probe files, 119 asserted rows, all passing against the unmutated stage-1 build and each
file's target caught when the corresponding mutation is applied. Run them with:

    docker build -t tablekeeper stage-1 && docker run -d --name adv-s1 -p 8099:8080 tablekeeper
    TK_BASE=http://127.0.0.1:8099 verification/probes/s1/run-all.sh
    bash verification/probes/s1/mutants/apply.sh      # 11 mutations, mutated FAIL / baseline PASS

| Probe file | Rows | Ledger rows it decides | Mutation caught |
| --- | --- | --- | --- |
| `R005_concurrency.js` | 14 | R005, R046, R047 | m02 (yield between receipt lookup and handler -> 409 storm) |
| `R006_halfopen.js` | 8 | R006, R048 | m01 (`<` -> `<=`; 20:30 adjacent booking refused) |
| `R007_no_partial.js` | 10 | R007, R048 | m03 (persist before validation; refused booking leaves a record) |
| `R029_query_integer.js` | 11 | R029 | m12 (integer regex dropped; `1e9`, `4.0`, `+4` accepted) |
| `R038_idem_order.js` | 8 | R038 | m04 (body comparison dropped; reused key replays) |
| `R041_replay.js` | 11 | R041 | m05 (receipt stores `null`; replay returns no body) |
| `R053_dst.js` | 17 | R053, R054, R055, R056 | m06 (fabricated instant for a skipped time), m08 (wall-clock duration across fall-back) |
| `R060_export_import.js` | 25 | R057, R058, R059, R060 | m09 (import merges), m10 (import regenerates identities) |
| `R063_moves.js` | 15 | R061, R062, R063 | m11 (each move applied as planned; a partial batch survives) |

Three reading errors of mine were found by running the probes against the real product rather
than against a mutant, and are recorded because each had produced a green row that measured
nothing:

1. `lib.parallel(n, makeRequest)` queued `makeRequest` itself, so an indexed callback received
   `undefined`. The 50-request sweep therefore sent `NaN` in every start time, the service
   correctly answered 422 fifty times, and a status-count row reported it as fifty clean
   bookings. The helper now passes the index and the row requires all fifty to be 201.
2. Trial 2b reused 19:00/19:30/20:00 on one day while a booking lasts 90 minutes, so attempts
   two and three overlapped attempt one and were correctly refused with 409. Each attempt now
   uses its own day.
3. `R005h2` counted only 409s, so a sweep that produced no bookings at all passed. It now
   requires all fifty to be 201 and adds a row that the fifty reservations are readable
   afterwards, since concurrency may not lose a commit.
