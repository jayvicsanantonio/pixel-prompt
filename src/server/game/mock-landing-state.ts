import { levels, uiCopy } from "@/content";
import type { LandingExperienceState } from "@/lib/game";

interface MockLandingStateOptions {
  canResume?: boolean;
}

export function getMockLandingState(options?: MockLandingStateOptions): LandingExperienceState {
  const canResume = options?.canResume ?? false;
  const firstLevel = levels[0];
  const startHref = firstLevel ? `/play?level=${firstLevel.number}` : "/play";

  if (!canResume) {
    return {
      analytics: undefined,
      startHref,
      resume: {
        available: false,
        href: startHref,
        currentLevelNumber: null,
        currentLevelTitle: null,
        levelsCleared: 0,
        attemptsRemaining: 0,
        bestScore: null,
        helperText: uiCopy.landing.resume.unavailableHelper,
      },
    };
  }

  const currentLevel = levels[1] ?? firstLevel;

  if (!currentLevel) {
    throw new Error("No levels available to build landing state.");
  }

  return {
    analytics: {
      anonymousPlayerId: "player-mock",
      runId: "run-mock",
    },
    startHref,
    resume: {
      available: true,
      href: `/play?level=${currentLevel.number}&resume=1`,
      currentLevelId: currentLevel.id,
      currentLevelNumber: currentLevel.number,
      currentLevelTitle: currentLevel.title,
      levelsCleared: 1,
      attemptsRemaining: currentLevel.maxAttempts - 1,
      bestScore: 54,
      highestUnlockedLevelNumber: currentLevel.number,
      runId: "run-mock",
      helperText: uiCopy.landing.resume.inProgressHelper,
    },
  };
}
