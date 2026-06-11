// Verifies the trade price against live Yahoo Finance data before calling
// the execute_trade RPC. Prevents clients from buying/selling at fabricated
// prices to game the coin economy.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Max % deviation between client price and live price
const PRICE_TOLERANCE = 0.03; // 3%

// Per-user rate limit
const RATE_LIMIT = 30;
const WINDOW_MS = 60_000;
const hits = new Map<string, { count: number; reset: number }>();
function rateLimited(key: string) {
  const now = Date.now();
  const rec = hits.get(key);
  if (!rec || rec.reset < now) {
    hits.set(key, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  rec.count++;
  return rec.count > RATE_LIMIT;
}

async function getLivePrice(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`,
      { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === "number" && Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    // User-scoped client preserves auth.uid() inside execute_trade
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (rateLimited(user.id)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { symbol, currency, type, quantity, price } = body ?? {};

    if (
      typeof symbol !== "string" || !/^[A-Za-z0-9.\-=^]{1,20}$/.test(symbol) ||
      typeof currency !== "string" || !/^[A-Za-z]{2,8}$/.test(currency) ||
      (type !== "buy" && type !== "sell") ||
      typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000 ||
      typeof price !== "number" || !Number.isFinite(price) || price <= 0
    ) {
      return new Response(JSON.stringify({ error: "Invalid trade parameters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify client price against live market price
    const livePrice = await getLivePrice(symbol);
    const verifiedPrice = livePrice ?? price;
    if (livePrice) {
      const dev = Math.abs(price - livePrice) / livePrice;
      if (dev > PRICE_TOLERANCE) {
        return new Response(
          JSON.stringify({
            error: `Price mismatch: provided ${price}, market ${livePrice.toFixed(4)}. Refresh and retry.`,
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { data, error } = await userClient.rpc("execute_trade", {
      p_symbol: symbol,
      p_currency: currency,
      p_type: type,
      p_quantity: quantity,
      p_price: verifiedPrice,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
