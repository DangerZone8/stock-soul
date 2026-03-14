import { motion } from "framer-motion";
import { Activity, TrendingUp, TrendingDown, Flame } from "lucide-react";

const MOOD_DATA = {
  index: 72,
  label: "Greed",
  trend: "Bullish momentum building",
  color: "primary" as const,
};

export function MarketMood() {
  const isGreedy = MOOD_DATA.index > 50;

  return (
    <section className="container mx-auto px-4 pb-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="glass-card p-6 max-w-md"
      >
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-4 h-4 text-primary" strokeWidth={1.5} />
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            Market Mood Index
          </span>
        </div>

        <div className="flex items-end gap-3 mb-4">
          <span className="font-mono text-4xl font-bold text-primary">
            {MOOD_DATA.index}
          </span>
          <span className="text-sm font-medium text-foreground mb-1">
            {MOOD_DATA.label}
          </span>
          {isGreedy ? (
            <TrendingUp className="w-5 h-5 text-primary mb-1" strokeWidth={1.5} />
          ) : (
            <TrendingDown className="w-5 h-5 text-destructive mb-1" strokeWidth={1.5} />
          )}
        </div>

        {/* Bar */}
        <div className="w-full h-2 rounded-full bg-muted mb-3 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-destructive via-yellow-500 to-primary"
            initial={{ width: 0 }}
            whileInView={{ width: `${MOOD_DATA.index}%` }}
            viewport={{ once: true }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
        </div>

        <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
          <span>EXTREME FEAR</span>
          <span>EXTREME GREED</span>
        </div>

        <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
          <Activity className="w-3 h-3" strokeWidth={1.5} />
          {MOOD_DATA.trend}
        </p>
      </motion.div>
    </section>
  );
}
