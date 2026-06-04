import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Crown, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Row { rank: number; user_id: string; username: string; coins_earned: number; trades: number }
interface Winner { week_start: string; username: string; coins_earned: number }

function weekRangeLabel() {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // 0 = Monday
  const monday = new Date(now); monday.setDate(now.getDate() - day);
  const friday = new Date(monday); friday.setDate(monday.getDate() + 4);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `${fmt(monday)} → ${fmt(friday)}`;
}

export function WeeklyChallenge() {
  const [rows, setRows] = useState<Row[]>([]);
  const [winner, setWinner] = useState<Winner | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      // Try to award previous week's winner (no-op if already done or no trades)
      await supabase.rpc("award_last_week_winner");
      const [{ data: lb }, { data: w }] = await Promise.all([
        supabase.rpc("get_weekly_leaderboard", { p_limit: 5 }),
        supabase.rpc("get_latest_weekly_winner"),
      ]);
      if (!active) return;
      if (lb) setRows(lb as any);
      if (w && w[0]) setWinner(w[0] as any);
    })();
    return () => { active = false; };
  }, []);

  return (
    <section className="container mx-auto px-4 sm:px-6 py-10">
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
        <div className="flex items-center gap-2 mb-3">
          <Flame className="w-4 h-4 text-primary" />
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Weekly Challenge · {weekRangeLabel()}</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-semibold tracking-tighter mb-5">
          Earn the most coins <span className="text-primary">Mon → Fri</span>
        </h2>

        {winner && (
          <div className="glass-card border-amber-500/40 p-5 mb-5 flex items-center gap-4"
               style={{ boxShadow: "0 0 30px hsl(45 90% 50% / 0.15)" }}>
            <Crown className="w-8 h-8 text-amber-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-mono text-amber-400 uppercase tracking-wider">Last Week's Winner</div>
              <div className="font-semibold text-lg truncate">
                {winner.username} — <span className="text-amber-400">Earned {Number(winner.coins_earned).toFixed(2)} coins</span>
              </div>
              <div className="text-xs text-muted-foreground">+250 bonus coins awarded · Week of {new Date(winner.week_start).toLocaleDateString()}</div>
            </div>
            <Trophy className="w-6 h-6 text-amber-400 hidden sm:block" />
          </div>
        )}

        <div className="glass-card p-5">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" /> This Week's Top Performers
          </h3>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No trades yet this week. Be the first to climb the board.</p>
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
    </section>
  );
}
