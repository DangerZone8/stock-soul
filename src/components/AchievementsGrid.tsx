import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, TrendingUp, Calendar, Award } from "lucide-react";

const ACHIEVEMENTS = [
  {
    id: "1",
    title: "Turned $10K → $147K",
    metric: "+1,370%",
    metricLabel: "Total Return",
    period: "2022–2024",
    teaser: "Started with savings, built a concentrated options portfolio during the AI boom.",
    description: "Through careful analysis of the semiconductor supply chain and early identification of the AI infrastructure build-out, I positioned a concentrated portfolio in NVDA, AMD, and AVGO options. Managed risk through rolling strikes and maintaining strict position sizing rules. The portfolio peaked at $147K before taking profits.",
  },
  {
    id: "2",
    title: "NVDA Earnings Play",
    metric: "+312%",
    metricLabel: "Single Trade",
    period: "May 2024",
    teaser: "Called the earnings beat and rode weekly calls through the after-hours surge.",
    description: "Identified unusual options flow 3 days before NVDA earnings. Bought weekly $880 calls at $8.20, sold at $34 after-hours when NVDA beat estimates by 18%. Total position return: 312% in 72 hours.",
  },
  {
    id: "3",
    title: "Built an AI Trading Bot",
    metric: "73.2%",
    metricLabel: "Win Rate",
    period: "2023–Present",
    teaser: "Full-stack algo trading system scanning 4,000+ tickers for momentum patterns.",
    description: "Designed and deployed a Python/TypeScript trading system using technical indicators, sentiment analysis from financial news APIs, and machine learning pattern recognition. The bot scans pre-market movers and executes momentum trades with automated stop-losses. Backtested across 5 years of data.",
  },
  {
    id: "4",
    title: "Zero to $1M Portfolio",
    metric: "$1.04M",
    metricLabel: "Net Liquidation",
    period: "Jan 2025",
    teaser: "Crossed the seven-figure milestone through compounding and disciplined risk management.",
    description: "Milestone achieved through a combination of active trading (40%), long-term equity positions (35%), and crypto exposure (25%). Key principles: never risk more than 5% on any single trade, always have a thesis, and compound aggressively during high-conviction setups.",
  },
  {
    id: "5",
    title: "Options Masterclass",
    metric: "500+",
    metricLabel: "Students Taught",
    period: "2024",
    teaser: "Launched a private community teaching retail traders professional-grade options strategies.",
    description: "Created a 12-module course covering everything from basic Greeks to advanced spread strategies. Community grew organically through verified track record sharing. Average student portfolio improvement: +34% in first 6 months of applying the methodology.",
  },
  {
    id: "6",
    title: "Crypto Winter Survivor",
    metric: "+89%",
    metricLabel: "Recovery Return",
    period: "2022–2023",
    teaser: "Navigated the crash by shorting overleveraged protocols and accumulating BTC at lows.",
    description: "When LUNA/UST collapsed, I had already positioned short via put options on crypto-exposed stocks. Used profits to dollar-cost average into BTC between $16K-$20K. The combined strategy yielded 89% returns during what most traders considered a devastating period.",
  },
];

export function AchievementsGrid() {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedAch = ACHIEVEMENTS.find((a) => a.id === selected);

  return (
    <section className="container mx-auto px-4 py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-12"
      >
        <div className="flex items-center gap-2 mb-3">
          <Award className="w-4 h-4 text-primary" strokeWidth={1.5} />
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            Track Record
          </span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tighter">
          Career <span className="text-primary">Achievements</span>
        </h2>
        <p className="text-muted-foreground mt-2 max-w-lg">
          Every trade is a lesson. Here are the milestones that shaped my journey.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ACHIEVEMENTS.map((ach, i) => (
          <motion.div
            key={ach.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            onClick={() => setSelected(ach.id)}
            className="glass-card-hover p-6 cursor-pointer group"
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
              <Calendar className="w-3 h-3" strokeWidth={1.5} />
              <span className="font-mono">{ach.period}</span>
            </div>

            <h3 className="text-lg font-semibold tracking-tight mb-3 group-hover:text-primary transition-colors">
              {ach.title}
            </h3>

            <div className="flex items-baseline gap-2 mb-3">
              <span className="font-mono text-2xl font-bold text-primary">{ach.metric}</span>
              <span className="text-xs text-muted-foreground">{ach.metricLabel}</span>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">{ach.teaser}</p>

            <div className="mt-4 flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
              <TrendingUp className="w-3 h-3" strokeWidth={1.5} />
              <span>Read more</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedAch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card p-8 max-w-lg w-full relative"
            >
              <button
                onClick={() => setSelected(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>

              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4 font-mono">
                <Calendar className="w-3 h-3" strokeWidth={1.5} />
                {selectedAch.period}
              </div>

              <h3 className="text-2xl font-semibold tracking-tight mb-2">{selectedAch.title}</h3>

              <div className="flex items-baseline gap-2 mb-6">
                <span className="font-mono text-3xl font-bold text-primary">{selectedAch.metric}</span>
                <span className="text-sm text-muted-foreground">{selectedAch.metricLabel}</span>
              </div>

              <p className="text-muted-foreground leading-relaxed">{selectedAch.description}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
