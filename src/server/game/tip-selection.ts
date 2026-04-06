import { tipRules, type TipRule } from "@/content";
import type { AttemptScore, Level, LevelAttempt, ScoreBreakdownDimension } from "@/lib/game";

const DEFAULT_MAX_TIPS = 2;

interface SelectRetryTipIdsInput {
  attemptNumber: number;
  level: Level;
  previousAttempts?: LevelAttempt[];
  rules?: TipRule[];
  score?: AttemptScore;
  maxTips?: number;
}

interface TipCandidate {
  dimension: ScoreBreakdownDimension;
  dimensionScore: number;
  rule: TipRule;
}

function matchesAudienceFilters(rule: TipRule, level: Level) {
  const { levelCategories, levelDifficulties, levelThemes } = rule.when;

  if (levelCategories.length > 0 && !levelCategories.includes(level.category)) {
    return false;
  }

  if (levelDifficulties.length > 0 && !levelDifficulties.includes(level.difficulty)) {
    return false;
  }

  if (levelThemes.length > 0 && !levelThemes.includes(level.theme)) {
    return false;
  }

  return true;
}

function chooseRuleForDimension(
  dimension: ScoreBreakdownDimension,
  dimensionScore: number,
  attemptNumber: number,
  level: Level,
  rules: TipRule[],
) {
  return rules
    .filter((rule) => {
      if (rule.dimension !== dimension) {
        return false;
      }

      if (!matchesAudienceFilters(rule, level)) {
        return false;
      }

      if (rule.when.minAttemptNumber != null && attemptNumber < rule.when.minAttemptNumber) {
        return false;
      }

      if (rule.when.maxDimensionScore != null && dimensionScore > rule.when.maxDimensionScore) {
        return false;
      }

      return true;
    })
    .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id))[0];
}

function buildTipCandidates(input: Required<Pick<SelectRetryTipIdsInput, "attemptNumber" | "level">> & {
  rules: TipRule[];
  score: AttemptScore;
}) {
  return Object.entries(input.score.breakdown ?? {})
    .flatMap(([dimension, rawScore]) => {
      if (typeof rawScore !== "number") {
        return [];
      }

      const rule = chooseRuleForDimension(
        dimension as ScoreBreakdownDimension,
        rawScore,
        input.attemptNumber,
        input.level,
        input.rules,
      );

      if (!rule) {
        return [];
      }

      return [
        {
          dimension: dimension as ScoreBreakdownDimension,
          dimensionScore: rawScore,
          rule,
        } satisfies TipCandidate,
      ];
    })
    .sort(
      (left, right) =>
        left.dimensionScore - right.dimensionScore ||
        right.rule.priority - left.rule.priority ||
        left.rule.id.localeCompare(right.rule.id),
    );
}

export function selectRetryTipIds(input: SelectRetryTipIdsInput) {
  if (!input.score || input.score.passed) {
    return [];
  }

  const candidates = buildTipCandidates({
    attemptNumber: input.attemptNumber,
    level: input.level,
    rules: input.rules ?? tipRules,
    score: input.score,
  });

  if (candidates.length === 0) {
    return [];
  }

  const previousTipIds = new Set((input.previousAttempts ?? []).flatMap((attempt) => attempt.result.tipIds));
  const unseenCandidates = candidates.filter((candidate) => !previousTipIds.has(candidate.rule.id));
  const repeatedCandidates = candidates.filter((candidate) => previousTipIds.has(candidate.rule.id));
  const limit = Math.max(1, input.maxTips ?? DEFAULT_MAX_TIPS);

  return [...unseenCandidates, ...repeatedCandidates].slice(0, limit).map((candidate) => candidate.rule.id);
}
