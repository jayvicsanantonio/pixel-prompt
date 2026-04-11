if (typeof window !== "undefined" && !process.env.VITEST) {
  throw new Error("This module can only be imported from the server runtime.");
}

export {};
