import { useEffect, useRef, useState } from "react";
import useStockData from "@/hooks/useStockData";

const DEFAULT_SYMBOLS = ["TSLA", "NVDA", "MSFT", "AMZN", "GOOG", "META"];

const FALLBACK_DATA = [
  { symbol: "TSLA", value: "178.22", change: 2.3 },
  { symbol: "NVDA", value: "124.60", change: 1.8 },
  { symbol: "MSFT", value: "415.30", change: -0.4 },
  { symbol: "AMZN", value: "182.50", change: 1.1 },
  { symbol: "GOOG", value: "155.72", change: -0.7 },
  { symbol: "META", value: "505.15", change: 3.2 },
];

function TickerItem({ symbol }: { symbol: string }) {
  const { data, loading, error } = useStockData(symbol);

  if (loading || error || !data) {
    const fb = FALLBACK_DATA.find(f => f.symbol === symbol);
    if (!fb) return null;
    return (
      <span className="font-mono text-xs flex items-center gap-1.5 shrink-0">
        <span className="text-muted-foreground font-semibold">{fb.symbol}</span>
        <span className="text-foreground/60">${fb.value}</span>
        <span className={fb.change >= 0 ? "ticker-positive" : "ticker-negative"}>
          {fb.change >= 0 ? "▲" : "▼"} {Math.abs(fb.change).toFixed(2)}%
        </span>
      </span>
    );
  }

  const price = parseFloat(data['05. price']).toFixed(2);
  const changePercent = parseFloat(data['10. change percent']).toFixed(2);
  const isUp = parseFloat(changePercent) >= 0;

  return (
    <span className="font-mono text-xs flex items-center gap-1.5 shrink-0">
      <span className="text-muted-foreground font-semibold">{symbol}</span>
      <span className="text-foreground/60">${price}</span>
      <span className={isUp ? "ticker-positive" : "ticker-negative"}>
        {isUp ? "▲" : "▼"} {Math.abs(parseFloat(changePercent))}%
      </span>
    </span>
  );
}

export function TickerTape() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const allSymbols = [...DEFAULT_SYMBOLS, ...DEFAULT_SYMBOLS];

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let animationId: number;
    let pos = 0;
    const speed = 0.5;

    const animate = () => {
      pos -= speed;
      if (Math.abs(pos) >= el.scrollWidth / 2) pos = 0;
      el.style.transform = `translateX(${pos}px)`;
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, []);

  return (
    <div className="w-full overflow-hidden bg-card/30 border-b border-border/30 py-2.5 backdrop-blur-md">
      <div ref={scrollRef} className="flex whitespace-nowrap gap-8">
        {allSymbols.map((symbol, i) => (
          <TickerItem key={`${symbol}-${i}`} symbol={symbol} />
        ))}
      </div>
    </div>
  );
}
        const latestTime = times[0];
        const latestData = timeSeries[latestTime];
        const latestPrice = parseFloat(latestData['4. close']);

        // Calculate change (using a simple approach - comparing with first available data)
        const oldestTime = times[times.length - 1];
        const oldestData = timeSeries[oldestTime];
        const oldestPrice = parseFloat(oldestData['4. close']);
        const change = ((latestPrice - oldestPrice) / oldestPrice) * 100;

        return {
          symbol: result.symbol,
          value: latestPrice.toFixed(2),
          change: parseFloat(change.toFixed(2))
        };
      });

      setDisplayData(transformed);
    }
  }, [stockDataResults]);

  // Ticker animation
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || displayData.length === 0) return;
    let animationId: number;
    let pos = 0;
    const speed = 0.5;

    const animate = () => {
      pos -= speed;
      if (Math.abs(pos) >= el.scrollWidth / 2) pos = 0;
      el.style.transform = `translateX(${pos}px)`;
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [displayData]);

  const items = [...displayData, ...displayData];

  return (
    <div className="w-full overflow-hidden bg-card/30 border-b border-border/30 py-2.5 backdrop-blur-md">
      <div className="text-center py-2 text-xs text-muted-foreground">
        {loadingCount < DEFAULT_SYMBOLS.length && `Loading: ${loadingCount}/${DEFAULT_SYMBOLS.length}`}
      </div>
      <div ref={scrollRef} className="flex whitespace-nowrap gap-8">
        {items.length === 0 ? (
          <div className="w-full text-center py-2 text-xs text-muted-foreground">Loading real-time data...</div>
        ) : (
          items.map((item, i) => (
            <span key={`${item.symbol}-${i}`} className="font-mono text-xs flex items-center gap-1.5">
              <span className="text-muted-foreground font-semibold">{item.symbol}</span>
              <span className="text-foreground/60">${item.value}</span>
              <span className={item.change > 0 ? "ticker-positive" : "ticker-negative"}>
                {item.change > 0 ? "▲" : "▼"} {Math.abs(item.change)}%
              </span>
            </span>
          ))
        )}
      </div>
    </div>
  );
}