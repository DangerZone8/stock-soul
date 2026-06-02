import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, TrendingUp, TrendingDown, RefreshCw, Coins, Globe, Sparkles, Plus, Minus, Trophy } from "lucide-react";
import { Line } from "react-chartjs-2";
import "chart.js/auto";
import { Navbar } from "@/components/Navbar";
import { CandlestickBackground } from "@/components/CandlestickBackground";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const REFRESH_MS = 1000;

const POPULAR = [
  { label: "EUR/USD", symbol: "EURUSD=X" },
  { label: "GBP/USD", symbol: "GBPUSD=X" },
  { label: "USD/JPY", symbol: "USDJPY=X" },
  { label: "USD/INR", symbol: "USDINR=X" },
  { label: "AUD/USD", symbol: "AUDUSD=X" },
  { label: "USD/CAD", symbol: "USDCAD=X" },
  { label: "USD/CHF", symbol: "USDCHF=X" },
  { label: "NZD/USD", symbol: "NZDUSD=X" },
];

interface Holding {
  id: string; symbol: string; currency: string; quantity: number; avg_buy_price: number;
}
interface Quote {
  symbol: string; currency: string; regularMarketPrice: number; previousClose: number;
  timestamps: number[]; closes: (number | null)[];
}

const isForex = (s: string) => /=X$/i.test(s);

const ForexInvestor = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [query, setQuery] = useState("");
  const [activeTicker, setActiveTicker] = useState("EURUSD=X");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [livePrices, setLivePrices] = useState<Record<string, { price: number; currency: string }>>({});
  const [qty, setQty] = useState("100");
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [flash, setFlash] = useState<{ kind: "profit" | "loss"; text: string } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchQuote = useCallback(async (symbol: string) => {
    try {
      const res = await fetch(
        `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/stock-chart?symbol=${encodeURIComponent(symbol)}&interval=1m&range=1d&t=${Date.now()}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setQuote(data);
    } catch { /* ignore */ }
  }, []);

  const fetchHoldings = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("holdings").select("*").order("created_at", { ascending: false });
    if (data) setHoldings((data as Holding[]).filter(h => isForex(h.symbol)));
  }, [user]);

  const fetchLivePricesForHoldings = useCallback(async (hs: Holding[]) => {
    const prices: Record<string, { price: number; currency: string }> = {};
    await Promise.all(hs.map(async (h) => {
      try {
        const r = await fetch(`https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/stock-chart?symbol=${encodeURIComponent(h.symbol)}&interval=1m&range=1d&t=${Date.now()}`, { cache: "no-store" });
        const d = await r.json();
        if (d?.regularMarketPrice) prices[h.symbol] = { price: d.regularMarketPrice, currency: d.currency || h.currency };
      } catch { /* ignore */ }
    }));
    setLivePrices(p => ({ ...p, ...prices }));
  }, []);

  useEffect(() => { fetchHoldings(); }, [fetchHoldings]);
  useEffect(() => { if (holdings.length) fetchLivePricesForHoldings(holdings); }, [holdings, fetchLivePricesForHoldings]);

  useEffect(() => {
    fetchQuote(activeTicker);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      fetchQuote(activeTicker);
      if (holdings.length) fetchLivePricesForHoldings(holdings);
    }, REFRESH_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [activeTicker, fetchQuote, fetchLivePricesForHoldings, holdings]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    // Normalize input like "EURUSD" or "EUR/USD" → "EURUSD=X"
    const cleaned = q.toUpperCase().replace(/[^A-Z=]/g, "");
    if (/^[A-Z]{6}$/.test(cleaned)) { setActiveTicker(cleaned + "=X"); setQuery(""); return; }
    if (/^[A-Z]{6}=X$/.test(cleaned)) { setActiveTicker(cleaned); setQuery(""); return; }
    setSearching(true);
    try {
      const r = await fetch(`https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/stock-chart?q=${encodeURIComponent(q)}`);
      const d = await r.json();
      const first = d?.quotes?.find((x: any) => isForex(x.symbol))?.symbol || d?.quotes?.[0]?.symbol;
      if (first) { setActiveTicker(first); setQuery(""); }
      else toast({ title: "No match", description: `No forex pair found for "${q}"`, variant: "destructive" });
    } finally { setSearching(false); }
  };

  const trade = async (type: "buy" | "sell", symbolOverride?: string, qtyOverride?: number) => {
    if (!user) { toast({ title: "Sign in needed", description: "Log in to trade." }); return; }
    const symbol = symbolOverride || quote?.symbol;
    const price = symbolOverride ? livePrices[symbolOverride]?.price : quote?.regularMarketPrice;
    const currency = symbolOverride ? (livePrices[symbolOverride]?.currency || "USD") : (quote?.currency || "USD");
    const q = qtyOverride ?? Number(qty);
    if (!symbol || !price || !q || q <= 0) { toast({ title: "Invalid trade", variant: "destructive" }); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("execute_trade", {
      p_symbol: symbol, p_currency: currency, p_type: type, p_quantity: q, p_price: price,
    });
    setBusy(false);
    if (error || !data?.[0]?.success) {
      toast({ title: "Trade failed", description: data?.[0]?.message || error?.message, variant: "destructive" });
      return;
    }
    const msg = data[0].message as string;
    toast({ title: type === "buy" ? "Bought!" : "Sold!", description: msg });
    if (type === "sell") {
      const isProfit = msg.toLowerCase().includes("profit");
      setFlash({ kind: isProfit ? "profit" : "loss", text: msg });
      setTimeout(() => setFlash(null), 2500);
    }
    await Promise.all([fetchHoldings(), refreshProfile()]);
  };

  const price = quote?.regularMarketPrice ?? 0;
  const prevClose = quote?.previousClose ?? price;
  const change = price - prevClose;
  const pct = prevClose > 0 ? (change / prevClose) * 100 : 0;
  const isUp = change >= 0;

  const portfolioValue = holdings.reduce((s, h) => s + (livePrices[h.symbol]?.price ?? h.avg_buy_price) * h.quantity, 0);
  const totalCost = holdings.reduce((s, h) => s + h.avg_buy_price * h.quantity, 0);
  const unrealizedPnL = portfolioValue - totalCost;

  const validPts = (quote?.timestamps || []).map((t, i) => ({ t, c: quote?.closes?.[i] })).filter(p => p.c != null && Number.isFinite(p.c as number));
  const chartConfig = {
    labels: validPts.map(p => new Date(p.t * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })),
    datasets: [{
      data: validPts.map(p => p.c),
      borderColor: isUp ? "rgb(34,197,94)" : "rgb(239,68,68)",
      backgroundColor: isUp ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
      fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2,
    }],
  };
  const chartOptions = {
    responsive: true, maintainAspectRatio: false, animation: false as const,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: "rgba(150,150,150,0.6)", maxTicksLimit: 6, font: { size: 10 } } },
      y: { grid: { color: "rgba(150,150,150,0.1)" }, ticks: { color: "rgba(150,150,150,0.6)", font: { size: 10 } } },
    },
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <CandlestickBackground />
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center relative z-10">
          <Globe className="w-12 h-12 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-semibold mb-2">Forex Investor</h1>
          <p className="text-muted-foreground mb-6">Sign in to trade currency pairs with virtual coins.</p>
          <Link to="/auth" className="inline-flex items-center gap-2 px-6 h-11 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90">
            Sign in to play
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

      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6, y: -20 }}
            animate={{ opacity: 1, scale: 1.1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6 }}
            className={`fixed top-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl font-bold text-lg shadow-2xl ${flash.kind === "profit" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}
          >
            {flash.kind === "profit" ? "🎉 " : "💸 "}{flash.text}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-4 h-4 text-primary" />
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Currency Trading Game</span>
          </div>
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl sm:text-5xl font-semibold tracking-tighter">
                Forex <span className="text-primary">Investor</span>
              </h1>
              <p className="text-muted-foreground mt-2">Trade EUR/USD, GBP/USD and more — live FX rates, virtual coins.</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <div className="glass-card px-4 py-2.5">
                <div className="text-xs text-muted-foreground">Coins</div>
                <div className="flex items-center gap-1.5 font-mono font-bold text-amber-500"><Coins className="w-4 h-4" />{Number(profile?.coins ?? 0).toFixed(2)}</div>
              </div>
              <div className="glass-card px-4 py-2.5">
                <div className="text-xs text-muted-foreground">FX Portfolio</div>
                <div className="font-mono font-bold">{portfolioValue.toFixed(2)} <span className="text-xs text-muted-foreground">coins</span></div>
              </div>
              <div className={`glass-card px-4 py-2.5 ${unrealizedPnL >= 0 ? "border-green-500/40" : "border-red-500/40"}`}>
                <div className="text-xs text-muted-foreground">Unrealized P/L</div>
                <div className={`font-mono font-bold flex items-center gap-1 ${unrealizedPnL >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {unrealizedPnL >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {unrealizedPnL >= 0 ? "+" : ""}{unrealizedPnL.toFixed(2)}
                </div>
              </div>
              <Link to="/investor" className="glass-card px-4 py-2.5 hover:border-primary/40 transition">
                <div className="text-xs text-muted-foreground">Switch to</div>
                <div className="font-semibold flex items-center gap-1.5"><Trophy className="w-4 h-4 text-primary" />Stocks</div>
              </Link>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search any FX pair (EURUSD, GBP/JPY, USDINR)"
                className="w-full h-14 pl-12 pr-4 rounded-xl bg-secondary/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/40" />
              {searching && <RefreshCw className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
            </form>

            <div className="flex flex-wrap gap-2">
              {POPULAR.map(t => (
                <button key={t.symbol} onClick={() => setActiveTicker(t.symbol)}
                  className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${activeTicker === t.symbol ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:text-foreground border border-border/30"}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {quote && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
                <div className="flex items-end justify-between gap-4 mb-4">
                  <div>
                    <div className="text-xs text-muted-foreground font-mono">{quote.symbol}</div>
                    <div className="text-3xl font-bold font-mono">{price.toFixed(5)}</div>
                    <div className={`text-sm flex items-center gap-1 mt-1 ${isUp ? "text-green-500" : "text-red-500"}`}>
                      {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      {isUp ? "+" : ""}{change.toFixed(5)} ({pct.toFixed(2)}%)
                    </div>
                  </div>
                </div>
                <div className="h-[220px] mb-4">
                  <Line data={chartConfig} options={chartOptions} />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground">Units</label>
                    <div className="flex items-center gap-2 mt-1">
                      <button type="button" onClick={() => setQty(q => String(Math.max(1, Number(q) - 100)))} className="w-9 h-10 rounded-lg bg-secondary border border-border/50 flex items-center justify-center hover:bg-secondary/80"><Minus className="w-4 h-4" /></button>
                      <input type="number" step="any" min="0" value={qty} onChange={e => setQty(e.target.value)}
                        className="flex-1 h-10 px-3 rounded-lg bg-secondary/50 border border-border/50 font-mono focus:outline-none focus:ring-2 focus:ring-primary/40" />
                      <button type="button" onClick={() => setQty(q => String(Number(q) + 100))} className="w-9 h-10 rounded-lg bg-secondary border border-border/50 flex items-center justify-center hover:bg-secondary/80"><Plus className="w-4 h-4" /></button>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Cost: <span className="font-mono">{(Number(qty) * price).toFixed(2)} coins</span></div>
                  </div>
                  <button onClick={() => trade("buy")} disabled={busy}
                    className="h-10 px-5 rounded-lg bg-green-500 text-white font-semibold hover:bg-green-600 disabled:opacity-60 flex items-center justify-center gap-2">
                    <TrendingUp className="w-4 h-4" /> Buy
                  </button>
                  <button onClick={() => trade("sell")} disabled={busy}
                    className="h-10 px-5 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 disabled:opacity-60 flex items-center justify-center gap-2">
                    <TrendingDown className="w-4 h-4" /> Sell
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          <div className="space-y-4">
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="font-semibold">FX Holdings</h3>
              </div>
              <div className="space-y-1 mb-4 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Holdings value</span><span className="font-mono font-semibold">{portfolioValue.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total cost</span><span className="font-mono">{totalCost.toFixed(2)}</span></div>
                <div className="flex justify-between font-semibold"><span>Unrealized P/L</span>
                  <span className={`font-mono ${unrealizedPnL >= 0 ? "text-green-500" : "text-red-500"}`}>{unrealizedPnL >= 0 ? "+" : ""}{unrealizedPnL.toFixed(2)}</span>
                </div>
              </div>

              {holdings.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-6">
                  No FX positions yet. Pick a pair above to start. 🌍
                </div>
              ) : (
                <div className="space-y-2">
                  {holdings.map(h => {
                    const live = livePrices[h.symbol]?.price ?? h.avg_buy_price;
                    const pl = (live - h.avg_buy_price) * h.quantity;
                    const plPct = h.avg_buy_price > 0 ? ((live - h.avg_buy_price) / h.avg_buy_price) * 100 : 0;
                    const positive = pl >= 0;
                    return (
                      <motion.div key={h.id} layout
                        className="border border-border/40 rounded-lg p-3 bg-secondary/30 hover:bg-secondary/50 transition cursor-pointer"
                        onClick={() => setActiveTicker(h.symbol)}>
                        <div className="flex justify-between items-start mb-1">
                          <div>
                            <div className="font-mono font-semibold text-sm">{h.symbol}</div>
                            <div className="text-xs text-muted-foreground">Qty {h.quantity} · Avg {h.avg_buy_price.toFixed(5)}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-sm">{live.toFixed(5)}</div>
                            <div className={`text-xs font-mono ${positive ? "text-green-500" : "text-red-500"}`}>
                              {positive ? "+" : ""}{pl.toFixed(2)} ({plPct.toFixed(2)}%)
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button onClick={(e) => { e.stopPropagation(); trade("sell", h.symbol, h.quantity); }}
                            className="flex-1 h-8 text-xs rounded-md bg-red-500/15 text-red-500 hover:bg-red-500/25 font-medium">
                            Sell all
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); trade("buy", h.symbol, 100); }}
                            className="flex-1 h-8 text-xs rounded-md bg-green-500/15 text-green-500 hover:bg-green-500/25 font-medium">
                            Buy +100
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ForexInvestor;
