import { TickerTape } from "@/components/TickerTape";
import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { TrackRecord } from "@/components/TrackRecord";
import { MarketMood } from "@/components/MarketMood";
import { QuickGuide } from "@/components/QuickGuide";
import { CandlestickBackground } from "@/components/CandlestickBackground";
import { Footer } from "@/components/Footer";
import { DevMode } from "@/components/DevMode";
import { HomeUserPanel } from "@/components/HomeUserPanel";
import { PersonalStats } from "@/components/PersonalStats";
import { WeeklyChallenge } from "@/components/WeeklyChallenge";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <CandlestickBackground />
      <TickerTape />
      <Navbar />
      <HeroSection />
      <PersonalStats />
      <HomeUserPanel />
      <WeeklyChallenge />
      <QuickGuide />
      <TrackRecord />
      <MarketMood />
      <Footer />
      {import.meta.env.DEV && <DevMode />}
    </div>
  );
};

export default Index;
