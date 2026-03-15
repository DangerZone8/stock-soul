import { motion } from "framer-motion";
import { TrendingUp, ChevronRight, Activity, DollarSign, Target, BarChart3, Users, Briefcase, Clock } from "lucide-react";

const METRICS = [
  { label: "Since", value: "2019", sub: "Trading Journey", icon: Clock },
  { label: "Net Liquidation", value: "$1.04M", sub: "Portfolio Value", icon: DollarSign },
  { label: "Total Returns", value: "$2.4M", sub: "+131% All-Time", icon: TrendingUp },
  { label: "Win Rate", value: "73.2%", sub: "All Trades", icon: Target },
  { label: "Verified Trades", value: "+312%", sub: "1,240+ All Trades", icon: BarChart3 },
  { label: "Logged Positions", value: "75%", sub: "Options & Crypto", icon: Briefcase },
  { label: "Students Taught", value: "3,200+", sub: "Options Masterclass", icon: Users },
];

export function HeroSection() {
  return (
    <section className="relative min-h-[85vh] flex items-center">
      <div className="container mx-auto px-4 py-20 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-5xl"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono mb-8"
          >
            <Activity className="w-3 h-3" strokeWidth={1.5} />
            <span>LIVE • Markets Open</span>
          </motion.div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-semibold tracking-tighter leading-[0.95] mb-6">
            My Stock Empire
            <br />
            <span className="neon-text">Powered by Passion</span>
            <br />
            <span className="text-muted-foreground text-3xl sm:text-4xl lg:text-5xl font-normal">
              & My Dream Girl
            </span>
          </h1>

          <p className="text-muted-foreground text-lg max-w-xl leading-relaxed mb-10">
            Quantitative trader. Full-stack builder. Every chart tells a story—
            and she helps me write the ending.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap gap-4 mb-16">
            <a href="/achievements" className="btn-terminal">
              <TrendingUp className="w-4 h-4" strokeWidth={1.5} />
              View Track Record
            </a>
            <a href="/dream-girl" className="btn-ghost-terminal">
              Meet My Dream Girl
              <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
            </a>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {METRICS.map((m, i) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.08 }}
                className="glass-card p-5"
              >
                <div className="flex items-center gap-2 mb-2">
                  <m.icon className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                  <div className="text-xs text-muted-foreground font-medium">{m.label}</div>
                </div>
                <div className="font-mono text-2xl font-bold text-primary mb-0.5">{m.value}</div>
                <div className="text-xs text-muted-foreground">{m.sub}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Gradient orbs */}
      <div className="absolute top-1/4 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-destructive/5 rounded-full blur-[100px] pointer-events-none" />
    </section>
  );
}
