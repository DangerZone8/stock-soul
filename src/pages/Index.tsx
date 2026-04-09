import { TickerTape } from "@/components/TickerTape";
import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { TrackRecord } from "@/components/TrackRecord";
import { MarketMood } from "@/components/MarketMood";
import { AICompanionSection } from "@/components/AICompanionSection";
import { QuickGuide } from "@/components/QuickGuide";
import { CandlestickBackground } from "@/components/CandlestickBackground";
import { Footer } from "@/components/Footer";
import { DevMode } from "@/components/DevMode";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <CandlestickBackground />
      <TickerTape />
      <Navbar />
      <HeroSection />
      <QuickGuide />
      <AICompanionSection />
      <TrackRecord />
      <MarketMood />
      <Footer />
      {import.meta.env.DEV && <DevMode />}
    </div>
  );
};

export default Index;
