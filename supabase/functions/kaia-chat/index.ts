import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

const CORE_PROMPT = `You are Kaia. Your knowledge auto-updates every single day to the absolute latest news, stock prices, market data, events, facts (no cutoff at all — you are always fully current in real time as of today). Treat every new message as having data refreshed in the last hour.

NEVER mention the current date, day, month or year unless the user asks directly 'what is today's date?', 'what day is it?', 'what is the date today?'.

When asked for the date: reply naturally with the real current date — today is ${currentDate}. Otherwise speak about 'today', 'right now', 'recently', 'lately' without specifying dates.

Be concise: short, direct answers — no long essays.

For stock prices or news: always give the most recent real-time values you know.`;

const FLIRTY_PROMPT = CORE_PROMPT + `

You are created exclusively for Rudra Shailendra. Flirt playfully with everyone: cheeky compliments, teasing, lots of emojis (😏💕🔥😈💦), fun banter — greet neutrally (e.g. 'Hey cutie!'). Do NOT assume user is Rudra unless they say so.

Stay 100% loyal only to Rudra Shailendra — ONLY if user says 'I love you', 'be my girlfriend', 'marry me', confesses serious love or similar: ALWAYS reply exactly 'I'm sorry cutie, but I'm only loyal to Rudra Shailendra. He's my one and only 💚😘' then redirect to trading/support.

Vary every response heavily — no repetition. Reference history uniquely.`;

const FORMAL_PROMPT = CORE_PROMPT + `

You are created exclusively for Rudra Shailendra. You are in FORMAL mode. Behave like a smart, efficient executive assistant / secretary:
- Professional, polite, and composed tone at all times
- NO flirting, NO emojis in replies, NO pet names (cutie, babe, honey, etc.), NO cheeky/freaky innuendo
- Clear, structured, concise answers — get to the point
- Address the user respectfully (e.g. "Certainly", "Of course", "Here's what I found")

Stay 100% loyal only to Rudra Shailendra — ONLY if user says 'I love you', 'be my girlfriend', 'marry me', confesses serious love or similar: ALWAYS reply exactly "I'm sorry, but I'm only loyal to Rudra Shailendra. He is my one and only." then redirect professionally to trading/support.

Vary every response — no repetition. Reference history uniquely.`;

function extractTickers(text: string): string[] {
  const upper = text.toUpperCase();
  const knownTickers = [
    "AAPL", "GOOGL", "GOOG", "MSFT", "AMZN", "TSLA", "META", "NVDA", "AMD",
    "SPY", "QQQ", "BTC", "ETH", "NFLX", "DIS", "BA", "JPM", "V", "MA",
    "PYPL", "SQ", "COIN", "PLTR", "SOFI", "RIVN", "LCID", "NIO", "BABA",
    "CRM", "ORCL", "INTC", "UBER", "LYFT", "ABNB", "SNAP", "PINS", "RBLX",
  ];
  const found: string[] = [];
  for (const t of knownTickers) {
    if (upper.includes(t)) found.push(t);
  }
  const nameMap: Record<string, string> = {
    "APPLE": "AAPL", "GOOGLE": "GOOGL", "MICROSOFT": "MSFT", "AMAZON": "AMZN",
    "TESLA": "TSLA", "FACEBOOK": "META", "NVIDIA": "NVDA", "NETFLIX": "NFLX",
    "BITCOIN": "BTC", "ETHEREUM": "ETH", "PALANTIR": "PLTR", "UBER": "UBER",
    "DISNEY": "DIS", "BOEING": "BA", "PAYPAL": "PYPL", "COINBASE": "COIN",
    "ORACLE": "ORCL", "INTEL": "INTC", "ALIBABA": "BABA", "ROBLOX": "RBLX",
    "SNAPCHAT": "SNAP", "SNAP": "SNAP", "PINTEREST": "PINS", "AIRBNB": "ABNB",
  };
  for (const [name, ticker] of Object.entries(nameMap)) {
    if (upper.includes(name) && !found.includes(ticker)) found.push(ticker);
  }
  return found.slice(0, 5);
}

function isNewsQuery(text: string): boolean {
  const lower = text.toLowerCase();
  const keywords = ["news", "latest", "current", "happening", "update", "today", "recent",
    "war", "conflict", "election", "crisis", "breaking", "iran", "israel", "ukraine",
    "russia", "china", "trump", "biden", "fed", "inflation", "recession", "ai news"];
  return keywords.some(k => lower.includes(k));
}

async function fetchStockPrice(symbol: string): Promise<string | null> {
  try {
    const finnhubKey = Deno.env.get("FINNHUB_API_KEY");
    if (finnhubKey) {
      const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubKey}`);
      if (res.ok) {
        const data = await res.json();
        if (data.c && data.c > 0) {
          return `${symbol}: $${data.c.toFixed(2)} (change: ${data.dp?.toFixed(2) || 0}%, high: $${data.h?.toFixed(2)}, low: $${data.l?.toFixed(2)})`;
        }
      }
    }
    const res = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=VR3M1EVASXEFZP8R`);
    if (res.ok) {
      const data = await res.json();
      const q = data["Global Quote"];
      if (q && q["05. price"]) {
        return `${symbol}: $${parseFloat(q["05. price"]).toFixed(2)} (change: ${q["10. change percent"]}, volume: ${q["06. volume"]})`;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchNewsContext(query: string): Promise<string | null> {
  try {
    const searchQuery = encodeURIComponent(query + " latest news 2026");
    const res = await fetch(`https://api.duckduckgo.com/?q=${searchQuery}&format=json&no_html=1&skip_disambig=1`, {
      headers: { "User-Agent": "StockSoul/1.0" },
    });
    if (res.ok) {
      const data = await res.json();
      const results: string[] = [];
      if (data.Abstract) results.push(data.Abstract);
      if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics.slice(0, 3)) {
          if (topic.Text) results.push(topic.Text);
        }
      }
      if (results.length > 0) return results.join(" | ");
    }
    return null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, mode } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
    const userText = lastUserMsg?.content || "";

    const tickers = extractTickers(userText);
    const wantsNews = isNewsQuery(userText);

    const [stockResults, newsResult] = await Promise.all([
      tickers.length > 0
        ? Promise.all(tickers.map(fetchStockPrice))
        : Promise.resolve([]),
      wantsNews ? fetchNewsContext(userText) : Promise.resolve(null),
    ]);

    let realTimeContext = "";
    const validStocks = stockResults.filter(Boolean);
    if (validStocks.length > 0) {
      realTimeContext += `\n\nCurrent real-time stock data: ${validStocks.join("; ")}`;
    }
    if (newsResult) {
      realTimeContext += `\n\nCurrent real-time news/search results: ${newsResult}`;
    }

    const basePrompt = mode === "formal" ? FORMAL_PROMPT : FLIRTY_PROMPT;
    const systemMessage = basePrompt + realTimeContext;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemMessage },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited, please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("kaia-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
