import { useEffect, useRef, useState } from "react";
import { marketFunctionUrl } from "@/lib/market-data";

interface StockQuote {
  "05. price": string;
  "10. change percent": string;
  symbol: string;
  currency: string;
}

const useStockData = (symbol: string) => {
  const [data, setData] = useState<StockQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    let disposed = false;
    let controller: AbortController | null = null;

    const fetchData = async () => {
      controller?.abort();
      controller = new AbortController();
      const requestId = ++requestIdRef.current;
      try {
        setLoading(true);
        setError(null);
        const endpoint = new URL(marketFunctionUrl("stock-chart"));
        endpoint.searchParams.set("symbol", symbol);
        endpoint.searchParams.set("interval", "1d");
        endpoint.searchParams.set("range", "5d");
        const response = await fetch(endpoint.toString(), {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Quote request failed (${response.status})`);
        const quote = await response.json();
        if (quote.error) throw new Error(quote.error);
        const price = Number(quote.regularMarketPrice);
        const previousClose = Number(quote.previousClose);
        if (!Number.isFinite(price) || price <= 0) throw new Error("No valid quote returned");
        const changePercent = Number.isFinite(previousClose) && previousClose > 0
          ? ((price - previousClose) / previousClose) * 100
          : 0;
        if (!disposed && requestId === requestIdRef.current) {
          setData({
            "05. price": String(price),
            "10. change percent": `${changePercent.toFixed(2)}%`,
            symbol: quote.symbol || symbol,
            currency: quote.currency || "USD",
          });
        }
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        if (!disposed && requestId === requestIdRef.current) {
          setError(cause instanceof Error ? cause : new Error("Unable to load quote"));
        }
      } finally {
        if (!disposed && requestId === requestIdRef.current) setLoading(false);
      }
    };

    void fetchData();
    const interval = window.setInterval(fetchData, 30000);
    return () => {
      disposed = true;
      controller?.abort();
      window.clearInterval(interval);
    };
  }, [symbol]);

  return { data, loading, error };
};

export default useStockData;
