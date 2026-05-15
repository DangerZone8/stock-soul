import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Briefcase, Coins, TrendingUp, TrendingDown, Sparkles, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Holding { id: string; symbol: string; quantity: number; avg_buy_price: number; }
interface Trade { symbol: string; type: string; quantity: number; price: number; created_at: string; }

export function HomeUserPanel() {
  const { user, profile } = useAuth();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [h, t] = await Promise.all([
        supabase.from("holdings").select("*").order("created_at", { ascending: false }),
        supabase.from("transactions").select("symbol,type,quantity,price,created_at").order("created_at", { ascending: false }).limit(5),
      ]);
      if (h.data) setHoldings(h.data as Holding[]);
      if (t.data) setTrades(t.data as Trade[]);
    })();
  }, [user]);

  if (!user || !profile) return null;

  const totalCost = holdings.reduce((s, h) => s + h.avg_buy_price * h.quantity, 0);
  const netProfit = Number(profile.net_profit ?? 0);
  const positive = netProfit >= 0;
  const name = profile.username || profile.display_name || "Trader";

  return (
    <section className="container mx-auto px-4 sm:px-6 py-10">
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
        <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Welcome back</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Hey, <span className="text-primary">{name}</span></h2>
          </div>
          <Link to="/investor" className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-1">
            Go to Stock Investor <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
          <div className="glass-card p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1"><Coins className="w-3.5 h-3.5" />Coins</div>
            <div className="font-mono font-bold text-amber-500 text-xl">{Number(profile.coins).toFixed(2)}</div>
          </div>
          <div className="glass-card p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1"><Briefcase className="w-3.5 h-3.5" />Holdings</div>
            <div className="font-mono font-bold text-xl">{holdings.length}</div>
          </div>
          <div className="glass-card p-4">
            <div className="text-xs text-muted-foreground mb-1">Invested</div>
            <div className="font-mono font-bold text-xl">{totalCost.toFixed(2)}</div>
          </div>
          <div className={`glass-card p-4 ${positive ? "border-green-500/40" : "border-red-500/40"}`}>
            <div className="text-xs text-muted-foreground mb-1">Net Profit</div>
            <div className={`font-mono font-bold flex items-center gap-1 text-xl ${positive ? "text-green-500" : "text-red-500"}`}>
              {positive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {positive ? "+" : ""}{netProfit.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-card p-5">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Briefcase className="w-4 h-4 text-primary" />Top Holdings</h3>
            {holdings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No holdings yet. <Link to="/investor" className="text-primary">Start trading →</Link></p>
            ) : (
              <div className="space-y-2">
                {holdings.slice(0, 5).map(h => (
                  <div key={h.id} className="flex justify-between items-center text-sm border-b border-border/30 pb-2 last:border-0">
                    <span className="font-mono font-semibold">{h.symbol}</span>
                    <span className="text-muted-foreground font-mono text-xs">qty {h.quantity} · avg {h.avg_buy_price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="glass-card p-5">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />Recent Trades</h3>
            {trades.length === 0 ? (
              <p className="text-sm text-muted-foreground">No trades yet.</p>
            ) : (
              <div className="space-y-2">
                {trades.map((t, i) => (
                  <div key={i} className="flex justify-between items-center text-sm border-b border-border/30 pb-2 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold uppercase ${t.type === "buy" ? "text-green-500" : "text-red-500"}`}>{t.type}</span>
                      <span className="font-mono">{t.symbol}</span>
                    </div>
                    <span className="text-muted-foreground font-mono text-xs">{t.quantity} @ {Number(t.price).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
