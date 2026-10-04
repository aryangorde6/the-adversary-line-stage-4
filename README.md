# The Adversary Line — a dark software factory

Entry for the WeAreDevelopers × BAND **Dark Factory** hackathon, **tablekeeper** track.

**Team:** Aryan Gorde (solo).

Five coding-agent seats in Band Desktop took one message and built a restaurant reservation service in four stages, each a complete container. Nothing else in the room came from a person. One seat turns the specification into a ledger of requirements and attacks the work against it; another plants defects to measure that checker. The whole factory runs on free models that need no key.

## How to read this repository

| Path | What it is |
|---|---|
| [`FACTORY.md`](FACTORY.md) | The factory: seats, who talks to whom, design choices and their cost, measured time and spend, how it catches bad work, what failed, how to stand it up |
| [`mandates/`](mandates/) | One standing instruction file per seat. Nothing in them names this problem |
| [`room.json`](room.json) | The Band room the factory worked in — the full, unedited session download |
| `stage-1/` … `stage-4/` | The service at each stage. Each folder builds and serves on its own: see *Try a stage* below |
| `verification/` | The Adversary's requirements ledgers, probes and stage-4 report; the Saboteur's defect reports |
| `bin/` | The seat launcher and the tools used to measure the run |
| `demo/` | Ours, after the run: serves `stage-4/` unchanged with sample restaurants, for the live demo |

Every commit in the history is a seat's own: each seat commits under its name (`Builder <builder@factory.invalid>`, and so on), and its room message names the commit. The exceptions are the commits made by hand after the run, all by `aryan gorde`. The packaging commit (`7104fee`) adds this README, the license, the factory's own files (`FACTORY.md`, `mandates/`, `bin/`, `dispatch/`) and `room.json`, and it puts `stage-4/src` back to the accepted commit (see *After the run* below). The later ones change only documentation and add `demo/`; none touches a stage folder.

## Try a stage

```sh
cd stage-4
docker build -t tablekeeper . && docker run --rm -p 8080:8080 tablekeeper
curl -s localhost:8080/health
```

Every stage folder follows the same contract: build its `Dockerfile`, run with `-e PORT=<port>`, no network at run time. The event's harness builds each folder the same way.

**One thing the seats left behind: one run file for four stages.** Each folder's `RUN.md` is stage 1's, byte for byte. Its build and run lines name no folder, so they work in any of the four; its endpoint table lists stage 1's API only.

## Results

The event's harness, `--all --mode isolated`, on a fresh clone (how the entry is graded):

| Stage | Claimed | Shipped checks passed |
|---|---|---|
| 1 | yes | 120 / 120 |
| 2 | yes | 145 / 145 (stage 1: 120 / 120, stage 2: 25 / 25) |
| 3 | yes | 152 / 152 (stage 1: 120 / 120, stage 2: 25 / 25, stage 3: 7 / 7) |
| 4 | yes | 158 / 158 (stage 1: 120 / 120, stage 2: 25 / 25, stage 3: 7 / 7, stage 4: 6 / 6) |

**Stage reached: 4 of 4.** The shipped checks are a sample; the graded suites are larger.

Who checks the checker — defects planted on purpose, and what caught them, from the committed files (where a table's summary and its own rows disagree, both are given):

- **Stage 1, `c1e5735`.** The Adversary rebuilt 11 of the Saboteur's defects and ran the event's harness, isolated, against each: **the shipped checks caught 8 of 11, its own probes 11 of 11** (`verification/mutants/harness-vs-mutants-c1e5735.md`). The Saboteur's final table, 14 defects, gives the shipped checks 9 and the probes 7 in its summary, 8 and 8 in its rows (`verification/sabotage/c1e5735.md`).
- **Stage 2, `e0e10eb`.** 8 defects. The Adversary's probes caught 7, one of them only after the Adversary fixed the probe, and the eighth was ruled not a defect; the shipped checks were not run against them (`verification/sabotage/stage-2-report.md`).
- **Stage 3, `a69e6ba`.** 3 defects. The probes caught 2; the shipped checks were not run. The same kind of defect as the miss, planted again in stage 4, was caught by a probe written since. Filed after stage 4 closed (`verification/sabotage/stage-3-report.md`).
- **Stage 4.** The Saboteur's model was rate-limited for most of stage 4 (21:45–00:15 UTC), so the Foreman planted 3 defects in scratch copies itself: two were caught, and the third, deleting the rank ordering from the planner's comparison of plans, passed every check. It then had the Builder commit defects to the repository for the Adversary to grade, and the Adversary's probes caught three (each planting and its grade, including one that never took effect, is in `verification/reports/stage-4-final.md`). The shipped checks pass with four of them still in the seats' last commit (see *After the run*).

- **Human input:** 1 message in the room — the dispatch at 2026-10-03 09:53 UTC.
- **Time:** 14.3 hours from the dispatch to the Foreman's close of stage 4 (2026-10-04 00:10 UTC); the factory was down for 1.5 h of it (0.2 h while the host restarted; 1.3 h while the network was off and a paused turn waited to resume).
- **Model spend:** 5,250 turns; 31.4 M fresh input, 946.9 M cached input, 2.26 M output tokens; **$0.00** — free models only. Per seat in `FACTORY.md`.

## After the run

- **The accepted stage 4, put back.** The Foreman closed stage 4 at `56e278a` (2026-10-04 00:10 UTC): "accepted hash `56e278a` — the tree the Adversary graded, with no planted defect". Minutes before, on its order, the Builder had committed planted defects to `stage-4/src` for a measured sabotage round, in five commits (`170c99d`, `4b4bc5c`, `1780d45`, `fadad4d`, `fc8c76b`; see *Stage 4* in `FACTORY.md`), and no seat took them out: four were live in the seats' last commit. Our last commit restores `stage-4/src` to `56e278a`; the seats' commits, the defects included, stay in the history. After it, every stage folder is byte-identical to `56e278a`. The event's harness on a fresh clone of the seats' last commit, `509edf0`, with the four defects in place, still claims all four stages on the shipped checks: those checks do not see them.
- **The seats talked on after the close.** From the close to the last message (02:25 UTC) they posted 466 more texts and made 89 more commits, correcting one another's reports, ledgers and citations. Of the 101 commits after `56e278a`, only the planted defects and two comment-only edits to `stage-4/src` (`334f8c2`, `057edb5`) touch a stage folder. The Foreman's mandate asks for a final report addressed to the human; none was posted, and the closing record is the Adversary's `verification/reports/stage-4-final.md`.
- **The room's last four entries are ours.** At 02:39 UTC `bin/end-run` removed the Adversary, Builder, Finisher and Saboteur from the room ("left the conversation"), so that starting the seats again for a later run could not pull them back into this one.

## License

MIT — see [`LICENSE`](LICENSE).
