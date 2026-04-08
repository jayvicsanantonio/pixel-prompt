import { handleReplayLevel } from "@/server/game/http";

export async function POST(request: Request) {
  return handleReplayLevel(request);
}
