import { TickerTape } from "@/components/TickerTape";
import { Navbar } from "@/components/Navbar";
import { AchievementsGrid } from "@/components/AchievementsGrid";
import { CandlestickBackground } from "@/components/CandlestickBackground";
import { Footer } from "@/components/Footer";
import { DevMode } from "@/components/DevMode";

const Achievements = () => {
  return (
    <div className="min-h-screen bg-background">
      <CandlestickBackground />
      <TickerTape />
      <Navbar />
      <AchievementsGrid />
      <Footer />
      <DevMode />
    </div>
  );
};

export default Achievements;
