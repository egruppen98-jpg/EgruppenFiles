
import { useCallback, useEffect, useMemo, useState } from "react";
import { Flame, Plus, RefreshCw, Snowflake, Trash2 } from "lucide-react";
import { fetchDraws, removeDraw, saveDraw, syncFromBclc } from "./lib/db";
import { computeStats, PAIR_COUNT } from "./lib/stats";
import { parseNumberList, validateDraw } from "./lib/validate";
import type { KenoDraw } from "./lib/types";

type Notice = { kind: "ok" | "error"; text: string } | null;

function Ball({ n, tone = "ink", small = false }: { n: number; tone?: "ink" | "hot" | "cold" | "pair"; small?: boolean }) {
  const tones = {
    ink: "bg-[#0F1B2D] text-white",
    hot: "bg-[#F5B301] text-[#0F1B2D]",
    cold: "bg-[#BFD9EE] text-[#0F1B2D]",
    pair: "bg-[#0E7C7B] text-white",
  };
  const size = small ? "h-6 w-6 text-[11px]" : "h-14 w-14 text-xl";
  return (
    <span className={`inline-flex items-center justify-center rounded-full font-semibold tabular-nums ${tones[tone]} ${size}`}>
      {n}
    </span>
  );
}

function formatP(p: number) {
  if (p < 0.001) return "< 0.001";
  return p.toFixed(3);
}

export default function App() {
  const [draws, setDraws] = useState<KenoDraw[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const load = useCallback(async () => {
    try {
      setDraws(await fetchDraws());
    } catch (e) {
      setNotice({ kind: "error", text: `Couldn't load draws: ${(e as Error).message}` });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => computeStats(draws), [draws]);

  async function refresh() {
    setSyncing(true);
    setNotice(null);
    try {
      const r = await syncFromBclc();
      await load();
      setNotice({ kind: "ok", text: `Refreshed. ${r.upserted} draws saved.` });
    } catch (e) {
      setNotice({ kind: "error", text: `Refresh failed: ${(e as Error).message}` });
    } finally {
      setSyncing(false);
    }
  }

  async function remove(nbr: number) {
    if (!window.confirm(`Delete draw #${nbr}?`)) return;
    try {
      await removeDraw(nbr);
      await load();
    } catch (e) {
      setNotice({ kind: "error", text: `Couldn't delete: ${(e as Error).message}` });
    }
  }

  const best = stats.bestPair;
  const significant = best ? best.adjustedP < 0.05 : false;

  return (
    <div className="min-h-screen bg-[#F2F4F7] text-[#0F1B2D]">
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Keno pairs</h1>
            <p className="text-sm text-slate-600">BCLC Keno, last {stats.drawCount || 20} draws</p>
          </div>
          <button
            onClick={refresh}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0F1B2D] px-4 py-2 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7C7B] focus-visible:ring-offset-2 disabled:opacity-60"
          >
            <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Refreshing" : "Refresh"}
          </button>
        </header>

        {notice && (
          <p
            role="status"
            className={`mt-4 rounded-lg px-4 py-3 text-sm ${notice.kind === "ok" ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"}`}
          >
            {notice.text}
          </p>
        )}

        {loading ? (
          <p className="mt-10 text-slate-600">Loading draws…</p>
        ) : draws.length === 0 ? (
          <p className="mt-10 rounded-lg bg-white p-6 text-slate-700">
            No draws yet. Tap Refresh to pull from BCLC, or add a draw below.
          </p>
        ) : (
          <>
            {best && (
              <section className="mt-6 rounded-xl bg-white p-5 shadow-sm" aria-labelledby="best-pair">
                <h2 id="best-pair" className="text-sm font-semibold text-slate-600">Most frequent pair</h2>
                <div className="mt-3 flex items-center gap-3">
                  <Ball n={best.a} tone="pair" />
                  <Ball n={best.b} tone="pair" />
                  <div className="ml-2 text-sm">
                    <p className="font-semibold">
                      Together in {best.count} of {stats.drawCount} draws
                    </p>
                    <p className="text-slate-600">Chance alone gives about {best.expected.toFixed(1)}</p>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-slate-600">p-value</dt>
                    <dd className="font-semibold tabular-nums">{formatP(best.pValue)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-600">Adjusted for {PAIR_COUNT.toLocaleString()} pairs</dt>
                    <dd className="font-semibold tabular-nums">{formatP(best.adjustedP)}</dd>
                  </div>
                </dl>
                <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${significant ? "bg-amber-50 text-amber-900" : "bg-slate-100 text-slate-700"}`}>
                  {significant
                    ? "This pair is unusually frequent even after adjusting for the number of pairs. Keno draws are independent, so that still doesn't make it more likely next time."
                    : "Not statistically significant. With 3,160 possible pairs, one this frequent is expected by chance. Each draw is independent, so past pairs don't predict the next draw."}
                </p>
                {stats.topPairs.length > 1 && (
                  <ul className="mt-4 divide-y divide-slate-100 text-sm">
                    {stats.topPairs.slice(1).map((p) => (
                      <li key={`${p.a}-${p.b}`} className="flex items-center justify-between py-2">
                        <span className="flex items-center gap-1">
                          <Ball n={p.a} tone="pair" small />
                          <Ball n={p.b} tone="pair" small />
                        </span>
                        <span className="tabular-nums text-slate-600">
                          {p.count} of {stats.drawCount}, p {formatP(p.pValue)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            <section className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-white p-5 shadow-sm">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                  <Flame size={16} /> Hot numbers
                </h2>
                <ul className="mt-3 space-y-2">
                  {stats.hot.map((s) => (
                    <li key={s.number} className="flex items-center justify-between text-sm">
                      <Ball n={s.number} tone="hot" small />
                      <span className="tabular-nums text-slate-600">
                        {s.count} of {stats.drawCount}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl bg-white p-5 shadow-sm">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                  <Snowflake size={16} /> Cold numbers
                </h2>
                <ul className="mt-3 space-y-2">
                  {stats.cold.map((s) => (
                    <li key={s.number} className="flex items-center justify-between text-sm">
                      <Ball n={s.number} tone="cold" small />
                      <span className="tabular-nums text-slate-600">
                        {s.count} of {stats.drawCount}
                        {s.drawsSince >= stats.drawCount ? ", not seen" : `, last ${s.drawsSince === 0 ? "draw" : `${s.drawsSince} ago`}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </>
        )}

        <ManualEntry
          nextNbr={draws.length ? draws[0].draw_nbr + 1 : null}
          onSaved={async () => {
            await load();
            setNotice({ kind: "ok", text: "Draw saved." });
          }}
          onError={(text) => setNotice({ kind: "error", text })}
        />

        {draws.length > 0 && (
          <section className="mt-6" aria-labelledby="draws-list">
            <h2 id="draws-list" className="mb-3 text-sm font-semibold text-slate-600">Draws</h2>
            <ul className="space-y-3">
              {draws.map((d) => (
                <li key={d.draw_nbr} className="rounded-xl bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">Draw #{d.draw_nbr}</span>
                    <span className="flex items-center gap-3 text-slate-600">
                      {d.draw_date} {d.draw_time.slice(0, 5)}
                      <button
                        onClick={() => remove(d.draw_nbr)}
                        aria-label={`Delete draw ${d.draw_nbr}`}
                        className="rounded p-1 text-slate-500 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7C7B]"
                      >
                        <Trash2 size={16} />
                      </button>
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {[...d.numbers].sort((a, b) => a - b).map((n) => (
                      <Ball key={n} n={n} small />
                    ))}
                  </div>
                  {d.bonus != null && <p className="mt-2 text-xs text-slate-600">Bonus {d.bonus}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function ManualEntry({
  nextNbr,
  onSaved,
  onError,
}: {
  nextNbr: number | null;
  onSaved: () => Promise<void>;
  onError: (text: string) => void;
}) {
  const [nbr, setNbr] = useState("");
  const [date, setDate] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [time, setTime] = useState(() => new Date().toTimeString().slice(0, 8));
  const [numbersText, setNumbersText] = useState("");
  const [bonus, setBonus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (nextNbr !== null && nbr === "") setNbr(String(nextNbr));
  }, [nextNbr, nbr]);

  async function submit() {
    setError(null);
    const drawNbr = parseInt(nbr, 10);
    if (!Number.isInteger(drawNbr) || drawNbr < 1) return setError("Enter the draw number.");
    const numbers = parseNumberList(numbersText);
    const bonusNum = bonus.trim() === "" ? null : parseInt(bonus, 10);
    const problem = validateDraw(numbers, bonusNum);
    if (problem) return setError(problem);

    setSaving(true);
    try {
      await saveDraw({
        draw_nbr: drawNbr,
        draw_date: date,
        draw_time: time.length === 5 ? `${time}:00` : time,
        numbers,
        bonus: bonusNum,
      });
      setNumbersText("");
      setBonus("");
      setNbr(String(drawNbr + 1));
      await onSaved();
    } catch (e) {
      onError(`Couldn't save the draw: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  const field =
    "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7C7B]";

  return (
    <section className="mt-6 rounded-xl bg-white p-5 shadow-sm" aria-labelledby="manual-entry">
      <h2 id="manual-entry" className="text-sm font-semibold text-slate-600">Add a draw</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="text-sm">
          Draw number
          <input className={field} inputMode="numeric" value={nbr} onChange={(e) => setNbr(e.target.value)} />
        </label>
        <label className="text-sm">
          Date
          <input className={field} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="text-sm">
          Time
          <input className={field} type="time" step={1} value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <label className="text-sm">
          Bonus (optional)
          <input className={field} inputMode="numeric" value={bonus} onChange={(e) => setBonus(e.target.value)} />
        </label>
      </div>
      <label className="mt-3 block text-sm">
        The 20 winning numbers
        <textarea
          className={field}
          rows={2}
          placeholder="3 7 12 18 …, separated by spaces or commas"
          value={numbersText}
          onChange={(e) => setNumbersText(e.target.value)}
        />
      </label>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      <button
        onClick={submit}
        disabled={saving}
        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#0E7C7B] px-4 py-2 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F1B2D] focus-visible:ring-offset-2 disabled:opacity-60"
      >
        <Plus size={16} />
        {saving ? "Saving" : "Save draw"}
      </button>
    </section>
  );
}
