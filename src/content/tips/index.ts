import { defineTipRules } from "@/content/schema";

export const tipRules = defineTipRules([
  {
    id: "tip-medium-specificity",
    dimension: "medium",
    title: "Name the image medium",
    body: "Say whether this should read like a photo, painting, poster, illustration, or 3D render instead of leaving the format implied.",
    priority: 55,
    when: {
      maxDimensionScore: 68,
      minAttemptNumber: 1,
    },
  },
  {
    id: "tip-subject-specificity",
    dimension: "subject",
    title: "Be more exact about the subject",
    body: "Name the main subject clearly and add the important supporting objects so the model is not forced to guess what belongs in frame.",
    priority: 65,
    when: {
      maxDimensionScore: 70,
      minAttemptNumber: 1,
    },
  },
  {
    id: "tip-context-specificity",
    dimension: "context",
    title: "Anchor the scene",
    body: "Add where the subject is, what surrounds it, and the mood of the setting so the background supports the same scene.",
    priority: 60,
    when: {
      maxDimensionScore: 68,
      minAttemptNumber: 1,
    },
  },
  {
    id: "tip-context-urban-night",
    dimension: "context",
    title: "Lock in the alley setting",
    body: "Call out the wet alley, neon signage, and late-night atmosphere directly so the portrait lands in the right environment.",
    priority: 72,
    when: {
      maxDimensionScore: 72,
      minAttemptNumber: 1,
      levelThemes: ["urban-night"],
    },
  },
  {
    id: "tip-style-specificity",
    dimension: "style",
    title: "Name the visual style",
    body: "If the target feels cinematic, painterly, retro, or editorial, say that plainly so the image picks the right visual language.",
    priority: 58,
    when: {
      maxDimensionScore: 68,
      minAttemptNumber: 1,
    },
  },
  {
    id: "tip-materials-specificity",
    dimension: "materials",
    title: "Describe the materials",
    body: "Mention what surfaces are made of, like glass, wood, stone, fabric, or metal, so the image gains the right physical cues.",
    priority: 57,
    when: {
      maxDimensionScore: 68,
      minAttemptNumber: 1,
    },
  },
  {
    id: "tip-materials-still-life",
    dimension: "materials",
    title: "Call out tabletop materials",
    body: "Still lifes get clearer when you name the tabletop and container materials, like wood, ceramic, or glass, instead of only the fruit.",
    priority: 70,
    when: {
      maxDimensionScore: 72,
      minAttemptNumber: 1,
      levelCategories: ["still-life"],
    },
  },
  {
    id: "tip-textures-specificity",
    dimension: "textures",
    title: "Add texture words",
    body: "Include texture cues like rough, glossy, cracked, wet, polished, or soft so the image does not feel too smooth or generic.",
    priority: 54,
    when: {
      maxDimensionScore: 66,
      minAttemptNumber: 1,
    },
  },
  {
    id: "tip-shapes-specificity",
    dimension: "shapes",
    title: "Describe the shapes",
    body: "Mention the important silhouettes or forms, like rounded fruit, narrow bottles, layered arches, or angular framing, to tighten the match.",
    priority: 53,
    when: {
      maxDimensionScore: 66,
      minAttemptNumber: 1,
    },
  },
  {
    id: "tip-composition-specificity",
    dimension: "composition",
    title: "Control the composition",
    body: "Say how elements are framed or arranged, such as close-up, centered, side profile, layered foreground, or tight tabletop crop.",
    priority: 67,
    when: {
      maxDimensionScore: 70,
      minAttemptNumber: 1,
    },
  },
  {
    id: "tip-time-period-specificity",
    dimension: "time_period",
    title: "Add era cues",
    body: "If the target suggests a historical or period look, name the era directly so architecture, clothing, and styling stay consistent.",
    priority: 56,
    when: {
      maxDimensionScore: 68,
      minAttemptNumber: 1,
    },
  },
  {
    id: "tip-time-period-historical",
    dimension: "time_period",
    title: "Spell out the historical era",
    body: "This scene needs stronger period language. Name the historical era or architectural tradition so the courtyard does not read as generic.",
    priority: 74,
    when: {
      maxDimensionScore: 74,
      minAttemptNumber: 1,
      levelThemes: ["historical"],
    },
  },
]);
