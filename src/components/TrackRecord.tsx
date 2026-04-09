import { motion } from "framer-motion";
import { Award, Zap, TrendingUp } from "lucide-react";

const HIGHLIGHTS = [
  {
    gain: "+312%",
    title: "NVDA Earnings Play",
    tag: "Options",
    desc: "Called the earnings beat and rode weekly calls through the after-hours surge in just 72 hours.",
  },
  {
    gain: "+2,340%",
    title: "Zero to $1M Portfolio",
    tag: "Milestone",
    desc: "Started with savings, built a concentrated options portfolio during the AI boom since 2019.",
  },
  {
    gain: "+89%",
    title: "Crypto Winter Survivor",
    tag: "BTC / ETH",
    desc: "Navigated the crash by shorting overleveraged protocols and accumulating BTC at lows.",
  },
];

export function TrackRecord() {
  return (
    <section className="container mx-auto px-4 sm:px-6 py-16 sm:py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-8 sm:mb-12"
      >
        <div className="flex items-center gap-2 mb-3">
          <Award className="w-4 h-4 text-primary" strokeWidth={1.5} />
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            Top Performance
          </span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-semibold tracking-tighter mb-2">
          Rudra's <span className="text-primary">Highlights</span>
        </h2>
        <p className="text-muted-foreground text-sm sm:text-base max-w-lg">
          The trades and milestones that define the journey — verified, documented, real.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
        {HIGHLIGHTS.map((item, i) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-6 sm:p-8 group hover:border-primary/30 transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-mono font-medium">
                {item.tag}
              </span>
              <TrendingUp className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" strokeWidth={1.5} />
            </div>

            <div className="font-mono text-3xl sm:text-4xl font-bold text-primary mb-2">
              {item.gain}
            </div>
            <h3 className="text-lg font-semibold tracking-tight mb-3">
              {item.title}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {item.desc}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
