# Tablekeeper Stage 1 - Requirements Ledger

Result repository: /home/aryan/band_hack/band-work/tablekeeper5
Specification: /home/aryan/band_hack/dark-factory-wearedevs/tablekeeper/spec/stage-1.md

| id | requirement | how_to_check |
|---|---|---|
| R001 | Listen on 0.0.0.0 using the PORT environment variable, default 8080 | Check server starts with PORT env; test default 8080 |
| R002 | GET /health -> 200 {"status": "ok"} | HTTP call to /health returns 200 with correct body |
| R003 | POST /_test/reset replaces all service state with fixture in body | Call reset with fixture, verify state changes; repeated resets supported |
| R004 | Occupancy is half-open interval [starts_at, starts_at + reservation_duration) | Check end time calculation |
| R005 | Two confirmed reservations must never occupy the same table at overlapping times, including during concurrent requests | Concurrent reservation attempts; verify only one succeeds or atomicity holds |
| R006 | Retries and rejected requests must not create duplicate or partial bookings | Retry with same key after failure; verify no duplicate |
| R007 | Every 4xx and 5xx response carries error body with code and message | Inspect error responses |
| R008 | POST /auth/signup returns 201 with user_id, display_name, token | Signup test |
| R009 | POST /auth/login returns 200 with user_id, display_name, token | Login test |
| R010 | Email already registered -> 409 email_taken | Try duplicate signup |
| R011 | Password shorter than 8 chars -> 422 validation_failed | Signup with short password |
| R012 | email not of form local@domain -> 422 validation_failed | Invalid email format |
| R013 | Wrong password or unknown email on login -> 401 unauthenticated | Bad login |
| R014 | Idempotency-Key required for POST /reservations and POST /reservation-moves; absent/empty -> 400 missing_idempotency_key | Test missing key |
| R015 | First use of key returns normal response (201) | First call with new key |
| R016 | Replay same key same body returns 200 with identical body | Replay identical request |
| R017 | Same key different body -> 409 idempotency_key_reuse | Replay with different body |
| R018 | Key reused after 4xx original -> treated as first use | After failed request, reuse key |
| R019 | Concurrent identical requests with unused key: exactly one returns 201, others 200 with same body | Concurrent identical POSTs |

Total rows: 19
