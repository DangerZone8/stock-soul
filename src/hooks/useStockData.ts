import { useEffect, useState } from 'react';
import axios from 'axios';

const GLOBAL_QUOTE_API_URL = 'https://www.alphavantage.co/query?function=GLOBAL_QUOTE';
const API_KEY = 'VR3M1EVASXEFZP8R';

const useStockData = (symbol) => {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchStockData = async () => {
            try {
                const response = await axios.get(`${GLOBAL_QUOTE_API_URL}&symbol=${symbol}&apikey=${API_KEY}`);
                setData(response.data['Global Quote']);
            } catch (error) {
                setError(error);
            }
        };

        fetchStockData();
    }, [symbol]);

    return { data, error };
};

export default useStockData;