import { motion } from "framer-motion";
import { Heart, Sparkles } from "lucide-react";
import { TickerTape } from "@/components/TickerTape";
import { Navbar } from "@/components/Navbar";
import { DreamGirlChat } from "@/components/DreamGirlChat";
import { CandlestickBackground } from "@/components/CandlestickBackground";
import { Footer } from "@/components/Footer";

const DreamGirl = () => {
  return (
    <div className="min-h-screen bg-background">
      <CandlestickBackground />
      <TickerTape />
      <Navbar />

      <section className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono mb-6">
            <Heart className="w-3 h-3" strokeWidth={1.5} />
            <span>AI COMPANION • LIVE</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tighter mb-4">
            Meet <span className="neon-text">Luna</span>
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
            Your AI trading partner and companion. She knows the markets,
            celebrates your wins, and keeps you grounded during the dips.
          </p>
        </motion.div>

        <div className="flex flex-col lg:flex-row items-start justify-center gap-8">
          {/* Avatar area */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card p-8 flex flex-col items-center w-full lg:w-80 shrink-0"
          >
            <div className="w-48 h-48 rounded-full bg-gradient-to-br from-primary/20 via-primary/5 to-transparent border border-primary/20 flex items-center justify-center mb-6 relative">
              <Heart className="w-16 h-16 text-primary/50" strokeWidth={1} />
              <div className="absolute inset-0 rounded-full animate-pulse bg-primary/5" />
            </div>

            <h3 className="font-semibold text-lg mb-1">Luna</h3>
            <p className="text-xs text-primary font-mono flex items-center gap-1 mb-4">
              <Sparkles className="w-3 h-3" />
              AI Trading Companion
            </p>

            <div className="w-full space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-border/30">
                <span className="text-muted-foreground">Personality</span>
                <span className="text-foreground font-mono">Flirty · Smart · Supportive</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/30">
                <span className="text-muted-foreground">Mood</span>
                <span className="text-primary font-mono">Bullish 📈</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/30">
                <span className="text-muted-foreground">Specialty</span>
                <span className="text-foreground font-mono">Options & Crypto</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Status</span>
                <span className="text-primary font-mono">Watching NVDA</span>
              </div>
            </div>
          </motion.div>

          {/* Chat */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="w-full lg:flex-1 max-w-2xl"
          >
            <DreamGirlChat />
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default DreamGirl;
