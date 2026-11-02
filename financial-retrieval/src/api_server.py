"""HTTP wrapper around hybrid retrieval and answer generation."""

from __future__ import annotations

import os
import re
import sys
import threading
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


PACKAGE_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = PACKAGE_ROOT.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))

from dotenv import load_dotenv

load_dotenv(REPO_ROOT / ".env")

from answer_question import (  # noqa: E402
    DEFAULT_MODEL,
    DEFAULT_OLLAMA_URL,
    build_context,
    generate_answer,
    generate_azure_answer,
)
from retrieval import retrieve  # noqa: E402


HOST = "127.0.0.1"
PORT = 8765
TOP_K = 4
PIPELINE_LOCK = threading.Lock()

app = FastAPI(title="QuarterLens retrieval")


class AskRequest(BaseModel):
    question: str = Field(default="", max_length=1000)


def evidence_from_results(results: list[dict]) -> tuple[list[dict], list[dict], dict | None]:
    """Turn retrieved chunks into the cards and table the web UI renders."""
    evidence = []
    citations = []
    table_rows = []

    for item in results:
        chunk = item["chunk"]
        label_number = len(evidence) + 1
        evidence_id = f"E{label_number}"
        headers = chunk.get("headers") if isinstance(chunk.get("headers"), list) else []
        values = chunk.get("values") if isinstance(chunk.get("values"), dict) else {}
        cells = [str(values.get(header, "")) for header in headers]
        title = str(chunk.get("title") or "Evidence")
        document = str(chunk.get("source_document") or "Unknown document")
        page = str(chunk.get("source_page") or "")

        evidence.append({
            "id": evidence_id,
            "document": document,
            "page": page,
            "section": str(chunk.get("table_title") or "Retrieved excerpt"),
            "unitNote": str(chunk.get("unit_note") or chunk.get("normalized_unit") or ""),
            "columns": [str(header) for header in headers],
            "rows": [
                {
                    "label": title,
                    "cells": cells,
                    "emphasize": True,
                }
            ] if headers else [],
            "metric": title,
            "unit": str(chunk.get("normalized_unit") or ""),
        })
        citations.append({
            "id": evidence_id,
            "label": f"{document}, page {page} — {title}",
        })
        preview = " | ".join(
            f"{header}: {values.get(header, '')}" for header in headers[:3]
        )
        table_rows.append([title, preview or str(chunk.get("content") or "")[:180], document, page])

    table = None
    if table_rows:
        table = {
            "headers": ["Metric", "Retrieved values", "Document", "Page"],
            "rows": table_rows,
        }

    return evidence, citations, table


def answer_question(question: str) -> dict[str, Any]:
    """Retrieve evidence, then ask the configured model from that evidence only."""
    with PIPELINE_LOCK:
        results = retrieve(question, rerank=True)
        selected = results[:TOP_K]
        context, _citations = build_context(selected)
        provider = os.environ.get("LLM_PROVIDER", "ollama").strip().lower()
        if provider == "azure":
            generated = generate_azure_answer(question, context)
        else:
            model = os.environ.get("OLLAMA_MODEL", DEFAULT_MODEL)
            ollama_url = os.environ.get("OLLAMA_URL", DEFAULT_OLLAMA_URL)
            generated = generate_answer(
                question,
                context,
                model=model,
                ollama_url=ollama_url,
            )
        headline = re.sub(r"\[S(\d+)\]", r"[E\1]", generated)
        evidence, citations, table = evidence_from_results(selected)

        return {
            "question": question,
            "found": True,
            "headline": headline,
            "bullets": [],
            "footnote": "",
            "citations": citations,
            "table": table,
            "evidence": evidence,
        }


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.post("/ask")
def ask(body: AskRequest) -> dict[str, Any]:
    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required.")
    try:
        return answer_question(question)
    except Exception as exc:  # noqa: BLE001 - return the pipeline error to the UI
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def main() -> int:
    import uvicorn

    print("Loading embedding and reranking models...")
    try:
        retrieve("Infosys revenue Q1 FY2026", rerank=True)
    except Exception as exc:  # noqa: BLE001
        print(f"Startup retrieval warmup skipped: {exc}")
    print(f"Retrieval pipeline listening on http://{HOST}:{PORT}")
    uvicorn.run(app, host=HOST, port=PORT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
