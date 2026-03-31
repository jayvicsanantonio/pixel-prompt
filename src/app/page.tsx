import { LandingScreen } from "@/components/landing/landing-screen";
import { levels } from "@/content";
import { getMockLandingState } from "@/server/game/mock-landing-state";

export default function Home() {
  return <LandingScreen landingState={getMockLandingState()} levels={levels} />;
}
