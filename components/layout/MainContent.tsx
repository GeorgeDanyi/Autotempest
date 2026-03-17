"use client";

import { usePathname } from "next/navigation";
import { Container } from "@/components/layout/primitives";

export function MainContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAnalyze = pathname === "/analyze";
  const isHome = pathname === "/";

  if (isAnalyze) {
    return <div className="pt-14 sm:pt-16 lg:pt-20 pb-14 sm:pb-16 lg:pb-20">{children}</div>;
  }

  if (isHome) {
    return <div>{children}</div>;
  }

  return (
    <Container>
      <div className="py-10 sm:py-14 lg:py-18">{children}</div>
    </Container>
  );
}
