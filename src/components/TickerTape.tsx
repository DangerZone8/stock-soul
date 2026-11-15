import { useEffect, useRef, useState } from "react";
import { marketFunctionUrl } from "@/lib/market-data";

const DEFAULT_SYMBOLS = ["AAPL", "TSLA", "NVDA", "SPY", "AMZN", "MSFT", "GOOGL", "META", "BTC-USD", "ETH-USD", "QQQ", "AMD"];
const REFRESH_MS = 30000;

interface MarketQuote {
  symbol: string;
  currency: string;
  regularMarketPrice: number;
  previousClose: number;
}

const displaySymbol = (symbol: string) => symbol.replace(/-USD$/, "");

function TickerItem({ symbol, quote }: { symbol: string; quote?: MarketQuote }) {
  const price = quote?.regularMarketPrice;
  const previousClose = quote?.previousClose;
  const changePercent = price != null && previousClose != null && previousClose > 0
    ? ((price - previousClose) / previousClose) * 100
    : null;
  const isUp = (changePercent ?? 0) >= 0;
  const formattedPrice = price != null && Number.isFinite(price)
    ? new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: quote?.currency || "USD",
        maximumFractionDigits: price < 10 ? 4 : 2,
      }).format(price)
    : "—";

  return (
    <span className="font-mono text-xs flex items-center gap-1.5 shrink-0" title={quote ? `Last refreshed market quote for ${symbol}` : `Waiting for market data for ${symbol}`}>
      <span className="text-muted-foreground font-semibold">{displaySymbol(symbol)}</span>
      <span className="text-foreground/60">{formattedPrice}</span>
      {changePercent != null && (
        <span className={isUp ? "ticker-positive" : "ticker-negative"}>
          {isUp ? "▲" : "▼"} {Math.abs(changePercent).toFixed(2)}%
        </span>
      )}
    </span>
  );
}

export function TickerTape() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const requestInFlight = useRef(false);
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({});

  useEffect(() => {
    let disposed = false;
    const fetchQuotes = async () => {
      if (requestInFlight.current) return;
      requestInFlight.current = true;
      try {
        const results = await Promise.all(DEFAULT_SYMBOLS.map(async (symbol) => {
          const endpoint = new URL(marketFunctionUrl("stock-chart"));
          endpoint.searchParams.set("symbol", symbol);
          endpoint.searchParams.set("interval", "1d");
          endpoint.searchParams.set("range", "5d");
          const response = await fetch(endpoint.toString(), { cache: "no-store" });
          if (!response.ok) throw new Error(`Quote request failed for ${symbol}`);
          const quote = await response.json() as MarketQuote & { error?: string };
          if (quote.error || quote.symbol !== symbol || !Number.isFinite(quote.regularMarketPrice)) {
            throw new Error(`Invalid quote returned for ${symbol}`);
          }
          return [symbol, quote] as const;
        }));
        if (!disposed) {
          setQuotes(previous => ({ ...previous, ...Object.fromEntries(results) }));
        }
      } catch {
        // Retain the last successful quotes; unavailable quotes stay blank.
      } finally {
        requestInFlight.current = false;
      }
    };

    void fetchQuotes();
    const interval = window.setInterval(fetchQuotes, REFRESH_MS);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    let animationId = 0;
    let position = 0;
    let previousFrame = 0;
    const speed = 28; // pixels per second

    const animate = (timestamp: number) => {
      const delta = previousFrame ? Math.min(timestamp - previousFrame, 50) : 0;
      previousFrame = timestamp;
      position -= (speed * delta) / 1000;
      const loopWidth = element.scrollWidth / 2;
      if (loopWidth > 0 && Math.abs(position) >= loopWidth) position = 0;
      element.style.transform = `translate3d(${position}px, 0, 0)`;
      animationId = window.requestAnimationFrame(animate);
    };

    animationId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(animationId);
  }, []);

  return (
    <div className="w-full overflow-hidden bg-card/30 border-b border-border/30 py-2.5 backdrop-blur-md">
      <div ref={scrollRef} className="flex w-max whitespace-nowrap gap-8 will-change-transform">
        <div className="flex shrink-0 gap-8">
          {DEFAULT_SYMBOLS.map(symbol => <TickerItem key={symbol} symbol={symbol} quote={quotes[symbol]} />)}
        </div>
        <div className="flex shrink-0 gap-8" aria-hidden="true">
          {DEFAULT_SYMBOLS.map(symbol => <TickerItem key={symbol} symbol={symbol} quote={quotes[symbol]} />)}
        </div>
      </div>
    </div>
  );
}
