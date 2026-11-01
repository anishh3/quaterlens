"""HTTP wrapper around hybrid retrieval and Ollama answer generation."""

from __future__ import annotations

import json
import os
import re
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
os.chdir(REPO_ROOT)
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


def answer_question(question: str) -> dict:
    """Retrieve evidence, then ask Ollama to answer from that evidence only."""
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


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802
        if self.path != "/health":
            self._send(404, {"error": "Not found."})
            return
        self._send(200, {"ok": True})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/ask":
            self._send(404, {"error": "Not found."})
            return

        length = int(self.headers.get("Content-Length", "0") or 0)
        raw = self.rfile.read(length) if length else b"{}"

        try:
            body = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            self._send(400, {"error": "Request body must be JSON."})
            return

        question = str(body.get("question") or "").strip()[:1000]
        if not question:
            self._send(400, {"error": "Question is required."})
            return

        try:
            payload = answer_question(question)
        except Exception as exc:  # noqa: BLE001 - return the pipeline error to the UI
            self._send(500, {"error": str(exc)})
            return

        self._send(200, payload)

    def log_message(self, format: str, *args) -> None:  # noqa: A002
        sys.stderr.write("%s - %s\n" % (self.address_string(), format % args))

    def _send(self, status: int, payload: dict) -> None:
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main() -> int:
    print("Loading embedding and reranking models...")
    retrieve("Infosys revenue Q1 FY2026", rerank=True)
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Retrieval pipeline listening on http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping retrieval pipeline.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
