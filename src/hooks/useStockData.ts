import { useEffect, useState } from 'react';

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

const useStockData = (symbol: string) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/stock-quote?symbol=${encodeURIComponent(symbol)}`
        );
        const json = await res.json();
        const quote = json['Global Quote'];
        if (quote && quote['05. price']) {
          setData(quote);
        } else {
          throw new Error('No data');
        }
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [symbol]);

  return { data, loading, error };
};

export default useStockData;
