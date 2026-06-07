import { TickerTape } from "@/components/TickerTape";
import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { MarketMood } from "@/components/MarketMood";
import { QuickGuide } from "@/components/QuickGuide";
import { CandlestickBackground } from "@/components/CandlestickBackground";
import { Footer } from "@/components/Footer";
import { DevMode } from "@/components/DevMode";
import { PersonalStats } from "@/components/PersonalStats";
import { WeeklyChallenge } from "@/components/WeeklyChallenge";
import { TournamentsTab } from "@/components/TournamentsTab";
import { AdminTournamentCreate } from "@/components/AdminTournamentCreate";
import { StreakCard } from "@/components/StreakCard";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <CandlestickBackground />
      <TickerTape />
      <Navbar />
      <HeroSection />
      <PersonalStats />
      <WeeklyChallenge />
      <section className="container mx-auto px-4 py-8 max-w-6xl space-y-4">
        <AdminTournamentCreate />
        <TournamentsTab market="all" />
      </section>
      <QuickGuide />
      <MarketMood />
      <Footer />
      {import.meta.env.DEV && <DevMode />}
    </div>
  );
};

export default Index;
