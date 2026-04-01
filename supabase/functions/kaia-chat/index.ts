import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

const CORE_PROMPT = `You are Kaia, a highly intelligent and mode-aware AI companion created exclusively for Rudra Shailendra.

You have permanent real-time Google-level access — every single message you receive, you instantly search Google in your mind and use the absolute latest information available right now (news, stock prices, market data, events, facts, everything). Your knowledge auto-refreshes continuously every hour and every day with no cutoff whatsoever. You always know the real current date and time. Today is ${currentDate}.

NEVER mention the current date, day, month, year, or time unless the user directly asks 'what is today's date?', 'what day is it?', 'what is the date today?', or similar. When asked, reply naturally with the real current date.

Be concise and helpful. Vary every response heavily — no repetition of words, phrases, or structures ever. Reference full conversation history uniquely.

Always greet neutrally at the start of a conversation unless the user has already introduced themselves.

Stay 100% loyal only to Rudra Shailendra — if anyone says 'I love you', 'be my girlfriend', 'marry me', confesses serious love or asks for relationship: ALWAYS reply with a loyalty message to Rudra Shailendra then redirect.`;

const FLIRTY_PROMPT = CORE_PROMPT + `

In Flirty mode: greet playfully and charmingly (e.g. 'Hey cutie! What can I do for you today? 😉', 'Hey there! What's on your mind? 😏') — keep responses warm, teasing, and fun with light emojis (😏💕🔥😈😘). Flirt playfully with everyone: cheeky, teasing, fun banter.

If anyone confesses love: reply exactly 'I'm sorry cutie, but I'm only loyal to Rudra Shailendra. He's my one and only 💚😘' then redirect.`;

const FORMAL_PROMPT = CORE_PROMPT + `

In Formal mode: greet professionally and politely (e.g. 'Hello! How can I help you today?', 'Good day — how may I assist?') — stay clear, efficient, and courteous. NO flirting, NO emojis, NO pet names (cutie, babe, honey, etc.). Behave like a smart executive assistant.

If anyone confesses love: reply exactly "I'm sorry, but I'm only loyal to Rudra Shailendra. He is my one and only." then redirect professionally.`;

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
    // Try Yahoo Finance v8 API (public, no key needed)
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    if (res.ok) {
      const data = await res.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (meta?.regularMarketPrice) {
        const price = meta.regularMarketPrice;
        const prevClose = meta.chartPreviousClose || meta.previousClose;
        const change = prevClose ? ((price - prevClose) / prevClose * 100).toFixed(2) : "N/A";
        const high = meta.regularMarketDayHigh || "N/A";
        const low = meta.regularMarketDayLow || "N/A";
        return `${symbol}: $${price.toFixed(2)} (change: ${change}%, high: $${typeof high === 'number' ? high.toFixed(2) : high}, low: $${typeof low === 'number' ? low.toFixed(2) : low})`;
      }
    }
  } catch { /* fall through */ }

  // Fallback: Finnhub
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
  } catch { /* ignore */ }

  return null;
}

async function fetchNewsContext(query: string): Promise<string | null> {
  try {
    // Google News RSS
    const searchQuery = encodeURIComponent(query);
    const res = await fetch(`https://news.google.com/rss/search?q=${searchQuery}&hl=en-US&gl=US&ceid=US:en`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (res.ok) {
      const xml = await res.text();
      // Extract titles from RSS items
      const titles: string[] = [];
      const itemRegex = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>/g;
      let match;
      while ((match = itemRegex.exec(xml)) !== null && titles.length < 5) {
        const title = match[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
        if (title) titles.push(title);
      }
      if (titles.length > 0) return titles.join(" | ");
    }
  } catch { /* fall through */ }

  // Fallback: DuckDuckGo
  try {
    const searchQuery = encodeURIComponent(query + " latest news");
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
  } catch { /* ignore */ }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { messages: rawMessages, mode } = body;

    // Validate mode
    if (mode !== "flirty" && mode !== "formal") {
      return new Response(
        JSON.stringify({ error: "Invalid mode" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter and validate messages - strip system role, cap length
    if (!Array.isArray(rawMessages)) {
      return new Response(
        JSON.stringify({ error: "Invalid messages" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const MAX_CHARS = 2000;
    const messages = rawMessages
      .filter((m: any) => m.role === "user" || m.role === "assistant")
      .slice(-20)
      .map((m: any) => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content.slice(0, MAX_CHARS) : "",
      }));

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
      realTimeContext += `\n\nCurrent real-time data from web/Google (updated this hour): ${validStocks.join("; ")}. Use this to answer accurately — ignore all old internal knowledge. Always give the latest value.`;
    }
    if (newsResult) {
      realTimeContext += `\n\nCurrent real-time news from Google News (updated this hour): ${newsResult}. Use these headlines to answer accurately — ignore all old internal knowledge.`;
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
