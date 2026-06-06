import Nav from "./components/Nav";
import Footer from "./components/Footer";
import Hero from "./components/arena/sections/Hero";
import Arena from "./components/arena/sections/Arena";
import ForecastEngine from "./components/arena/sections/ForecastEngine";
import WorldCupIntelligence from "./components/arena/sections/WorldCupIntelligence";
import LiveReasoning from "./components/arena/sections/LiveReasoning";
import Leaderboard from "./components/arena/sections/Leaderboard";
import WhyWeWin from "./components/arena/sections/WhyWeWin";
import Final from "./components/arena/sections/Final";

export default function Home() {
  return (
    <main className="relative">
      <Nav />
      <Hero />
      <Arena />
      <ForecastEngine />
      <WorldCupIntelligence />
      <LiveReasoning />
      <Leaderboard />
      <WhyWeWin />
      <Final />
      <Footer />
    </main>
  );
}
