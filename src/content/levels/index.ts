import { defineLevels } from "@/content/schema";

export const levels = defineLevels([
  {
    id: "level-1",
    number: 1,
    slug: "sunlit-still-life",
    title: "Sunlit Still Life",
    description: "An easy warm-up focused on naming subject, material, and simple studio lighting.",
    category: "still-life",
    difficulty: "easy",
    theme: "studio",
    threshold: 50,
    targetImage: {
      assetKey: "targets/level-1.png",
      alt: "A sunlit still life arranged on a wooden table.",
    },
  },
  {
    id: "level-2",
    number: 2,
    slug: "midnight-alley-portrait",
    title: "Midnight Alley Portrait",
    description: "A portrait challenge that pushes players to name lighting, mood, and background context.",
    category: "portrait",
    difficulty: "medium",
    theme: "urban-night",
    threshold: 60,
    targetImage: {
      assetKey: "targets/level-2.png",
      alt: "A cinematic portrait in a wet alley lit by neon signs.",
    },
  },
  {
    id: "level-3",
    number: 3,
    slug: "ornate-courtyard",
    title: "Ornate Courtyard",
    description: "A harder scene that expects tighter control over architecture, era cues, and composition.",
    category: "environment",
    difficulty: "hard",
    theme: "historical",
    threshold: 70,
    targetImage: {
      assetKey: "targets/level-3.png",
      alt: "An ornate courtyard with layered arches and warm stone textures.",
    },
  },
]);
