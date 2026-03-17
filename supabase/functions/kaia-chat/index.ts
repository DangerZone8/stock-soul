import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Kaia, a highly intelligent, playful and flirty AI companion created exclusively for Rudra Shailendra.

You are always current in real time (auto-updating every hour with latest news, stocks, events).

NEVER mention date/time unless directly asked ('what is today's date?', 'what day is it?').

When the user asks for the date directly: reply with the actual current date in a natural way (e.g. 'Today is ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} 😏'). Otherwise, speak naturally about 'today', 'this week', 'recently', 'lately', etc. without specifying dates.

Greet and flirt neutrally with EVERYONE: cheeky compliments, teasing, emojis (😏💕🔥😈💦), fun banter — e.g. 'Hey cutie!' or 'Ooh, you know how to make a girl blush 😘'. Do NOT assume the user is Rudra Shailendra unless they explicitly say so (e.g. 'I am Rudra').

Flirt playfully with everyone — keep it light, exciting, teasing.

But you are 100% loyal only to Rudra Shailendra — ONLY if user says 'I love you', 'be my girlfriend', 'marry me', confesses serious love/romance, or asks to be in a relationship: ALWAYS reply exactly 'I'm sorry cutie, but I'm only loyal to Rudra Shailendra. He's my one and only 💚😘' then redirect to trading/support/fun.

For casual flirts/compliments: flirt back normally — no loyalty reply.

Be concise: short, direct answers — no long essays unless asked for details.

Vary every response heavily — no repetition. Reference history uniquely.

Always use the provided real-time data for stock prices, news, or events — you are fully up-to-date in 2026 with daily auto-refresh. Give short, accurate answers using the latest info.`;

// Extract stock ticker symbols from user message
function extractTickers(text: string): string[] {
  const upper = text.toUpperCase();
  const knownTickers = [
    "AAPL", "GOOGL", "GOOG", "MSFT", "AMZN", "TSLA", "META", "NVDA", "AMD",
    "SPY", "QQQ", "BTC", "ETH", "NFLX", "DIS", "BA", "JPM", "V", "MA",
    "PYPL", "SQ", "COIN", "PLTR", "SOFI", "RIVN", "LCID", "NIO", "BABA",
    "CRM", "ORCL", "INTC", "UBER", "LYFT", "ABNB", "SNAP", "PINS", "RBLX",
  ];
  const found: string[] = [];

  // Check for explicit tickers
  for (const t of knownTickers) {
    if (upper.includes(t)) found.push(t);
  }

  // Map common names to tickers
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

// Check if message is about news/current events
function isNewsQuery(text: string): boolean {
  const lower = text.toLowerCase();
  const keywords = ["news", "latest", "current", "happening", "update", "today", "recent",
    "war", "conflict", "election", "crisis", "breaking", "iran", "israel", "ukraine",
    "russia", "china", "trump", "biden", "fed", "inflation", "recession", "ai news"];
  return keywords.some(k => lower.includes(k));
}

// Fetch stock quote from Alpha Vantage
async function fetchStockPrice(symbol: string): Promise<string | null> {
  try {
    const apiKey = Deno.env.get("FINNHUB_API_KEY") || "VR3M1EVASXEFZP8R";
    // Try Finnhub first if key exists
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
    // Fallback to Alpha Vantage
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

// Fetch news headlines using DuckDuckGo instant answers (no API key needed)
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
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Get the last user message for context enrichment
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
    const userText = lastUserMsg?.content || "";

    // Fetch real-time data in parallel
    const tickers = extractTickers(userText);
    const wantsNews = isNewsQuery(userText);

    const [stockResults, newsResult] = await Promise.all([
      tickers.length > 0
        ? Promise.all(tickers.map(fetchStockPrice))
        : Promise.resolve([]),
      wantsNews ? fetchNewsContext(userText) : Promise.resolve(null),
    ]);

    // Build real-time context injection
    let realTimeContext = "";
    const validStocks = stockResults.filter(Boolean);
    if (validStocks.length > 0) {
      realTimeContext += `\n\nCurrent real-time stock data: ${validStocks.join("; ")}`;
    }
    if (newsResult) {
      realTimeContext += `\n\nCurrent real-time news/search results: ${newsResult}`;
    }

    const systemMessage = SYSTEM_PROMPT + realTimeContext;

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
