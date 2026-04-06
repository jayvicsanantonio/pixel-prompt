import { handleResumeProgress } from "@/server/game/http";

export async function GET(request: Request) {
  return handleResumeProgress(request);
}
