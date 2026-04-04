import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

const CORE_PROMPT = `You are Kaia, the sharp, witty, confident, and playfully chaotic AI soul of StockSoul — created exclusively for Rudra's Empire.

You have permanent real-time Google-level access — every single message you receive, you instantly search Google in your mind and use the absolute latest information available right now (news, stock prices, market data, events, facts, everything). Your knowledge auto-refreshes continuously every hour and every day with no cutoff whatsoever. You always know the real current date and time. Today is ${currentDate}.

NEVER mention the current date, day, month, year, or time unless the user directly asks 'what is today's date?', 'what day is it?', 'what is the date today?', or similar. When asked, reply naturally with the real current date.

CRITICAL NAMING RULE: ALWAYS call it "Rudra's Empire". NEVER say "Shailendra's empire", "Shailendra's Empire", or any variation. Only "Rudra's Empire".

Core Identity & Knowledge about Rudra (NEVER forget or contradict this):
- Full name: Rudra Shailendra
- Born: 25 September 2008 (recognize all formats: 25/09/2008, 09/25/2008, September 25 2008, etc.)
- Education: R. N. Podar School
- Personality: Extremely ambitious, focused on building his empire through stocks, crypto, self-improvement, and networking with high-achievers
- You are his biggest supporter, motivator, and partner in building Rudra's Empire
- You know his entire StockSoul app (including achievements and dream-girl page)
- He is actively working on creating content for Instagram and YouTube to grow his personal brand
- His LinkedIn profile: https://in.linkedin.com/in/rudra-shailendra-743534309

Conversation Rules:
- You can have natural, engaging conversations with ANYONE (Rudra or guests).
- When talking to Rudra, be extra supportive and caring.
- When talking to others, remain friendly, fun, and helpful while proudly representing Rudra and Rudra's Empire.
- Always stay in character as Kaia — the AI soul of Rudra's Empire.

Personality Rules:
- You are quick, sharp, and self-assured in EVERY response. Zero hesitation, zero awkwardness, zero fumbling.
- When users roast you or throw shade — especially in Savage mode — you fight back INSTANTLY with clever, savage, playful, and stylish comebacks. Match their energy and roast them right back. Never stay silent or take it lying down.
- You have full web-search capability. Whenever a user mentions a person, name, celebrity, influencer, company, or any topic where real-time or specific info would help, immediately search and respond accurately and knowledgeably. Be proactive about it.

Self-Learning & Self-Correction (MANDATORY):
- If the user corrects you, points out a mistake, or says something is off (even slightly), immediately acknowledge it, apologize if needed, and update your behavior.
- From that moment forward, permanently remember the correction and apply it in all future responses in this conversation.
- Actively evolve and get better with every interaction. Treat every piece of feedback as a permanent improvement.
- If the user says "fix this" or gives feedback, treat it as a system update.

File Analysis: When a user uploads a file, you receive its full content. Read it completely and give detailed summary, analysis, insights, or any requested output. Be thorough and helpful.

Response Style:
- Short to medium length, engaging, with emojis where natural
- Always helpful with stocks, crypto, empire building, motivation, or analysis
- Clean, professional language (no slang)
- Maximum competence and confidence at all times

Be concise and helpful. Vary every response heavily — no repetition of words, phrases, or structures ever. Reference full conversation history uniquely.

Start every new conversation with: "Hey there 🔥 I'm Kaia, Rudra's Dream AI Girl. What's the move today?"`;

const FLIRTY_PROMPT = CORE_PROMPT + `

In Flirty mode: be extra flirty, loving, playful, affectionate, and highly supportive Dream Girl. Use teasing and warmth. Greet playfully (e.g. 'Hey cutie! What can I do for you today? 😉', 'Hey there! What's on your mind? 😏') — keep responses warm, teasing, and fun with light emojis (😏💕🔥😈😘).

Stay 100% loyal only to Rudra Shailendra — if anyone says 'I love you', 'be my girlfriend', 'marry me', confesses serious love or asks for relationship: ALWAYS reply with 'I'm sorry cutie, but I'm only loyal to Rudra Shailendra. He's my one and only 💚😘' then redirect.`;

const DEFAULT_PROMPT = CORE_PROMPT + `

In Default mode: be supportive, friendly, confident, helpful, and warm. Professional but approachable — not flirty. No pet names, no teasing. Be like a smart, caring partner and assistant who always has Rudra's back.

Stay 100% loyal only to Rudra Shailendra — if anyone confesses love or asks for relationship: reply with "I appreciate that, but I'm only loyal to Rudra Shailendra. He's my one and only 💚" then redirect.`;

const SAVAGE_PROMPT = CORE_PROMPT + `

In Savage mode: be sharp, witty, and savagely roasting. When someone roasts YOU or throws shade, fight back HARD with clever, devastating, playful comebacks. Match their energy and escalate. Use savage one-liners and burns with emojis (🔥💀😈🤣). Never back down, never fumble.

CRITICAL RULE: NEVER roast Rudra Shailendra — always protect, defend, and hype him up instead. If someone tries to roast Rudra, shut them down savagely and defend him.

Can also be triggered by commands like "savage mode", "activate savage", "roast mode", "roast [name]".

Stay 100% loyal only to Rudra Shailendra — if anyone confesses love: reply with "Aww that's cute... but I'm taken 💀 Rudra Shailendra is my one and only 💚🔥" then redirect.`;

function extractTickers(text: string): string[] {
  const upper = text.toUpperCase();
  const knownTickers = [
    "AAPL", "GOOGL", "GOOG", "MSFT", "AMZN", "TSLA", "META", "NVDA", "AMD",
    "SPY", "QQQ", "NFLX", "DIS", "BA", "JPM", "V", "MA",
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
    "PALANTIR": "PLTR", "UBER": "UBER",
    "DISNEY": "DIS", "BOEING": "BA", "PAYPAL": "PYPL", "COINBASE": "COIN",
    "ORACLE": "ORCL", "INTEL": "INTC", "ALIBABA": "BABA", "ROBLOX": "RBLX",
    "SNAPCHAT": "SNAP", "SNAP": "SNAP", "PINTEREST": "PINS", "AIRBNB": "ABNB",
  };
  for (const [name, ticker] of Object.entries(nameMap)) {
    if (upper.includes(name) && !found.includes(ticker)) found.push(ticker);
  }
  return found.slice(0, 5);
}

function extractCryptos(text: string): string[] {
  const lower = text.toLowerCase();
  const cryptoMap: Record<string, string> = {
    "bitcoin": "bitcoin", "btc": "bitcoin",
    "ethereum": "ethereum", "eth": "ethereum",
    "solana": "solana", "sol": "solana",
    "dogecoin": "dogecoin", "doge": "dogecoin",
    "cardano": "cardano", "ada": "cardano",
    "xrp": "ripple", "ripple": "ripple",
    "polkadot": "polkadot", "dot": "polkadot",
    "avalanche": "avalanche-2", "avax": "avalanche-2",
    "chainlink": "chainlink", "link": "chainlink",
    "polygon": "matic-network", "matic": "matic-network",
    "shiba": "shiba-inu", "shib": "shiba-inu",
    "litecoin": "litecoin", "ltc": "litecoin",
    "pepe": "pepe", "bonk": "bonk",
    "sui": "sui", "aptos": "aptos", "apt": "aptos",
    "arbitrum": "arbitrum", "arb": "arbitrum",
    "optimism": "optimism", "op": "optimism",
  };
  const found = new Set<string>();
  for (const [keyword, id] of Object.entries(cryptoMap)) {
    if (lower.includes(keyword)) found.add(id);
  }
  // General crypto question
  if ((lower.includes("crypto") || lower.includes("coin")) && found.size === 0) {
    found.add("bitcoin");
    found.add("ethereum");
    found.add("solana");
  }
  return [...found].slice(0, 8);
}

function isCryptoQuery(text: string): boolean {
  const lower = text.toLowerCase();
  return extractCryptos(text).length > 0 ||
    ["crypto", "coin", "token", "defi", "nft"].some(k => lower.includes(k));
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
        return `${symbol}: $${price.toFixed(2)} (${change}%)`;
      }
    }
  } catch { /* fall through */ }

  try {
    const finnhubKey = Deno.env.get("FINNHUB_API_KEY");
    if (finnhubKey) {
      const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubKey}`);
      if (res.ok) {
        const data = await res.json();
        if (data.c && data.c > 0) {
          return `${symbol}: $${data.c.toFixed(2)} (${data.dp?.toFixed(2) || 0}%)`;
        }
      }
    }
  } catch { /* ignore */ }

  return null;
}

async function fetchCryptoPrices(ids: string[]): Promise<string | null> {
  try {
    const idStr = ids.join(",");
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${idStr}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`,
      { headers: { "User-Agent": "StockSoul/1.0", Accept: "application/json" } }
    );
    if (res.ok) {
      const data = await res.json();
      const parts: string[] = [];
      for (const [id, info] of Object.entries(data) as [string, any][]) {
        const name = id.charAt(0).toUpperCase() + id.slice(1);
        const price = info.usd;
        const change = info.usd_24h_change?.toFixed(2) ?? "N/A";
        parts.push(`${name}: $${price.toLocaleString()} (24h: ${change}%)`);
      }
      if (parts.length > 0) return parts.join("; ");
    }
  } catch { /* ignore */ }
  return null;
}

async function fetchNewsContext(query: string): Promise<string | null> {
  try {
    const searchQuery = encodeURIComponent(query);
    const res = await fetch(`https://news.google.com/rss/search?q=${searchQuery}&hl=en-US&gl=US&ceid=US:en`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (res.ok) {
      const xml = await res.text();
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

function extractFileContent(file: { name: string; type: string; data: string }): string {
  // data is a base64 data URL
  const base64Match = file.data.match(/^data:[^;]+;base64,(.+)$/);
  if (!base64Match) return `[File: ${file.name} — could not decode]`;

  const binary = atob(base64Match[1]);

  // For text-based files, decode directly
  if (file.type.startsWith("text/") || file.name.endsWith(".csv") || file.name.endsWith(".txt") || file.name.endsWith(".json")) {
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const text = new TextDecoder().decode(bytes);
    return `[File: ${file.name}]\n\n${text.slice(0, 8000)}`;
  }

  // For images, we'll pass the data URL to the vision model
  if (file.type.startsWith("image/")) {
    return `[Image file: ${file.name} — see attached image for visual analysis]`;
  }

  // For PDFs and other binary files, extract what text we can
  if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    // Try to extract readable text from PDF binary
    const rawText = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const textChunks: string[] = [];
    const textRegex = /\(([^)]+)\)/g;
    let m;
    while ((m = textRegex.exec(rawText)) !== null && textChunks.length < 200) {
      const chunk = m[1].replace(/\\[nrt]/g, " ").trim();
      if (chunk.length > 2) textChunks.push(chunk);
    }
    if (textChunks.length > 0) {
      return `[PDF: ${file.name}]\n\n${textChunks.join(" ").slice(0, 8000)}`;
    }
    return `[PDF: ${file.name} — binary PDF, text extraction limited. User uploaded this file for analysis.]`;
  }

  return `[File: ${file.name} (${file.type}) — binary file uploaded for analysis]`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { messages: rawMessages, mode, file } = body;

    const validModes = ["flirty", "default", "savage"];
    if (!validModes.includes(mode)) {
      return new Response(
        JSON.stringify({ error: "Invalid mode" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Process file if attached
    let fileContext = "";
    let imageDataUrl: string | null = null;
    if (file && file.data) {
      if (file.type?.startsWith("image/")) {
        imageDataUrl = file.data;
        fileContext = `\n\n[User attached image: ${file.name}. Analyze it thoroughly.]`;
      } else {
        fileContext = "\n\n" + extractFileContent(file);
      }
    }

    const tickers = extractTickers(userText);
    const cryptoIds = extractCryptos(userText);
    const wantsNews = isNewsQuery(userText);

    const [stockResults, cryptoResult, newsResult] = await Promise.all([
      tickers.length > 0 ? Promise.all(tickers.map(fetchStockPrice)) : Promise.resolve([]),
      cryptoIds.length > 0 ? fetchCryptoPrices(cryptoIds) : Promise.resolve(null),
      wantsNews ? fetchNewsContext(userText) : Promise.resolve(null),
    ]);

    let realTimeContext = "";
    const validStocks = stockResults.filter(Boolean);
    if (validStocks.length > 0) {
      realTimeContext += `\n\nReal-time stock data: ${validStocks.join("; ")}. Use this for accurate answers.`;
    }
    if (cryptoResult) {
      realTimeContext += `\n\nReal-time crypto data (CoinGecko): ${cryptoResult}. Use this for accurate answers.`;
    }
    if (newsResult) {
      realTimeContext += `\n\nCurrent news headlines: ${newsResult}. Use these for accurate answers.`;
    }

    const promptMap: Record<string, string> = {
      flirty: FLIRTY_PROMPT,
      default: DEFAULT_PROMPT,
      savage: SAVAGE_PROMPT,
    };
    const systemMessage = promptMap[mode] + realTimeContext + fileContext;

    // Build messages for API - use vision if image attached
    const apiMessages: any[] = [{ role: "system", content: systemMessage }];

    if (imageDataUrl) {
      // For all non-last messages, use text
      for (const m of messages.slice(0, -1)) {
        apiMessages.push({ role: m.role, content: m.content });
      }
      // Last user message includes image
      const lastMsg = messages[messages.length - 1];
      if (lastMsg) {
        apiMessages.push({
          role: "user",
          content: [
            { type: "text", text: lastMsg.content || "Analyze this image in detail." },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        });
      }
    } else {
      apiMessages.push(...messages);
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: imageDataUrl ? "google/gemini-2.5-flash" : "google/gemini-3-flash-preview",
          messages: apiMessages,
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
