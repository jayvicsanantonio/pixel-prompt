function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

export const uiCopy = {
  landing: {
    eyebrow: "Prompt Match Game",
    headline: "Study the image. Write the prompt. Beat the threshold.",
    summary:
      "Each level shows a target image. Write a short prompt, get a match score, and clear the level.",
    supportCopy:
      "You get up to 3 attempts per level, and missed tries turn into quick feedback instead of a dead end.",
    newRun: {
      label: "New Run",
      title: "Start fresh from Level 1",
      body: "Jump into the opening challenge and learn the loop by playing.",
      cta: "Start Game",
    },
    resume: {
      emptyLabel: "Resume saved run",
      unavailableHelper: "Resume appears here after your first scored attempt.",
      inProgressHelper: "Pick up the same run without replaying cleared progress.",
      failedHelper: "Jump back into the failed level with a fresh attempt cycle when you're ready.",
      replayHelper: "Replay any cleared level without losing your unlocked progress.",
      buildLabel(levelNumber: number | null, available: boolean) {
        return available && levelNumber ? `Resume Level ${levelNumber}` : this.emptyLabel;
      },
      buildProgressLine(currentLevelTitle: string, attemptsRemaining: number) {
        return `Continue at ${currentLevelTitle} with ${attemptsRemaining} ${pluralize(attemptsRemaining, "attempt")} left.`;
      },
      buildStatsLine(levelsCleared: number, bestScore: number) {
        return `Cleared ${levelsCleared} ${pluralize(levelsCleared, "level")} and banked a best score of ${bestScore}% on this run.`;
      },
    },
    stats: {
      promptBudget: "Prompt Budget",
      attemptsPerLevel: "Attempts Per Level",
      launchLevels: "Seeded Launch Levels",
    },
    roundStructure: {
      label: "Round Structure",
      title: "A fast loop that teaches observation through repetition",
      steps: [
        {
          title: "Study the target",
          body: "Look for subject, materials, lighting, and framing before you type anything.",
        },
        {
          title: "Write a tight prompt",
          body: "Use the short prompt budget to name the details that matter most.",
        },
        {
          title: "Score and retry",
          body: "Check the match score, tighten the draft, and try again if you need another pass.",
        },
      ],
    },
    levelPreview: {
      label: "Level Preview",
      title: "The first three thresholds scale from warm-up to precision",
      buildThresholdLabel(threshold: number) {
        return `Pass at ${threshold}% match`;
      },
    },
  },
  gameplay: {
    backToLanding: "Back to Landing",
    topBar: {
      level: "Level",
      requiredScore: "Required Score",
      attemptsLeft: "Attempts Left",
    },
    targetPanel: {
      eyebrow: "Target Image",
      caption: "Keep the target visible while you write so the key details stay in view.",
      expandCta: "Expand Target Image",
      expandHelper: "Use the larger study view on smaller screens when the framing needs a closer read.",
      expandedEyebrow: "Expanded Target",
      closeCta: "Close Study View",
      expandedCaption: "Inspect the composition, spacing, and light here, then jump back into the prompt.",
    },
    progress: {
      eyebrow: "Run Progress",
      title: "Unlocked levels stay with you",
      helper: "Replay any cleared level without lowering the farthest level you have already opened.",
      currentCta: "Current Level",
      openCta: "Open Level",
      active: "Active",
      passed: "Cleared",
      failed: "Failed",
      locked: "Locked",
      unlocked: "Unlocked",
      threshold: "Threshold",
      bestScore: "Best",
      attemptsLeft: "Attempts Left",
      activeBody: "This is the live level on the current run.",
      passedBody: "This level is banked and ready for replay.",
      failedBody: "Restart this level when you want a fresh attempt cycle.",
      lockedBody: "Clear the previous level to open this slot.",
      unlockedBody: "This level is open on the current run.",
    },
    active: {
      eyebrow: "Write Your Prompt",
      title: "Describe what matters before you submit",
      body: "Aim for subject, material, lighting, and composition. Keep the draft short and specific.",
      label: "Prompt",
      placeholder: "sunlit pears and green bottle on a wooden table, warm studio still life",
      submitCta: "Generate Match",
      guidance: "Press Cmd+Enter or Ctrl+Enter to submit without leaving the textarea.",
      helper: "Short, specific prompts are easier to improve on the next try.",
      emptyValidation: "Write a prompt before you submit.",
      buildOverLimitValidation(limit: number) {
        return `Keep the prompt at ${limit} characters or fewer.`;
      },
    },
    generating: {
      eyebrow: "Generating",
      title: "Building your match image",
      body: "Your prompt is in. Hold on while the image and score are prepared.",
      submittedPrompt: "Submitted Prompt",
      requiredScore: "Required Score",
      attemptsOnTheLine: "Attempts On The Line",
      nextState: "Next State",
      nextStateValue: "Result",
      helper: "Keep the target visible so you can compare as soon as the result is ready.",
      pendingCta: "Result incoming",
      workingCta: "Working...",
      revealCta: "Reveal Result",
      backCta: "Back to Prompt",
    },
    result: {
      eyebrow: "Result",
      title: "Compare the target against your generated match",
      body: "You get one percentage score. Compare the two images, then decide whether to continue or retry.",
      score: "Match Score",
      passedHeadline: "Threshold cleared",
      failedHeadline: "Below the pass line",
      buildPassedSummary(threshold: number, levelNumber: number) {
        return `This attempt clears the ${threshold}% requirement for Level ${levelNumber}.`;
      },
      buildFailedSummary(threshold: number) {
        return `This attempt misses the ${threshold}% requirement, so the next move is a tighter retry.`;
      },
      submittedPrompt: "Submitted Prompt",
      threshold: "Threshold",
      outcome: "Outcome",
      passOutcome: "Pass",
      retryOutcome: "Needs Retry",
      generatedImageEyebrow: "Generated Image",
      generatedImageTitle: "Match preview",
      generatedImageHelper: "Keep the target on the left and compare the biggest differences first.",
      generatedImageAlt(promptText: string) {
        return `Generated image preview for prompt: ${promptText}.`;
      },
      scoreUnavailable: "The attempt could not be scored.",
      buildResolvedSummary(score: number, threshold: number, passed: boolean) {
        return passed
          ? `Score ${score}% cleared the ${threshold}% pass score.`
          : `Score ${score}% missed the ${threshold}% pass score. Tighten the prompt and try again.`;
      },
      successCta: "See Success Options",
      retryCta: "See Retry Options",
      failureCta: "See Failure State",
      passedSecondaryCta: "Replay Prompt",
      failedSecondaryCta: "Adjust Prompt",
    },
    success: {
      eyebrow: "Level Cleared",
      buildTitle(hasNextLevel: boolean) {
        return hasNextLevel ? "Carry the momentum into the next image" : "Close out the run cleanly";
      },
      buildBody(hasNextLevel: boolean) {
        return hasNextLevel
          ? "You cleared the threshold. Move to the next level or replay this one for a stronger score."
          : "You cleared the last level. Open the summary or replay this level again.";
      },
      clearedWith: "Cleared With",
      unlocked: "Unlocked",
      unusedAttempts: "Unused Attempts",
      submittedPrompt: "Submitted Prompt",
      nextStepEyebrow: "Next Step",
      fallbackTitle: "Final summary comes next",
      buildNextStepCaption(nextLevelNumber: number | null) {
        return nextLevelNumber
          ? `Level ${nextLevelNumber} is ready to load with a fresh attempt counter.`
          : "Open the final summary to review every cleared level and jump into a replay.";
      },
      viewSummaryCta: "View Final Summary",
      replayCta: "Replay This Level",
    },
    retry: {
      eyebrow: "Retry Ready",
      title: "Take another pass while the comparison is still fresh",
      body: "You still have attempts left. Keep what worked and tighten the details that drifted.",
      attemptsLeft: "Attempts Left",
      buildHeadline(attemptsRemaining: number) {
        return attemptsRemaining === 1 ? "One retry remains" : "Retries remain";
      },
      summary: "Tighten the prompt around context, materials, or composition, then submit again.",
      currentScore: "Current Score",
      threshold: "Threshold",
      submittedPrompt: "Submitted Prompt",
      adviceEyebrow: "Retry Advice",
      adviceTitle: "Revise the draft, then resubmit",
      adviceBody: "The draft stays in the textarea, so you can change the key details instead of starting over.",
      reviseCta: "Revise Prompt",
      reviewCta: "Review Result Again",
    },
    failure: {
      eyebrow: "Level Failed",
      title: "The best try stays with you",
      body: "You can restart whenever you're ready. Keep the strongest score as your guide.",
      strongestAttempt: "Strongest Attempt",
      headline: "Close, but not through",
      summary: "Use the strongest attempt as your starting point for the restart.",
      threshold: "Threshold",
      lastResult: "Last Result",
      attemptsLeft: "Attempts Left",
      lastSubmittedPrompt: "Last Submitted Prompt",
      contextEyebrow: "Strongest Attempt Context",
      contextTitle: "What to carry into the restart",
      buildFallbackSummary(strongestAttemptScore: number, levelNumber: number) {
        return `Best score ${strongestAttemptScore}% on Level ${levelNumber}. Restart and tighten the biggest visual differences.`;
      },
      restartCta: "Restart Level",
      reviewCta: "Review Result Again",
    },
    summary: {
      eyebrow: "Run Complete",
      title: "You cleared the opening pack",
      body: "Review the run, check your best scores, and pick a level to replay next.",
      packResult: "Pack Result",
      headline: "All opening levels cleared",
      levelsCleared: "Levels Cleared",
      totalAttempts: "Total Attempts",
      improvementTrend: "Improvement Trend",
      replayEyebrow: "Replay Entry Points",
      replayTitle: "Best scores by cleared level",
      replayHelper: "Pick a cleared level and push the score higher, or come back when the next pack arrives.",
      nextReturn: "Next Return",
      encouragement: "Replay a cleared level now, or come back when the next pack lands.",
      buildImprovementSummary(improvementDelta: number, firstTitle: string | null, lastTitle: string | null, completedLevels: number) {
        if (!firstTitle || !lastTitle || completedLevels <= 1) {
          return "You cleared the opening run. Replay a level to push the score higher.";
        }

        return `You finished ${Math.abs(improvementDelta)} points ${
          improvementDelta >= 0 ? "stronger" : "lower"
        } on ${lastTitle} than on ${firstTitle}.`;
      },
      buildReplayMeta(bestScore: number, attemptsUsed: number) {
        return `Best score ${bestScore}% in ${attemptsUsed} scored ${pluralize(attemptsUsed, "attempt")}.`;
      },
      buildReplayCta(levelNumber: number) {
        return `Replay Level ${levelNumber}`;
      },
      replayFinalCta: "Replay Final Level",
      backCta: "Back to Landing",
    },
    errors: {
      attemptIncomplete: "The attempt could not be completed. Try again.",
      submitFailed: "The attempt could not be submitted. Try again.",
      actionFailed: "The level action could not be completed. Try again.",
    },
  },
} as const;
