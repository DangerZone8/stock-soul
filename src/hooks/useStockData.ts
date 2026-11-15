import { useEffect, useRef, useState } from 'react';
import { marketFunctionUrl } from '@/lib/market-data';

const useStockData = (symbol: string) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
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
        const endpoint = new URL(marketFunctionUrl("stock-quote"));
        endpoint.searchParams.set("symbol", symbol);
        const res = await fetch(endpoint.toString(), { cache: "no-store", signal: controller.signal });
        if (!res.ok) throw new Error(`Quote request failed (${res.status})`);
        const json = await res.json();
        const quote = json["Global Quote"];
        if (!quote || !quote["05. price"]) throw new Error("No quote data returned");
        if (!disposed && requestId === requestIdRef.current) setData(quote);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!disposed && requestId === requestIdRef.current) setError(err);
      } finally {
        if (!disposed && requestId === requestIdRef.current) setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => {
      disposed = true;
      controller?.abort();
      clearInterval(interval);
    };
  }, [symbol]);

  return { data, loading, error };
};

export default useStockData;
