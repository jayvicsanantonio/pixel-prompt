import { z } from "zod";

import { MAX_ATTEMPTS_PER_LEVEL, PROMPT_CHARACTER_LIMIT, SCORE_BREAKDOWN_DIMENSIONS } from "@/lib/game";

const levelDifficultySchema = z.enum(["easy", "medium", "hard"]);

export const levelMetadataSchema = z.object({
  category: z.string().min(1),
  difficulty: levelDifficultySchema,
  theme: z.string().min(1),
  packId: z.string().min(1).optional(),
  groupId: z.string().min(1).optional(),
});

export const levelTargetImageSchema = z.object({
  assetKey: z.string().min(1),
  alt: z.string().min(1),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const levelContentSchema = levelMetadataSchema.extend({
  id: z.string().min(1),
  number: z.number().int().positive(),
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  threshold: z.number().min(0).max(100),
  promptCharacterLimit: z.literal(PROMPT_CHARACTER_LIMIT).default(PROMPT_CHARACTER_LIMIT),
  maxAttempts: z.literal(MAX_ATTEMPTS_PER_LEVEL).default(MAX_ATTEMPTS_PER_LEVEL),
  targetImage: levelTargetImageSchema,
});

export const levelCollectionSchema = z.array(levelContentSchema);

const tipRuleConditionsSchema = z.object({
  maxDimensionScore: z.number().min(0).max(100).optional(),
  minAttemptNumber: z.number().int().positive().optional(),
  levelCategories: z.array(z.string().min(1)).default([]),
  levelDifficulties: z.array(levelDifficultySchema).default([]),
  levelThemes: z.array(z.string().min(1)).default([]),
});

export const tipRuleSchema = z.object({
  id: z.string().min(1),
  dimension: z.enum(SCORE_BREAKDOWN_DIMENSIONS),
  title: z.string().min(1),
  body: z.string().min(1).max(240),
  priority: z.number().int().min(1).max(100).default(50),
  when: tipRuleConditionsSchema.default({
    levelCategories: [],
    levelDifficulties: [],
    levelThemes: [],
  }),
});

export const tipRuleCollectionSchema = z.array(tipRuleSchema);

export type LevelContent = z.infer<typeof levelContentSchema>;
export type TipRule = z.infer<typeof tipRuleSchema>;
export type LevelContentInput = z.input<typeof levelContentSchema>;
export type TipRuleInput = z.input<typeof tipRuleSchema>;

export function defineLevels(input: LevelContentInput[]) {
  return levelCollectionSchema.parse(input);
}

export function defineTipRules(input: TipRuleInput[]) {
  return tipRuleCollectionSchema.parse(input);
}
