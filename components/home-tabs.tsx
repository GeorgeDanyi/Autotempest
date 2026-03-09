"use client"

import Link from "next/link"

import { SearchHero } from "@/components/search-hero"
import { Waitlist } from "@/components/waitlist"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type TrendItem = {
  model_key: string
  title: string
  median_price_czk: number | null
  sample_size: number | null
}

type Props = {
  items: TrendItem[]
}

export function HomeTabs({ items }: Props) {
  const hasTrends = items.length > 0

  return (
    <Tabs defaultValue="search" className="w-full space-y-4">
      <TabsList>
        <TabsTrigger value="search">Hledat</TabsTrigger>
        <TabsTrigger value="trends">Price Trends</TabsTrigger>
      </TabsList>

      <TabsContent value="search">
        <div className="flex flex-col items-center gap-4 py-4 md:py-6">
          <SearchHero />
          <div className="w-full max-w-xl px-1 md:px-0">
            <Waitlist variant="home" />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="trends">
        <div className="space-y-3 py-4 md:py-6">
          <header className="space-y-1">
            <Badge className="w-fit text-[11px]">Price Trends CZ</Badge>
            <h2 className="text-base font-semibold tracking-tight md:text-lg">
              Price Trends CZ
            </h2>
            <p className="text-xs text-muted-foreground md:text-sm">
              Tržní ceny ojetin podle reálných inzerátů.
            </p>
          </header>

          {hasTrends ? (
            <>
              <section className="grid gap-3 md:grid-cols-3">
                {items.map((item) => (
                  <Card key={item.model_key}>
                    <CardHeader className="pb-2">
                      <CardTitle className="line-clamp-2 text-sm md:text-base">
                        {item.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs md:text-sm">
                      <div>
                        <p className="text-[11px] text-muted-foreground">
                          Mediánová cena
                        </p>
                        <p className="font-semibold">
                          {item.median_price_czk != null
                            ? new Intl.NumberFormat("cs-CZ", {
                                style: "currency",
                                currency: "CZK",
                                maximumFractionDigits: 0,
                              }).format(item.median_price_czk)
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">
                          Počet vzorků
                        </p>
                        <p>{item.sample_size ?? "—"}</p>
                      </div>
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="mt-2 h-8 rounded-full text-xs"
                      >
                        <Link href={`/price-trends/${item.model_key}`}>
                          Zobrazit detail
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </section>

              <div className="flex justify-center">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="mt-2 h-8 rounded-full px-4 text-xs md:text-sm"
                >
                  <Link href="/price-trends">Zobrazit všechny trendy</Link>
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Zatím nemáme k dispozici žádné agregované cenové statistiky.
            </p>
          )}
        </div>
      </TabsContent>
    </Tabs>
  )
}

