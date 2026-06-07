// Cron-invoked: fetches active alerts, checks prices via Yahoo, fires notifications.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UA = "Mozilla/5.0 (compatible; StockSoulAlerts/1.0)";

async function fetchQuotes(symbols: string[]): Promise<Record<string, number>> {
  if (!symbols.length) return {};
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(","))}`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (!r.ok) return {};
    const j = await r.json();
    const out: Record<string, number> = {};
    for (const q of j?.quoteResponse?.result ?? []) {
      if (q?.symbol && typeof q.regularMarketPrice === "number") {
        out[q.symbol] = q.regularMarketPrice;
      }
    }
    return out;
  } catch {
    return {};
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: alerts, error } = await supabase
    .from("price_alerts")
    .select("id,user_id,symbol,direction,target_price,notify_email")
    .eq("triggered", false)
    .limit(500);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!alerts?.length) {
    return new Response(JSON.stringify({ checked: 0, fired: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const symbols = Array.from(new Set(alerts.map(a => a.symbol)));
  // chunk to 40 per call
  const prices: Record<string, number> = {};
  for (let i = 0; i < symbols.length; i += 40) {
    const chunk = symbols.slice(i, i + 40);
    Object.assign(prices, await fetchQuotes(chunk));
  }

  let fired = 0;
  for (const a of alerts) {
    const px = prices[a.symbol];
    if (typeof px !== "number") continue;
    const hit = (a.direction === "above" && px >= a.target_price) ||
                (a.direction === "below" && px <= a.target_price);
    if (!hit) continue;

    const { error: updErr } = await supabase
      .from("price_alerts")
      .update({ triggered: true, triggered_at: new Date().toISOString(), triggered_price: px })
      .eq("id", a.id)
      .eq("triggered", false);
    if (updErr) continue;

    await supabase.from("notifications").insert({
      user_id: a.user_id,
      kind: "price_alert",
      title: `${a.symbol} hit ${a.direction} ${a.target_price}`,
      body: `Current price: ${px.toFixed(2)}. Your alert (${a.direction} ${a.target_price}) was triggered.`,
      link: `/live?symbol=${encodeURIComponent(a.symbol)}`,
    });
    fired++;
  }

  return new Response(JSON.stringify({ checked: alerts.length, fired }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
