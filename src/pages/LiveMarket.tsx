import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Search, TrendingUp, TrendingDown, RefreshCw, Clock, DollarSign, BarChart3, Volume2 } from "lucide-react";
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
  timestamps: number[];
  closes: (number | null)[];
  volumes: (number | null)[];
}

const LiveMarket = () => {
  const [query, setQuery] = useState("");
  const [activeTicker, setActiveTicker] = useState("NVDA");
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchChart = useCallback(async (symbol: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/stock-chart?symbol=${encodeURIComponent(symbol)}&interval=1m&range=1d`
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setChartData(data);
      setLastUpdated(new Date());
    } catch (e: any) {
      setError(e.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChart(activeTicker);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => fetchChart(activeTicker), 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeTicker, fetchChart]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    const looksLikeTicker = /^[A-Za-z0-9.\-]{1,15}$/.test(q) && !q.includes(" ");
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

  // Build chart
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
          label: (ctx: any) => `${chartData?.currency ?? "$"} ${Number(ctx.raw).toFixed(2)}`,
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

  return (
    <div className="min-h-screen bg-background">
      <CandlestickBackground />
      <Navbar />

      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 relative z-10">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-primary" strokeWidth={1.5} />
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Live Data</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tighter">
            Live <span className="text-primary">Market</span>
          </h1>
          <p className="text-muted-foreground mt-2">Real-time prices & charts. Auto-updates every 60s.</p>
        </motion.div>

        {/* Search */}
        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onSubmit={handleSearch}
          className="mb-6"
        >
          <div className="relative max-w-2xl">
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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap gap-2 mb-8"
        >
          {POPULAR_TICKERS.map(t => (
            <button
              key={t.symbol}
              onClick={() => setActiveTicker(t.symbol)}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
                activeTicker === t.symbol
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/30"
              }`}
            >
              {t.label}
            </button>
          ))}
        </motion.div>

        {/* Price Header */}
        {chartData && !error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6 sm:p-8 mb-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <div className="text-sm text-muted-foreground font-mono mb-1">{chartData.symbol}</div>
                <div className="text-4xl sm:text-5xl font-bold tracking-tight font-mono">
                  {chartData.currency === "INR" ? "₹" : "$"}{price.toFixed(2)}
                </div>
                <div className={`flex items-center gap-2 mt-2 text-lg font-medium ${isPositive ? "text-green-500" : "text-red-500"}`}>
                  {isPositive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                  <span>{isPositive ? "+" : ""}{change.toFixed(2)} ({isPositive ? "+" : ""}{changePercent.toFixed(2)}%)</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 sm:gap-6 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="w-4 h-4" />
                  <span>Prev Close: {prevClose.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Volume2 className="w-4 h-4" />
                  <span>Vol: {(totalVolume / 1e6).toFixed(1)}M</span>
                </div>
                {lastUpdated && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
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
          transition={{ delay: 0.3 }}
          className="glass-card p-4 sm:p-6 mb-8"
        >
          {loading && !chartData && (
            <div className="h-[400px] flex items-center justify-center text-muted-foreground">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Loading chart...
            </div>
          )}
          {error && (
            <div className="h-[400px] flex items-center justify-center text-destructive">
              {error}. Try a different ticker.
            </div>
          )}
          {chartData && !error && (
            <div className="h-[350px] sm:h-[450px]">
              <Line data={chartConfig} options={chartOptions} />
            </div>
          )}
        </motion.div>
      </div>

      <Footer />
    </div>
  );
};

export default LiveMarket;
