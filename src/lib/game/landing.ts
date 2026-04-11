export type LandingResumeState =
  | {
      available: false;
      href: string;
      currentLevelNumber: null;
      currentLevelTitle: null;
      levelsCleared: number;
      attemptsRemaining: number;
      bestScore: null;
      helperText: string;
    }
  | {
      available: true;
      href: string;
      currentLevelId: string;
      currentLevelNumber: number;
      currentLevelTitle: string;
      levelsCleared: number;
      attemptsRemaining: number;
      bestScore: number;
      highestUnlockedLevelNumber: number;
      runId: string;
      helperText: string;
    };

export interface LandingExperienceState {
  analytics?: {
    anonymousPlayerId?: string;
    runId?: string;
  };
  startHref: string;
  resume: LandingResumeState;
}
