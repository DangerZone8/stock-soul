const baseUrl = (process.env.SUPABASE_URL || "https://eziysdlolpetfzbpkwqz.supabase.co").replace(/\/+$/, "");
const endpoint = new URL(`${baseUrl}/functions/v1/stock-chart`);

async function request(params) {
  const url = new URL(endpoint);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${payload.error || response.statusText}`);
  if (payload.error) throw new Error(payload.error);
  return payload;
}

function assertQuote(payload, expectedSymbol) {
  if (payload.symbol !== expectedSymbol) throw new Error(`Expected ${expectedSymbol}, got ${payload.symbol}`);
  if (!Number.isFinite(payload.regularMarketPrice) || payload.regularMarketPrice <= 0) {
    throw new Error("Feed returned an invalid price");
  }
  if (!Array.isArray(payload.timestamps) || !Array.isArray(payload.closes)) {
    throw new Error("Feed did not return chart arrays");
  }
  if (payload.timestamps.length !== payload.closes.length || payload.timestamps.length === 0) {
    throw new Error("Chart timestamps and closes are empty or misaligned");
  }
}

const first = await request({ symbol: "AAPL", interval: "1m", range: "1d" });
assertQuote(first, "AAPL");
console.log(`PASS first quote: ${first.symbol} ${first.currency} ${first.regularMarketPrice} (chart points: ${first.timestamps.length})`);

const search = await request({ q: "Apple" });
if (!Array.isArray(search.quotes) || !search.quotes.some((item) => item.symbol === "AAPL")) {
  throw new Error("Ticker search did not return AAPL for Apple");
}
console.log("PASS ticker search: Apple -> AAPL");

await new Promise((resolve) => setTimeout(resolve, 16000));
const second = await request({ symbol: "AAPL", interval: "1m", range: "1d" });
assertQuote(second, "AAPL");
const changed = first.regularMarketPrice !== second.regularMarketPrice ||
  first.regularMarketTime !== second.regularMarketTime;
console.log(`PASS second quote: ${second.symbol} ${second.currency} ${second.regularMarketPrice}`);
console.log(changed
  ? "PASS feed refreshed: provider price/time changed between polls."
  : "PASS feed polled twice: price/time unchanged (normal when the exchange is closed or no new trade has printed).");
