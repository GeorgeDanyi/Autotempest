export interface CarGeneration {
  gen: string; // "I", "II", "III", "IV"
  label: string; // "Generace III (2013–2020)"
  from: number;
  to: number;
}

export const GENERATION_MAP: Record<string, CarGeneration[]> = {
  skoda_octavia: [
    { gen: "I", label: "Generace I (1996–2010)", from: 1996, to: 2010 },
    { gen: "II", label: "Generace II (2004–2013)", from: 2004, to: 2013 },
    { gen: "III", label: "Generace III (2013–2020)", from: 2013, to: 2020 },
    { gen: "IV", label: "Generace IV (2020–dosud)", from: 2020, to: 2030 },
  ],
  skoda_fabia: [
    { gen: "I", label: "Generace I (1999–2007)", from: 1999, to: 2007 },
    { gen: "II", label: "Generace II (2007–2014)", from: 2007, to: 2014 },
    { gen: "III", label: "Generace III (2014–2021)", from: 2014, to: 2021 },
    { gen: "IV", label: "Generace IV (2021–dosud)", from: 2021, to: 2030 },
  ],
  skoda_superb: [
    { gen: "I", label: "Generace I (2001–2008)", from: 2001, to: 2008 },
    { gen: "II", label: "Generace II (2008–2015)", from: 2008, to: 2015 },
    { gen: "III", label: "Generace III (2015–dosud)", from: 2015, to: 2030 },
  ],
  volkswagen_golf: [
    { gen: "VI", label: "Golf VI (2008–2012)", from: 2008, to: 2012 },
    { gen: "VII", label: "Golf VII (2012–2019)", from: 2012, to: 2019 },
    { gen: "VIII", label: "Golf VIII (2019–dosud)", from: 2019, to: 2030 },
  ],
  volkswagen_passat: [
    { gen: "B6", label: "Passat B6 (2005–2010)", from: 2005, to: 2010 },
    { gen: "B7", label: "Passat B7 (2010–2014)", from: 2010, to: 2014 },
    { gen: "B8", label: "Passat B8 (2014–dosud)", from: 2014, to: 2030 },
  ],
  volkswagen_tiguan: [
    { gen: "I", label: "Tiguan I (2007–2016)", from: 2007, to: 2016 },
    { gen: "II", label: "Tiguan II (2016–dosud)", from: 2016, to: 2030 },
  ],
  audi_a4: [
    { gen: "B7", label: "A4 B7 (2004–2008)", from: 2004, to: 2008 },
    { gen: "B8", label: "A4 B8 (2007–2015)", from: 2007, to: 2015 },
    { gen: "B9", label: "A4 B9 (2015–dosud)", from: 2015, to: 2030 },
  ],
  audi_a6: [
    { gen: "C6", label: "A6 C6 (2004–2011)", from: 2004, to: 2011 },
    { gen: "C7", label: "A6 C7 (2011–2018)", from: 2011, to: 2018 },
    { gen: "C8", label: "A6 C8 (2018–dosud)", from: 2018, to: 2030 },
  ],
  audi_a3: [
    { gen: "8P", label: "A3 8P (2003–2012)", from: 2003, to: 2012 },
    { gen: "8V", label: "A3 8V (2012–2020)", from: 2012, to: 2020 },
    { gen: "8Y", label: "A3 8Y (2020–dosud)", from: 2020, to: 2030 },
  ],
  bmw_3_series: [
    { gen: "E90", label: "3-series E90 (2005–2011)", from: 2005, to: 2011 },
    { gen: "F30", label: "3-series F30 (2011–2019)", from: 2011, to: 2019 },
    { gen: "G20", label: "3-series G20 (2018–dosud)", from: 2018, to: 2030 },
  ],
  bmw_5_series: [
    { gen: "E60", label: "5-series E60 (2003–2010)", from: 2003, to: 2010 },
    { gen: "F10", label: "5-series F10 (2009–2016)", from: 2009, to: 2016 },
    { gen: "G30", label: "5-series G30 (2016–dosud)", from: 2016, to: 2030 },
  ],
  bmw_x5: [
    { gen: "E53", label: "X5 E53 (1999–2006)", from: 1999, to: 2006 },
    { gen: "E70", label: "X5 E70 (2006–2013)", from: 2006, to: 2013 },
    { gen: "F15", label: "X5 F15 (2013–2018)", from: 2013, to: 2018 },
    { gen: "G05", label: "X5 G05 (2018–dosud)", from: 2018, to: 2030 },
  ],
  bmw_x3: [
    { gen: "E83", label: "X3 E83 (2003–2010)", from: 2003, to: 2010 },
    { gen: "F25", label: "X3 F25 (2010–2017)", from: 2010, to: 2017 },
    { gen: "G01", label: "X3 G01 (2017–dosud)", from: 2017, to: 2030 },
  ],
  toyota_corolla: [
    { gen: "E120", label: "Corolla E120 (2001–2007)", from: 2001, to: 2007 },
    { gen: "E150", label: "Corolla E150 (2006–2013)", from: 2006, to: 2013 },
    { gen: "E170", label: "Corolla E170 (2013–2019)", from: 2013, to: 2019 },
    { gen: "E210", label: "Corolla E210 (2018–dosud)", from: 2018, to: 2030 },
  ],
  ford_focus: [
    { gen: "Mk2", label: "Focus Mk2 (2004–2011)", from: 2004, to: 2011 },
    { gen: "Mk3", label: "Focus Mk3 (2011–2018)", from: 2011, to: 2018 },
    { gen: "Mk4", label: "Focus Mk4 (2018–dosud)", from: 2018, to: 2030 },
  ],
};

/**
 * Najde generaci pro daný model a rok.
 * Při překryvu generací vrátí mladší (vyšší from).
 */
export function findGeneration(
  modelKey: string,
  year: number,
): CarGeneration | null {
  const gens = GENERATION_MAP[modelKey];
  if (!gens) return null;

  const matches = gens.filter((g) => year >= g.from && year <= g.to);
  if (matches.length === 0) return null;

  // Při překryvu vrátíme mladší generaci
  return matches.sort((a, b) => b.from - a.from)[0] ?? null;
}

