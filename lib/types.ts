export type Metric =
  | "revenue"
  | "operating-profit"
  | "operating-margin"
  | "net-profit"
  | "eps"
  | "headcount"
  | "fcf"
  | "deals";

export type Period =
  | "Q1 FY2026"
  | "Q2 FY2026"
  | "Q3 FY2026"
  | "Q4 FY2026"
  | "FY2026";

export type Currency = "USD" | "INR" | "percent" | "count";

export type Chunk = {
  id: string;
  metric: Metric;
  period: Period;
  currency: Currency;
  document: string;
  page: string;
  section: string;
  unitNote: string;
  columns: string[];
  rows: { label: string; cells: string[]; emphasize?: boolean }[];
  displayLabel: string;
  citation: string;
  value: string;
  prior: string;
  growth: string;
  periodEnd: string;
  calculatedGrowth?: boolean;
};

export type EvidenceView = {
  id: string;
  document: string;
  page: string;
  section: string;
  unitNote: string;
  columns: string[];
  rows: { label: string; cells: string[]; emphasize?: boolean }[];
  metric: string;
  unit: string;
};

export type AnswerResult = {
  question: string;
  found: boolean;
  headline: string;
  bullets: string[];
  footnote: string;
  citations: { id: string; label: string }[];
  table: { headers: string[]; rows: string[][] } | null;
  evidence: EvidenceView[];
};

export type RecentQuestion = {
  text: string;
  ago: string;
  timeLabel: string;
};
