"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Filter as FilterIcon, ArrowRight } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type SearchBarProps = {
  placeholder?: string;
};

export function SearchBar({ placeholder }: SearchBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [value, setValue] = useState("");

  useEffect(() => {
    const qp = searchParams.get("query") ?? "";
    setValue(qp);
  }, [searchParams]);

  const submit = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) {
      params.set("query", value.trim());
    } else {
      params.delete("query");
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="sticky top-16 z-30 mb-4 border-b border-slate-100 bg-white pb-4">
      <div className="rounded-2xl border border-slate-200/70 bg-white/90 px-4 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.06)] sm:px-5 sm:py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                placeholder ??
                "Popiš auto nebo model (např. Škoda Octavia 2019 2.0 TDI, 150 000 km)"
              }
              className="h-12 rounded-xl border-[rgba(148,163,184,0.45)] bg-white/85 pl-10 pr-4 text-sm placeholder:text-[#94A3B8] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_14px_32px_rgba(15,23,42,0.10)] focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:border-transparent focus-visible:ring-offset-0"
            />
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <FilterIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="flex justify-end sm:justify-start">
            <Button
              type="button"
              onClick={submit}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#5B8CFF] px-4 py-2.5 text-sm font-medium text-white shadow-[0_14px_35px_rgba(91,140,255,0.55)] transition hover:bg-[#729dff] sm:w-auto"
            >
              <span>Analyzovat trh</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

