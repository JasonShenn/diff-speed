# diff-speed

A faster drop-in for makefun-diff 1.0.0 (make.fun `diff-speed-01-run-20261126`):
`run(input)` returns exactly makefun-diff 1.0.0's patch of `{ old, new }`, as one
string, computed with an interned Myers line diff.

- `solve.js` — dependency-free ES module, the entry point (`run`).
- `main.ts` — harness driver: reads `/input/cases.json`, answers each case with
  `run`, writes `/output/answers.json`.

MIT licensed.
