"use client";

import Link from "next/link";
import { useEffect, useRef, type MutableRefObject, type ReactNode } from "react";
import type { LandingExperienceState, LandingResumeState } from "@/lib/game";
import { captureClientAnalyticsEvent } from "@/lib/analytics/client";

interface LandingAnalyticsProps {
  landingState: LandingExperienceState;
}

interface LandingLinkProps {
  children: ReactNode;
  className: string;
  href: string;
  landingState: LandingExperienceState;
}

function sendOneShotAnalytics(flagRef: MutableRefObject<boolean>, emitEvents: (occurredAt: string) => void) {
  if (flagRef.current) {
    return;
  }

  flagRef.current = true;
  emitEvents(new Date().toISOString());
}

function emitResumeEvents(
  anonymousPlayerId: string | undefined,
  resumeState: Extract<LandingResumeState, { available: true }>,
  occurredAt: string,
) {
  captureClientAnalyticsEvent({
    name: "game_started",
    occurredAt,
    anonymousPlayerId,
    runId: resumeState.runId,
    entry: "resume",
  });
  captureClientAnalyticsEvent({
    name: "resume_started",
    occurredAt,
    anonymousPlayerId,
    runId: resumeState.runId,
    currentLevelId: resumeState.currentLevelId,
  });
}

export function LandingAnalytics({ landingState }: LandingAnalyticsProps) {
  const hasTrackedLandingView = useRef(false);
  const anonymousPlayerId = landingState.analytics?.anonymousPlayerId;
  const landingRunId = landingState.analytics?.runId;

  useEffect(() => {
    if (hasTrackedLandingView.current) {
      return;
    }

    hasTrackedLandingView.current = true;
    const occurredAt = new Date().toISOString();

    captureClientAnalyticsEvent({
      name: "landing_viewed",
      occurredAt,
      anonymousPlayerId,
      runId: landingRunId,
    });

    if (landingState.resume.available) {
      captureClientAnalyticsEvent({
        name: "resume_offered",
        occurredAt,
        anonymousPlayerId,
        runId: landingState.resume.runId,
        levelId: landingState.resume.currentLevelId,
        levelNumber: landingState.resume.currentLevelNumber,
        highestUnlockedLevelNumber: landingState.resume.highestUnlockedLevelNumber,
      });
    }
  }, [anonymousPlayerId, landingRunId, landingState.resume]);

  return null;
}

export function NewRunLink({ children, className, href, landingState }: LandingLinkProps) {
  const hasTrackedStartClick = useRef(false);
  const anonymousPlayerId = landingState.analytics?.anonymousPlayerId;
  const landingRunId = landingState.analytics?.runId;

  return (
    <Link
      className={className}
      href={href}
      onClick={() => {
        sendOneShotAnalytics(hasTrackedStartClick, (occurredAt) => {
          captureClientAnalyticsEvent({
            name: "game_started",
            occurredAt,
            anonymousPlayerId,
            runId: landingRunId,
            entry: "new",
          });
        });
      }}
    >
      {children}
    </Link>
  );
}

export function ResumeRunLink({ children, className, href, landingState }: LandingLinkProps) {
  const hasTrackedResumeClick = useRef(false);
  const anonymousPlayerId = landingState.analytics?.anonymousPlayerId;
  const resumeState = landingState.resume;

  return (
    <Link
      className={className}
      href={href}
      onClick={() => {
        if (!resumeState.available) {
          return;
        }

        sendOneShotAnalytics(hasTrackedResumeClick, (occurredAt) => {
          emitResumeEvents(anonymousPlayerId, resumeState, occurredAt);
        });
      }}
    >
      {children}
    </Link>
  );
}
