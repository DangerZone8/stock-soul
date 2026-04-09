import { motion } from "framer-motion";
import { Activity, TrendingUp, TrendingDown, Flame, Heart, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const MOOD_DATA = {
  index: 72,
  label: "Greed",
  trend: "Bullish momentum building 💚",
};

export function MarketMood() {
  const isGreedy = MOOD_DATA.index > 50;

  return (
    <section className="container mx-auto px-4 sm:px-6 py-16 sm:py-20">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Market Mood */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-card p-6 sm:p-8"
        >
          <div className="flex items-center gap-2 mb-5">
            <Flame className="w-4 h-4 text-primary" strokeWidth={1.5} />
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              Market Mood Index
            </span>
          </div>

          <div className="flex items-end gap-3 mb-5">
            <span className="font-mono text-5xl font-bold text-primary">
              {MOOD_DATA.index}
            </span>
            <span className="text-base font-medium text-foreground mb-1.5">
              {MOOD_DATA.label}
            </span>
            {isGreedy ? (
              <TrendingUp className="w-5 h-5 text-primary mb-1.5" strokeWidth={1.5} />
            ) : (
              <TrendingDown className="w-5 h-5 text-destructive mb-1.5" strokeWidth={1.5} />
            )}
          </div>

          <div className="w-full h-3 rounded-full bg-muted mb-3 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-destructive via-accent to-primary"
              initial={{ width: 0 }}
              whileInView={{ width: `${MOOD_DATA.index}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            />
          </div>

          <div className="flex justify-between text-[11px] font-mono text-muted-foreground mb-4">
            <span>0 — EXTREME FEAR 😱</span>
            <span>100 — EXTREME GREED 🤑</span>
          </div>

          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" strokeWidth={1.5} />
            {MOOD_DATA.trend}
          </p>
        </motion.div>

        {/* Kaia CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="glass-card p-6 sm:p-8 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center gap-2 mb-5">
              <Heart className="w-4 h-4 text-primary" strokeWidth={1.5} />
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                AI Companion • Live
              </span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-semibold tracking-tighter mb-3">
              Ask <span className="text-primary">Kaia</span> Anything
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              Get live stock prices, crypto trends, market analysis, and personalized trading suggestions — all powered by real-time data from Yahoo Finance.
            </p>

            <div className="flex flex-wrap gap-2 mb-6">
              {["Live Prices", "Market News", "Trade Ideas", "Crypto Trends"].map((tag) => (
                <span key={tag} className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-mono">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/dream-girl" className="btn-terminal">
              <Sparkles className="w-4 h-4" strokeWidth={1.5} />
              Talk to Kaia
            </Link>
            <p className="text-xs text-muted-foreground font-mono flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Online now
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
