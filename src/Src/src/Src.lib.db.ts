import { supabase } from "./supabase";
import type { KenoDraw, KenoDrawInput, SyncResult } from "./types";

export const WINDOW = 20;

function toDraw(row: Record<string, unknown>): KenoDraw {
  return {
    draw_nbr: Number(row.draw_nbr),
    draw_date: String(row.draw_date),
    draw_time: String(row.draw_time),
    numbers: ((row.numbers as number[]) ?? []).map(Number),
    bonus: row.bonus == null ? null : Number(row.bonus),
    fetched_at: row.fetched_at ? String(row.fetched_at) : undefined,
  };
}

/** Newest draws first. */
export async function fetchDraws(limit = WINDOW): Promise<KenoDraw[]> {
  const { data, error } = await supabase
    .from("keno_draws")
    .select("*")
    .order("draw_nbr", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toDraw);
}

/** Insert or update one draw (used by manual entry). */
export async function saveDraw(draw: KenoDrawInput): Promise<void> {
  const { error } = await supabase.from("keno_draws").upsert(draw, { onConflict: "draw_nbr" });
  if (error) throw new Error(error.message);
}

export async function removeDraw(drawNbr: number): Promise<void> {
  const { error } = await supabase.from("keno_draws").delete().eq("draw_nbr", drawNbr);
  if (error) throw new Error(error.message);
}

/** Calls the `sync-keno` edge function, which fetches BCLC and upserts. */
export async function syncFromBclc(): Promise<SyncResult> {
  const { data, error } = await supabase.functions.invoke("sync-keno", { method: "POST" });
  if (error) {
    let detail = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const body = await ctx.json();
        if (body?.error) detail = String(body.error);
      } catch {
        /* keep default message */
      }
    }
    throw new Error(detail);
  }
  return data as SyncResult;
}
