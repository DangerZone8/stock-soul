import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Trophy, Clock, Coins, Users, Crown, Medal, Award, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface Tournament {
  id: string;
  name: string;
  market: "stock" | "forex" | "both";
  kind: "daily" | "weekly" | "custom";
  entry_fee: number;
  prize_pool: number;
  starts_at: string;
  ends_at: string;
  awarded: boolean;
  entrants: number;
  joined: boolean;
  status: "upcoming" | "active" | "ended";
}
interface LbRow { rank: number; user_id: string; username: string; coins_earned: number; trades: number; }
interface Winner { tournament_id: string; user_id: string; username: string; rank: number; prize: number; }

export function TournamentsTab({ market = "all" }: { market?: "stock" | "forex" | "all" }) {
  const { user } = useAuth();
  const [list, setList] = useState<Tournament[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [lb, setLb] = useState<LbRow[]>([]);
  const [recentWinners, setRecentWinners] = useState<Winner[]>([]);

  const load = useCallback(async () => {
    await supabase.rpc("ensure_recurring_tournaments");
    await supabase.rpc("award_pending_tournaments");
    const [{ data }, { data: w }] = await Promise.all([
      supabase.rpc("get_tournaments"),
      supabase.from("tournament_winners").select("*").order("awarded_at", { ascending: false }).limit(6),
    ]);
    setList((data as Tournament[]) || []);
    setRecentWinners((w as Winner[]) || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!open) return;
    supabase.rpc("get_tournament_leaderboard", { p_id: open, p_limit: 10 })
      .then(({ data }) => setLb((data as LbRow[]) || []));
  }, [open]);

  const filtered = list.filter(t => market === "all" ? true : t.market === "both" || t.market === market);

  const join = async (id: string) => {
    if (!user) { toast({ title: "Sign in to join", variant: "destructive" }); return; }
    const { data, error } = await supabase.rpc("join_tournament", { p_id: id });
    if (error || !data?.[0]?.success) {
      toast({ title: "Couldn't join", description: error?.message || data?.[0]?.message, variant: "destructive" });
      return;
    }
    toast({ title: data[0].message });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-bold flex items-center gap-2"><Trophy className="w-4 h-4 text-primary" />Tournaments</h3>
        <button onClick={load} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"><RefreshCw className="w-3 h-3" />Refresh</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(t => {
          const isOpen = open === t.id;
          return (
            <motion.div key={t.id} layout className="glass-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold truncate">{t.name}</span>
                    <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full ${
                      t.status === "active" ? "bg-green-500/15 text-green-500" :
                      t.status === "upcoming" ? "bg-blue-500/15 text-blue-500" :
                      "bg-muted text-muted-foreground"
                    }`}>{t.status}</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-secondary/60 border border-border/30">{t.market}</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-secondary/60 border border-border/30">{t.kind}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono mt-1 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(t.starts_at).toLocaleString()} → {new Date(t.ends_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <div className="rounded-lg bg-secondary/40 p-2">
                  <div className="text-[10px] text-muted-foreground">Entry</div>
                  <div className="font-mono font-bold flex items-center justify-center gap-1"><Coins className="w-3 h-3 text-primary" />{t.entry_fee}</div>
                </div>
                <div className="rounded-lg bg-secondary/40 p-2">
                  <div className="text-[10px] text-muted-foreground">Prize Pool</div>
                  <div className="font-mono font-bold text-primary">{Number(t.prize_pool).toFixed(0)}</div>
                </div>
                <div className="rounded-lg bg-secondary/40 p-2">
                  <div className="text-[10px] text-muted-foreground">Players</div>
                  <div className="font-mono font-bold flex items-center justify-center gap-1"><Users className="w-3 h-3" />{t.entrants}</div>
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <button
                  disabled={t.joined || t.status === "ended"}
                  onClick={() => join(t.id)}
                  className="btn-terminal flex-1 text-sm py-2 disabled:opacity-40"
                >
                  {t.joined ? "Joined ✓" : t.status === "ended" ? "Ended" : `Join (${t.entry_fee} coins)`}
                </button>
                <button onClick={() => setOpen(isOpen ? null : t.id)} className="px-3 py-2 rounded-lg bg-secondary/50 border border-border/30 text-sm">
                  {isOpen ? "Hide" : "Leaderboard"}
                </button>
              </div>

              {isOpen && (
                <div className="mt-3 border-t border-border/30 pt-3 space-y-1">
                  {lb.length === 0 && <div className="text-xs text-muted-foreground text-center">No trades yet during this tournament.</div>}
                  {lb.map(r => (
                    <div key={r.user_id} className="flex items-center justify-between text-sm font-mono">
                      <span className="flex items-center gap-2">
                        <span className="w-5 text-muted-foreground">{r.rank}</span>
                        {r.rank === 1 ? <Crown className="w-3.5 h-3.5 text-yellow-500" /> :
                         r.rank === 2 ? <Medal className="w-3.5 h-3.5 text-zinc-400" /> :
                         r.rank === 3 ? <Award className="w-3.5 h-3.5 text-orange-500" /> : <span className="w-3.5" />}
                        @{r.username}
                      </span>
                      <span className={r.coins_earned >= 0 ? "text-green-500" : "text-red-500"}>
                        {r.coins_earned >= 0 ? "+" : ""}{r.coins_earned.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })}
        {filtered.length === 0 && <div className="text-muted-foreground text-sm md:col-span-2 text-center py-6">No tournaments yet.</div>}
      </div>

      {recentWinners.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="font-bold mb-3 flex items-center gap-2"><Crown className="w-4 h-4 text-yellow-500" />Recent Winners</h3>
          <div className="space-y-1.5">
            {recentWinners.map(w => (
              <div key={`${w.tournament_id}-${w.rank}`} className="flex items-center justify-between text-sm">
                <span>#{w.rank} <strong>@{w.username}</strong></span>
                <span className="font-mono text-primary">+{Number(w.prize).toFixed(0)} coins</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
