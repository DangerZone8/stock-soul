import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Search, TrendingUp, TrendingDown, RefreshCw, Clock, DollarSign, BarChart3, Volume2, Sparkles, Heart, Newspaper } from "lucide-react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
} from "chart.js";
import { Navbar } from "@/components/Navbar";
import { CandlestickBackground } from "@/components/CandlestickBackground";
import { Footer } from "@/components/Footer";
import { DreamGirlChat } from "@/components/DreamGirlChat";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler);

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

const POPULAR_TICKERS = [
  { label: "NVIDIA", symbol: "NVDA" },
  { label: "Reliance", symbol: "RELIANCE.NS" },
  { label: "Bitcoin", symbol: "BTC-USD" },
  { label: "Tesla", symbol: "TSLA" },
  { label: "Apple", symbol: "AAPL" },
  { label: "Ethereum", symbol: "ETH-USD" },
  { label: "TCS", symbol: "TCS.NS" },
  { label: "Microsoft", symbol: "MSFT" },
];

interface ChartData {
  symbol: string;
  currency: string;
  regularMarketPrice: number;
  previousClose: number;
  regularMarketTime?: number;
  timestamps: number[];
  closes: (number | null)[];
  volumes: (number | null)[];
}

interface KaiaTip {
  action: "strong_buy" | "buy" | "hold" | "sell" | "strong_sell";
  sentiment: "bullish" | "neutral" | "bearish";
  move_reason: string;
  take: string;
  headlines?: string[];
}

const LIVE_REFRESH_MS = 30000;
const TIP_REFRESH_MS = 90000;
const MAX_LIVE_POINTS = 240;

const buildLiveChartData = (incoming: ChartData, previous?: ChartData | null): ChartData => {
  const base = previous?.symbol === incoming.symbol ? previous : incoming;
  const timestamps = [...(base.timestamps || [])];
  const closes = [...(base.closes || [])];
  const volumes = [...(base.volumes || [])];
  const incomingPoints = (incoming.timestamps || []).map((ts, index) => ({
    timestamp: ts,
    close: incoming.closes?.[index] ?? null,
    volume: incoming.volumes?.[index] ?? null,
  })).filter(point => point.close != null && Number.isFinite(point.close));

  incomingPoints.forEach(point => {
    const existingIndex = timestamps.indexOf(point.timestamp);
    if (existingIndex >= 0) {
      closes[existingIndex] = point.close;
      volumes[existingIndex] = point.volume;
    } else {
      timestamps.push(point.timestamp);
      closes.push(point.close);
      volumes.push(point.volume);
    }
  });

  const liveTimestamp = Math.floor(Date.now() / 1000);
  const livePrice = incoming.regularMarketPrice;
  if (Number.isFinite(livePrice)) {
    timestamps.push(liveTimestamp);
    closes.push(livePrice);
    volumes.push(incoming.volumes?.at(-1) ?? null);
  }

  const sorted = timestamps.map((timestamp, index) => ({
    timestamp,
    close: closes[index],
    volume: volumes[index],
  })).filter(point => point.close != null && Number.isFinite(point.close as number))
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-MAX_LIVE_POINTS);

  return {
    ...incoming,
    timestamps: sorted.map(point => point.timestamp),
    closes: sorted.map(point => point.close),
    volumes: sorted.map(point => point.volume),
  };
};

const LiveMarket = () => {
  const [query, setQuery] = useState("");
  const [activeTicker, setActiveTicker] = useState("NVDA");
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [tip, setTip] = useState<KaiaTip | null>(null);
  const [tipLoading, setTipLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tipIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFetchingRef = useRef(false);
  const isFetchingTipRef = useRef(false);

  const fetchChart = useCallback(async (symbol: string, mode: "initial" | "live" = "live") => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (mode === "initial") setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/stock-chart?symbol=${encodeURIComponent(symbol)}&interval=1m&range=1d&t=${Date.now()}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json() as ChartData & { error?: string };
      if (data.error) throw new Error(data.error);
      setChartData(prev => buildLiveChartData(data, mode === "live" ? prev : null));
      setLastUpdated(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch data");
    } finally {
      if (mode === "initial") setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  const fetchTip = useCallback(async (symbol: string, price: number, changePercent: number, currency: string) => {
    if (isFetchingTipRef.current) return;
    if (!Number.isFinite(price) || price <= 0) return;
    isFetchingTipRef.current = true;
    setTipLoading(true);
    try {
      const res = await fetch(
        `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/kaia-tip`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ symbol, price, changePercent, currency }),
        }
      );
      if (!res.ok) throw new Error("tip failed");
      const data = await res.json();
      if (!data.error) setTip(data);
    } catch {
      /* silent */
    } finally {
      setTipLoading(false);
      isFetchingTipRef.current = false;
    }
  }, []);

  useEffect(() => {
    setTip(null);
    fetchChart(activeTicker, "initial");
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => fetchChart(activeTicker, "live"), LIVE_REFRESH_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeTicker, fetchChart]);

  // Refresh Kaia's tip when chart data updates (throttled)
  useEffect(() => {
    if (!chartData) return;
    const price = chartData.regularMarketPrice;
    const prev = chartData.previousClose ?? price;
    const pct = prev > 0 ? ((price - prev) / prev) * 100 : 0;
    fetchTip(chartData.symbol, price, pct, chartData.currency);
    if (tipIntervalRef.current) clearInterval(tipIntervalRef.current);
    tipIntervalRef.current = setInterval(() => {
      const cur = chartData.regularMarketPrice;
      const cprev = chartData.previousClose ?? cur;
      const cpct = cprev > 0 ? ((cur - cprev) / cprev) * 100 : 0;
      fetchTip(chartData.symbol, cur, cpct, chartData.currency);
    }, TIP_REFRESH_MS);
    return () => {
      if (tipIntervalRef.current) clearInterval(tipIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartData?.symbol]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    const looksLikeTicker = /^[A-Z0-9]{1,6}([.-][A-Z0-9]{1,6})?$/.test(q);
    if (looksLikeTicker) {
      setActiveTicker(q.toUpperCase());
      setQuery("");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/stock-chart?q=${encodeURIComponent(q)}`
      );
      const data = await res.json();
      const first = data?.quotes?.[0]?.symbol;
      if (first) {
        setActiveTicker(first);
        setQuery("");
      } else {
        setError(`No match found for "${q}"`);
      }
    } catch {
      setError("Search failed. Try a ticker symbol.");
    } finally {
      setLoading(false);
    }
  };

  const price = chartData?.regularMarketPrice ?? 0;
  const prevClose = chartData?.previousClose ?? price;
  const change = price - prevClose;
  const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
  const isPositive = change >= 0;

  const validPoints = (chartData?.timestamps || []).map((ts, i) => ({
    time: new Date(ts * 1000),
    close: chartData?.closes?.[i],
    vol: chartData?.volumes?.[i],
  })).filter(p => p.close != null && Number.isFinite(p.close as number));

  const labels = validPoints.map(p =>
    p.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );

  const lineColor = isPositive ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)";
  const bgColor = isPositive ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)";

  const chartConfig = {
    labels,
    datasets: [
      {
        data: validPoints.map(p => p.close),
        borderColor: lineColor,
        backgroundColor: bgColor,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 800, easing: "easeOutQuart" as const },
    interaction: { intersect: false, mode: "index" as const },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(0,0,0,0.8)",
        titleColor: "#fff",
        bodyColor: "#fff",
        padding: 12,
        displayColors: false,
        callbacks: {
          label: (ctx: { raw: unknown }) => `${chartData?.currency ?? "$"} ${Number(ctx.raw).toFixed(2)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "rgba(150,150,150,0.6)", maxTicksLimit: 8, font: { size: 10 } },
      },
      y: {
        grid: { color: "rgba(150,150,150,0.1)" },
        ticks: { color: "rgba(150,150,150,0.6)", font: { size: 10 } },
      },
    },
  };

  const totalVolume = validPoints.reduce((s, p) => s + ((p.vol as number) || 0), 0);

  const actionStyles: Record<string, string> = {
    buy: "bg-green-500/15 text-green-500 border-green-500/30",
    hold: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
    sell: "bg-red-500/15 text-red-500 border-red-500/30",
  };

  return (
    <div className="min-h-screen bg-background">
      <CandlestickBackground />
      <Navbar />

      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 relative z-10">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-primary" strokeWidth={1.5} />
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Live Data + Kaia AI</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tighter">
            Live <span className="text-primary">Market</span>
          </h1>
          <p className="text-muted-foreground mt-2">Real-time prices, charts & Kaia's smart tips. Auto-updates every 30s.</p>
        </motion.div>

        {/* Split layout: chart left, Kaia right */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: Search + Chart + Tip */}
          <div className="lg:col-span-2 space-y-6">
            {/* Search */}
            <motion.form
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleSearch}
            >
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search any stock or crypto... (NVDA, BTC-USD, RELIANCE.NS)"
                  className="w-full h-14 pl-12 pr-4 rounded-xl bg-secondary/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-base transition-all"
                />
              </div>
            </motion.form>

            {/* Popular Tickers */}
            <div className="flex flex-wrap gap-2">
              {POPULAR_TICKERS.map(t => (
                <button
                  key={t.symbol}
                  onClick={() => setActiveTicker(t.symbol)}
                  className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    activeTicker === t.symbol
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/30"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Price Header */}
            {chartData && !error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-5 sm:p-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground font-mono mb-1">{chartData.symbol}</div>
                    <div className="text-3xl sm:text-4xl font-bold tracking-tight font-mono">
                      {chartData.currency === "INR" ? "₹" : "$"}{price.toFixed(2)}
                    </div>
                    <div className={`flex items-center gap-2 mt-2 text-base font-medium ${isPositive ? "text-green-500" : "text-red-500"}`}>
                      {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      <span>{isPositive ? "+" : ""}{change.toFixed(2)} ({isPositive ? "+" : ""}{changePercent.toFixed(2)}%)</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 sm:gap-4 text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>Prev: {prevClose.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Vol: {(totalVolume / 1e6).toFixed(1)}M</span>
                    </div>
                    {lastUpdated && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{lastUpdated.toLocaleTimeString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Chart */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-4 sm:p-6"
            >
              {loading && !chartData && (
                <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                  <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Loading chart...
                </div>
              )}
              {error && (
                <div className="h-[350px] flex items-center justify-center text-destructive">
                  {error}. Try a different ticker.
                </div>
              )}
              {chartData && !error && (
                <div className="h-[300px] sm:h-[400px]">
                  <Line data={chartConfig} options={chartOptions} />
                </div>
              )}
            </motion.div>

            {/* Kaia's Tip */}
            {chartData && !error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-5 sm:p-6"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-sm">Kaia's Take on {chartData.symbol}</h3>
                  {tipLoading && <RefreshCw className="w-3 h-3 animate-spin text-muted-foreground" />}
                </div>

                {!tip && !tipLoading && (
                  <p className="text-sm text-muted-foreground">Analyzing live data...</p>
                )}

                {tip && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${actionStyles[tip.action] || actionStyles.hold}`}>
                        {tip.action}
                      </span>
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-secondary/50 border border-border/40 text-muted-foreground capitalize">
                        Sentiment: {tip.sentiment}
                      </span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{tip.take}</p>
                    <div className="text-xs text-muted-foreground border-t border-border/30 pt-2">
                      <span className="font-semibold text-foreground">Why it's moving: </span>{tip.move_reason}
                    </div>
                    {tip.headlines && tip.headlines.length > 0 && (
                      <div className="pt-2 border-t border-border/30">
                        <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground mb-2">
                          <Newspaper className="w-3 h-3" /> Latest headlines
                        </div>
                        <ul className="space-y-1">
                          {tip.headlines.slice(0, 4).map((h, i) => (
                            <li key={i} className="text-xs text-muted-foreground leading-relaxed">• {h}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* RIGHT: Kaia Chat */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1"
          >
            <div className="lg:sticky lg:top-20">
              <div className="flex items-center gap-2 mb-3">
                <Heart className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-sm">Chat with Kaia</h2>
              </div>
              <DreamGirlChat />
            </div>
          </motion.div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default LiveMarket;
