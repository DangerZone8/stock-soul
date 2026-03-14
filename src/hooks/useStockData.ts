import { useEffect, useState } from 'react';

const API_URL = 'https://www.alphavantage.co/query?function=GLOBAL_QUOTE';
const API_KEY = 'VR3M1EVASXEFZP8R';

const useStockData = (symbol: string) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}&symbol=${symbol}&apikey=${API_KEY}`);
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