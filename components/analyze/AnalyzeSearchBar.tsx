"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter as FilterIcon, ArrowRight } from "lucide-react";

import { Input } from "@/components/ui/input";
import { GradientButton } from "@/components/price-trends/GradientButton";

type AnalyzeSearchBarProps = {
  className?: string;
  placeholder?: string;
};

export function AnalyzeSearchBar({
  className,
  placeholder,
}: AnalyzeSearchBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [value, setValue] = useState("");

  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    setValue(q);
  }, [searchParams]);

  const submit = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) {
      params.set("q", value.trim());
    } else {
      params.delete("q");
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className={className}>
      <div className="relative flex gap-3">
        <div className="relative flex-1">
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              placeholder ??
              "Popiš auto nebo model (např. Škoda Octavia 2019 2.0 TDI, 150 000 km)"
            }
            className="h-10 rounded-lg border border-slate-200/80 bg-white pl-9 pr-3 text-sm placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-slate-200 focus-visible:border-slate-300"
          />
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <FilterIcon className="h-3.5 w-3.5" />
          </span>
        </div>
        <GradientButton
          type="button"
          variant="primary"
          onClick={submit}
          rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
          className="h-10 shrink-0 px-4 text-sm"
        >
          Analyzovat
        </GradientButton>
      </div>
    </div>
  );
}

