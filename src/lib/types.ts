/** One row of the `keno_draws` table. */
export interface KenoDraw {
  draw_nbr: number;
  draw_date: string; // YYYY-MM-DD
  draw_time: string; // HH:MM:SS
  numbers: number[]; // 20 numbers, 1-80
  bonus: number | null;
  fetched_at?: string;
}

export type KenoDrawInput = Omit<KenoDraw, "fetched_at">;

export interface SyncResult {
  fetched: number;
  upserted: number;
  pruned: number;
}

export interface PairStat {
  a: number;
  b: number;
  count: number; // draws (in the window) containing both numbers
  expected: number; // expected count if draws were purely random
  pValue: number; // P(X >= count), binomial
  adjustedP: number; // pValue x number of pairs tested (Bonferroni), capped at 1
  drawsSince: number; // 0 = appeared together in the latest draw
}

export interface NumberStat {
  number: number;
  count: number;
  expected: number;
  drawsSince: number; // 0 = in the latest draw; window size = not seen at all
}

export interface KenoStats {
  drawCount: number;
  bestPair: PairStat | null;
  topPairs: PairStat[];
  hot: NumberStat[];
  cold: NumberStat[];
}
