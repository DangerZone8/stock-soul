import { useEffect, useState } from 'react';

const ALPHA_VANTAGE_API_KEY = 'VR3M1EVASXEFZP8R';
const ALPHA_VANTAGE_URL = 'https://www.alphavantage.co/query';

const useStockData = (symbol) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchStockData = async () => {
            try {
                setLoading(true);
                const response = await fetch(`${ALPHA_VANTAGE_URL}?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=1min&apikey=${ALPHA_VANTAGE_API_KEY}`);
                const result = await response.json();
                if (result['Time Series (1min)']) {
                    setData(result['Time Series (1min)']);
                } else {
                    throw new Error('Error fetching stock data');
                }
            } catch (err) {
                setError(err);
            } finally {
                setLoading(false);
            }
        };

        fetchStockData();
    }, [symbol]);

    return { data, loading, error };
};

export default useStockData;