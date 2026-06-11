import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, TrendingUp, TrendingDown, RefreshCw, Coins, Briefcase, Globe, ArrowRightLeft, Plus, Minus, ChartBar as BarChart3, ChartLine as LineChart } from "lucide-react";
import { Line } from "react-chartjs-2";
import "chart.js/auto";
import { Navbar } from "@/components/Navbar";
import { CandlestickBackground } from "@/components/CandlestickBackground";
import { Footer } from "@/components/Footer";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const REFRESH_MS = 3000;

const FOREX_PAIRS = [
  { label: "EUR/USD", symbol: "EURUSD=X" },
  { label: "GBP/USD", symbol: "GBPUSD=X" },
  { label: "USD/JPY", symbol: "JPY=X" },
  { label: "AUD/USD", symbol: "AUDUSD=X" },
  { label: "USD/CAD", symbol: "CAD=X" },
  { label: "USD/CHF", symbol: "CHF=X" },
  { label: "EUR/GBP", symbol: "EURGBP=X" },
  { label: "NZD/USD", symbol: "NZDUSD=X" },
];

const CRYPTO_PAIRS = [
  { label: "BTC/USD", symbol: "BTC-USD" },
  { label: "ETH/USD", symbol: "ETH-USD" },
  { label: "SOL/USD", symbol: "SOL-USD" },
  { label: "XRP/USD", symbol: "XRP-USD" },
];

interface ForexHolding {
  id: string;
  symbol: string;
  currency: string;
  quantity: number;
  avg_buy_price: number;
}

interface Quote {
  symbol: string;
  currency: string;
  regularMarketPrice: number;
  previousClose: number;
  timestamps: number[];
  closes: (number | null)[];
}

const fmtForex = (n: number, symbol: string) => {
  const isJPY = symbol.includes("JPY");
  const isCrypto = symbol.includes("-USD");
  if (isCrypto) return `$${n.toFixed(2)}`;
  if (isJPY) return `¥${n.toFixed(2)}`;
  return n.toFixed(isJPY ? 2 : 5);
};

const ForexInvestor = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [query, setQuery] = useState("");
  const [activePair, setActivePair] = useState("EURUSD=X");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [holdings, setHoldings] = useState<ForexHolding[]>([]);
  const [livePrices, setLivePrices] = useState<Record<string, { price: number; currency: string }>>({});
  const [qty, setQty] = useState("1000");
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [flash, setFlash] = useState<{ kind: "profit" | "loss"; text: string } | null>(null);
  const [assetType, setAssetType] = useState<"forex" | "crypto">("forex");
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
    } catch {
      /* ignore */
    }
  }, []);

  const fetchHoldings = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("holdings").select("*").order("created_at", { ascending: false });
    if (data) setHoldings(data as ForexHolding[]);
  }, [user]);

  const fetchLivePricesForHoldings = useCallback(async (hs: ForexHolding[]) => {
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
    fetchQuote(activePair);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      fetchQuote(activePair);
      if (holdings.length) fetchLivePricesForHoldings(holdings);
    }, REFRESH_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [activePair, fetchQuote, fetchLivePricesForHoldings, holdings]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim().toUpperCase();
    if (!q) return;
    if (/^[A-Z]{3}[A-Z]{3}=X$/.test(q) || /^[A-Z]+-USD$/.test(q)) {
      setActivePair(q);
      setQuery("");
      return;
    }
    setSearching(true);
    try {
      const r = await fetch(`https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/stock-chart?q=${encodeURIComponent(q)}`);
      const d = await r.json();
      const first = d?.quotes?.[0]?.symbol;
      if (first) {
        setActivePair(first);
        setQuery("");
      } else {
        toast({ title: "No match", description: `No pair found for "${q}"`, variant: "destructive" });
      }
    } finally {
      setSearching(false);
    }
  };

  const trade = async (type: "buy" | "sell", symbolOverride?: string, qtyOverride?: number) => {
    if (!user) {
      toast({ title: "Sign in needed", description: "Log in to trade." });
      return;
    }
    const symbol = symbolOverride || quote?.symbol;
    const price = symbolOverride ? livePrices[symbolOverride]?.price : quote?.regularMarketPrice;
    const currency = symbolOverride ? (livePrices[symbolOverride]?.currency || "USD") : (quote?.currency || "USD");
    const q = qtyOverride ?? Number(qty);
    if (!symbol || !price || !q || q <= 0) {
      toast({ title: "Invalid trade", variant: "destructive" });
      return;
    }
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

  const forexHoldings = holdings.filter(h => h.symbol.includes("=X") || h.symbol.includes("-USD"));
  const portfolioValue = forexHoldings.reduce((s, h) => s + (livePrices[h.symbol]?.price ?? h.avg_buy_price) * h.quantity, 0);
  const totalCost = forexHoldings.reduce((s, h) => s + h.avg_buy_price * h.quantity, 0);
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
    responsive: true, maintainAspectRatio: false,
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
          <p className="text-muted-foreground mb-6">Sign in to start trading currency pairs and crypto with virtual coins.</p>
          <Link to="/auth" className="inline-flex items-center gap-2 px-6 h-11 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90">
            Sign in to trade
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
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">24/5 Forex Market</span>
          </div>
          <div className="flex flex-end justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl sm:text-5xl font-semibold tracking-tighter">
                Forex <span className="text-primary">Investor</span>
              </h1>
              <p className="text-muted-foreground mt-2">Trade currency pairs and major cryptos with real-time prices.</p>
            </div>
            <div className="flex gap-3">
              <div className="glass-card px-4 py-2.5">
                <div className="text-xs text-muted-foreground">Coins</div>
                <div className="flex items-center gap-1.5 font-mono font-bold text-amber-500"><Coins className="w-4 h-4" />{Number(profile?.coins ?? 0).toFixed(2)}</div>
              </div>
              <div className="glass-card px-4 py-2.5">
                <div className="text-xs text-muted-foreground">Forex Portfolio</div>
                <div className="font-mono font-bold">{portfolioValue.toFixed(2)} <span className="text-xs text-muted-foreground">coins</span></div>
              </div>
              <div className={`glass-card px-4 py-2.5 ${unrealizedPnL >= 0 ? "border-green-500/40" : "border-red-500/40"}`}>
                <div className="text-xs text-muted-foreground">Unrealized P/L</div>
                <div className={`font-mono font-bold flex items-center gap-1 ${unrealizedPnL >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {unrealizedPnL >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {unrealizedPnL >= 0 ? "+" : ""}{unrealizedPnL.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <Tabs value={assetType} onValueChange={(v) => setAssetType(v as "forex" | "crypto")} className="w-full mb-6">
          <TabsList className="bg-secondary/40 border border-border/30">
            <TabsTrigger value="forex" className="gap-1.5"><ArrowRightLeft className="w-3.5 h-3.5" />Forex</TabsTrigger>
            <TabsTrigger value="crypto" className="gap-1.5"><LineChart className="w-3.5 h-3.5" />Crypto</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder={assetType === "forex" ? "Search pairs (EURUSD=X, GBPUSD=X...)" : "Search crypto (BTC-USD, ETH-USD...)"}
                className="w-full h-14 pl-12 pr-4 rounded-xl bg-secondary/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/40" />
              {searching && <RefreshCw className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
            </form>

            <div className="flex flex-wrap gap-2">
              {(assetType === "forex" ? FOREX_PAIRS : CRYPTO_PAIRS).map(pair => (
                <button key={pair.symbol} onClick={() => setActivePair(pair.symbol)}
                  className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${activePair === pair.symbol ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:text-foreground border border-border/30"}`}>
                  {pair.label}
                </button>
              ))}
            </div>

            {quote && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
                <div className="flex items-end justify-between gap-4 mb-4">
                  <div>
                    <div className="text-xs text-muted-foreground font-mono">{quote.symbol}</div>
                    <div className="text-3xl font-bold font-mono">{fmtForex(price, quote.symbol)}</div>
                    <div className={`text-sm flex items-center gap-1 mt-1 ${isUp ? "text-green-500" : "text-red-500"}`}>
                      {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      {isUp ? "+" : ""}{change.toFixed(assetType === "forex" ? 5 : 2)} ({pct.toFixed(2)}%)
                    </div>
                  </div>
                </div>
                <div className="h-[220px] mb-4">
                  <Line data={chartConfig} options={chartOptions} />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground">Units / Contract Size</label>
                    <div className="flex items-center gap-2 mt-1">
                      <button type="button" onClick={() => setQty(q => String(Math.max(100, Number(q) - 1000)))} className="w-9 h-10 rounded-lg bg-secondary border border-border/50 flex items-center justify-center hover:bg-secondary/80"><Minus className="w-4 h-4" /></button>
                      <input type="number" step="100" min="100" value={qty} onChange={e => setQty(e.target.value)}
                        className="flex-1 h-10 px-3 rounded-lg bg-secondary/50 border border-border/50 font-mono focus:outline-none focus:ring-2 focus:ring-primary/40" />
                      <button type="button" onClick={() => setQty(q => String(Number(q) + 1000))} className="w-9 h-10 rounded-lg bg-secondary border border-border/50 flex items-center justify-center hover:bg-secondary/80"><Plus className="w-4 h-4" /></button>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Position value: <span className="font-mono">{(Number(qty) * price).toFixed(2)} coins</span></div>
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
                <BarChart3 className="w-4 h-4 text-primary" />
                <h3 className="font-semibold">Forex Positions</h3>
              </div>
              {forexHoldings.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-6">
                  No forex/crypto positions yet. Open your first trade!
                </div>
              ) : (
                <div className="space-y-2">
                  {forexHoldings.map(h => {
                    const live = livePrices[h.symbol]?.price ?? h.avg_buy_price;
                    const pl = (live - h.avg_buy_price) * h.quantity;
                    const plPct = h.avg_buy_price > 0 ? ((live - h.avg_buy_price) / h.avg_buy_price) * 100 : 0;
                    const positive = pl >= 0;
                    return (
                      <motion.div key={h.id} layout
                        className="border border-border/40 rounded-lg p-3 bg-secondary/30 hover:bg-secondary/50 transition cursor-pointer"
                        onClick={() => setActivePair(h.symbol)}>
                        <div className="flex justify-between items-start mb-1">
                          <div>
                            <div className="font-mono font-semibold text-sm">{h.symbol}</div>
                            <div className="text-xs text-muted-foreground">Units {h.quantity} · Avg {h.avg_buy_price.toFixed(assetType === "forex" ? 5 : 2)}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-sm">{live.toFixed(assetType === "forex" ? 5 : 2)}</div>
                            <div className={`text-xs font-mono ${positive ? "text-green-500" : "text-red-500"}`}>
                              {positive ? "+" : ""}{pl.toFixed(2)} ({plPct.toFixed(2)}%)
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button onClick={(e) => { e.stopPropagation(); trade("sell", h.symbol, h.quantity); }}
                            className="flex-1 h-8 text-xs rounded-md bg-red-500/15 text-red-500 hover:bg-red-500/25 font-medium">
                            Close position
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="glass-card p-5">
              <h3 className="font-semibold mb-3 text-sm">Market Hours</h3>
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>Forex:</strong> Open 24/5 (Mon-Fri)</p>
                <p><strong>Crypto:</strong> Open 24/7</p>
                <p className="text-amber-500 mt-2">Trading halts during weekends for forex pairs.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ForexInvestor;
