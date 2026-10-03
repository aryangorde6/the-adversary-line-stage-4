# The supplied stage-1 suite run against each mutant (commit c1e5735 baseline)

The earlier "caught by adversary probes" column measured a placeholder, and a baseline run on
unmutated code proves only that the suite passes. The measurement that decides anything is the run
against each mutant. This is that measurement.

Every mutant was applied to a scratch copy of `stage-1` outside the repository
(`/tmp/opencode/adv-mut/<id>/stage-1`), then the supplied suite was run through its own CLI, in
isolated mode, one run per mutant with a fresh `--out` directory:

    cd /home/aryan/band_hack/dark-factory-wearedevs
    .venv/bin/python -m harness run --track tablekeeper \
      --repo /tmp/opencode/adv-mut/<id> --stage 1 --mode isolated \
      --out /home/aryan/band_hack/band-work/checks/tablekeeper5/mut-<id>

The repository tree was never mutated; `stage-1/` is untouched at `c1e5735`.

| mutant | requirement | supplied suite | adversary probes (119 rows) | what caught it, or the row that should have |
|---|---|---|---|---|
| m01 half-open -> closed | R006 | **caught** (117/120) | caught | `test_adjacent_non_overlapping_booking_succeeds`, `test_booked_table_leaves_the_slot_and_every_overlapping_one`, `test_list_is_starts_at_descending` |
| m02 await between receipt lookup and write | R005 | **MISSED** (120/120) | caught (`R005b`) | the shipped `test_one_slot_under_ten_clients` asserts only "exactly one booking may win"; it never asserts that the losers get **200 with a byte-identical body**. The exposed row is the second half of R005: 10 parallel identical POSTs on one unused key -> exactly one 201, nine 200s, every body byte-identical, exactly one confirmed reservation. |
| m03 persist before validation | R007 | **caught** (42 failed) | caught (`R007c`) | broad, not surgical — see the note below |
| m04 key reuse without body comparison | R038 | **caught** (119/120) | caught (`R038b`) | `test_same_key_changed_party_size_is_reuse` |
| m05 receipt stores `response: null` | R041 | **caught** (118/120) | caught (`R041d`) | `test_replay_after_cancel_returns_the_original_confirmed_body`, `test_first_use_is_201_replay_is_200_with_the_same_body` |
| m06 fabricated instant for a skipped local time | R053 | **caught** (119/120) | caught (`R053c`) | `test_booking_a_skipped_local_time_is_rejected` |
| m08 wall-clock duration across fall-back | R055 | **caught** (115/120) | caught (`R055b`) | `test_duration_is_absolute_time_not_wall_clock`, `test_ends_at_is_start_plus_duration`, plus three availability tests that fail as collateral |
| m09 import merges instead of replacing | R058 | **MISSED** (120/120) | caught (`R058a`) | no shipped check arranges destination state, exports, mutates the destination, imports, and counts. Exposed row: R058's replacement half — seed, export, change the destination (book something new), import the unchanged export, assert the destination's post-export booking is **gone** and only the exported reservations remain; repeat the import and assert no duplication. |
| m10 import regenerates identities | R060 | **caught** (119/120) | caught (`R060l`) | `test_export_can_restore_a_booking` |
| m11 per-move application breaks all-or-nothing | R063 | **MISSED** (120/120) | caught (`R063d`) | the shipped `test_a_move_batch_of_one_moves_the_booking` only ever moves one reservation, so it cannot see a partial batch. Exposed row: R063's all-or-nothing half — a batch whose **first** item is legal and whose **second** conflicts; assert 409, assert the first booking is still on its original table and time, and assert availability for its original slot is unchanged. |
| m12 query integer regex removed | R029 | **caught** (116/120) | caught (`R029a`) | `test_a_query_integer_must_be_plain_decimal_digits[4.0, +4, " 4"]`, `test_availability_rejects_bad_party_size[1e9]` |

**Three of eleven survive the supplied suite, and all three are the rows my ledger marks `hidden`:**
R005's replay half, R058's replacement half, R063's atomicity half. Every one of the three is a
requirement stated in the specification, so each is an exposed row in the graded build, not a
disputed reading.

**One caveat about m03.** The mutation I wrote is harsher than the sabotage report's: it pushes a
malformed record (party_size 999) into state before validation, which poisons availability for
every later booking, so 42 checks fail. It is caught, but the count overstates the detection — a
faithful "partial booking" mutant would leave state untouched apart from one record and would fail
perhaps three checks. The `R007c` probe is the one that names the defect precisely: the same slot
is 422 after the refusal, which is what a leaked record looks like from the outside.

## Reproducing

    bash /tmp/opencode/adv-mut/run.sh <id>          # one mutant, fresh --out
    bash verification/probes/s1/mutants/apply.sh     # the probe side: 11 caught, 11 baselines pass
    TK_BASE=http://127.0.0.1:8099 verification/probes/s1/run-all.sh
