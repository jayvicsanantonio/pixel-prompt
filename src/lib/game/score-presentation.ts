import type { AttemptScore } from "./types";

export interface PlayerFacingScore {
  percentage: number;
  passed: boolean;
  threshold: number;
}

export function toPlayerFacingScore(score: AttemptScore): PlayerFacingScore {
  return {
    percentage: Math.floor(score.normalized),
    passed: score.passed,
    threshold: score.threshold,
  };
}
