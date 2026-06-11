import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type YahooQuote = {
  symbol?: string;
};

// Simple in-memory per-IP rate limiter (60 req/min — chart endpoint is polled more often)
const RATE_LIMIT = 60;
const WINDOW_MS = 60_000;
const ipHits = new Map<string, { count: number; reset: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = ipHits.get(ip);
  if (!rec || rec.reset < now) {
    ipHits.set(ip, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  rec.count++;
  return rec.count > RATE_LIMIT;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";
  if (rateLimited(ip)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const searchQuery = url.searchParams.get("q");

    // Search mode: lookup ticker by company name or partial ticker
    if (searchQuery) {
      const sUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(searchQuery)}&quotesCount=5&newsCount=0`;
      const sRes = await fetch(sUrl, {
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      });
      if (!sRes.ok) throw new Error(`Search failed ${sRes.status}`);
      const sData = await sRes.json();
      const quotes = ((sData?.quotes || []) as YahooQuote[]).filter((quote) => quote.symbol);
      return new Response(JSON.stringify({ quotes }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const symbol = url.searchParams.get("symbol");
    const interval = url.searchParams.get("interval") || "1m";
    const range = url.searchParams.get("range") || "1d";

    if (!symbol || !/^[A-Za-z0-9.\-=^]{1,20}$/.test(symbol)) {
      return new Response(
        JSON.stringify({ error: "Invalid symbol" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
    const res = await fetch(yahooUrl, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    });

    if (!res.ok) {
      throw new Error(`Yahoo returned ${res.status}`);
    }

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) throw new Error("No chart data");

    const meta = result.meta;
    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];
    const volumes = result.indicators?.quote?.[0]?.volume || [];
    const opens = result.indicators?.quote?.[0]?.open || [];
    const highs = result.indicators?.quote?.[0]?.high || [];
    const lows = result.indicators?.quote?.[0]?.low || [];

    const response = {
      symbol: meta.symbol,
      currency: meta.currency,
      regularMarketPrice: meta.regularMarketPrice,
      previousClose: meta.chartPreviousClose ?? meta.previousClose,
      regularMarketTime: meta.regularMarketTime,
      timestamps,
      closes,
      volumes,
      opens,
      highs,
      lows,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
