import { useEffect, useRef } from "react";

const TICKER_DATA = [
  { symbol: "AAPL", value: "189.84", change: 2.3 },
  { symbol: "TSLA", value: "248.42", change: -1.7 },
  { symbol: "NVDA", value: "875.28", change: 4.1 },
  { symbol: "MSFT", value: "415.60", change: 1.2 },
  { symbol: "AMZN", value: "185.07", change: -0.8 },
  { symbol: "GOOG", value: "141.80", change: 0.6 },
  { symbol: "META", value: "505.95", change: 3.2 },
  { symbol: "BTC", value: "67,842", change: 5.4 },
  { symbol: "ETH", value: "3,485", change: -2.1 },
  { symbol: "SPY", value: "519.23", change: 0.9 },
  { symbol: "QQQ", value: "449.12", change: 1.5 },
  { symbol: "SOUL", value: "∞", change: 99.9 },
];

export function TickerTape() {
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const items = [...TICKER_DATA, ...TICKER_DATA];

  return (
    <div className="w-full overflow-hidden bg-card/30 border-b border-border/30 py-2.5 backdrop-blur-md">
      <div ref={scrollRef} className="flex whitespace-nowrap gap-8">
        {items.map((item, i) => (
          <span key={`${item.symbol}-${i}`} className="font-mono text-xs flex items-center gap-1.5">
            <span className="text-muted-foreground font-semibold">{item.symbol}</span>
            <span className="text-foreground/60">${item.value}</span>
            <span className={item.change > 0 ? "ticker-positive" : "ticker-negative"}>
              {item.change > 0 ? "▲" : "▼"} {Math.abs(item.change)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
