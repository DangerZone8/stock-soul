import { TickerTape } from "@/components/TickerTape";
import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { TrackRecord } from "@/components/TrackRecord";
import { MarketMood } from "@/components/MarketMood";
import { AICompanionSection } from "@/components/AICompanionSection";
import { CandlestickBackground } from "@/components/CandlestickBackground";
import { Footer } from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <CandlestickBackground />
      <TickerTape />
      <Navbar />
      <HeroSection />
      <TrackRecord />
      <MarketMood />
      <AICompanionSection />
      <Footer />
    </div>
  );
};

export default Index;
