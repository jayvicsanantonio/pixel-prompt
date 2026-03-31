export interface LandingResumeState {
  available: boolean;
  href: string;
  currentLevelNumber: number | null;
  currentLevelTitle: string | null;
  levelsCleared: number;
  attemptsRemaining: number;
  bestScore: number | null;
  helperText: string;
}

export interface LandingExperienceState {
  startHref: string;
  resume: LandingResumeState;
}
