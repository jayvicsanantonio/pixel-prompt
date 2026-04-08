import { cookies } from "next/headers";
import { LandingScreen } from "@/components/landing/landing-screen";
import { levels } from "@/content";
import { buildLandingExperience } from "@/server/game/session-state";
import { getSessionByToken, SESSION_COOKIE_NAME } from "@/server/game/session-store";

export default async function Home() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = sessionToken ? await getSessionByToken(sessionToken) : null;

  return <LandingScreen landingState={buildLandingExperience(session, levels)} levels={levels} />;
}
