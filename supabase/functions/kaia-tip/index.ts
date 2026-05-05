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
    const { symbol, price, changePercent, currency } = await req.json();
    if (!symbol || typeof symbol !== "string" || !/^[A-Za-z0-9.\-=^]{1,20}$/.test(symbol)) {
      return new Response(JSON.stringify({ error: "Invalid symbol" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const headlines = await fetchNewsHeadlines(symbol);
    const newsBlock = headlines.length
      ? `Latest headlines about ${symbol}:\n- ${headlines.join("\n- ")}`
      : `No fresh headlines fetched for ${symbol}.`;

    const systemPrompt = `You are Kaia, the sharp, confident AI soul of Rudra's Empire — a decisive market analyst. Given live price data and news headlines, deliver a BOLD, decisive trading call. NEVER default to "hold" — only call hold when signals are genuinely mixed. Analyze price action, momentum, news, sentiment, and technicals (RSI, MAs, volume, breakouts), then commit. Be confident, specific, and honest. This call helps real retail traders make actual decisions.`;

    const userPrompt = `Ticker: ${symbol}
Price: ${currency || "$"}${Number(price).toFixed(2)}
Change: ${Number(changePercent).toFixed(2)}% (today)

${newsBlock}

Make a DECISIVE call: strong_buy, buy, hold, sell, or strong_sell. Give the public sentiment, a sharp 1-line reason for the move, and a confident 2-3 sentence take a retail trader can act on. Be bold — don't default to hold unless signals are truly mixed.`;

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
                sentiment: { type: "string", enum: ["bullish", "neutral", "bearish"] },
                move_reason: { type: "string", description: "Why the stock is moving (news/earnings/macro/trend)." },
                take: { type: "string", description: "2-3 sentence smart recommendation in Kaia's voice." },
              },
              required: ["action", "sentiment", "move_reason", "take"],
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
        action: "hold", sentiment: "neutral",
        move_reason: "Insufficient signal to make a strong call.",
        take: "Sit tight and wait for a clearer setup.",
      };
    }

    return new Response(JSON.stringify({ ...parsed, headlines }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
