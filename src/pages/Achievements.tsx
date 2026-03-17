import { useState } from "react";
import { motion } from "framer-motion";
import { TickerTape } from "@/components/TickerTape";
import { Navbar } from "@/components/Navbar";
import { AchievementDoor } from "@/components/AchievementDoor";
import { AchievementsGrid } from "@/components/AchievementsGrid";
import { AchievementStats } from "@/components/AchievementStats";
import { CandlestickBackground } from "@/components/CandlestickBackground";
import { Footer } from "@/components/Footer";
import { DevMode } from "@/components/DevMode";

const Achievements = () => {
  const [doorOpen, setDoorOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <CandlestickBackground />
      <TickerTape />
      <Navbar />

      {!doorOpen && <AchievementDoor onOpen={() => setDoorOpen(true)} />}

      {doorOpen && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <AchievementsGrid />
          <AchievementStats />
        </motion.div>
      )}

      <Footer />
      <DevMode />
    </div>
  );
};

export default Achievements;
