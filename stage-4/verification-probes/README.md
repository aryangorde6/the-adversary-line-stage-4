# Browser suite for the screens

Three suites, run against a built container. Each one asserts an observable a person can see, and
each state row asserts both halves: the state that applies, and the state that must not be on screen
at the same time.

```sh
docker build -t tk-fin stage-4
docker run --rm -d --name tk-fin -e PORT=8080 -p 18099:8080 tk-fin

cd stage-4/verification-probes
node ui-grid.mjs        # the search results region: empty, loading, results, no slots
node ui-messages.mjs    # the lookup screen, and message integrity
node ui-a11y.mjs        # labels, sideways scrolling, clipped text, contrast
node ui-states-a11y.mjs # seven looks, focus at every stop, booking by keyboard alone
node ui-day-state.mjs   # what a screen may say about a day
node ui-booking-terms.mjs # what a screen may say about a booking's terms
node stage3-api.mjs     # policies, explain, accepted terms, history and series

docker rm -f tk-fin
```

## Pointing a suite at a service

**Every suite imports `stage4-base.mjs`**, which resolves the base URL once for the whole folder, in this
order:

    node ui-grid.mjs http://localhost:18099        # argv[2] wins
    BASE=http://localhost:18099 node ui-grid.mjs   # or the environment
    TK_BASE_URL=... node stage3-api.mjs            # still accepted; kept so an existing invocation
                                                   # does not silently start pointing elsewhere

and falls back to `http://localhost:18099`. **A suite cannot invent its own convention**, because none of
them reads the environment for a base URL any more.

**Every request is bounded** (`REQUEST_TIMEOUT_MS`, default 5000ms) and **every suite asserts
`GET /health` before its first row** -- at import for the screen suites, before the rows for
`seam-check.mjs`. So a suite pointed at a port with nothing on it **exits in seconds naming the URL
it tried**, rather than hanging until someone kills it and the silence being read as a slow suite.

`playwright-core` is installed outside the repository and linked in as `node_modules` here; it is
not a dependency of the product and the image stays dependency-free. Set `SHOTS=<dir>` to write
screenshots.

## What each suite holds the product to

`ui-grid.mjs` — the results region is visible from page load carrying an empty state that says what
to do; it stays visible while a search is in flight with a loading message; a fully-booked day still
renders a grid whose every cell is unavailable; and a day with no slots shows the no-slots message
instead of the grid, never beside it.

`ui-messages.mjs` — a reference that cannot be seen produces an error and no booking detail; a
booking that can be seen shows its status, its table by name and its time as a person reads it, and
the cancel action disappears once the booking is cancelled. Every inserted message appears at most
once, and its host exists in the document at the moment of insertion.

`ui-states-a11y.mjs` — the booking path driven with nothing but the keyboard: how many stops it
costs to reach a free table, that no taken table is in the tab order, and that Enter completes the
booking; the seven states named by the specification are seven distinct
(background, text, border) triples, asserted as a set so two of them collapsing into one look
cannot pass; and at every tab stop on all four routes, at both widths, a real `Tab` press yields a
focus indicator that is visible against the surface behind it.

`ui-a11y.mjs` — no sideways scrolling at 375 or 1280, every input labelled, no text clipped inside
its own box, and every text node above its WCAG floor against the first non-transparent background
behind it rather than against the page root.

`stage3-api.mjs` — the stage-4 API surface: who may publish a policy and what a complete one is,
which policy a local date selects and how a tie is broken, that `explain` is recomputed from capacity
and occupancy rather than read back from the answer it explains, that accepted terms are a snapshot
rather than a live read, that history is a record with its own sequence and never renumbers, that
adoption is all or nothing, and that a series occurrence is an ordinary reservation. The ten
standing clauses are restated at the top of the file, because a convention in a header does not
travel into a new file by itself.

## Two rules these rows follow

If a setup step can fail, assert that it succeeded before asserting anything about its result: a
rejected `/_test/reset` leaves the previous store in place, so every reading after it would be
stale. And assert the shape of what you read before drawing a conclusion from it: a missing key is
not a zero.

`ui-day-state.mjs` — what a screen may say about a day: only a day the service reports as `shut` may
be described as closed, and a day whose terms exclude every slot is described as having no times to
book. Each of the four day states is produced by a real fixture and read back from the service before
the screen is driven, so the row cannot pass against a field that does not exist.

`ui-booking-terms.mjs` — what a screen may say about the terms a booking was made under once the
restaurant has published new ones. A booking keeps the terms it was accepted under, and nothing in
the reservation response says those terms still apply, so a screen may state the booking's own terms
or nothing at all — and never that the booking is on the terms now in force.
