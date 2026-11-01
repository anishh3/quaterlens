export default function SettingsPage() {
  return (
    <main className="page">
      <header className="page-head">
        <h1>Settings</h1>
      </header>
      <div className="page-body">
        <section className="info-card">
          <h2>Company corpus</h2>
          <p>
            Infosys is the active company. Answers use reported FY2026 figures
            from the quarterly results and the year ended March 31, 2026.
          </p>
        </section>
        <section className="info-card">
          <h2>How this deployment answers</h2>
          <p>
            The chat retrieves excerpts with BM25 keyword search and a MiniLM
            vector index in Chroma, reranks them, and asks Azure OpenAI to
            answer from that evidence. Start the Python service with{" "}
            <code>npm run pipeline</code>. The first question after startup
            takes longer because the search models load then.
          </p>
        </section>
        <section className="info-card">
          <h2>Limits</h2>
          <p>
            This is a report reader, not investment advice. If a growth rate is
            marked calculated, it was computed from two reported totals rather
            than copied from a printed growth column. Pages labeled Fact sheet,
            Highlights, or Headcount point at the results disclosure when a PDF
            page number is not the citation.
          </p>
        </section>
      </div>
    </main>
  );
}
