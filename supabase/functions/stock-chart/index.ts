import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type YahooQuote = { symbol?: string };
type YahooChartResult = {
  meta?: {
    symbol?: string;
    currency?: string;
    regularMarketPrice?: number;
    chartPreviousClose?: number;
    previousClose?: number;
    regularMarketTime?: number;
  };
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      close?: (number | null)[];
      volume?: (number | null)[];
      open?: (number | null)[];
      high?: (number | null)[];
      low?: (number | null)[];
    }>;
  };
};
type YahooPayload = {
  chart?: {
    error?: { description?: string } | null;
    result?: YahooChartResult[] | null;
  };
  quotes?: YahooQuote[];
};

type CacheEntry = { expiresAt: number; payload: unknown };
const responseCache = new Map<string, CacheEntry>();
const CACHE_LIMIT = 250;

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": status === 200 ? "public, max-age=5, stale-while-revalidate=10" : "no-store",
    },
  });

const getCached = (key: string) => {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return null;
  }
  return entry.payload;
};

const setCached = (key: string, payload: unknown, ttlMs: number) => {
  if (responseCache.size >= CACHE_LIMIT) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) responseCache.delete(oldestKey);
  }
  responseCache.set(key, { payload, expiresAt: Date.now() + ttlMs });
};

const fetchYahooJson = async (path: string): Promise<YahooPayload> => {
  let lastError: Error | null = null;
  for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
    try {
      const response = await fetch(`https://${host}${path}`, {
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        lastError = new Error(`Yahoo Finance returned HTTP ${response.status}`);
        continue;
      }
      const payload = await response.json() as YahooPayload;
      if (payload?.chart?.error) {
        lastError = new Error(payload.chart.error.description || "Yahoo Finance returned a chart error");
        continue;
      }
      return payload;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Yahoo Finance request failed");
    }
  }
  throw lastError || new Error("Yahoo Finance is temporarily unavailable");
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const url = new URL(req.url);
    const searchQuery = url.searchParams.get("q")?.trim();

    if (searchQuery) {
      if (searchQuery.length > 80) return jsonResponse({ error: "Search query is too long" }, 400);
      const cacheKey = `search:${searchQuery.toLowerCase()}`;
      const cached = getCached(cacheKey);
      if (cached) return jsonResponse(cached);

      const params = new URLSearchParams({
        q: searchQuery,
        quotesCount: "8",
        newsCount: "0",
      });
      const payload = await fetchYahooJson(`/v1/finance/search?${params.toString()}`);
      const quotes = (payload?.quotes || [])
        .filter((quote) => typeof quote.symbol === "string" && quote.symbol.length > 0)
        .slice(0, 8);
      const result = { quotes };
      setCached(cacheKey, result, 60_000);
      return jsonResponse(result);
    }

    const symbol = url.searchParams.get("symbol")?.trim();
    const interval = url.searchParams.get("interval") || "1m";
    const range = url.searchParams.get("range") || "1d";
    const allowedIntervals = new Set(["1m", "2m", "5m", "15m", "30m", "60m", "90m", "1d", "5d", "1wk", "1mo", "3mo"]);
    const allowedRanges = new Set(["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"]);

    if (!symbol || !/^[A-Za-z0-9.\-=^]{1,20}$/.test(symbol)) {
      return jsonResponse({ error: "Invalid symbol" }, 400);
    }
    if (!allowedIntervals.has(interval) || !allowedRanges.has(range)) {
      return jsonResponse({ error: "Unsupported chart interval or range" }, 400);
    }

    const cacheKey = `chart:${symbol.toUpperCase()}:${interval}:${range}`;
    const cached = getCached(cacheKey);
    if (cached) return jsonResponse(cached);

    const params = new URLSearchParams({ interval, range });
    const payload = await fetchYahooJson(`/v8/finance/chart/${encodeURIComponent(symbol)}?${params.toString()}`);
    const result = payload?.chart?.result?.[0];
    if (!result) throw new Error("No chart data returned for this ticker");

    const meta = result.meta || {};
    const quote = result.indicators?.quote?.[0] || {};
    const timestamps = result.timestamp || [];
    const closes = quote.close || [];
    const volumes = quote.volume || [];
    const validCloses = closes.filter((value: number | null) => Number.isFinite(value));
    const regularMarketPrice = Number(meta.regularMarketPrice ?? validCloses.at(-1));

    if (!Number.isFinite(regularMarketPrice) || regularMarketPrice <= 0) {
      throw new Error(`No valid market price is currently available for ${symbol}`);
    }

    const response = {
      symbol: meta.symbol || symbol.toUpperCase(),
      currency: meta.currency || "USD",
      regularMarketPrice,
      previousClose: Number(meta.chartPreviousClose ?? meta.previousClose ?? regularMarketPrice),
      regularMarketTime: meta.regularMarketTime,
      timestamps,
      closes,
      volumes,
      opens: quote.open || [],
      highs: quote.high || [],
      lows: quote.low || [],
    };

    setCached(cacheKey, response, interval === "1m" ? 10_000 : 30_000);
    return jsonResponse(response);
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : "Market data service failed",
    }, 502);
  }
});
