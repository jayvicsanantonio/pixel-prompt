import { cookies } from "next/headers";
import { ActiveLevelScreen } from "@/components/game/active-level-screen";
import { buildLiveActiveLevelState } from "@/server/game/live-state";
import { getSessionByToken, SESSION_COOKIE_NAME } from "@/server/game/session-store";

function getSingleQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

type PlayPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PlayPage(props: PlayPageProps) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = sessionToken ? await getSessionByToken(sessionToken) : null;
  const searchParams = await props.searchParams;
  const levelParam = getSingleQueryValue(searchParams.level);
  const parsedLevelNumber = levelParam ? Number.parseInt(levelParam, 10) : undefined;
  const levelNumber = parsedLevelNumber !== undefined && !Number.isNaN(parsedLevelNumber) ? parsedLevelNumber : undefined;
  const state = buildLiveActiveLevelState({
    requestedLevelNumber: levelNumber,
    preferResume: getSingleQueryValue(searchParams.resume) === "1",
    session,
  });

  return (
    <ActiveLevelScreen
      key={`${state.level.id}:${state.promptDraft}`}
      state={state}
      submissionEndpoint="/api/game/submit-attempt"
      restartLevelEndpoint="/api/game/restart-level"
      replayLevelEndpoint="/api/game/replay-level"
    />
  );
}
