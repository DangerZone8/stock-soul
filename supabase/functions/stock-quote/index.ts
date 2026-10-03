import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CRYPTO_SYMBOL_MAP: Record<string, string> = {
  BTC: "BTC-USD",
  ETH: "ETH-USD",
};

const buildQuotePayload = (symbol: string, price: number, previousClose?: number) => {
  const safePreviousClose =
    typeof previousClose === "number" && Number.isFinite(previousClose) && previousClose > 0
      ? previousClose
      : price;
  const change = price - safePreviousClose;
  const changePercent = safePreviousClose > 0 ? (change / safePreviousClose) * 100 : 0;

  return {
    "Global Quote": {
      "01. symbol": symbol,
      "05. price": price.toFixed(2),
      "09. change": change.toFixed(2),
      "10. change percent": `${changePercent.toFixed(2)}%`,
    },
    source: "yahoo-finance",
  };
};

async function fetchYahooQuote(symbol: string) {
  const yahooSymbol = CRYPTO_SYMBOL_MAP[symbol] ?? symbol;
  let res: Response | null = null;
  let lastErr: unknown = null;
  for (const host of ["query1", "query2", "query1", "query2"]) {
    try {
      const r = await fetch(
        `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=2d`,
        { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" } }
      );
      if (r.ok) { res = r; break; }
      lastErr = new Error(`Yahoo status ${r.status}`);
    } catch (e) {
      lastErr = e;
    }
    await new Promise((ok) => setTimeout(ok, 250));
  }
  if (!res) throw lastErr ?? new Error("Yahoo unavailable");

  const data = await res.json();
  const meta = data?.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  const previousClose = meta?.chartPreviousClose ?? meta?.previousClose;

  if (typeof price !== "number" || !Number.isFinite(price)) {
    throw new Error("Yahoo quote missing price");
  }

  return buildQuotePayload(symbol, price, previousClose);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const symbol = url.searchParams.get("symbol");

    if (!symbol || !/^[A-Z]{1,10}$/.test(symbol)) {
      return new Response(
        JSON.stringify({ error: "Invalid symbol" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const API_KEY = Deno.env.get("ALPHAVANTAGE_API_KEY");
    if (API_KEY) {
      const res = await fetch(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${API_KEY}`
      );
      const data = await res.json();

      if (data?.["Global Quote"]?.["05. price"]) {
        return new Response(JSON.stringify({ ...data, source: "alpha-vantage" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const fallbackData = await fetchYahooQuote(symbol);

    return new Response(JSON.stringify(fallbackData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Price temporarily unavailable", unavailable: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
