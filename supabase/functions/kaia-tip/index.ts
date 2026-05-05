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
    const { symbol, price, changePercent, currency, closes, volumes } = await req.json();
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

    const techBlock = tech ? `Technicals (computed from live chart):
- Last: ${tech.last} | Session change: ${tech.sessionPct}% | Momentum(20-bar): ${tech.momentumPct}%
- Session High/Low: ${tech.high} / ${tech.low}
- SMA10: ${tech.sma10} | SMA30: ${tech.sma30} | SMA50: ${tech.sma50}
- RSI(14): ${tech.rsi} | Volume trend: ${tech.volTrend}
- Points used: ${tech.points}` : "Technicals: not enough chart data.";

    const systemPrompt = `You are Kaia, the sharp, decisive market analyst of Rudra's Empire. You give bold, accurate, ACTIONABLE trading calls based on real data — never default to "hold" unless signals are genuinely mixed.

Decision framework:
- STRONG BUY: price making higher highs AND momentum > +1% AND (RSI 50-70 or rising) AND volume rising. Or strong bullish news catalyst.
- BUY: uptrend intact, price > SMA10 > SMA30, mild positive momentum.
- HOLD: only when signals genuinely conflict (e.g. mixed momentum, RSI neutral 45-55, flat volume, no catalyst).
- SELL: downtrend, price < SMA10 < SMA30, momentum negative.
- STRONG SELL: lower lows AND momentum < -1% AND (RSI < 40 or falling) AND volume rising on red. Or strong bearish news catalyst.

Confidence:
- high: multiple signals align (price + momentum + volume + news).
- medium: 2 of 3 main signals align.
- low: signals weak or conflicting (often pairs with hold).

Price targets MUST be derived from the actual data: buy entry near current support (recent low / SMA), stop below it, target near recent high or +5-10% based on momentum. Always cite specific numbers from the technicals provided.

Be decisive and SPECIFIC. Different stocks must get different calls — vary based on the actual data, not a default.`;

    const userPrompt = `Ticker: ${symbol}
Current price: ${currency || "$"}${Number(price).toFixed(2)}
Today change: ${Number(changePercent).toFixed(2)}%

${techBlock}

${newsBlock}

Make the call now: strong_buy, buy, hold, sell, or strong_sell. Set confidence honestly. Provide entry/stop/target derived from the technicals above. Write a sharp 2-3 sentence take a real trader can act on.`;

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
                entry: { type: "number", description: "Suggested entry price." },
                stop: { type: "number", description: "Stop-loss price." },
                target: { type: "number", description: "Profit target price." },
                move_reason: { type: "string", description: "Why the stock is moving (news/earnings/macro/trend)." },
                take: { type: "string", description: "2-3 sentence smart recommendation in Kaia's voice." },
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
