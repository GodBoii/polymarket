import Nav from "./components/Nav";
import Hero from "./components/hero/Hero";
import WorldCupBoard from "./components/sections/WorldCupBoard";
import ProbabilityRivers from "./components/sections/ProbabilityRivers";
import MatchIntelligence from "./components/sections/MatchIntelligence";
import GlobalSentiment from "./components/sections/GlobalSentiment";
import TournamentExplorer from "./components/sections/TournamentExplorer";
import AIForecaster from "./components/sections/AIForecaster";
import MarketDiscovery from "./components/sections/MarketDiscovery";
import FinalCTA from "./components/sections/FinalCTA";
import Footer from "./components/Footer";

export default function Home() {
  return (
    <main className="relative">
      <Nav />
      <Hero />
      <div id="match">
        <MatchIntelligence />
      </div>
      <div id="sentiment">
        <GlobalSentiment />
      </div>
      <div id="tournaments">
        <TournamentExplorer />
      </div>
      <div id="ai">
        <AIForecaster />
      </div>
      <div id="discover">
        <MarketDiscovery />
      </div>
      <FinalCTA />
      <Footer />
    </main>
  );
}
