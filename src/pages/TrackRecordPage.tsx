import { motion } from "framer-motion";
import { Award, TrendingUp } from "lucide-react";
import { TickerTape } from "@/components/TickerTape";
import { Navbar } from "@/components/Navbar";
import { TrackRecord } from "@/components/TrackRecord";
import { AchievementsGrid } from "@/components/AchievementsGrid";
import { AchievementStats } from "@/components/AchievementStats";
import { CandlestickBackground } from "@/components/CandlestickBackground";
import { Footer } from "@/components/Footer";

const TrackRecordPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <CandlestickBackground />
      <TickerTape />
      <Navbar />

      <section className="container mx-auto px-4 sm:px-6 py-8 sm:py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10 sm:mb-14"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono mb-4 sm:mb-6">
            <TrendingUp className="w-3 h-3" strokeWidth={1.5} />
            <span>TRACK RECORD & ACHIEVEMENTS</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tighter mb-3 sm:mb-4">
            Rudra's <span className="neon-text">Track Record</span>
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
            Verified trading positions, career milestones, and every achievement that built the empire.
          </p>
        </motion.div>
      </section>

      {/* Trading Positions */}
      <TrackRecord />

      {/* Career Achievements */}
      <AchievementsGrid />
      <AchievementStats />

      <Footer />
    </div>
  );
};

export default TrackRecordPage;
