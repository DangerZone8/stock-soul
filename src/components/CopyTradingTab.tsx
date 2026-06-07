import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Copy, Users, TrendingUp, TrendingDown, Settings2, X, RefreshCw, UserMinus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

interface Leader {
  leader_id: string;
  username: string;
  coins: number;
  net_profit: number;
  max_coins_per_trade: number;
  stop_loss_pct: number;
  active: boolean;
  realized_loss: number;
}
interface FeedItem {
  trade_id: string;
  leader_id: string;
  username: string;
  symbol: string;
  type: "buy" | "sell";
  quantity: number;
  price: number;
  pnl: number;
  created_at: string;
  already_copied: boolean;
}
interface TopTrader {
  user_id: string;
  username: string;
  net_profit: number;
  coins: number;
}

async function fetchLivePrice(symbol: string): Promise<number | null> {
  try {
    const url = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/stock-quote?symbol=${encodeURIComponent(symbol)}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const d = await r.json();
    return Number(d?.regularMarketPrice) || null;
  } catch { return null; }
}

export function CopyTradingTab({ market = "all" }: { market?: "stock" | "forex" | "all" }) {
  const { user } = useAuth();
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [top, setTop] = useState<TopTrader[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<Leader | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: l }, { data: f }, { data: t }] = await Promise.all([
      supabase.rpc("get_my_copy_leaders"),
      supabase.rpc("get_copy_feed", { p_limit: 30 }),
      supabase.rpc("get_leaderboard", { p_kind: "profit", p_limit: 8 }),
    ]);
    setLeaders((l as Leader[]) || []);
    setFeed((f as FeedItem[]) || []);
    setTop(((t as any[]) || []).filter(x => x.user_id !== user.id).map(x => ({
      user_id: x.user_id, username: x.username, net_profit: x.net_profit, coins: x.coins,
    })));
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const startCopying = async (leaderId: string) => {
    const { data, error } = await supabase.rpc("set_copy_settings", {
      p_leader: leaderId, p_max: 500, p_stop_pct: 20, p_active: true,
    });
    if (error || !data?.[0]?.success) {
      toast({ title: "Failed", description: error?.message || data?.[0]?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Now copying", description: "Default: 500 coins/trade, 20% stop-loss" });
    load();
  };

  const filtered = feed.filter(f => {
    if (market === "all") return true;
    const isFx = /=X$/i.test(f.symbol);
    return market === "forex" ? isFx : !isFx;
  });

  const copyOne = async (item: FeedItem) => {
    setBusy(item.trade_id);
    const price = await fetchLivePrice(item.symbol) ?? item.price;
    const { data: { session } } = await supabase.auth.getSession();
    const url = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/copy-verified-trade`;
    let respJson: any = null;
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ source_trade_id: item.trade_id, symbol: item.symbol, price }),
      });
      respJson = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(respJson?.error || `Error ${r.status}`);
    } catch (e: any) {
      setBusy(null);
      toast({ title: "Copy failed", description: e.message, variant: "destructive" });
      return;
    }
    setBusy(null);
    const row = respJson?.data?.[0];
    if (!row?.success) {
      toast({ title: "Copy failed", description: row?.message || "Unknown error", variant: "destructive" });
      return;
    }
    toast({ title: row.message });
    load();
  };

  if (!user) return <div className="glass-card p-6 text-center text-muted-foreground">Sign in to use copy trading</div>;

  return (
    <div className="space-y-6">
      {/* Top traders to copy */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold flex items-center gap-2"><Users className="w-4 h-4 text-primary" />Top Traders to Copy</h3>
          <button onClick={load} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"><RefreshCw className="w-3 h-3" />Refresh</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {top.map(t => {
            const already = leaders.some(l => l.leader_id === t.user_id && l.active);
            return (
              <div key={t.user_id} className="rounded-lg border border-border/30 p-3 bg-secondary/30">
                <div className="font-semibold truncate">@{t.username}</div>
                <div className={`text-sm font-mono ${t.net_profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {t.net_profit >= 0 ? "+" : ""}{t.net_profit.toFixed(2)} profit
                </div>
                <button
                  disabled={already}
                  onClick={() => startCopying(t.user_id)}
                  className="w-full mt-2 btn-terminal text-xs py-1.5 disabled:opacity-40"
                >
                  {already ? "Copying" : "Copy"}
                </button>
              </div>
            );
          })}
          {top.length === 0 && <div className="text-sm text-muted-foreground col-span-full">No traders yet.</div>}
        </div>
      </div>

      {/* Your leaders */}
      {leaders.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="font-bold mb-3">Traders You Copy</h3>
          <div className="space-y-2">
            {leaders.map(l => (
              <div key={l.leader_id} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/30 border border-border/30 px-3 py-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">@{l.username} {!l.active && <span className="text-[10px] text-muted-foreground">(paused)</span>}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    Max {l.max_coins_per_trade} / trade • Stop {l.stop_loss_pct}% • Loss tracked {l.realized_loss.toFixed(2)}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => setEditing(l)} className="text-xs text-primary hover:underline flex items-center gap-1">
                    <Settings2 className="w-3 h-3" />Risk
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Stop copying @${l.username}?`)) return;
                      const { error } = await (supabase.rpc as any)("remove_copy_leader", { p_leader: l.leader_id });
                      if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
                      toast({ title: `Stopped copying @${l.username}` });
                      load();
                    }}
                    className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                  >
                    <UserMinus className="w-3 h-3" />Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trade feed */}
      <div className="glass-card p-5">
        <h3 className="font-bold mb-3">Recent Trades from Your Leaders</h3>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent trades. Start copying a trader above to see their moves here.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map(item => {
              const isBuy = item.type === "buy";
              return (
                <motion.div
                  key={item.trade_id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between gap-3 rounded-lg bg-secondary/30 border border-border/30 px-3 py-2.5"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isBuy ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"}`}>
                      {isBuy ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">
                        @{item.username} {isBuy ? "bought" : "sold"} {Number(item.quantity).toFixed(4)} {item.symbol}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        @ {Number(item.price).toFixed(4)} • {new Date(item.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => copyOne(item)}
                    disabled={item.already_copied || busy === item.trade_id}
                    className="btn-terminal text-xs px-3 py-1.5 disabled:opacity-40 whitespace-nowrap flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    {item.already_copied ? "Copied" : busy === item.trade_id ? "..." : "Copy"}
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Risk modal */}
      {editing && (
        <RiskModal leader={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}

function RiskModal({ leader, onClose, onSaved }: { leader: Leader; onClose: () => void; onSaved: () => void }) {
  const [max, setMax] = useState(leader.max_coins_per_trade);
  const [stop, setStop] = useState(leader.stop_loss_pct);
  const [active, setActive] = useState(leader.active);
  const save = async () => {
    const { data, error } = await supabase.rpc("set_copy_settings", {
      p_leader: leader.leader_id, p_max: max, p_stop_pct: stop, p_active: active,
    });
    if (error || !data?.[0]?.success) {
      toast({ title: "Failed", description: error?.message, variant: "destructive" }); return;
    }
    toast({ title: "Saved" });
    onSaved();
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-card p-5 max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">Risk settings — @{leader.username}</h3>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <label className="text-xs text-muted-foreground">Max coins per copied trade</label>
        <input type="number" value={max} onChange={e => setMax(Number(e.target.value))}
          className="w-full mt-1 mb-3 bg-secondary/50 border border-border/50 rounded-lg px-3 py-2" />
        <label className="text-xs text-muted-foreground">Stop copying if loss exceeds (%)</label>
        <input type="number" value={stop} onChange={e => setStop(Number(e.target.value))}
          className="w-full mt-1 mb-3 bg-secondary/50 border border-border/50 rounded-lg px-3 py-2" />
        <label className="flex items-center gap-2 text-sm mb-4">
          <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
          Active (auto-show their trades to copy)
        </label>
        <button onClick={save} className="btn-terminal w-full">Save</button>
      </div>
    </div>
  );
}
