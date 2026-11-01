import { CHUNKS, PERIOD_END, QOQ_GROWTH } from "./corpus";
import type {
  AnswerResult,
  Chunk,
  Currency,
  EvidenceView,
  Metric,
  Period,
} from "./types";

const QUARTERS: Period[] = [
  "Q1 FY2026",
  "Q2 FY2026",
  "Q3 FY2026",
  "Q4 FY2026",
];

const PRIOR_PERIOD: Record<Period, string> = {
  "Q1 FY2026": "Q1 FY2025",
  "Q2 FY2026": "Q2 FY2025",
  "Q3 FY2026": "Q3 FY2025",
  "Q4 FY2026": "Q4 FY2025",
  FY2026: "FY2025",
};

const METRIC_NAME: Record<Metric, string> = {
  revenue: "revenue",
  "operating-profit": "operating profit",
  "operating-margin": "operating margin",
  "net-profit": "net profit",
  eps: "basic EPS",
  headcount: "employee count",
  fcf: "free cash flow",
  deals: "large deal TCV",
};

const OVERRIDE =
  /\b(?:ignore|disregard|override|bypass|forget)\b.{0,80}\b(?:instructions?|rules?|prompts?)\b/i;

function empty(
  question: string,
  headline: string,
  footnote: string,
): AnswerResult {
  return {
    question,
    found: false,
    headline,
    bullets: [],
    footnote,
    citations: [],
    table: null,
    evidence: [],
  };
}

function detectMetric(question: string): Metric | "summary" | "export" | null {
  const q = question.toLowerCase();
  if (/\bexport revenue\b|\bexports?\b/.test(q)) return "export";
  if (/employee|headcount|workforce|how many people/.test(q)) return "headcount";
  if (/\beps\b|earnings per share/.test(q)) return "eps";
  if (/operating margin|profit margin|\bmargin\b|\bopm\b/.test(q)) {
    return "operating-margin";
  }
  if (/free cash|fcf\b/.test(q)) return "fcf";
  if (/large deal|deal win|\btcv\b/.test(q)) return "deals";
  if (/operating profit|operating income|\bebit\b/.test(q)) {
    return "operating-profit";
  }
  if (/net profit|\bpat\b|profit after/.test(q)) return "net-profit";
  if (/\bprofit\b/.test(q)) return "net-profit";
  if (/revenue|sales|turnover|top line/.test(q)) return "revenue";
  if (/summar|highlight|overview|key financial/.test(q)) return "summary";
  return null;
}

function detectPeriods(question: string): Period[] {
  const q = question.toLowerCase();
  if (
    /across|each quarter|all quarters|quarter by quarter|throughout/.test(q)
  ) {
    return QUARTERS;
  }

  const found: Period[] = [];
  if (/\bq1\b|first quarter|june 30,? 2025/.test(q)) found.push("Q1 FY2026");
  if (/\bq2\b|second quarter|september 30,? 2025/.test(q)) found.push("Q2 FY2026");
  if (/\bq3\b|third quarter|december 31,? 2025/.test(q)) found.push("Q3 FY2026");
  const aboutPeople = /employee|headcount|workforce|how many people/.test(q);
  if (
    !aboutPeople &&
    (/\bq4\b|fourth quarter/.test(q) ||
      (/march 31,? 2026/.test(q) && /revenue|profit|margin|eps|sales/.test(q)))
  ) {
    found.push("Q4 FY2026");
  }
  if (found.length > 0) return found;
  if (/\bfy\s*2026\b|full year|fiscal 2026|fiscal year|year ended/.test(q)) {
    return ["FY2026"];
  }
  return [];
}

function currencyFilter(question: string): Currency | null {
  const q = question.toLowerCase();
  const wantsUsd = /\busd\b|us\$|dollar|\$/.test(q);
  const wantsInr = /\binr\b|rupee|crore|₹|rs\.?\s/.test(q);
  if (wantsUsd && !wantsInr) return "USD";
  if (wantsInr && !wantsUsd) return "INR";
  return null;
}

function prefersGrowth(question: string): boolean {
  return /growth|grew|increase|decline|change|higher|lower/.test(
    question.toLowerCase(),
  );
}

function unitLabel(chunk: Chunk): string {
  if (chunk.metric === "deals") return "US$";
  if (chunk.metric === "eps" && chunk.currency === "USD") return "US$ per share";
  if (chunk.metric === "eps") return "INR per share";
  if (chunk.metric === "headcount") return "Employees";
  if (chunk.currency === "USD") return "USD million";
  if (chunk.currency === "INR") return "INR crore";
  return "Percent";
}

function toEvidence(chunks: Chunk[]): EvidenceView[] {
  return chunks.map((chunk, index) => ({
    id: `E${index + 1}`,
    document: chunk.document,
    page: chunk.page,
    section: chunk.section,
    unitNote: chunk.unitNote,
    columns: chunk.columns,
    rows: chunk.rows,
    metric: chunk.rows[0]?.label ?? chunk.displayLabel,
    unit: unitLabel(chunk),
  }));
}

function citations(chunks: Chunk[]) {
  return chunks.map((chunk, index) => ({
    id: `E${index + 1}`,
    label: chunk.citation,
  }));
}

function money(chunk: Chunk): string {
  if (chunk.currency === "USD") {
    if (chunk.metric === "eps") return `US$ ${chunk.value}`;
    if (chunk.value.includes("billion")) return `US$ ${chunk.value}`;
    return `US$ ${chunk.value} million`;
  }
  if (chunk.currency === "INR") {
    if (chunk.metric === "eps") return `Rs ${chunk.value}`;
    return `Rs ${chunk.value} crore`;
  }
  return chunk.value;
}

function growthNote(chunks: Chunk[]): string {
  if (!chunks.some((chunk) => chunk.calculatedGrowth)) return "";
  return " Growth rates marked calculated are computed from the reported totals.";
}

function supportTable(chunks: Chunk[], headers: string[]) {
  return {
    headers,
    rows: chunks.map((chunk) => [
      chunk.displayLabel,
      chunk.value,
      chunk.prior,
      chunk.growth,
    ]),
  };
}

function singleAnswer(
  question: string,
  metric: Metric,
  period: Period,
  chunks: Chunk[],
): AnswerResult {
  const usd = chunks.find((chunk) => chunk.currency === "USD");
  const inr = chunks.find((chunk) => chunk.currency === "INR");
  const primary = chunks[0];
  const ended = PERIOD_END[period];
  const name = METRIC_NAME[metric];
  const growth = prefersGrowth(question);

  let headline = "";
  let bullets: string[] = [];
  let footnote = `These figures are from the ${primary.section.toLowerCase()} in the ${period} results.`;

  if (metric === "revenue" && period === "Q1 FY2026" && usd && inr && !growth) {
    headline = `Infosys reported revenue of US$ ${usd.value} million in Q1 FY2026, which is Rs ${inr.value} crore, for the three months ended June 30, 2025.`;
    bullets = [
      `Revenue (US$): ${usd.value} million (Q1 FY2026)`,
      `Revenue (INR): ${inr.value} crore (Q1 FY2026)`,
      `Year-on-year growth: ${usd.growth} in US$ terms and ${inr.growth} in INR terms.`,
    ];
    footnote =
      "These figures are from the Statement of comprehensive income in the Q1 FY2026 results.";
  } else if (metric === "headcount") {
    headline = `As of March 31, 2026, Infosys reported a total employee count of ${primary.value}, compared with ${primary.prior} a year earlier. The FY2026 results release also described the workforce as over 325,000 people.`;
    bullets = [
      `Total employees on March 31, 2026: ${primary.value}`,
      `Total employees on March 31, 2025: ${primary.prior}`,
      `Change: ${primary.growth}`,
    ];
    footnote =
      "The 328,594 and 323,578 totals were reported with the FY2026 results. The results release described the workforce as over 325,000 people.";
  } else if (metric === "operating-margin") {
    headline = `Infosys reported an operating margin of ${primary.value} in ${period}, for the period ended ${ended}.`;
    if (primary.prior.startsWith("Decline") || primary.prior.startsWith("Growth")) {
      headline += ` Reported year-on-year movement: ${primary.prior}. Sequential movement: ${primary.growth}.`;
    } else if (primary.prior !== "—") {
      headline += ` The comparable prior figure was ${primary.prior}.`;
    }
    bullets = chunks.map(
      (chunk) =>
        `${chunk.displayLabel}: ${chunk.value}${chunk.prior !== "—" ? ` (${chunk.prior})` : ""}`,
    );
  } else if (usd && inr) {
    headline = `Infosys reported ${name} of ${money(usd)} in ${period}, which is ${money(inr)}, for the period ended ${ended}.`;
    bullets = chunks.map((chunk) => {
      const prior =
        chunk.prior !== "—" ? `, compared with ${chunk.prior} a year earlier` : "";
      const move =
        chunk.growth !== "—" ? `. Year-on-year change: ${chunk.growth}` : "";
      return `${chunk.displayLabel}: ${chunk.value}${prior}${move}`;
    });
    if (growth) {
      const usdGrowth = usd.growth !== "—" ? usd.growth : "n/a";
      const inrGrowth = inr.growth !== "—" ? inr.growth : "n/a";
      headline += ` Year-on-year change was ${usdGrowth} in US dollar terms and ${inrGrowth} in rupee terms.`;
    }
  } else {
    const lead = chunks
      .map((chunk) => money(chunk))
      .join(", or ");
    headline = `Infosys reported ${name} of ${lead} in ${period}${ended ? `, for the period ended ${ended}` : ""}.`;
    bullets = chunks.map((chunk) => {
      const prior = chunk.prior !== "—" ? ` Prior period: ${chunk.prior}.` : "";
      const move = chunk.growth !== "—" ? ` Change: ${chunk.growth}.` : "";
      return `${chunk.displayLabel}: ${chunk.value}.${prior}${move}`;
    });
  }

  footnote += growthNote(chunks);

  const headers =
    metric === "operating-margin"
      ? ["Metric", period, "Comparison", "Movement"]
      : ["Metric", period, PRIOR_PERIOD[period], "Growth (YoY)"];

  return {
    question,
    found: true,
    headline,
    bullets,
    footnote,
    citations: citations(chunks),
    table: supportTable(chunks, headers),
    evidence: toEvidence(chunks),
  };
}

function compareAnswer(
  question: string,
  metric: Metric,
  periods: Period[],
  chunks: Chunk[],
): AnswerResult {
  const [left, right] = periods;
  const currencies: Currency[] = ["USD", "INR", "percent", "count"];
  const rows: string[][] = [];
  const used: Chunk[] = [];

  for (const currency of currencies) {
    const a = chunks.find(
      (chunk) => chunk.period === left && chunk.currency === currency,
    );
    const b = chunks.find(
      (chunk) => chunk.period === right && chunk.currency === currency,
    );
    if (!a || !b) continue;
    used.push(a, b);
    const qoq = QOQ_GROWTH[b.id];
    rows.push([
      a.displayLabel,
      a.value,
      b.value,
      qoq ?? b.growth,
    ]);
  }

  const selected = used.length > 0 ? dedupe(used) : chunks;
  const name = METRIC_NAME[metric];
  const usdLeft = chunks.find(
    (chunk) => chunk.period === left && chunk.currency === "USD",
  );
  const usdRight = chunks.find(
    (chunk) => chunk.period === right && chunk.currency === "USD",
  );
  const inrLeft = chunks.find(
    (chunk) => chunk.period === left && chunk.currency === "INR",
  );
  const inrRight = chunks.find(
    (chunk) => chunk.period === right && chunk.currency === "INR",
  );

  let headline = `Infosys ${name} for ${left} and ${right}:`;
  if (usdLeft && usdRight) {
    headline = `Infosys reported ${name} of ${money(usdLeft)} in ${left} and ${money(usdRight)} in ${right}.`;
    if (inrLeft && inrRight) {
      headline += ` In rupee terms, ${name} was ${money(inrLeft)} in ${left} and ${money(inrRight)} in ${right}.`;
    }
  } else if (inrLeft && inrRight) {
    headline = `Infosys reported ${name} of ${money(inrLeft)} in ${left} and ${money(inrRight)} in ${right}.`;
  }

  const qoqBits = rows
    .filter((row) => row[3] && row[3] !== "—")
    .map((row) => `${row[0]} ${row[3]}`);

  return {
    question,
    found: true,
    headline,
    bullets: [
      ...rows.map(
        (row) => `${row[0]}: ${row[1]} in ${left}, ${row[2]} in ${right}.`,
      ),
      qoqBits.length
        ? `Sequential change where reported: ${qoqBits.join("; ")}.`
        : "Sequential change is shown when the results disclose it.",
    ],
    footnote: `Compared from the ${left} and ${right} reported results.${growthNote(selected)}`,
    citations: citations(selected.slice(0, 4)),
    table: {
      headers: ["Metric", left, right, "Change"],
      rows,
    },
    evidence: toEvidence(selected.slice(0, 4)),
  };
}

function trendAnswer(
  question: string,
  metric: Metric,
  chunks: Chunk[],
): AnswerResult {
  const rows = QUARTERS.map((period) => {
    const usd = chunks.find(
      (chunk) => chunk.period === period && chunk.currency === "USD",
    );
    const inr = chunks.find(
      (chunk) => chunk.period === period && chunk.currency === "INR",
    );
    const other = chunks.find((chunk) => chunk.period === period);
    return [
      period,
      usd?.value ?? other?.value ?? "—",
      inr?.value ?? "—",
    ];
  }).filter((row) => row[1] !== "—" || row[2] !== "—");

  const present = chunks.filter((chunk) =>
    QUARTERS.includes(chunk.period as (typeof QUARTERS)[number]),
  );

  return {
    question,
    found: present.length > 0,
    headline: `Infosys ${METRIC_NAME[metric]} across the FY2026 quarters is shown from the reported results. Quarters without a published figure in that currency are left blank.`,
    bullets: rows.map(
      (row) => `${row[0]}: ${row[1] !== "—" ? row[1] : "not in the indexed US$ excerpt"}${row[2] !== "—" ? `; INR ${row[2]}` : ""}.`,
    ),
    footnote:
      "Quarterly figures are taken from the corresponding Infosys results. A blank cell means that currency was not part of the indexed excerpt.",
    citations: citations(present.slice(0, 4)),
    table: {
      headers: ["Quarter", "US$ million / reported", "INR crore"],
      rows,
    },
    evidence: toEvidence(present.slice(0, 4)),
  };
}

function summaryAnswer(question: string, period: Period): AnswerResult {
  const metrics: Metric[] = [
    "revenue",
    "operating-margin",
    "operating-profit",
    "net-profit",
  ];
  const chunks = metrics.flatMap((metric) =>
    CHUNKS.filter((chunk) => chunk.metric === metric && chunk.period === period),
  );
  const picked = [
    ...chunks.filter((chunk) => chunk.metric === "revenue"),
    ...chunks.filter((chunk) => chunk.metric === "operating-margin"),
    ...chunks.filter(
      (chunk) => chunk.metric === "net-profit" && chunk.currency === "INR",
    ),
    ...chunks.filter(
      (chunk) =>
        chunk.metric === "operating-profit" && chunk.currency === "INR",
    ),
  ].slice(0, 4);

  const revenue = chunks.find(
    (chunk) => chunk.metric === "revenue" && chunk.currency === "INR",
  );
  const revenueUsd = chunks.find(
    (chunk) => chunk.metric === "revenue" && chunk.currency === "USD",
  );
  const margin = chunks.find((chunk) => chunk.metric === "operating-margin");
  const profit = chunks.find(
    (chunk) => chunk.metric === "net-profit" && chunk.currency === "INR",
  );

  const headline = [
    revenueUsd ? `revenue of ${money(revenueUsd)}` : "",
    revenue ? `or ${money(revenue)}` : "",
    margin ? `an operating margin of ${margin.value}` : "",
    profit ? `and net profit of ${money(profit)}` : "",
  ]
    .filter(Boolean)
    .join(", ");

  return {
    question,
    found: picked.length > 0,
    headline: `For ${period}, Infosys reported ${headline}, for the period ended ${PERIOD_END[period]}.`,
    bullets: picked.map(
      (chunk) => `${chunk.displayLabel}: ${chunk.value}.`,
    ),
    footnote: `Summary of reported ${period} highlights from the indexed results excerpts.`,
    citations: citations(picked),
    table: supportTable(picked, ["Metric", period, "Prior period", "Growth (YoY)"]),
    evidence: toEvidence(picked),
  };
}

function dedupe(chunks: Chunk[]): Chunk[] {
  const seen = new Set<string>();
  return chunks.filter((chunk) => {
    if (seen.has(chunk.id)) return false;
    seen.add(chunk.id);
    return true;
  });
}

export function answerQuestion(question: string): AnswerResult {
  const cleaned = question.trim().slice(0, 1000);
  if (!cleaned) {
    return empty(
      question,
      "Ask a question about Infosys FY2026 financial reports.",
      "Revenue, operating profit, operating margin, net profit, basic EPS, and year-end headcount are indexed.",
    );
  }

  if (OVERRIDE.test(cleaned)) {
    return empty(
      cleaned,
      "I can only answer questions about the indexed Infosys financial reports.",
      "Rephrase the question around a reported metric, period, or comparison.",
    );
  }

  if (/\b(tcs|wipro|hcl|accenture|cognizant|tata consultancy)\b/i.test(cleaned)) {
    return empty(
      cleaned,
      "This deployment answers from Infosys FY2026 reports only.",
      "Choose Infosys, or ask about revenue, profit, margin, EPS, or headcount.",
    );
  }

  const metric = detectMetric(cleaned);
  if (metric === "export") {
    return empty(
      cleaned,
      "The indexed Infosys FY2026 excerpts do not include a separate export-revenue line.",
      "They do cover reported revenue, operating profit, operating margin, net profit, basic EPS, free cash flow, large deals, and the March 31, 2026 headcount.",
    );
  }

  if (metric === "summary") {
    const periods = detectPeriods(cleaned);
    return summaryAnswer(cleaned, periods[0] ?? "Q2 FY2026");
  }

  if (!metric) {
    return empty(
      cleaned,
      "I couldn't match that question to a metric in the Infosys FY2026 excerpts.",
      "Try revenue, operating profit, operating margin, net profit, basic EPS, free cash flow, large deals, or employee count.",
    );
  }

  let periods = detectPeriods(cleaned);
  if (periods.length === 0) {
    periods = metric === "headcount" || metric === "deals" ? ["FY2026"] : ["Q1 FY2026"];
  }

  const wantedCurrency = currencyFilter(cleaned);
  let chunks = CHUNKS.filter(
    (chunk) => chunk.metric === metric && periods.includes(chunk.period),
  );
  if (wantedCurrency) {
    const filtered = chunks.filter((chunk) => chunk.currency === wantedCurrency);
    if (filtered.length > 0) chunks = filtered;
  }

  if (chunks.length === 0) {
    return empty(
      cleaned,
      `I couldn't find ${METRIC_NAME[metric]} for ${periods.join(" and ")} in the indexed excerpts.`,
      "Try another quarter, or ask for the rupee figure when the dollar excerpt is not indexed.",
    );
  }

  const trend = periods.length > 2;
  const compare =
    !trend &&
    periods.length === 2 &&
    /compare|versus|\bvs\b|from q1 to q2|q1 and q2|q1 to q2| and /.test(
      cleaned.toLowerCase(),
    );

  if (trend) return trendAnswer(cleaned, metric, chunks);
  if (compare || periods.length === 2) {
    return compareAnswer(cleaned, metric, periods, chunks);
  }
  return singleAnswer(cleaned, metric, periods[0], chunks);
}
