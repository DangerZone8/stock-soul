import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, DollarSign, TrendingUp, Target, BarChart3, Briefcase, Coins, Trophy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Stats {
  joined_at: string;
  username: string;
  coins: number;
  net_profit: number;
  portfolio_value: number;
  total_trades: number;
  total_buys: number;
  total_sells: number;
  wins: number;
  losses: number;
  win_rate: number;
  holdings_count: number;
  league: string;
}

const LEAGUE_STYLES: Record<string, string> = {
  Rookie: "text-slate-400 border-slate-500/40 bg-slate-500/10",
  Trader: "text-sky-400 border-sky-500/40 bg-sky-500/10",
  Shark: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  Whale: "text-violet-400 border-violet-500/40 bg-violet-500/10",
  Titan: "text-amber-400 border-amber-500/40 bg-amber-500/10",
};

export function PersonalStats() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      const { data } = await supabase.rpc("get_user_stats", { p_user: user.id });
      if (active && data && data[0]) setStats(data[0] as any);
    };
    load();
    const id = setInterval(load, 15000);
    return () => { active = false; clearInterval(id); };
  }, [user, profile?.coins, profile?.net_profit]);

  if (!user || !stats) return null;

  const joined = new Date(stats.joined_at);
  const sinceYear = joined.getFullYear();
  const joinedFull = joined.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  const net = Number(stats.net_profit);
  const positive = net >= 0;
  const leagueCls = LEAGUE_STYLES[stats.league] ?? LEAGUE_STYLES.Rookie;

  const cards = [
    { label: "Since", value: String(sinceYear), sub: joinedFull, icon: Clock },
    { label: "Portfolio Value", value: stats.portfolio_value.toFixed(2), sub: `${stats.holdings_count} holdings`, icon: DollarSign },
    { label: "Net Profit", value: `${positive ? "+" : ""}${net.toFixed(2)}`, sub: positive ? "All-time gains" : "All-time losses", icon: TrendingUp, accent: positive ? "text-green-500" : "text-red-500" },
    { label: "Win Rate", value: `${Number(stats.win_rate).toFixed(1)}%`, sub: `${stats.wins}W / ${stats.losses}L`, icon: Target },
    { label: "Verified Trades", value: String(stats.total_trades), sub: `${stats.total_buys} buys · ${stats.total_sells} sells`, icon: BarChart3 },
    { label: "Coins", value: Number(stats.coins).toFixed(2), sub: "Available balance", icon: Coins, accent: "text-amber-500" },
    { label: "Holdings", value: String(stats.holdings_count), sub: "Stocks + Forex", icon: Briefcase },
  ];

  return (
    <section className="container mx-auto px-4 sm:px-6 pt-2 pb-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Trophy className="w-4 h-4 text-primary" />
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Your Performance</span>
          <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-mono font-semibold ${leagueCls}`}>
            {stats.league} League
          </span>
        </div>
        <span className="text-xs text-muted-foreground font-mono">Joined {joinedFull}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card p-4 sm:p-5"
          >
            <div className="flex items-center gap-2 mb-2">
              <c.icon className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
              <div className="text-[10px] sm:text-xs text-muted-foreground font-medium">{c.label}</div>
            </div>
            <div className={`font-mono text-lg sm:text-2xl font-bold mb-0.5 ${c.accent ?? "text-primary"}`}>{c.value}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">{c.sub}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
