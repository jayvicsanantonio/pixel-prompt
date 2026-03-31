import { ActiveLevelScreen } from "@/components/game/active-level-screen";
import { getMockActiveLevelState } from "@/server/game/mock-active-level-state";

export default function PlayPage() {
  return <ActiveLevelScreen state={getMockActiveLevelState()} />;
}
