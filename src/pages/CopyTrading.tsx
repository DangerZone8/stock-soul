import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Copy, Users, TrendingUp, TrendingDown, CircleDollarSign, Crown, UserPlus, UserMinus, Settings, Play, Pause, Coins, Target, ChartBar as BarChart3, Briefcase } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { CandlestickBackground } from "@/components/CandlestickBackground";
import { Footer } from "@/components/Footer";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface CopyTrader {
  user_id: string;
  username: string;
  coins: number;
  net_profit: number;
  total_copiers: number;
  win_rate: number;
  is_accepting: boolean;
  description: string | null;
  min_copy: number;
  max_copy: number | null;
  fee_percent: number;
}

interface CopyRelation {
  trader_id: string;
  username: string;
  allocated_coins: number;
  proportion: number;
  is_active: boolean;
  total_profit: number;
  copied_trades: number;
  trader_coins: number;
  trader_profit: number;
}

const CopyTrading = () => {
  const { user, profile } = useAuth();
  const [traders, setTraders] = useState<CopyTrader[]>([]);
  const [myCopies, setMyCopies] = useState<CopyRelation[]>([]);
  const [allocateAmount, setAllocateAmount] = useState<string>("100");
  const [selectedTrader, setSelectedTrader] = useState<CopyTrader | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [tab, setTab] = useState("discover");
  const [isTrader, setIsTrader] = useState(false);
  const [traderDesc, setTraderDesc] = useState("");
  const [minCopy, setMinCopy] = useState("100");
  const [maxCopy, setMaxCopy] = useState("");
  const [feePercent, setFeePercent] = useState("0");

  const loadTraders = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("get_copy_traders", { p_limit: 25 });
      if (error) throw error;
      setTraders((data as CopyTrader[]) || []);
    } catch (err) {
      console.error("Error loading traders:", err);
    }
  }, []);

  const loadMyCopies = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.rpc("get_my_copy_relationships");
      if (error) throw error;
      setMyCopies((data as CopyRelation[]) || []);
    } catch (err) {
      console.error("Error loading copies:", err);
    }
  }, [user]);

  const checkIfTrader = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("copy_traders").select("description, min_copy_amount, max_copy_amount, performance_fee_percent").eq("user_id", user.id).maybeSingle();
    if (data) {
      setIsTrader(true);
      setTraderDesc(data.description || "");
      setMinCopy(String(data.min_copy_amount));
      setMaxCopy(data.max_copy_amount ? String(data.max_copy_amount) : "");
      setFeePercent(String(data.performance_fee_percent));
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadTraders(), loadMyCopies()]).finally(() => setLoading(false));
  }, [loadTraders, loadMyCopies]);

  useEffect(() => {
    if (user) checkIfTrader();
  }, [user, checkIfTrader]);

  const startCopy = async (trader: CopyTrader) => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to copy traders.", variant: "destructive" });
      return;
    }
    const amount = Number(allocateAmount);
    if (!amount || amount <= 0) {
      toast({ title: "Invalid amount", description: "Enter a valid amount to allocate.", variant: "destructive" });
      return;
    }
    setActionLoading(true);
    try {
      const { data, error } = await supabase.rpc("start_copy_trading", {
        p_trader_id: trader.user_id,
        p_allocated_coins: amount,
      });
      if (error) throw error;
      const result = data?.[0];
      if (result?.success) {
        toast({ title: "Success!", description: result.message });
        loadMyCopies();
        loadTraders();
      } else {
        toast({ title: "Error", description: result?.message || "Failed to start copying", variant: "destructive" });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to start copying", variant: "destructive" });
    } finally {
      setActionLoading(false);
      setSelectedTrader(null);
      setAllocateAmount("100");
    }
  };

  const stopCopy = async (traderId: string) => {
    setActionLoading(true);
    try {
      const { data, error } = await supabase.rpc("stop_copy_trading", { p_trader_id: traderId });
      if (error) throw error;
      const result = data?.[0];
      if (result?.success) {
        toast({ title: "Stopped", description: result.message });
        loadMyCopies();
        loadTraders();
      } else {
        toast({ title: "Error", description: result?.message, variant: "destructive" });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to stop copying", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const becomeTrader = async () => {
    if (!user) return;
    setActionLoading(true);
    try {
      const { data, error } = await supabase.rpc("become_copy_trader", {
        p_description: traderDesc || null,
        p_min_copy: Number(minCopy) || 100,
        p_max_copy: maxCopy ? Number(maxCopy) : null,
        p_fee_percent: Number(feePercent) || 0,
      });
      if (error) throw error;
      const result = data?.[0];
      if (result?.success) {
        setIsTrader(true);
        toast({ title: "Success!", description: result.message });
        loadTraders();
      } else {
        toast({ title: "Error", description: result?.message, variant: "destructive" });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to become a trader", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const stopBeingTrader = async () => {
    if (!user) return;
    setActionLoading(true);
    try {
      await supabase.from("copy_traders").update({ is_accepting_copiers: false }).eq("user_id", user.id);
      setIsTrader(false);
      toast({ title: "Stopped", description: "You are no longer accepting copiers." });
      loadTraders();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to update", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <CandlestickBackground />
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center relative z-10">
          <Copy className="w-12 h-12 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-semibold mb-2">Copy Trading</h1>
          <p className="text-muted-foreground mb-6">Sign in to automatically copy top traders and grow your portfolio.</p>
          <Link to="/auth" className="inline-flex items-center gap-2 px-6 h-11 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90">
            Sign in to start
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <CandlestickBackground />
      <Navbar />

      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Copy className="w-4 h-4 text-primary" />
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Social Trading</span>
          </div>
          <div className="flex flex-end justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl sm:text-5xl font-semibold tracking-tighter">
                Copy <span className="text-primary">Trading</span>
              </h1>
              <p className="text-muted-foreground mt-2">Automatically mirror trades from top performers. Profit when they profit.</p>
            </div>
            <div className="flex gap-3">
              <div className="glass-card px-4 py-2.5">
                <div className="text-xs text-muted-foreground">Your Coins</div>
                <div className="flex items-center gap-1.5 font-mono font-bold text-amber-500"><Coins className="w-4 h-4" />{Number(profile?.coins ?? 0).toFixed(2)}</div>
              </div>
              {isTrader && (
                <div className="glass-card px-4 py-2.5 border-green-500/40">
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div className="font-bold text-green-500 flex items-center gap-1"><Crown className="w-4 h-4" />Signal Provider</div>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="mb-6 bg-secondary/40 border border-border/30 flex-wrap h-auto">
            <TabsTrigger value="discover" className="gap-1.5"><Users className="w-3.5 h-3.5" />Discover Traders</TabsTrigger>
            <TabsTrigger value="copying" className="gap-1.5"><Copy className="w-3.5 h-3.5" />My Copies</TabsTrigger>
            <TabsTrigger value="provider" className="gap-1.5"><Crown className="w-3.5 h-3.5" />Become Provider</TabsTrigger>
          </TabsList>

          <TabsContent value="discover">
            {loading ? (
              <div className="text-center py-10 text-muted-foreground">Loading traders...</div>
            ) : traders.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">No traders available yet. Be the first to become a signal provider!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {traders.map((trader) => {
                  const isCopying = myCopies.some(c => c.trader_id === trader.user_id && c.is_active);
                  return (
                    <motion.div key={trader.user_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className="glass-card p-5 hover:border-primary/30 transition-all">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-semibold text-lg">{trader.username}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Users className="w-3 h-3" />{trader.total_copiers} copiers
                          </div>
                        </div>
                        <div className={`px-2 py-1 rounded text-xs font-medium ${trader.is_accepting ? "bg-green-500/15 text-green-500" : "bg-secondary text-muted-foreground"}`}>
                          {trader.is_accepting ? "Accepting" : "Paused"}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="p-3 rounded-lg bg-secondary/30">
                          <div className="text-xs text-muted-foreground">Net Profit</div>
                          <div className={`font-mono font-bold flex items-center gap-1 ${trader.net_profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                            {trader.net_profit >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {trader.net_profit >= 0 ? "+" : ""}{Number(trader.net_profit).toFixed(2)}
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-secondary/30">
                          <div className="text-xs text-muted-foreground">Coins</div>
                          <div className="font-mono font-bold text-amber-500 flex items-center gap-1">
                            <Coins className="w-3 h-3" />{Number(trader.coins).toFixed(0)}
                          </div>
                        </div>
                      </div>

                      {trader.description && (
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{trader.description}</p>
                      )}

                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                        <span>Min: {trader.min_copy} coins</span>
                        {trader.max_copy && <span>Max: {trader.max_copy} coins</span>}
                        {trader.fee_percent > 0 && <span>Fee: {trader.fee_percent}%</span>}
                      </div>

                      {isCopying ? (
                        <button onClick={() => stopCopy(trader.user_id)} disabled={actionLoading}
                          className="w-full h-10 rounded-lg bg-red-500/15 text-red-500 font-medium hover:bg-red-500/25 flex items-center justify-center gap-2">
                          <UserMinus className="w-4 h-4" /> Stop Copying
                        </button>
                      ) : (
                        <button onClick={() => setSelectedTrader(trader)} disabled={!trader.is_accepting}
                          className="w-full h-10 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                          <UserPlus className="w-4 h-4" /> Copy This Trader
                        </button>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="copying">
            {myCopies.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <Copy className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">You're not copying any traders yet.</p>
                <button onClick={() => setTab("discover")} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium">
                  Discover Traders
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {myCopies.map((copy) => (
                  <div key={copy.trader_id} className="glass-card p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-lg">{copy.username}</div>
                        <div className="text-sm text-muted-foreground">
                          Allocated: <span className="font-mono text-amber-500">{copy.allocated_coins} coins</span>
                        </div>
                      </div>
                      <div className={`px-2 py-1 rounded text-xs font-medium ${copy.is_active ? "bg-green-500/15 text-green-500" : "bg-secondary text-muted-foreground"}`}>
                        {copy.is_active ? "Active" : "Paused"}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                      <div>
                        <div className="text-xs text-muted-foreground">Your Profit</div>
                        <div className={`font-mono font-bold ${copy.total_profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {copy.total_profit >= 0 ? "+" : ""}{copy.total_profit.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Copied Trades</div>
                        <div className="font-mono font-bold">{copy.copied_trades}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Trader's Coins</div>
                        <div className="font-mono text-amber-500">{Number(copy.trader_coins).toFixed(0)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Trader's P/L</div>
                        <div className={`font-mono font-bold ${copy.trader_profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {copy.trader_profit >= 0 ? "+" : ""}{Number(copy.trader_profit).toFixed(2)}
                        </div>
                      </div>
                    </div>
                    {copy.is_active && (
                      <button onClick={() => stopCopy(copy.trader_id)} disabled={actionLoading}
                        className="mt-4 w-full h-9 rounded-lg bg-red-500/15 text-red-500 font-medium hover:bg-red-500/25 flex items-center justify-center gap-2">
                        <Pause className="w-4 h-4" /> Stop Copying
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="provider">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Crown className="w-5 h-5 text-amber-500" />
                  <h3 className="font-semibold text-lg">Become a Signal Provider</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Let others copy your trades automatically. Earn a performance fee on profits you generate for your copiers.
                </p>
                {isTrader ? (
                  <div className="space-y-4">
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-sm text-green-600 dark:text-green-400">
                      You are currently accepting copiers. Your trades will be automatically mirrored.
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Description</label>
                      <textarea value={traderDesc} onChange={e => setTraderDesc(e.target.value)}
                        placeholder="Tell copiers about your trading style..."
                        className="w-full h-20 mt-1 px-3 py-2 rounded-lg bg-secondary/50 border border-border/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/40" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Min Copy</label>
                        <input type="number" value={minCopy} onChange={e => setMinCopy(e.target.value)}
                          className="w-full h-10 mt-1 px-3 rounded-lg bg-secondary/50 border border-border/50 font-mono focus:outline-none focus:ring-2 focus:ring-primary/40" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Max Copy</label>
                        <input type="number" value={maxCopy} onChange={e => setMaxCopy(e.target.value)} placeholder="Unlimited"
                          className="w-full h-10 mt-1 px-3 rounded-lg bg-secondary/50 border border-border/50 font-mono focus:outline-none focus:ring-2 focus:ring-primary/40" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Fee %</label>
                        <input type="number" step="0.1" min="0" max="50" value={feePercent} onChange={e => setFeePercent(e.target.value)}
                          className="w-full h-10 mt-1 px-3 rounded-lg bg-secondary/50 border border-border/50 font-mono focus:outline-none focus:ring-2 focus:ring-primary/40" />
                      </div>
                    </div>
                    <button onClick={becomeTrader} disabled={actionLoading}
                      className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 flex items-center justify-center gap-2">
                      <Settings className="w-4 h-4" /> Update Settings
                    </button>
                    <button onClick={stopBeingTrader} disabled={actionLoading}
                      className="w-full h-11 rounded-lg bg-secondary text-muted-foreground font-medium hover:bg-secondary/80 flex items-center justify-center gap-2">
                      <Pause className="w-4 h-4" /> Stop Accepting Copiers
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-muted-foreground">Description (optional)</label>
                      <textarea value={traderDesc} onChange={e => setTraderDesc(e.target.value)}
                        placeholder="Tell copiers about your trading style..."
                        className="w-full h-20 mt-1 px-3 py-2 rounded-lg bg-secondary/50 border border-border/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/40" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Min Copy</label>
                        <input type="number" value={minCopy} onChange={e => setMinCopy(e.target.value)}
                          className="w-full h-10 mt-1 px-3 rounded-lg bg-secondary/50 border border-border/50 font-mono focus:outline-none focus:ring-2 focus:ring-primary/40" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Max Copy</label>
                        <input type="number" value={maxCopy} onChange={e => setMaxCopy(e.target.value)} placeholder="Unlimited"
                          className="w-full h-10 mt-1 px-3 rounded-lg bg-secondary/50 border border-border/50 font-mono focus:outline-none focus:ring-2 focus:ring-primary/40" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Fee %</label>
                        <input type="number" step="0.1" min="0" max="50" value={feePercent} onChange={e => setFeePercent(e.target.value)}
                          className="w-full h-10 mt-1 px-3 rounded-lg bg-secondary/50 border border-border/50 font-mono focus:outline-none focus:ring-2 focus:ring-primary/40" />
                      </div>
                    </div>
                    <button onClick={becomeTrader} disabled={actionLoading}
                      className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 flex items-center justify-center gap-2">
                      <Play className="w-4 h-4" /> Start Accepting Copiers
                    </button>
                  </div>
                )}
              </div>

              <div className="glass-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-lg">How Copy Trading Works</h3>
                </div>
                <div className="space-y-4 text-sm text-muted-foreground">
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">1</div>
                    <p><strong className="text-foreground">Choose a Trader</strong> - Browse top performers by profit, coins, or win rate.</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">2</div>
                    <p><strong className="text-foreground">Allocate Coins</strong> - Decide how many coins you want to mirror their trades with.</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">3</div>
                    <p><strong className="text-foreground">Auto-Copy</strong> - When they execute a trade, your account mirrors it proportionally.</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">4</div>
                    <p><strong className="text-foreground">Profit Together</strong> - Your balance grows (or falls) in sync with the trader's performance.</p>
                  </div>
                </div>
                <div className="mt-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    <strong>Note:</strong> Copy trading involves risk. Past performance does not guarantee future results. Only allocate what you can afford to lose.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Start Copy Modal */}
      {selectedTrader && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="glass-card p-6 w-full max-w-md">
            <h3 className="font-semibold text-lg mb-2">Copy {selectedTrader.username}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Allocate coins to automatically mirror this trader's positions.
            </p>
            <div className="mb-4">
              <label className="text-xs text-muted-foreground">Amount to Allocate</label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-amber-500 font-mono font-bold">$</span>
                <input type="number" value={allocateAmount} onChange={e => setAllocateAmount(e.target.value)}
                  min={selectedTrader.min_copy} max={selectedTrader.max_copy || undefined}
                  className="flex-1 h-11 px-3 rounded-lg bg-secondary/50 border border-border/50 font-mono focus:outline-none focus:ring-2 focus:ring-primary/40" />
                <button onClick={() => setAllocateAmount(String(selectedTrader.min_copy))}
                  className="h-11 px-3 rounded-lg bg-secondary border border-border/50 text-sm font-medium hover:bg-secondary/80">
                  Min
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Min: {selectedTrader.min_copy} {selectedTrader.max_copy ? `· Max: ${selectedTrader.max_copy}` : ""}
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setSelectedTrader(null)}
                className="flex-1 h-11 rounded-lg bg-secondary text-muted-foreground font-medium hover:bg-secondary/80">
                Cancel
              </button>
              <button onClick={() => startCopy(selectedTrader)} disabled={actionLoading}
                className="flex-1 h-11 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90">
                Start Copying
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default CopyTrading;
