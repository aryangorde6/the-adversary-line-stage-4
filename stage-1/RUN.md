# Tablekeeper

Node.js 22, no dependencies, no build step. State is in memory only and is lost
when the container stops.

## Run

From the directory that holds this file — the one containing the `Dockerfile`:

```sh
docker build -t tablekeeper .
docker run --rm -e PORT=8080 -p 8080:8080 tablekeeper
```

Base URL: `http://localhost:8080`

`PORT` is not required. If you leave `-e PORT` out the service listens on 8080. To use a
different port, change it on both sides of the mapping, `-e PORT=9000 -p 9000:9000`, and
the base URL becomes `http://localhost:9000`.

Health check:

```sh
curl -s http://localhost:8080/health
# {"status":"ok"}
```

Stop with `Ctrl-C`; nothing is left behind and nothing needs cleaning up.

## What it is

One process serving a reservation API over `node:http`. Restaurants, tables and
accounts arrive only through `POST /_test/reset`; the rest of the endpoints act on
that data.

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| `POST` | `/auth/signup` | no | 201 with `user_id`, `display_name`, `token` |
| `POST` | `/auth/login` | no | 200, same body |
| `GET` | `/restaurants` | no | public list |
| `GET` | `/restaurants/{id}` | no | public detail with tables |
| `GET` | `/availability` | no | `restaurant_id`, `date`, `party_size` |
| `POST` | `/reservations` | yes | needs `Idempotency-Key` |
| `GET` | `/reservations` | yes | own bookings, latest start first |
| `GET` | `/reservations/{reference}` | yes | own booking only |
| `POST` | `/reservations/{reference}/cancel` | yes | cut-off applies |
| `PATCH` | `/reservations/{reference}` | yes | amendment, any subset of fields |
| `POST` | `/reservation-moves` | yes | needs `Idempotency-Key`, 1-8 bookings, all or nothing |
| `GET` | `/_test/export` | no | atomic snapshot |
| `POST` | `/_test/import` | no | replaces state with a snapshot |

Send the token as `Authorization: Bearer <token>`. `POST /reservations` and
`POST /reservation-moves` also need an `Idempotency-Key` header of 1 to 255
characters; repeating the same key with the same body replays the stored answer
with 200 instead of booking again.

## Seed data

`POST /_test/reset` replaces everything with the fixture in the body and answers
`204`. `{}` leaves an empty service.

```sh
curl -s -X POST http://localhost:8080/_test/reset \
  -H 'Content-Type: application/json' \
  -d '{
    "users": [
      { "id": "u_ada", "email": "ada@example.com", "password": "correct horse", "display_name": "Ada" }
    ],
    "restaurants": [
      {
        "id": "r_anker", "name": "Zum Anker", "timezone": "Europe/Berlin",
        "slot_minutes": 30, "reservation_duration_minutes": 90, "cancellation_cutoff_minutes": 120,
        "opening_hours": [
          { "weekday": "thu", "opens": "18:00", "closes": "23:00" },
          { "weekday": "fri", "opens": "18:00", "closes": "23:30" }
        ],
        "tables": [
          { "id": "t_1", "label": "1", "capacity": 2 },
          { "id": "t_2", "label": "2", "capacity": 4 }
        ]
      }
    ],
    "reservations": []
  }' -o /dev/null -w '%{http_code}\n'
```

Seeded users can sign in with the seeded password straight away.

## A first booking, end to end

With the service running and the seed above posted, these two calls make one booking. Use a fresh
`Idempotency-Key` for each booking you make.

```sh
TOKEN=$(curl -s -X POST http://localhost:8080/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ada@example.com","password":"correct horse"}' \
  | sed 's/.*"token":"\([^"]*\)".*/\1/')

curl -s -X POST http://localhost:8080/reservations \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Idempotency-Key: first-booking-1' \
  -d '{"restaurant_id":"r_anker","table_id":"t_2","starts_at_local":"2026-09-24T19:00","party_size":4}'
# 201, with "reference" and "status":"confirmed"
```

`r_anker`, `t_2` and the date come from the seed above; `GET /availability` returns the start
times to choose from. The seed is open Thursday and Friday, so 2026-09-24 books and 2026-09-23
does not.

## Errors

Every 4xx and 5xx body is `{"error":{"code":"...","message":"..."}}`. The `code` is the stable
part and is what a program should branch on. The `message` is a sentence for the person who made
the request, worded in `src/messages.js` and free to change, so never parse it or branch on its
wording. Codes:
`malformed_request`, `missing_idempotency_key`, `unauthenticated`, `forbidden`,
`not_found`, `idempotency_key_reuse`, `email_taken`, `table_unavailable`,
`cutoff_passed`, `reservation_cancelled`, `validation_failed`,
`not_on_slot_grid`, `outside_opening_hours`, `party_exceeds_capacity`,
`invalid_local_time`.

## Layout

```
src/main.js      entry point: listen, timeouts, shutdown
src/server.js    routing, authentication, idempotency, error mapping
src/api.js       endpoint behaviour
src/domain.js    opening hours, slot grid, capacity, occupancy
src/moves.js     batch move planning
src/time.js      wall clock and IANA zones, including DST
src/state.js     in-memory store
src/fixture.js   reset fixture parsing
src/snapshot.js  export and import
src/accounts.js  scrypt hashing, bearer tokens
src/fields.js    request field validation
src/http.js      request and response plumbing
src/idempotency.js  idempotency keys and their stored replies
src/errors.js    error codes and statuses
src/text.js      user-facing message lookup
src/messages.js  the message catalogue
```