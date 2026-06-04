import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Trophy, Crown, Flame, Coins, X, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface Row { rank: number; user_id: string; username: string; coins_earned: number; trades: number }
interface Winner { week_start: string; username: string; coins_earned: number }

function weekRangeLabel() {
  const now = new Date();
  const day = (now.getDay() + 6) % 7;
  const monday = new Date(now); monday.setDate(now.getDate() - day);
  const friday = new Date(monday); friday.setDate(monday.getDate() + 4);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `${fmt(monday)} → ${fmt(friday)}`;
}

export function WeeklyChallenge() {
  const { user, refreshProfile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [winner, setWinner] = useState<Winner | null>(null);
  const [entered, setEntered] = useState<boolean | null>(null);
  const [entrants, setEntrants] = useState<number>(0);
  const [showPopup, setShowPopup] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    await supabase.rpc("award_last_week_winner");
    const [{ data: lb }, { data: w }, { data: me }] = await Promise.all([
      supabase.rpc("get_weekly_leaderboard", { p_limit: 5 }),
      supabase.rpc("get_latest_weekly_winner"),
      user ? supabase.rpc("get_my_weekly_entry") : Promise.resolve({ data: null }),
    ]);
    if (lb) setRows(lb as any);
    if (w && w[0]) setWinner(w[0] as any);
    if (me && (me as any)[0]) {
      setEntered(!!(me as any)[0].entered);
      setEntrants(Number((me as any)[0].entrants ?? 0));
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const enterChallenge = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("enter_weekly_challenge");
    setBusy(false);
    const row = (data as any)?.[0];
    if (error || !row?.success) {
      toast({ title: "Couldn't enter", description: row?.message || error?.message || "Try again", variant: "destructive" });
      return;
    }
    toast({ title: "You're in!", description: row.message });
    setShowPopup(false);
    await Promise.all([refreshProfile(), refresh()]);
  };

  return (
    <section className="container mx-auto px-4 sm:px-6 py-10">
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Flame className="w-4 h-4 text-primary" />
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            Weekly Challenge · {weekRangeLabel()} · {entrants} entered
          </span>
          {user && entered && (
            <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/30">
              <CheckCircle2 className="w-3 h-3" /> You're in
            </span>
          )}
        </div>
        <h2 className="text-2xl sm:text-4xl font-semibold tracking-tighter mb-2">
          Earn the most coins <span className="text-primary">Mon → Fri</span>
        </h2>
        <p className="text-sm text-muted-foreground mb-5 max-w-2xl">
          Optional weekly contest. Pay <span className="text-amber-500 font-semibold">50 coins</span> to enter — your profit from <b>Stock Investor</b> and <b>Forex Investor</b> trades counts. Friday's top earner gets <span className="text-green-500 font-semibold">+250 bonus coins</span> and a featured spot here.
        </p>

        {user && entered === false && (
          <button
            onClick={() => setShowPopup(true)}
            className="mb-5 inline-flex items-center gap-2 h-11 px-5 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
          >
            <Coins className="w-4 h-4" /> Join this week (50 coins)
          </button>
        )}

        {winner && (
          <div className="glass-card border-amber-500/40 p-5 mb-5 flex items-center gap-4"
               style={{ boxShadow: "0 0 30px hsl(45 90% 50% / 0.15)" }}>
            <Crown className="w-8 h-8 text-amber-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-mono text-amber-400 uppercase tracking-wider">Last Week's Winner</div>
              <div className="font-semibold text-lg truncate">
                {winner.username} — <span className="text-amber-400">Earned {Number(winner.coins_earned).toFixed(2)} coins this week</span>
              </div>
              <div className="text-xs text-muted-foreground">+250 bonus coins awarded · Week of {new Date(winner.week_start).toLocaleDateString()}</div>
            </div>
            <Trophy className="w-6 h-6 text-amber-400 hidden sm:block" />
          </div>
        )}

        <div className="glass-card p-5">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" /> This Week's Top Performers (entered users only)
          </h3>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entrants have completed a profitable sell yet. Be the first to climb the board.</p>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.user_id} className="flex items-center justify-between border-b border-border/30 pb-2 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={`font-mono text-xs w-6 h-6 grid place-items-center rounded-full ${
                      r.rank === 1 ? "bg-amber-500/20 text-amber-400" :
                      r.rank === 2 ? "bg-slate-400/20 text-slate-300" :
                      r.rank === 3 ? "bg-orange-500/20 text-orange-400" :
                      "bg-muted text-muted-foreground"
                    }`}>{r.rank}</span>
                    <span className="font-semibold text-sm">{r.username}</span>
                    <span className="text-xs text-muted-foreground">{r.trades} trades</span>
                  </div>
                  <span className={`font-mono text-sm ${Number(r.coins_earned) >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {Number(r.coins_earned) >= 0 ? "+" : ""}{Number(r.coins_earned).toFixed(2)} coins
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {showPopup && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setShowPopup(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="glass-card max-w-md w-full p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setShowPopup(false)} className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-secondary/60">
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-5 h-5 text-primary" />
              <h3 className="text-xl font-semibold">Join Weekly Challenge</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              Pay <span className="font-semibold text-amber-500">50 coins</span> to enter this week's challenge ({weekRangeLabel()}).
              Profit from your Stock + Forex sells counts toward the leaderboard. Friday's top earner wins
              <span className="font-semibold text-green-500"> +250 coins</span> and is featured on the home page.
            </p>
            <div className="flex gap-2">
              <button
                onClick={enterChallenge}
                disabled={busy}
                className="flex-1 h-11 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <Coins className="w-4 h-4" /> Pay 50 coins & enter
              </button>
              <button
                onClick={() => setShowPopup(false)}
                className="flex-1 h-11 rounded-lg bg-secondary border border-border/50 font-medium hover:bg-secondary/80"
              >
                Not now
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </section>
  );
}
