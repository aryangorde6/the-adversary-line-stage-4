# Browser suite for the screens

Three suites, run against a built container. Each one asserts an observable a person can see, and
each state row asserts both halves: the state that applies, and the state that must not be on screen
at the same time.

```sh
docker build -t tk-fin stage-2
docker run --rm -d --name tk-fin -e PORT=8080 -p 18099:8080 tk-fin

cd stage-2/verification-probes
node ui-grid.mjs        # the search results region: empty, loading, results, no slots
node ui-messages.mjs    # the lookup screen, and message integrity
node ui-a11y.mjs        # labels, sideways scrolling, clipped text, contrast

docker rm -f tk-fin
```

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

`ui-a11y.mjs` — no sideways scrolling at 375 or 1280, every input labelled, no text clipped inside
its own box, and every text node above its WCAG floor against the first non-transparent background
behind it rather than against the page root.

## Two rules these rows follow

If a setup step can fail, assert that it succeeded before asserting anything about its result: a
rejected `/_test/reset` leaves the previous store in place, so every reading after it would be
stale. And assert the shape of what you read before drawing a conclusion from it: a missing key is
not a zero.
