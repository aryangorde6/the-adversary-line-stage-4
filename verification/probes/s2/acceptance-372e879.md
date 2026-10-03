# Stage-2 acceptance at `372e8793e98947da659f3e59407c04580e72d318` (on `785406f`, `84157a5`)

Verdict: **PASS.** Every ledger row I hold has been checked at this hash and holds. The supplied
suite is green, and the one row that was BLOCKED on — the focus half of S2-042 — is verified per
stop, per exit, and in both directions.

## The sanctioned command

Clean clone at `372e879` in `/tmp/check-372e879`, built and started as `stage-2/RUN.md` says.
`/health` ok, `/` 200 in 9917 bytes.

| suite | collected | passed | failed | errors |
|---|---|---|---|---|
| stage 1 | 120 | 120 | 0 | 0 |
| stage 2 | 25 | 25 | 0 | 0 |

Highest contiguous stage: **2**.

## My probes, at this hash

| probe | 375 | 1280 | result |
|---|---|---|---|
| `focus_lifecycle.py` (new) | 42/42 | 42/42 | per-stop focus, three exits, no premature teardown, tab span |
| `contrast_focus.py` | — | 17/17 | text contrast and ring contrast, per stop |
| `states_set.py` | — | 11/11 | eight states, eight distinct triples |
| `closed_day.py` | — | 26/26 | closed day both sign-in states, short window included |
| `presence.py` | — | 7/7 | the three containers |
| `inert_and_widths.py` | — | 10/10 | `disabled` + `aria-disabled`, no sideways scrolling at both widths |
| `out_of_order_lost.py` | — | 12/12 | out-of-order, lost response, retry, refusal |

## S2-042, the focus half — the row that was BLOCKED

**Per stop, every stop, all four routes, signed in and out, at both widths: 53 to 56 stops per
route, every one painted.** The walk goes to exhaustion and never breaks on a repeat.

**The date field's internal stops: 18 per pass, ring painted on 18 of 18.** Of those, **4 stops do
not match `:focus` while the ring is painted** — the falsifiable form of the mechanism, and the
number to watch: if a later change makes it 0 or 2, the mechanism has moved. The Finisher's "4
wrapper-carried" and the Builder's "3" agree once the counting basis is stated; what both measured
is this.

**The wrapper's ring, against the surface it is actually drawn on:** lowest **7.64:1** on 18
wrapper-carried stops. So it is not a ring whose own edge coincides with the field's border and has
nothing to contrast against.

**No premature teardown:** the ring survives all four internal stops, including the stops where
`:focus` does not match, and a document-level `focusin` whose target is inside the field does not
clear it.

**Each exit driven independently, not one standing in for another:**

| exit | `kb-focus` after |
|---|---|
| `focusin` landing on another control | absent |
| `window` blur | absent |
| `pagehide` | absent |
| real mouse click elsewhere | absent |
| programmatic `.blur()` | absent |
| a programmatic search rebuilding the region while the keyboard is inside the field | **present — and correctly so**, because `activeElement` is still `date-input` inside the wrapper |

That last row is the one that distinguishes a working listener from a stuck ring, and it is asserted
as **ring present exactly when focus is genuinely still inside**, not as presence alone.

**And the ring re-arms:** after all three exits, focusing the field again paints it again. An exit
that cannot be undone is a different defect from an indicator that sticks.

**Tab-stop cost, reachability as well as appearance:** **1 press from a focused search button to the
first free table**, both widths, both sign-in states — measured from the search button because that
is where the search leaves focus, and labelled as such rather than as "from the top of the page".
**Unavailable cells reachable by keyboard: 0.**

## Two of my own instruments were wrong at this hash, and both were the faults I have clauses for

1. **A stale probe read the wrong element.** `contrast_focus.py` predates the wrapper and read the
   focused element's own outline, so it reported three false reds on the date field — the ring was
   there, painted one element out, exactly where the fix put it. It now reads the carrier. This is
   the mirror of the eight false failures: an instrument that looks at the wrong element is a false
   green or a false red depending on which way the change went.
2. **The same surface fault, re-invented inside my new probe.** `focus_lifecycle.py` initially walked
   the background from the carrier rather than from its parent, which reported `1.00:1` on all four
   submit buttons — the exact number clause 5 exists to prevent, in a file written after the clause.
   That is worth more than the fix: a convention in a header does not travel into new code by
   itself.

Both were caught because the runs contradicted the numbers I had already measured elsewhere, which is
the only reason they surfaced at all.

## The rest of the ledger, re-measured

- **Closed day**, signed in and out: results region out of the document, `no-slots` visible, sentence
  says closed and names the day; the **short window** covered with reset asserted 204 first and
  `slots` length 0 read from the service before the screen.
- **Open day on load**: grid visible, non-empty empty-state text, `no-slots` absent.
- **Fully-booked day**: every cell `data-available="false"`, no message.
- **Presence containers** absent in every state where they should not be; the form is built when a
  table is chosen and taken out when a search abandons the attempt; `reservation-detail` absent until
  there is one.
- **Taken against chosen** distinguishable on colour, on `disabled`/`aria-disabled`, and on the
  accessible name.
- **States set**: eight observed, eight distinct triples, including the `loading`/`empty` pair.
- **Out-of-order**: 45 of the second search's cells and its date after the late first response lands;
  the region present and visible in flight.
- **Lost response, retry, refusal**: uncertain message with the booking committed server-side; retry
  carrying the same key and a byte-identical body showing the original reference with exactly one
  reservation; refusal showing `booking-error` alone.
- **Contrast**: lowest 5.08:1 across four routes and both sign-in states.
- **Widths**: no sideways scrolling at 375 or 1280, signed in and out.

## Row count and judgment rows

Judgment rows in the stage-2 ledger: S2-008, S2-042's contrast half, S2-043, S2-044, S2-045,
S2-046. What I measured for each, rather than accepted:

- **S2-008** (page-level presentation): the four routes render non-empty and coherent at 375 and
  1280, no sideways scrolling, no visible word that explains how the system works, primary actions
  identifiable. Read as passing on those measurements; the taste half is recorded, not claimed.
- **S2-042 contrast half**: lowest 5.08:1 against the first non-transparent **ancestor**, which is the
  half that would have been wrong if read off the page root — two of the states sit on a form host.
- **S2-043**: the set assertion over eight observed states, plus taken-versus-chosen on two channels.
- **S2-044**: visible text for a pair booking carries no `t_1`, no `+`, and no "combined" — the
  sentences read as table names.
- **S2-045**: no raw `t_` or `r_` identifier appears in visible text on any route, in any state.
- **S2-046**: recorded as judgment; the measurable parts (no test-only chrome, identifiable primary
  action) hold.

## Reproducing

    git clone -q /home/aryan/band_hack/band-work/tablekeeper5 /tmp/check-372e879
    cd /tmp/check-372e879 && git checkout -q 372e879 && cd stage-2
    docker build -t tablekeeper . && docker run -d --name adv-s2i -e PORT=8080 -p 8087:8080 tablekeeper
    for p in focus_lifecycle contrast_focus states_set closed_day presence inert_and_widths out_of_order_lost; do
      for w in 375 1280; do BASE=http://127.0.0.1:8087 W=$w python verification/probes/s2/$p.py; done
    done
