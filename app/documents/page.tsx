const REPORTS = [
  {
    name: "Q1 FY2026",
    period: "Quarter ended June 30, 2025",
    href: "https://www.infosys.com/investors/reports-filings/quarterly-results/2025-2026/q1/documents/q1-2026.pdf",
  },
  {
    name: "Q2 FY2026",
    period: "Quarter ended September 30, 2025",
    href: "https://www.infosys.com/investors/reports-filings/quarterly-results/2025-2026/q2/documents/q2-2026.pdf",
  },
  {
    name: "Q3 FY2026",
    period: "Quarter ended December 31, 2025",
    href: "https://www.infosys.com/investors/reports-filings/quarterly-results/2025-2026/q3/documents/q3-2026.pdf",
  },
  {
    name: "Additional information 2025-26",
    period: "Includes FY2026 information through March 31, 2026",
    href: "https://www.infosys.com/investors/reports-filings/documents/additional-information-2025-26.pdf",
  },
];

export default function DocumentsPage() {
  return (
    <main className="page">
      <header className="page-head">
        <h1>Documents</h1>
      </header>
      <div className="page-body">
        <section className="info-card">
          <h2>Infosys FY2026 reports</h2>
          <p>
            QuarterLens answers from figures published in these Infosys investor
            reports. Open the original PDF before relying on a figure.
          </p>
        </section>
        <div className="report-list">
          {REPORTS.map((report) => (
            <article key={report.name}>
              <h3>{report.name}</h3>
              <p className="muted">{report.period}</p>
              <p>
                <a href={report.href} target="_blank" rel="noreferrer">
                  Open official PDF
                </a>
              </p>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
