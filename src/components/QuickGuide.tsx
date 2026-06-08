import { motion } from "framer-motion";
import { MessageSquare, Sun, TrendingUp, Lightbulb, HelpCircle, X } from "lucide-react";
import { useState } from "react";

const STEPS = [
  {
    icon: MessageSquare,
    title: "Talk to Kaia",
    desc: "Ask anything about stocks, crypto, or market news. She's always online.",
  },
  {
    icon: Sun,
    title: "Switch Themes",
    desc: "Use the sun/moon toggle in the top-right to flip between Light and Dark Mode.",
  },
  {
    icon: TrendingUp,
    title: "Get Live Prices",
    desc: "Kaia fetches fresh data from Yahoo Finance — never outdated, never guessed.",
  },
  {
    icon: Lightbulb,
    title: "Ask for Suggestions",
    desc: "Kaia gives her own take with clear reasons — hold, buy, or watch.",
  },
];

export function QuickGuide() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <section className="container mx-auto px-4 sm:px-6 pb-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="glass-card p-6 sm:p-8 max-w-4xl mx-auto relative"
      >
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
          aria-label="Dismiss guide"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <HelpCircle className="w-4 h-4 text-primary" strokeWidth={1.5} />
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            Quick Guide
          </span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tighter mb-6">
          How to Use <span className="text-primary">StockSoul</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex gap-4 p-4 rounded-xl bg-secondary/30 border border-border/20"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <span className="text-xs font-mono font-bold text-primary">{i + 1}</span>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <step.icon className="w-3.5 h-3.5 text-primary" strokeWidth={1.5} />
                  <h3 className="text-sm font-semibold">{step.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
