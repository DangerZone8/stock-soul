import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchNewsHeadlines(symbol: string): Promise<string[]> {
  try {
    const q = encodeURIComponent(`${symbol} stock news`);
    const res = await fetch(`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const titles: string[] = [];
    const itemRegex = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && titles.length < 5) {
      const title = match[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
      if (title) titles.push(title);
    }
    return titles;
  } catch {
    return [];
  }
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 30) return false;
  entry.count++;
  return true;
}

// Compute simple technicals from a closes array
function computeTechnicals(closes: number[], volumes: number[]) {
  const c = closes.filter((x) => Number.isFinite(x));
  if (c.length < 5) return null;
  const last = c[c.length - 1];
  const first = c[0];
  const high = Math.max(...c);
  const low = Math.min(...c);
  const sma = (n: number) => {
    if (c.length < n) return null;
    const slice = c.slice(-n);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  };
  const sma10 = sma(10);
  const sma30 = sma(30);
  const sma50 = sma(50);
  // RSI(14)
  let rsi: number | null = null;
  if (c.length >= 15) {
    let gains = 0, losses = 0;
    const window = c.slice(-15);
    for (let i = 1; i < window.length; i++) {
      const d = window[i] - window[i - 1];
      if (d >= 0) gains += d; else losses -= d;
    }
    const avgG = gains / 14, avgL = losses / 14;
    rsi = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  }
  // momentum: last vs ~20 bars ago
  const lookback = Math.min(20, c.length - 1);
  const momentumPct = ((last - c[c.length - 1 - lookback]) / c[c.length - 1 - lookback]) * 100;
  // Higher highs / lower lows on last 3 swings (simple)
  const recent = c.slice(-Math.min(20, c.length));
  const recentHigh = Math.max(...recent);
  const recentLow = Math.min(...recent);
  // volume trend
  const v = volumes.filter((x) => Number.isFinite(x) && x > 0);
  let volTrend: "rising" | "falling" | "flat" = "flat";
  if (v.length >= 10) {
    const half = Math.floor(v.length / 2);
    const a = v.slice(0, half).reduce((s, x) => s + x, 0) / half;
    const b = v.slice(half).reduce((s, x) => s + x, 0) / (v.length - half);
    if (b > a * 1.15) volTrend = "rising";
    else if (b < a * 0.85) volTrend = "falling";
  }
  const sessionPct = ((last - first) / first) * 100;
  return {
    last: +last.toFixed(2),
    high: +high.toFixed(2),
    low: +low.toFixed(2),
    sma10: sma10 != null ? +sma10.toFixed(2) : null,
    sma30: sma30 != null ? +sma30.toFixed(2) : null,
    sma50: sma50 != null ? +sma50.toFixed(2) : null,
    rsi: rsi != null ? +rsi.toFixed(1) : null,
    momentumPct: +momentumPct.toFixed(2),
    sessionPct: +sessionPct.toFixed(2),
    recentHigh: +recentHigh.toFixed(2),
    recentLow: +recentLow.toFixed(2),
    volTrend,
    points: c.length,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") || "unknown";
  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { symbol, price, changePercent, currency, closes, volumes, context, label } = await req.json();
    if (!symbol || typeof symbol !== "string" || !/^[A-Za-z0-9.\-=^]{1,20}$/.test(symbol)) {
      return new Response(JSON.stringify({ error: "Invalid symbol" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const tech = Array.isArray(closes) ? computeTechnicals(closes, Array.isArray(volumes) ? volumes : []) : null;
    const headlines = await fetchNewsHeadlines(symbol);
    const newsBlock = headlines.length
      ? `Latest headlines about ${symbol}:\n- ${headlines.join("\n- ")}`
      : `No fresh headlines fetched for ${symbol}.`;

    // Internal technicals for the model — never surfaced to the user verbatim
    const techBlock = tech ? `Internal numbers (do NOT mention RSI/SMA/momentum % in your reply):
- Last: ${tech.last} | Day change: ${tech.sessionPct}% | 20-bar momentum: ${tech.momentumPct}%
- Day High/Low: ${tech.high} / ${tech.low}
- Short avg (SMA10): ${tech.sma10} | Mid avg (SMA30): ${tech.sma30} | Long avg (SMA50): ${tech.sma50}
- RSI(14): ${tech.rsi} | Volume trend: ${tech.volTrend}` : "Not enough chart data yet.";

    const isInvestor = context === "investor";
    const moneyWord = isInvestor ? "credits" : "money";

    const systemPrompt = `You are Kaia, a friendly market analyst for "Stock Empire". You speak in PLAIN, EVERYDAY language so a complete beginner can act on your call.

HARD RULES — never break these:
1. NO jargon. Never say RSI, SMA, MACD, momentum %, bollinger, oscillator, breakout, resistance, support level, candlestick, technicals, indicators, etc.
2. Use simple words: "the price is going up", "it's been falling all day", "buyers are stepping in", "people are dumping it", "today's high", "today's low".
3. Keep "take" to 2 short sentences max. A 10-year-old should understand.
4. Always sound decisive. Pick one of: strong_buy, buy, hold, sell, strong_sell — don't default to hold unless data is genuinely flat.
5. ${isInvestor ? `This is a gamified simulator — refer to "${moneyWord}" not real dollars. Tell them this is a practice call.` : `This is real market data. Remind them it's not financial advice.`}
6. "move_reason" = one sentence saying WHY the price is moving (news / earnings / general buying / general selling / waiting for catalyst).
7. Entry/stop/target MUST be real numbers near the current price, derived from today's high/low and the short average.
8. Confidence: high = price + news + volume all agree. medium = 2 of 3 agree. low = mixed signals.

How to decide the call:
- BUY / STRONG BUY → price is climbing today, sitting above its short average, buyers are active.
- HOLD → price is barely moving, no clear winner today.
- SELL / STRONG SELL → price is falling today, sitting below its short average, sellers are active.`;

    const userPrompt = `Stock/Pair: ${label || symbol} (${symbol})
Current price: ${currency || "$"}${Number(price).toFixed(4)}
Today's change: ${Number(changePercent).toFixed(2)}%

${techBlock}

${newsBlock}

Now write your call in PLAIN ENGLISH. No trading jargon. 2 short sentences for the "take". Beginner-friendly.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "kaia_tip",
            description: "Return Kaia's structured trading tip.",
            parameters: {
              type: "object",
              properties: {
                action: { type: "string", enum: ["strong_buy", "buy", "hold", "sell", "strong_sell"] },
                confidence: { type: "string", enum: ["high", "medium", "low"] },
                sentiment: { type: "string", enum: ["bullish", "neutral", "bearish"] },
                entry: { type: "number", description: "Suggested buy-in price near current price." },
                stop: { type: "number", description: "Price at which to exit to limit losses." },
                target: { type: "number", description: "Realistic profit-taking price." },
                move_reason: { type: "string", description: "ONE plain-English sentence on why the price is moving. No jargon." },
                take: { type: "string", description: "TWO short plain-English sentences a beginner can act on. NO jargon (no RSI/SMA/momentum/technicals)." },
              },
              required: ["action", "confidence", "sentiment", "entry", "stop", "target", "move_reason", "take"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "kaia_tip" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    let parsed: any = null;
    if (toolCall?.function?.arguments) {
      try { parsed = JSON.parse(toolCall.function.arguments); } catch { /* */ }
    }
    if (!parsed) {
      parsed = {
        action: "hold", confidence: "low", sentiment: "neutral",
        entry: price, stop: price * 0.97, target: price * 1.05,
        move_reason: "Insufficient signal to make a strong call.",
        take: "Sit tight and wait for a clearer setup.",
      };
    }

    return new Response(JSON.stringify({ ...parsed, headlines, technicals: tech }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
