import { handleSubmitAttempt } from "@/server/game/http";

export async function POST(request: Request) {
  return handleSubmitAttempt(request);
}
