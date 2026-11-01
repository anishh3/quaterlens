import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page">
      <header className="page-head">
        <h1>Home</h1>
      </header>
      <div className="page-body">
        <section className="info-card">
          <h2>QuarterLens</h2>
          <p>
            Ask a question about Infosys FY2026 results and read the answer next
            to the source line it came from. The indexed excerpts cover the four
            quarters and the year ended March 31, 2026.
          </p>
          <p>
            <Link href="/">Open Financial Report Q&A</Link>
          </p>
        </section>
        <section className="info-card">
          <h2>What you can ask</h2>
          <ul>
            <li>Revenue, operating profit, operating margin, net profit, and basic EPS by quarter.</li>
            <li>Comparisons, such as Q1 and Q2 FY2026 revenue.</li>
            <li>Full-year FY2026 totals and the March 31, 2026 employee count.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
