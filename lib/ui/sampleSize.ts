export type SampleTier = "small" | "medium" | "large";

export function getSampleTier(n: number): SampleTier {
  if (n < 15) return "small";
  if (n <= 50) return "medium";
  return "large";
}

export function formatInzeraty(n: number): string {
  if (n === 1) return "1 inzerát";
  if (n >= 2 && n <= 4) return `${n} inzeráty`;
  return `${n} inzerátů`;
}

export function formatVozu(n: number): string {
  if (n === 1) return "1 vozu";
  if (n >= 2 && n <= 4) return `${n} vozů`;
  return `${n} vozů`;
}

export function getSampleBadge(n: number): { text: string; tier: SampleTier } {
  const tier = getSampleTier(n);
  if (tier === "small") return { text: `Vzorek: ${n} vozů · nižší spolehlivost`, tier };
  if (tier === "medium") return { text: `Analyzováno: ${n} vozů`, tier };
  return { text: `Aktivní trh · ${n} vozů`, tier };
}

