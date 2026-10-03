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

Total rows: 63
