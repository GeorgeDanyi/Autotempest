export type MakeKey =
  | "skoda"
  | "hyundai"
  | "toyota"
  | "volkswagen"
  | "bmw"
  | "kia"

export type SourceKey =
  | "sauto"
  | "tipcars"
  | "autoscout"
  | "bazos"
  | "mobileDe"

export const SOURCE_DISPLAY_NAMES: Record<SourceKey, string> = {
  sauto: "Sauto.cz",
  tipcars: "TipCars",
  autoscout: "Autoscout",
  bazos: "Bazoš",
  mobileDe: "Mobile.de",
}

export type Car = {
  id: string
  title: string
  makeKey: MakeKey
  model: string
  priceCZK: number
  year: number
  mileageKm: number
  fuelType: "benzín" | "nafta" | "hybrid" | "elektro" | "ostatní"
  transmission: "manuál" | "automat"
  location: string
  sourceKey: SourceKey
  sourceName: string
  sourceUrl: string
}

export const carsSample: Car[] = [
  {
    id: "1",
    title: "Škoda Octavia 2.0 TDI Style",
    makeKey: "skoda",
    model: "octavia",
    priceCZK: 429000,
    year: 2019,
    mileageKm: 132000,
    fuelType: "nafta",
    transmission: "manuál",
    location: "Praha",
    sourceKey: "sauto",
    sourceName: SOURCE_DISPLAY_NAMES.sauto,
    sourceUrl: "#",
  },
  {
    id: "2",
    title: "Hyundai i30 1.5 T-GDi Comfort",
    makeKey: "hyundai",
    model: "i30",
    priceCZK: 359000,
    year: 2021,
    mileageKm: 54000,
    fuelType: "benzín",
    transmission: "manuál",
    location: "Brno",
    sourceKey: "tipcars",
    sourceName: SOURCE_DISPLAY_NAMES.tipcars,
    sourceUrl: "#",
  },
  {
    id: "3",
    title: "Škoda Kodiaq 2.0 TDI 4x4 DSG",
    makeKey: "skoda",
    model: "kodiaq",
    priceCZK: 789000,
    year: 2020,
    mileageKm: 88000,
    fuelType: "nafta",
    transmission: "automat",
    location: "Plzeň",
    sourceKey: "sauto",
    sourceName: SOURCE_DISPLAY_NAMES.sauto,
    sourceUrl: "#",
  },
  {
    id: "4",
    title: "Toyota Corolla 1.8 Hybrid Comfort",
    makeKey: "toyota",
    model: "corolla",
    priceCZK: 519000,
    year: 2020,
    mileageKm: 61000,
    fuelType: "hybrid",
    transmission: "automat",
    location: "Ostrava",
    sourceKey: "autoscout",
    sourceName: SOURCE_DISPLAY_NAMES.autoscout,
    sourceUrl: "#",
  },
  {
    id: "5",
    title: "Volkswagen Golf 1.5 TSI Life",
    makeKey: "volkswagen",
    model: "golf",
    priceCZK: 449000,
    year: 2019,
    mileageKm: 99000,
    fuelType: "benzín",
    transmission: "manuál",
    location: "Praha",
    sourceKey: "bazos",
    sourceName: SOURCE_DISPLAY_NAMES.bazos,
    sourceUrl: "#",
  },
  {
    id: "6",
    title: "BMW 320d xDrive M Sport",
    makeKey: "bmw",
    model: "3",
    priceCZK: 899000,
    year: 2018,
    mileageKm: 125000,
    fuelType: "nafta",
    transmission: "automat",
    location: "Hradec Králové",
    sourceKey: "tipcars",
    sourceName: SOURCE_DISPLAY_NAMES.tipcars,
    sourceUrl: "#",
  },
  {
    id: "7",
    title: "Kia Ceed 1.6 CRDi Exclusive",
    makeKey: "kia",
    model: "ceed",
    priceCZK: 289000,
    year: 2018,
    mileageKm: 145000,
    fuelType: "nafta",
    transmission: "manuál",
    location: "České Budějovice",
    sourceKey: "tipcars",
    sourceName: SOURCE_DISPLAY_NAMES.tipcars,
    sourceUrl: "#",
  },
  {
    id: "8",
    title: "Škoda Fabia 1.0 TSI Ambition",
    makeKey: "skoda",
    model: "fabia",
    priceCZK: 249000,
    year: 2019,
    mileageKm: 88000,
    fuelType: "benzín",
    transmission: "manuál",
    location: "Liberec",
    sourceKey: "sauto",
    sourceName: SOURCE_DISPLAY_NAMES.sauto,
    sourceUrl: "#",
  },
]

