import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, RefreshCw, Newspaper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const TIP_REFRESH_MS = 90_000;

export interface KaiaTip {
  action: "strong_buy" | "buy" | "hold" | "sell" | "strong_sell";
  confidence?: "high" | "medium" | "low";
  sentiment: "bullish" | "neutral" | "bearish";
  entry?: number;
  stop?: number;
  target?: number;
  move_reason: string;
  take: string;
  headlines?: string[];
}

interface KaiaTakeProps {
  symbol: string;
  price: number;
  changePercent: number;
  currency?: string;
  closes?: (number | null)[];
  volumes?: (number | null)[];
  /** Label hint for the model — e.g. "EUR/USD" or "credits" for gamified pages */
  label?: string;
  /** "live" = real talk. "investor" = gamified simulator (credits, not money) */
  context?: "live" | "investor";
  /** Decimals for entry/stop/target — forex needs more precision */
  decimals?: number;
}

const actionStyles: Record<string, string> = {
  strong_buy: "bg-green-500/25 text-green-400 border-green-500/50",
  buy: "bg-green-500/15 text-green-500 border-green-500/30",
  hold: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  sell: "bg-red-500/15 text-red-500 border-red-500/30",
  strong_sell: "bg-red-500/25 text-red-400 border-red-500/50",
};
const actionLabels: Record<string, string> = {
  strong_buy: "Strong Buy",
  buy: "Buy",
  hold: "Hold",
  sell: "Sell",
  strong_sell: "Sell Slowly",
};
const actionPlain: Record<string, string> = {
  strong_buy: "Good time to buy",
  buy: "Looks worth buying",
  hold: "Just wait & watch",
  sell: "Better to sell",
  strong_sell: "Sell — it's falling",
};

export function KaiaTake({
  symbol,
  price,
  changePercent,
  currency = "USD",
  closes,
  volumes,
  label,
  context = "live",
  decimals = 2,
}: KaiaTakeProps) {
  const [tip, setTip] = useState<KaiaTip | null>(null);
  const [loading, setLoading] = useState(false);
  const lastSymbolRef = useRef<string | null>(null);
  const isFetchingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTip = useCallback(async () => {
    if (isFetchingRef.current) return;
    if (!symbol || !Number.isFinite(price) || price <= 0) return;
    isFetchingRef.current = true;
    setLoading(true);
    try {
      const cleanCloses = (closes || []).filter((c): c is number => c != null && Number.isFinite(c));
      const cleanVols = (volumes || []).map((v) => (v == null ? 0 : v));
      const res = await fetch(
        `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/kaia-tip`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            symbol, price, changePercent, currency,
            closes: cleanCloses, volumes: cleanVols,
            context, label,
          }),
        }
      );
      if (!res.ok) throw new Error("tip failed");
      const data = await res.json();
      if (!data.error) setTip(data);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, currency, context, label]);

  // Refresh when symbol changes, and on an interval
  useEffect(() => {
    if (lastSymbolRef.current !== symbol) {
      setTip(null);
      lastSymbolRef.current = symbol;
    }
    fetchTip();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(fetchTip, TIP_REFRESH_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [symbol, fetchTip]);

  const fmt = (n?: number) => (n == null || !Number.isFinite(n) ? "—" : n.toFixed(decimals));
  const heading = label || symbol;
  const isCredits = context === "investor";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5 sm:p-6"
    >
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Kaia's Take on {heading}</h3>
        {loading && <RefreshCw className="w-3 h-3 animate-spin text-muted-foreground" />}
      </div>

      {!tip && !loading && (
        <p className="text-sm text-muted-foreground">Reading the market for you…</p>
      )}

      {tip && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${actionStyles[tip.action] || actionStyles.hold}`}>
              {actionLabels[tip.action] || tip.action}
            </span>
            {tip.confidence && (
              <span className={`px-3 py-1 rounded-full text-xs font-medium border capitalize ${
                tip.confidence === "high" ? "bg-primary/15 text-primary border-primary/30" :
                tip.confidence === "medium" ? "bg-secondary/50 text-foreground border-border/40" :
                "bg-muted/40 text-muted-foreground border-border/30"
              }`}>
                How sure: {tip.confidence}
              </span>
            )}
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-secondary/50 border border-border/40 text-muted-foreground capitalize">
              Mood: {tip.sentiment}
            </span>
          </div>

          {/* One-line plain summary */}
          <p className="text-sm font-semibold text-foreground">
            {actionPlain[tip.action] || "Take a look"} {isCredits ? "(with credits)" : ""}
          </p>

          {(tip.entry != null || tip.stop != null || tip.target != null) && (
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg border border-border/40 bg-secondary/30 p-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Buy near</div>
                <div className="font-mono font-semibold text-foreground">{fmt(tip.entry)}</div>
              </div>
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-2">
                <div className="text-[10px] uppercase tracking-wider text-red-500/80 font-mono">Exit if falls to</div>
                <div className="font-mono font-semibold text-red-500">{fmt(tip.stop)}</div>
              </div>
              <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-2">
                <div className="text-[10px] uppercase tracking-wider text-green-500/80 font-mono">Aim for</div>
                <div className="font-mono font-semibold text-green-500">{fmt(tip.target)}</div>
              </div>
            </div>
          )}

          <p className="text-sm text-foreground leading-relaxed">{tip.take}</p>

          <div className="text-xs text-muted-foreground border-t border-border/30 pt-2">
            <span className="font-semibold text-foreground">What's driving it: </span>{tip.move_reason}
          </div>

          {tip.headlines && tip.headlines.length > 0 && (
            <div className="pt-2 border-t border-border/30">
              <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground mb-2">
                <Newspaper className="w-3 h-3" /> Latest news
              </div>
              <ul className="space-y-1">
                {tip.headlines.slice(0, 4).map((h, i) => (
                  <li key={i} className="text-xs text-muted-foreground leading-relaxed">• {h}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground italic pt-1">
            {isCredits
              ? "Practice call — you're trading virtual credits, not real money."
              : "Not financial advice. Make your own call."}
          </p>
        </div>
      )}
    </motion.div>
  );
}
