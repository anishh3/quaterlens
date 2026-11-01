"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  BarChart3,
  Building2,
  ChevronDown,
  ChevronUp,
  List,
  Send,
  Settings,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { SUGGESTIONS } from "@/lib/questions";
import type { AnswerResult } from "@/lib/types";
import { useQuarterLens } from "./AppShell";

function RichLine({ text }: { text: string }) {
  const parts = text.split(/(US\$ [\d,.]+(?: million| billion)?|Rs [\d,.]+ crore)/g);
  return parts.map((part, index) =>
    part.startsWith("US$") || part.startsWith("Rs") ? (
      <strong key={index}>{part}</strong>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

export function ChatWorkspace() {
  const { activeQuestion, ask, isNew, recent } = useQuarterLens();
  const [draft, setDraft] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [evidenceOpen, setEvidenceOpen] = useState(true);
  const [answer, setAnswer] = useState<AnswerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || !activeQuestion) {
      setAnswer(null);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setAnswer(null);

    fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: activeQuestion }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = (await response.json()) as AnswerResult & { error?: string };
        if (!response.ok) {
          throw new Error(data.error || "Retrieval failed.");
        }
        setAnswer(data);
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        const message = caught instanceof Error ? caught.message : "Retrieval failed.";
        setError(message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [activeQuestion, isNew]);
  const timeLabel =
    recent.find((item) => item.text === activeQuestion)?.timeLabel ??
    "Today";

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    ask(text);
    setDraft("");
    setDetailsOpen(true);
    setEvidenceOpen(true);
  }

  return (
    <section className="chat">
      <header className="topbar">
        <h1>Financial Report Q&A</h1>
        <div className="top-actions">
          <label className="company">
            <Building2 size={16} />
            <select aria-label="Company" defaultValue="infosys">
              <option value="infosys">Infosys (Current)</option>
            </select>
          </label>
          <Link href="/settings" className="icon-button" aria-label="Settings">
            <Settings size={18} />
          </Link>
        </div>
      </header>

      {answer || loading || error ? (
        <div className="workspace">
          <div className="thread">
            <article className="question-row">
              <span className="avatar">
                <UserRound size={18} />
              </span>
              <div>
                <h2>{answer?.question ?? activeQuestion}</h2>
              </div>
              <time>{timeLabel}</time>
            </article>

            <article className="answer-card">
              <div className="answer-kicker">
                <BarChart3 size={16} />
                QuarterLens Answer
              </div>
              {loading ? (
                <p className="headline">Searching the reports and drafting an answer…</p>
              ) : null}
              {error ? <p className="headline">{error}</p> : null}
              {answer ? (
                <>
                  <p className="headline">
                    <RichLine text={answer.headline} />
                  </p>
                  {answer.bullets.length > 0 ? (
                    <ul>
                      {answer.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  ) : null}
                  {answer.citations.length > 0 ? (
                    <div className="citations">
                      {answer.citations.map((citation) => (
                        <span key={citation.id}>
                          <b>{citation.id}</b> {citation.label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : null}
            </article>

            {answer?.table ? (
              <section className="panel">
                <button
                  type="button"
                  className="panel-toggle"
                  onClick={() => setDetailsOpen((open) => !open)}
                >
                  <span>
                    <List size={16} />
                    Supporting Details
                  </span>
                  {detailsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {detailsOpen ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          {answer.table.headers.map((header) => (
                            <th key={header}>{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {answer.table.rows.map((row) => (
                          <tr key={row.join("|")}>
                            {row.map((cell, index) => (
                              <td key={`${cell}-${index}`}>{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>

          <aside className="evidence">
            <button
              type="button"
              className="panel-toggle"
              onClick={() => setEvidenceOpen((open) => !open)}
            >
              <span>Source Evidence ({answer?.evidence.length ?? 0})</span>
              {evidenceOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {evidenceOpen && answer ? (
              answer.evidence.length > 0 ? (
                <div className="evidence-list">
                  {answer.evidence.map((card) => (
                    <article key={card.id} className="evidence-card">
                      <header>
                        <b>{card.id}</b>
                        <span>
                          {card.document}
                          {" · "}
                          {/^\d+$/.test(card.page) ? `Page ${card.page}` : card.page}
                        </span>
                      </header>
                      <h3>{card.section}</h3>
                      <p>{card.unitNote}</p>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Particulars</th>
                              {card.columns.map((column) => (
                                <th key={column}>{column}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {card.rows.map((row) => (
                              <tr
                                key={row.label}
                                className={row.emphasize ? "emphasize" : undefined}
                              >
                                <td>{row.label}</td>
                                {row.cells.map((cell, index) => (
                                  <td key={`${cell}-${index}`}>{cell}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <dl>
                        <div>
                          <dt>Metric</dt>
                          <dd>{card.metric}</dd>
                        </div>
                        <div>
                          <dt>Unit</dt>
                          <dd>{card.unit}</dd>
                        </div>
                        <div>
                          <dt>Document</dt>
                          <dd>{card.document}</dd>
                        </div>
                        <div>
                          <dt>Page</dt>
                          <dd>{card.page}</dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="empty-evidence">
                  No source excerpt matched this question.
                </p>
              )
            ) : null}
          </aside>
        </div>
      ) : (
        <div className="empty-state">
          <BarChart3 size={28} />
          <h2>Ask a question about Infosys FY2026</h2>
          <p>
            QuarterLens answers from indexed results for revenue, profit, margin,
            EPS, and headcount, and shows the source line beside the answer.
          </p>
        </div>
      )}

      <form className="composer" onSubmit={submit}>
        <input
          aria-label="Ask a question about Infosys financial reports"
          placeholder="Ask a question about Infosys financial reports..."
          value={draft}
          maxLength={1000}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" aria-label="Send question" disabled={!draft.trim() || loading}>
          <Send size={18} />
        </button>
      </form>
      <div className="suggestions">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => {
              ask(suggestion);
              setDetailsOpen(true);
              setEvidenceOpen(true);
            }}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </section>
  );
}
