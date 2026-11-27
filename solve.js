// diff-speed: a faster drop-in for makefun-diff 1.0.0.
//
// run(input) returns exactly makefun-diff 1.0.0's patch of { old, new }, as one
// string. Written from the task rules (the kit's RULES.txt and the reference
// program's header, which state the same rule), not from the reference code:
//   - Lines: a text is cut after every '\n' (the only separator; '\r' is part
//     of its line); a last line with no '\n' is a line too. The empty text has
//     no lines; '\n' has one, an empty line. Two lines are equal only when
//     they are the same code units, their '\n' (or its absence) included.
//   - Edit script: the common prefix of lines is kept, then the common suffix
//     of the lines left; between them Myers's greedy search from the first
//     lines, keeping on each diagonal the path reaching furthest into the old
//     text and, when a deletion and an insertion reach the same point, the
//     deletion's; never moving past either text's end, pruning no edge
//     diagonal, and following every run of equal lines as far as it goes; the
//     first path to reach both ends is the script.
//   - Patch: a line 'makefun-diff/1 old=N new=M hunks=H deleted=D inserted=I',
//     then each hunk's line '@ os ol ns nl' (os one more than the old lines
//     before the hunk) and one line per line it covers, '=' kept, '-' deleted,
//     '+' inserted; each run of changes lists its deletions before its
//     insertions and shows up to 3 kept lines before and after it, and two
//     runs at most 6 kept lines apart share a hunk. A line that ends its text
//     with no newline is written with one and followed by a line '%'. Identical
//     texts are the first line alone.
//
// Speed: lines are interned once to integer ids (repeated lines share one id),
// Myers runs on typed arrays with the whole V history kept in one flat
// Int32Array (V of depth d lives at d*d + k + d), and the patch is built from
// one pass over the op stream. No work is shared between cases: every call
// interns and diffs its own input alone.

const KEEP = 0;
const DEL = 1;
const INS = 2;

/** A text's lines, each with its '\n' (the last one without, when the text does not end in one). */
function tokenize(text) {
  const lines = [];
  let start = 0;
  for (;;) {
    const nl = text.indexOf('\n', start);
    if (nl === -1) {
      if (start < text.length) lines.push(text.slice(start));
      return lines;
    }
    lines.push(text.slice(start, nl + 1));
    start = nl + 1;
  }
}

/** makefun-diff 1.0.0's answer for one case's input. */
export function run(input) {
  const oldLines = tokenize(input.old);
  const newLines = tokenize(input.new);
  const N = oldLines.length;
  const M = newLines.length;

  // Intern every line to a small integer id; equal lines share one id.
  const ids = new Map();
  const a = new Int32Array(N);
  const b = new Int32Array(M);
  for (let i = 0; i < N; i++) {
    const s = oldLines[i];
    let id = ids.get(s);
    if (id === undefined) {
      id = ids.size;
      ids.set(s, id);
    }
    a[i] = id;
  }
  for (let j = 0; j < M; j++) {
    const s = newLines[j];
    let id = ids.get(s);
    if (id === undefined) {
      id = ids.size;
      ids.set(s, id);
    }
    b[j] = id;
  }

  // Common prefix, then common suffix of the lines left.
  const minNM = N < M ? N : M;
  let p = 0;
  while (p < minNM && a[p] === b[p]) p++;
  let s = 0;
  while (s < minNM - p && a[N - 1 - s] === b[M - 1 - s]) s++;
  const n = N - p - s;
  const m = M - p - s;
  const A = a.subarray(p, N - s);
  const B = b.subarray(p, M - s);

  // Myers's greedy search over the middle, with the full V history kept so
  // the script can be walked back exactly as the forward search found it.
  // vs[d*d + k + d] is the furthest old-lines count reached on diagonal k
  // with d edits (after its snake), or -1 when no d-edit path reaches k.
  let vs = new Int32Array(64 * 64);
  let cap = 64; // vs holds cap*cap entries, i.e. depths 0..cap-1
  let D = 0;
  if (n > 0 || m > 0) {
    let found = -1;
    for (let d = 0; found < 0; d++) {
      if (d + 1 > cap) {
        let nc = cap;
        while (d + 1 > nc) nc *= 2;
        const nv = new Int32Array(nc * nc);
        nv.set(vs.subarray(0, cap * cap));
        vs = nv;
        cap = nc;
      }
      const base = d * d;
      const prevBase = (d - 1) * (d - 1);
      for (let k = -d; k <= d; k += 2) {
        let x;
        if (d === 0) {
          x = 0;
        } else {
          // One old line past the (d-1)-point on k-1 (a deletion), or one new
          // line past the (d-1)-point on k+1 (an insertion), whichever lies
          // further into the old text; the deletion when both reach the same
          // point; a move past the end of either text is no candidate.
          const pi = prevBase + k + d; // index of V(d-1, k+1); V(d-1, k-1) is pi-2
          let x1 = -1;
          let x2 = -1;
          if (k > -d) {
            const v = vs[pi - 2];
            if (v >= 0 && v + 1 <= n) x1 = v + 1;
          }
          if (k < d) {
            const v = vs[pi];
            if (v >= 0 && v - k <= m) x2 = v;
          }
          if (x1 < 0 && x2 < 0) {
            vs[base + k + d] = -1;
            continue;
          }
          x = x1 >= x2 ? x1 : x2;
        }
        let y = x - k;
        while (x < n && y < m && A[x] === B[y]) {
          x++;
          y++;
        }
        vs[base + k + d] = x;
        if (x === n && y === m) {
          found = d;
          D = d;
        }
      }
    }
  }

  // Walk the script back from the end, through the same choices the forward
  // search made, collecting the middle ops in reverse.
  const rev = [];
  if (n > 0 || m > 0) {
    let x = n;
    let y = m;
    let d = D;
    while (d > 0) {
      const k = x - y;
      const prevBase = (d - 1) * (d - 1);
      const pi = prevBase + k + d;
      let delX = -1;
      let insX = -1;
      if (k > -d) {
        const v = vs[pi - 2];
        if (v >= 0 && v + 1 <= n) delX = v + 1;
      }
      if (k < d) {
        const v = vs[pi];
        if (v >= 0 && v - k <= m) insX = v;
      }
      let xMove;
      let isDel;
      if (delX >= 0 && delX >= insX) {
        isDel = true;
        xMove = delX;
      } else {
        isDel = false;
        xMove = insX;
      }
      const yMove = xMove - k;
      for (let t = xMove; t < x; t++) rev.push(KEEP);
      if (isDel) {
        rev.push(DEL);
        x = xMove - 1;
        y = yMove;
      } else {
        rev.push(INS);
        x = xMove;
        y = yMove - 1;
      }
      d--;
    }
    for (let t = 0; t < x; t++) rev.push(KEEP);
    rev.reverse();
  }

  // The whole op stream: the kept prefix, the middle script, the kept suffix.
  const totalOps = p + rev.length + s;
  const ops = new Uint8Array(totalOps);
  ops.set(rev, p);
  let deleted = 0;
  let inserted = 0;
  for (let t = 0; t < rev.length; t++) {
    if (rev[t] === DEL) deleted++;
    else if (rev[t] === INS) inserted++;
  }

  // Within each run of changes, list the deletions before the insertions.
  let t = 0;
  while (t < totalOps) {
    if (ops[t] === KEEP) {
      t++;
      continue;
    }
    let e = t;
    while (e < totalOps && ops[e] !== KEEP) e++;
    let w = t;
    for (let u = t; u < e; u++) {
      if (ops[u] === DEL) {
        const tmp = ops[u];
        ops[u] = ops[w];
        ops[w] = tmp;
        w++;
      }
    }
    t = e;
  }

  // Old/new line index before each op, for hunk headers.
  const oIdx = new Int32Array(totalOps + 1);
  const nIdx = new Int32Array(totalOps + 1);
  for (let t = 0; t < totalOps; t++) {
    const op = ops[t];
    oIdx[t + 1] = oIdx[t] + (op !== INS ? 1 : 0);
    nIdx[t + 1] = nIdx[t] + (op !== DEL ? 1 : 0);
  }

  // Group change runs into hunks: up to 3 kept lines before and after each
  // run, and two runs at most 6 kept lines apart share a hunk.
  const hunks = [];
  let i = 0;
  while (i < totalOps) {
    while (i < totalOps && ops[i] === KEEP) i++;
    if (i >= totalOps) break;
    const hs = i - 3 > 0 ? i - 3 : 0;
    let lastChange = i;
    i++;
    while (i < totalOps) {
      if (ops[i] !== KEEP) {
        if (i - lastChange - 1 <= 6) {
          lastChange = i;
          i++;
          continue;
        }
        break;
      }
      i++;
    }
    let he = lastChange + 4;
    if (he > totalOps) he = totalOps;
    hunks.push([hs, he]);
    i = he;
  }

  // Emit the patch.
  const out = [
    `makefun-diff/1 old=${N} new=${M} hunks=${hunks.length} deleted=${deleted} inserted=${inserted}\n`,
  ];
  for (let h = 0; h < hunks.length; h++) {
    const hs = hunks[h][0];
    const he = hunks[h][1];
    out.push(`@ ${oIdx[hs] + 1} ${oIdx[he] - oIdx[hs]} ${nIdx[hs] + 1} ${nIdx[he] - nIdx[hs]}\n`);
    for (let t = hs; t < he; t++) {
      const op = ops[t];
      const line = op === INS ? newLines[nIdx[t]] : oldLines[oIdx[t]];
      const mark = op === KEEP ? '=' : op === DEL ? '-' : '+';
      if (line.charCodeAt(line.length - 1) === 10) out.push(mark, line);
      else out.push(mark, line, '\n%\n');
    }
  }
  return out.join('');
}
