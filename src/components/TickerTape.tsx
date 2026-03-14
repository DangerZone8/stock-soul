import { useEffect, useRef, useState } from "react";
import useStockData from "@/hooks/useStockData";

const DEFAULT_SYMBOLS = ["AAPL", "TSLA", "NVDA", "MSFT", "AMZN", "GOOG", "META", "BTC", "ETH", "SPY", "QQQ"];

export function TickerTape() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [displayData, setDisplayData] = useState<any[]>([]);
  const [loadingCount, setLoadingCount] = useState(0);

  // Fetch data for all symbols
  const stockDataResults = DEFAULT_SYMBOLS.map(symbol => ({
    symbol,
    ...useStockData(symbol)
  }));

  useEffect(() => {
    // Check if all data is loaded
    const allLoaded = stockDataResults.every(result => !result.loading);
    const loadedCount = stockDataResults.filter(result => !result.loading).length;
    setLoadingCount(loadedCount);

    if (allLoaded) {
      // Transform the data to match the original format
      const transformed = stockDataResults.map(result => {
        if (result.error || !result.data) {
          return {
            symbol: result.symbol,
            value: "N/A",
            change: 0
          };
        }

        // Get the latest price from the intraday data
        const timeSeries = result.data;
        const times = Object.keys(timeSeries);
        if (times.length === 0) {
          return {
            symbol: result.symbol,
            value: "N/A",
            change: 0
          };
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