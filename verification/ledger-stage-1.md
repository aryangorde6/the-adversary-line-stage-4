# Tablekeeper Stage 1 - Requirements Ledger

Result repository: /home/aryan/band_hack/band-work/tablekeeper5
Specification: /home/aryan/band_hack/dark-factory-wearedevs/tablekeeper/spec/stage-1.md

| id | section | requirement | how_to_check |
|---|---|---|---|
| R001 | §1 | Diners can search restaurant availability, book a table and receive confirmation reference | Test availability search, booking flow |
| R002 | §1 | Can cancel or amend bookings, including changing several bookings together | Test cancel, amend, batch moves |
| R003 | §1 | Each restaurant has table capacities, opening hours, cancellation policy | Verify fixture fields respected |
| R004 | §1 | Only HTTP API required | N/A - implementation choice |
| R005 | §1 | Two confirmed reservations must never occupy the same table at overlapping times including concurrent requests | Concurrent booking attempts to same slot |
| R006 | §1 | Occupancy is half-open interval [starts_at, starts_at + reservation_duration) | Verify ends_at = starts_at + duration |
| R007 | §1 | Retries and rejected requests must not create duplicate or partial bookings | Retry scenarios |
| R008 | §2 | Deliver HTTP service, Dockerfile and RUN.md with command to build and start without manual setup | Verify files exist |
| R009 | §2 | Image must run with -e PORT=<port> and port mapping | Docker run as specified |
| R010 | §2 | Runtime networking has no outbound access; all deps in image | Build-time vs runtime constraints |
| R011 | §2 | Resource limits: CPU 2vCPU, memory 2GiB, start to first healthy within 60s, up to 50 concurrent in-flight, per-request timeout 5s (10s for POST /_test/reset), no outbound at runtime | Verify constraints are met |
| R012 | §3.1 | Listen on 0.0.0.0 using PORT env var, default 8080 | Start server with/without PORT |
| R013 | §3.2 | GET /health -> 200 {"status":"ok"}; non-200 allowed before ready but must be 200 when ready within 60s | Probe health during startup and when ready |
| R014 | §3.3 | POST /_test/reset with fixture body -> 204; replaces all state; repeated resets supported; unauthenticated | Reset and verify state; repeat |
| R015 | §3.4 | application/json; charset=utf-8 | Check content-type |
| R016 | §3.4 | Timestamps RFC 3339 with explicit offset | Inspect timestamp formats |
| R017 | §3.4 | Unknown fields in request ignored; unknown query params ignored | Send extra fields/params |
| R018 | §3.4 | IDs opaque strings max 64 chars (applies to fixture IDs too) | Validate ID format/length constraints |
| R019 | §4 | Restaurants/tables supplied only via POST /_test/reset; no create endpoints | Enforce via fixture only |
| R020 | §4 | Seeded users must be able to login immediately with given password | Login seeded user |
| R021 | §4 | Fixtures may use any calendar date; booking not rejected solely because start is in past | Past date booking allowed except cutoffs |
| R022 | §4 | weekday one of mon tue wed thu fri sat sun | Validate weekday values |
| R023 | §4 | opens/closes HH:MM 24h, closes later than opens same day, never cross midnight | Validate opening hours |
| R024 | §5 | Every 4xx/5xx has body {error:{code,message}} | Check all error responses |
| R025 | §5 | 400 malformed_request for unparseable body or wrong JSON type | Send bad JSON/wrong types |
| R026 | §5 | 400 missing_idempotency_key when required header absent/empty | Test missing/empty key |
| R027 | §5 | 401 unauthenticated for missing/malformed/unknown bearer token | Auth failures |
| R028 | §5 | 403 forbidden when authenticated but not permitted | Permission cases |
| R029 | §5 | 404 not_found when no such resource or not visible to caller | Not found cases; ownership |
| R030 | §5 | 409 idempotency_key_reuse when key used by same caller with different body | Idem reuse |
| R031 | §5 | 422 validation_failed for missing required field/param or stated rule violation | Validation cases |
| R032 | §5 | Idempotency-Key 1..255 chars; else 422 validation_failed | Key length bounds |
| R033 | §5 | No 5xx under any circumstances including concurrent load | Stress/concurrency |
| R034 | §5 | Query param integers must be plain decimal digits (1e9, 4.0, +4 -> 422) | Query param format |
| R035 | §6 | POST /auth/signup returns 201 with user_id, display_name, token | Signup |
| R036 | §6 | POST /auth/login returns 200 with user_id, display_name, token | Login |
| R037 | §6 | Email already registered -> 409 email_taken | Duplicate signup |
| R038 | §6 | Password < 8 chars -> 422 validation_failed | Short password |
| R039 | §6 | email not local@domain form -> 422 validation_failed | Bad email format |
| R040 | §6 | Wrong password or unknown email on login -> 401 unauthenticated | Bad login |
| R041 | §6 | Bearer token required on all endpoints except /health, /_test/reset, /auth/signup, /auth/login, GET /restaurants, GET /restaurants/{id}, GET /availability | Auth scope test |
| R042 | §6 | Tokens do not expire; multiple tokens/sessions allowed | Token behavior |
| R043 | §6 | Passwords stored using password-hashing function (bcrypt/scrypt/argon2 or equivalent), not plaintext | Inspect storage semantics via behavior/implementation check |
| R044 | §7 | POST /reservations and POST /reservation-moves require Idempotency-Key | Enforce requirement |
| R045 | §7 | Key scoped to authenticated user | Different users same key independent |
| R046 | §7 | Replay = same user, same method, same path, same body; same key on different path is different | Path boundary |
| R047 | §7 | Idempotency resolved after body parsed and authenticated, before endpoint validation and resource checks; different body -> 409 even if new body invalid | Order of checks |
| R048 | §7 | Absent/empty key -> 400 missing_idempotency_key | Key missing |
| R049 | §7 | First use -> normal response (201) | First use |
| R050 | §7 | Replay same key same body -> 200 with identical body | Replay identity |
| R051 | §7 | Same key different body -> 409 idempotency_key_reuse | Reuse different |
| R052 | §7 | Key reused after 4xx original -> treated as first use | After failure reuse |
| R053 | §7 | Same body means same JSON value after parsing (order/whitespace irrelevant) | Canonicalization |
| R054 | §7 | Concurrent identical requests with unused key: exactly one 201, others 200 with same body; op once | Concurrency |
| R055 | §7 | Successful replay returns original response even after resource changes/cancelled; makes no state changes | Replay stability |
| R056 | §8 | GET /restaurants returns list with id,name,timezone | Public endpoint |
| R057 | §8 | GET /restaurants/{id} returns full restaurant shape incl slot_minutes, duration, cutoff, opening_hours, tables; 404 if unknown | Get single restaurant |
| R058 | §8 | GET /availability requires restaurant_id,date,party_size; missing any -> 422 validation_failed; date is local calendar date | Param validation |
| R059 | §8 | Availability returns slots on slot_minutes grid from opens while slot+duration <= closes; closed day returns empty slots | Grid calculation |
| R060 | §8 | available_table_ids lists tables with capacity>=party_size and no overlapping confirmed reservation, in fixture order; empty list if none | Availability filtering |
| R061 | §8 | starts_at_local is full YYYY-MM-DDTHH:MM | Format |
| R062 | §8 | POST /reservations requires Idempotency-Key; returns 201 with full reservation fields including reference, status confirmed, timestamps with offsets | Create reservation |
| R063 | §8 | reference 6-12 chars A-Z0-9, unique across all, never changes | Reference format/uniqueness |
| R064 | §8 | Table taken for overlapping interval -> 409 table_unavailable | Overlap conflict |
| R065 | §8 | starts_at_local not on slot grid -> 422 not_on_slot_grid | Grid alignment |
| R066 | §8 | Slot outside opening hours or would end after closes -> 422 outside_opening_hours | Hours boundary |
| R067 | §8 | party_size exceeds table capacity -> 422 party_exceeds_capacity | Capacity |
| R068 | §8 | party_size < 1 or not integer -> 422 validation_failed | Party size validation |
| R069 | §8 | starts_at_local is local time that does not exist (DST spring forward) -> 422 invalid_local_time | DST skipped hour |
| R070 | §8 | Unknown restaurant/table or table belongs to different restaurant -> 404 not_found | Referential integrity |
| R071 | §8 | GET /reservations returns caller's reservations starts_at desc, confirmed and cancelled; empty list ok | List own reservations |
| R072 | §8 | GET /reservations/{reference} returns one reservation; 404 if not caller's (no leakage) | Ownership enforced |
| R073 | §8 | POST /reservations/{reference}/cancel -> 200 with status cancelled; frees table immediately | Cancel frees slot |
| R074 | §8 | Cancel already cancelled -> 200 with current state | Idempotent cancel |
| R075 | §8 | Cancel within cutoff or later -> 409 cutoff_passed | Cutoff enforcement |
| R076 | §8 | Cancel not caller's -> 404 not_found | Ownership |
| R077 | §8 | PATCH /reservations/{reference} changes time/table/party_size (any subset); no idem key required | Amendment |
| R078 | §8 | Amendment uses same validation as create; cutoff measured against current start; cancelled -> 409 reservation_cancelled | Amend rules |
| R079 | §8 | Successful amendment releases old slot and reserves new together; failed amendment leaves original unchanged | Atomicity of amend |
| R080 | §8 | reference and reservation_id survive change | Identity preserved |
| R081 | §9 | Spring forward: skipped local times never appear in availability; booking skipped time -> 422 invalid_local_time | DST spring |
| R082 | §9 | Fall back: repeated hour occurs twice; always resolve to first occurrence (before clocks change); slot appears once; second not bookable | DST fall back ambiguity |
| R083 | §9 | reservation_duration_minutes is absolute time, not wall-clock | Duration absolute |
| R084 | §9 | Europe/Berlin and America/New_York transitions as specified must be handled; offsets follow IANA rules | Specific transition dates |
| R085 | §10 | GET /_test/export and POST /_test/import are unauthenticated test endpoints | Public test endpoints |
| R086 | §10 | Export returns 200 with track="tablekeeper", format_version=1, state (opaque) | Export format |
| R087 | §10 | Import takes entire object, atomically replaces state, returns 204 | Import behavior |
| R088 | §10 | Import accepts unchanged export from same service; no dependency on process/files/volume/port/network | Portability |
| R089 | §10 | Import is replacement not merge; repeating restores exported state without duplication | Idempotent replace |
| R090 | §10 | Invalid JSON -> malformed per §5; missing fields/wrong track/version/invalid state -> 422 validation_failed without changing destination | Validation |
| R091 | §10 | Test control calls have 10s timeout | Timeout |
| R092 | §10 | Export is atomic read-only snapshot; subsequent writes don't change it | Snapshot |
| R093 | §10 | Preserve accounts, hashed passwords, bearer tokens, fixture config, reservations, references, completed idem request bodies and original responses | Preservation |
| R094 | §10 | Identities, statuses, timestamps never regenerated | No regeneration |
| R095 | §10 | Failed request keys remain reusable | Failed keys reusable |
| R096 | §10 | Existing receipts/references/tokens/retries remain valid after import | Validity preserved |
| R097 | §10 | Replacing state with fresh fixture alone does not satisfy preservation requirement | Semantic requirement |
| R098 | §10 | Import removes all previous destination data/credentials | Full replacement |
| R099 | §10 | Reset clears all state including imported state | Reset scope |
| R100 | §10 | State need not survive abrupt container restart | No persistence |
| R101 | §11 | POST /reservation-moves requires auth and idempotency key; body has moves array | Moves basics |
| R102 | §11 | moves has 1..8 objects with distinct string references; invalid shape/duplicates -> 422 validation_failed | Shape/range |
| R103 | §11 | Every booking must belong to caller and same restaurant; unknown/other owner -> 404 not_found; different restaurants -> 422 validation_failed | Scope constraints |
| R104 | §11 | No token -> 401 | Auth |
| R105 | §11 | Each item accepts table_id, starts_at_local, party_size (subset); omitted fields retained; unknown ignored | Patch semantics |
| R106 | §11 | Booking identity, owner, creation time never change | Identity |
| R107 | §11 | Cancelled bookings -> 409 reservation_cancelled | Cancelled blocked |
| R108 | §11 | Each booking's existing cutoff applies | Cutoff per booking |
| R109 | §11 | Non-occupancy errors use ordinary amendment codes; precedence in input order; cutoff errors precede other changes for that booking | Error precedence |
| R110 | §11 | Overlap among resulting bookings or with unlisted booking -> 409 table_unavailable | Move conflicts |
| R111 | §11 | Unchanged listed bookings retain occupancy | No side effects |
| R112 | §11 | Either every move commits or nothing changes (occupancy, records, retry keys) | Atomic all-or-nothing |
| R113 | §11 | On success 201 with {"reservations": [...]} in input order, including unchanged items | Success response |
| R114 | §11 | Replays return original response with 200 even after amendments/cancellations; no-op moves retain values | Replay behavior |
| R115 | §11 | Export/import preserves successful batch receipts and resulting bookings | Persistence across export/import |

Total rows: 115
