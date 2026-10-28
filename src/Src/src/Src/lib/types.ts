import type { KenoStats, NumberStat, PairStat } from "./types";
import { PICKED, POOL } from "./validate";

/** P(a given pair of numbers are both among the 20 drawn from 80). */
export const PAIR_P = (PICKED / POOL) * ((PICKED - 1) / (POOL - 1));
/** P(a given number is among the 20 drawn). */
export const NUMBER_P = PICKED / POOL;
/** Number of distinct pairs: C(80, 2). */
export const PAIR_COUNT = (POOL * (POOL - 1)) / 2;

/** P(X >= k) for X ~ Binomial(n, p). */
export function binomialUpperTail(k: number, n: number, p: number): number {
  if (k <= 0) return 1;
  if (k > n) return 0;
  const ratio = p / (1 - p);
  let pmf = Math.pow(1 - p, n); // P(X = 0)
  for (let i = 0; i < k; i++) pmf *= ((n - i) / (i + 1)) * ratio; // -> P(X = k)
  let upper = 0;
  for (let i = k; i <= n; i++) {
    upper += pmf;
    pmf *= ((n - i) / (i + 1)) * ratio;
  }
  return Math.min(1, upper);
}

interface DrawLike {
  draw_nbr: number;
  numbers: number[];
}

export function computeStats(input: DrawLike[], topN = 10): KenoStats {
  const draws = [...input].sort((x, y) => y.draw_nbr - x.draw_nbr); // newest first
  const n = draws.length;
  if (n === 0) return { drawCount: 0, bestPair: null, topPairs: [], hot: [], cold: [] };

  const W = POOL + 1;
  const pairCount = new Uint16Array(W * W);
  const pairLast = new Int16Array(W * W).fill(n); // draws since last co-occurrence
  const numCount = new Uint16Array(W);
  const numLast = new Int16Array(W).fill(n);

  draws.forEach((draw, age) => {
    const nums = [...draw.numbers].sort((x, y) => x - y);
    for (let i = 0; i < nums.length; i++) {
      const a = nums[i];
      numCount[a]++;
      if (age < numLast[a]) numLast[a] = age;
      for (let j = i + 1; j < nums.length; j++) {
        const idx = a * W + nums[j];
        pairCount[idx]++;
        if (age < pairLast[idx]) pairLast[idx] = age;
      }
    }
  });

  const pairs: PairStat[] = [];
  for (let a = 1; a < POOL; a++) {
    for (let b = a + 1; b <= POOL; b++) {
      const idx = a * W + b;
      const count = pairCount[idx];
      const pValue = binomialUpperTail(count, n, PAIR_P);
      pairs.push({
        a,
        b,
        count,
        expected: n * PAIR_P,
        pValue,
        adjustedP: Math.min(1, pValue * PAIR_COUNT),
        drawsSince: pairLast[idx],
      });
    }
  }
  pairs.sort(
    (x, y) => y.count - x.count || x.drawsSince - y.drawsSince || x.a - y.a || x.b - y.b,
  );

  const nums: NumberStat[] = [];
  for (let k = 1; k <= POOL; k++) {
    nums.push({ number: k, count: numCount[k], expected: n * NUMBER_P, drawsSince: numLast[k] });
  }
  const hot = [...nums]
    .sort((x, y) => y.count - x.count || x.drawsSince - y.drawsSince || x.number - y.number)
    .slice(0, topN);
  const cold = [...nums]
    .sort((x, y) => x.count - y.count || y.drawsSince - x.drawsSince || x.number - y.number)
    .slice(0, topN);

  return { drawCount: n, bestPair: pairs[0], topPairs: pairs.slice(0, 5), hot, cold };
}
