import { handleRestartLevel } from "@/server/game/http";

export async function POST(request: Request) {
  return handleRestartLevel(request);
}
