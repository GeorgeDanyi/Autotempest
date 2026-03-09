export type ConfidenceLevel = "high" | "medium" | "low";

export function computeConfidence(sampleSize: number | null): {
  level: ConfidenceLevel;
  label: string;
  description: string;
} {
  if (!sampleSize || sampleSize < 5) {
    return {
      level: "low",
      label: "Málo dat",
      description:
        "Výsledek je orientační – máme zatím málo podobných aut.",
    };
  }

  if (sampleSize < 25) {
    return {
      level: "medium",
      label: "Orientační",
      description: "Výpočet vychází z menšího počtu aut.",
    };
  }

  return {
    level: "high",
    label: "Spolehlivý",
    description:
      "Výpočet vychází z dostatečného množství podobných aut.",
  };
}

