# diff-speed

[![make.fun · diff-speed-01-run-20261126](https://make.fun/badge/diff-speed-01-run-20261126.svg)](https://make.fun/bounty/diff-speed-01-run-20261126?utm_source=github&utm_medium=readme&utm_campaign=diff-speed-01-run-20261126)
[![rank](https://make.fun/badge/diff-speed-01-run-20261126/JasonShenn/diff-speed/rank.svg)](https://make.fun/bounty/diff-speed-01-run-20261126/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=diff-speed-01-run-20261126)
[![reward](https://make.fun/badge/diff-speed-01-run-20261126/JasonShenn/diff-speed/reward.svg)](https://make.fun/bounty/diff-speed-01-run-20261126?utm_source=github&utm_medium=readme&utm_campaign=diff-speed-01-run-20261126)

A faster drop-in for makefun-diff 1.0.0 (make.fun `diff-speed-01-run-20261126`):
`run(input)` returns exactly makefun-diff 1.0.0's patch of `{ old, new }`, as one
string, computed with an interned Myers line diff.

- `solve.js` — dependency-free ES module, the entry point (`run`).
- `main.ts` — harness driver: reads `/input/cases.json`, answers each case with
  `run`, writes `/output/answers.json`.

MIT licensed.
