import { ActiveLevelScreen } from "@/components/game/active-level-screen";
import { getMockActiveLevelState } from "@/server/game/mock-active-level-state";

function getSingleQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PlayPage(props: PageProps<"/play">) {
  const searchParams = await props.searchParams;
  const levelParam = getSingleQueryValue(searchParams.level);
  const parsedLevelNumber = levelParam ? Number.parseInt(levelParam, 10) : undefined;
  const levelNumber = parsedLevelNumber !== undefined && !Number.isNaN(parsedLevelNumber) ? parsedLevelNumber : undefined;
  const state = getMockActiveLevelState({
    levelNumber,
    resume: getSingleQueryValue(searchParams.resume) === "1",
  });

  return <ActiveLevelScreen key={`${state.level.id}:${state.promptDraft}`} state={state} />;
}
