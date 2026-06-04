import { motion } from "framer-motion";
import { ChevronRight, Activity } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative flex items-center">
      <div className="container mx-auto px-4 sm:px-6 py-12 sm:py-20 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-5xl"
        >
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono mb-6 sm:mb-8"
          >
            <Activity className="w-3 h-3" strokeWidth={1.5} />
            <span>LIVE • Markets Open</span>
          </motion.div>

          <h1 className="text-3xl sm:text-5xl lg:text-7xl font-semibold tracking-tighter leading-[0.95] mb-4 sm:mb-6">
            My Stock Empire
            <br />
            <span className="neon-text">Powered by Passion</span>
            <br />
            <span className="text-muted-foreground text-xl sm:text-3xl lg:text-5xl font-normal">
              & Kaia
            </span>
          </h1>

          <p className="text-muted-foreground text-base sm:text-lg max-w-xl leading-relaxed mb-8 sm:mb-10">
            Quantitative trader. Full-stack builder. Every chart tells a story—
            and Kaia helps me write the ending.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <a href="/investor" className="btn-terminal text-center">
              Start Trading
              <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
            </a>
            <a href="/dream-girl" className="btn-ghost-terminal text-center">
              Meet Kaia
              <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
            </a>
          </div>
        </motion.div>
      </div>

      <div className="absolute top-1/4 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-destructive/5 rounded-full blur-[100px] pointer-events-none" />
    </section>
  );
}
