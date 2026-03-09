import type { SourceKey } from "@/lib/cars"

export type CarResult = {
  id: string
  title: string
  price: number
  year: number
  mileage: number
  fuel: string
  transmission: string
  location: string
  sourceKey: SourceKey
  sourceName: string
  sourceUrl: string
}

