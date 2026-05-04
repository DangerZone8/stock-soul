import { motion } from "framer-motion";
import { TickerTape } from "@/components/TickerTape";
import { Navbar } from "@/components/Navbar";
import { TrackRecord } from "@/components/TrackRecord";
import { AchievementsGrid } from "@/components/AchievementsGrid";
import { AchievementStats } from "@/components/AchievementStats";
import { CandlestickBackground } from "@/components/CandlestickBackground";
import { Footer } from "@/components/Footer";
import { DevMode } from "@/components/DevMode";

const Achievements = () => {
  return (
    <div className="min-h-screen bg-background">
      <CandlestickBackground />
      <TickerTape />
      <Navbar />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <TrackRecord />
        <AchievementsGrid />
        <AchievementStats />
      </motion.div>

      <Footer />
      {import.meta.env.DEV && <DevMode />}
    </div>
  );
};

export default Achievements;
