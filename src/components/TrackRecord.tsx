import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Award, Clock, ChevronDown, ChevronUp, Zap } from "lucide-react";

const POSITIONS = [
  {
    id: "1",
    gain: "+312%",
    title: "NVDA Earnings Play",
    tag: "NVDA Options",
    duration: "72 hours",
    description:
      "Called the earnings beat and rode weekly calls through the after-hours surge.",
  },
  {
    id: "2",
    gain: "+2,340%",
    title: "Zero to $1M Portfolio",
    tag: "Portfolio Milestone",
    duration: "Since 2019",
    description:
      "Started with savings, built a concentrated options portfolio during the AI boom.",
  },
  {
    id: "3",
    gain: "+89%",
    title: "Crypto Winter Survivor",
    tag: "BTC / LUNA Crypto",
    duration: "Bear Market",
    description:
      "Navigated the crash by shorting overleveraged protocols and accumulating BTC at lows.",
  },
  {
    id: "4",
    gain: "Live",
    title: "AI Trading Bot",
    tag: "ALGO System",
    duration: "Ongoing",
    description:
      "Designed and deployed a Python/TypeScript trading system with ML pattern recognition.",
  },
];

export function TrackRecord() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <section className="container mx-auto px-4 pb-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-10"
      >
        <div className="flex items-center gap-2 mb-3">
          <Award className="w-4 h-4 text-primary" strokeWidth={1.5} />
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            Verified Positions
          </span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tighter">
          Track <span className="text-primary">Record</span>
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {POSITIONS.map((pos, i) => {
          const isOpen = expanded === pos.id;
          const isLive = pos.gain === "Live";
          return (
            <motion.div
              key={pos.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              onClick={() => setExpanded(isOpen ? null : pos.id)}
              className="glass-card-hover p-6 cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span
                    className={`font-mono text-2xl font-bold ${
                      isLive ? "text-primary animate-pulse" : "text-primary"
                    }`}
                  >
                    {pos.gain}
                  </span>
                  <h3 className="text-lg font-semibold tracking-tight mt-1">
                    {pos.title}
                  </h3>
                </div>
                {isOpen ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
                )}
              </div>

              <div className="flex items-center gap-3 text-xs mb-3">
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono">
                  {pos.tag}
                </span>
                <span className="flex items-center gap-1 text-muted-foreground font-mono">
                  <Clock className="w-3 h-3" strokeWidth={1.5} />
                  {pos.duration}
                </span>
              </div>

              <AnimatePresence>
                {isOpen && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-sm text-muted-foreground leading-relaxed overflow-hidden"
                  >
                    {pos.description}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
