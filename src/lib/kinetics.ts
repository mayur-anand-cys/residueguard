export const CHEMICALS = {
  Azoxystrobin: { phi: 15, dt50: 10, mrl_fssai: 2.0, mrl_eu: 2.0, eu_approved: true },
  Mancozeb: { phi: 21, dt50: 2, mrl_fssai: 0.5, mrl_eu: 0.01, eu_approved: false },
  Carbendazim: { phi: 30, dt50: 14, mrl_fssai: 0.1, mrl_eu: 0.01, eu_approved: false },
  Chlorpyrifos: { phi: 25, dt50: 12, mrl_fssai: 0.2, mrl_eu: 0.01, eu_approved: false },
  Imidacloprid: { phi: 20, dt50: 8, mrl_fssai: 0.5, mrl_eu: 0.05, eu_approved: false },
  Cypermethrin: { phi: 7, dt50: 5, mrl_fssai: 1.0, mrl_eu: 0.5, eu_approved: true }, 
} as const;

export type ChemicalName = keyof typeof CHEMICALS;
export type CropName = "Grapes" | "Pomegranate" | "Tomato" | "Chilli" | "Mango" | "Okra" | "Cotton";
export type Market = "Domestic" | "EU";
export type Verdict = "SAFE" | "DELAY_HARVEST" | "DO_NOT_USE";

export const CHEMICAL_NAMES = Object.keys(CHEMICALS) as ChemicalName[];
export const CROPS: CropName[] = ["Grapes", "Pomegranate", "Tomato", "Chilli", "Mango", "Okra", "Cotton"];

export interface ComplianceInput {
  crop: CropName;
  chemical: ChemicalName;
  market: Market;
  doseApplied: number;
  labelDose: number;
  daysToHarvest: number;
}

export interface ComplianceResult {
  k: number;
  doseAdj: number;
  marketAdj: number;
  msi: number;
  mrlTarget: number;
  phi: number;
  dt50: number;
  mrlFssai: number;
  mrlEu: number;
  euApproved: boolean;
  doseRatio: number;
  daysToHarvest: number;
  verdict: Verdict;
  title: string;
  reason: string;
  narrative: string;
  lotId: string;
}

const CROP_CODE: Record<CropName, string> = {
  Grapes: "GRA", Pomegranate: "POM", Tomato: "TOM", Chilli: "CHL", Mango: "MAN", Okra: "OKR", Cotton: "COT",
};

const CHEM_CODE: Record<ChemicalName, string> = {
  Azoxystrobin: "AZOX", Mancozeb: "MANC", Carbendazim: "CARB", Chlorpyrifos: "CHLR", Imidacloprid: "IMID", Cypermethrin: "CYPE",
};

export function lotId(crop: CropName, chemical: ChemicalName, days: number): string {
  const day = Math.max(0, Math.round(days));
  return `RG-${CROP_CODE[crop]}-${CHEM_CODE[chemical]}-${day}`;
}

export function decayConstant(dt50: number): number {
  return Math.log(2) / dt50;
}

export function residueAt(
  chemical: ChemicalName,
  doseApplied: number,
  labelDose: number,
  day: number,
): number {
  const spec = CHEMICALS[chemical];
  const k = decayConstant(spec.dt50);
  const ratio = doseApplied / labelDose;
  return spec.mrl_fssai * ratio * Math.exp(k * (spec.phi - day));
}

export function evaluate(input: ComplianceInput): ComplianceResult {
  const spec = CHEMICALS[input.chemical];
  const k = decayConstant(spec.dt50);
  const doseRatio = input.doseApplied / input.labelDose;
  const doseAdj = Math.log(doseRatio) / k;
  const mrlTarget = input.market === "EU" ? spec.mrl_eu : spec.mrl_fssai;
  const marketAdj = Math.max(0, Math.log(spec.mrl_fssai / mrlTarget) / k);
  const msi = Math.ceil(spec.phi + doseAdj + marketAdj);

  let verdict: Verdict;
  let title: string;
  let reason: string;

  if (input.market === "EU" && !spec.eu_approved) {
    verdict = "DO_NOT_USE";
    title = "DO NOT USE";
    reason = "Banned in EU. Default MRL 0.01 mg/kg.";
  } else if (input.daysToHarvest < msi) {
    verdict = "DELAY_HARVEST";
    title = "DELAY HARVEST";
    reason = `Wait ${formatDelta(msi - input.daysToHarvest)} more days. True MSI: ${msi} days.`;
  } else {
    verdict = "SAFE";
    title = "SAFE";
    reason = `Clear to harvest. True MSI: ${msi} days.`;
  }

  const doseDays = Math.round(doseAdj);
  const doseSign = doseDays > 0 ? "+" : "";
  const ratioLabel = formatRatio(doseRatio);
  const narrative = `You applied ${ratioLabel}x dose. First-order kinetics requires ${doseSign}${doseDays} days decay.`;

  return {
    k,
    doseAdj,
    marketAdj,
    msi,
    mrlTarget,
    phi: spec.phi,
    dt50: spec.dt50,
    mrlFssai: spec.mrl_fssai,
    mrlEu: spec.mrl_eu,
    euApproved: spec.eu_approved,
    doseRatio,
    daysToHarvest: input.daysToHarvest,
    verdict,
    title,
    reason,
    narrative,
    lotId: lotId(input.crop, input.chemical, input.daysToHarvest),
  };
}

export interface DecayPoint {
  day: number;
  residue: number;
}

export function auditDecayCurve(): DecayPoint[] {
  const points: DecayPoint[] = [];
  for (let day = 0; day <= 30; day += 1) {
    points.push({
      day,
      residue: round3(residueAt("Azoxystrobin", 1.5, 1.0, day)),
    });
  }
  return points;
}

export const AUDIT_LOT = {
  fpo: "Kolar Horticulture FPO",
  crop: "Grapes" as CropName,
  chemical: "Azoxystrobin" as ChemicalName,
  doseApplied: 1.5,
  labelDose: 1.0,
  market: "EU" as Market,
  lotId: "RG-GRA-AZOX-10",
};

export interface MoatRow {
  crop: CropName;
  ingredient: ChemicalName;
  phi: number;
  dt50: number;
  euMrl: number;
  euApproved: boolean;
}

export const DATA_MOAT: MoatRow[] = [
  {
    crop: "Grapes",
    ingredient: "Azoxystrobin",
    phi: CHEMICALS.Azoxystrobin.phi,
    dt50: CHEMICALS.Azoxystrobin.dt50,
    euMrl: CHEMICALS.Azoxystrobin.mrl_eu,
    euApproved: CHEMICALS.Azoxystrobin.eu_approved,
  },
  {
    crop: "Grapes",
    ingredient: "Mancozeb",
    phi: CHEMICALS.Mancozeb.phi,
    dt50: CHEMICALS.Mancozeb.dt50,
    euMrl: CHEMICALS.Mancozeb.mrl_eu,
    euApproved: CHEMICALS.Mancozeb.eu_approved,
  },
  {
    crop: "Pomegranate",
    ingredient: "Carbendazim",
    phi: CHEMICALS.Carbendazim.phi,
    dt50: CHEMICALS.Carbendazim.dt50,
    euMrl: CHEMICALS.Carbendazim.mrl_eu,
    euApproved: CHEMICALS.Carbendazim.eu_approved,
  },
];

export function formatMrl(value: number): string {
  if (value >= 1) return value.toFixed(1);
  if (value >= 0.1) return value.toFixed(2);
  return value.toFixed(2);
}

export function formatFixed(value: number, digits: number): string {
  return value.toFixed(digits);
}

function formatDelta(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return (Math.round(value * 10) / 10).toString();
}

function formatRatio(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? rounded.toFixed(1) : String(rounded);
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}