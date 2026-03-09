import { Suspense } from "react";
import { AnalyzePageClient } from "@/components/analyze/AnalyzePageClient";

export default function AnalyzePage() {
  return (
    <Suspense fallback={null}>
      <AnalyzePageClient />
    </Suspense>
  );
}

