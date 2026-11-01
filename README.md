# QuarterLens

QuarterLens is a financial-report Q&A app for Infosys FY2026. Ask a question in plain language and the app searches the indexed results, then writes an answer that stays tied to those excerpts. The reply shows the source document, page, and the figures that were retrieved.

The interface is a Next.js app. Search and answer generation run in a local Python service.

## What you can ask

- What was Infosys revenue in Q1 FY2026?
- What is the operating profit margin in Q1 FY2026?
- What was the net profit in Q1 FY2026?
- What was basic EPS in Q1 FY2026?
- Compare Q1 and Q2 FY2026 revenue
- What was the operating margin in Q3 FY2026?
- Show me Infosys revenue for FY2026
- Show me employee count as of March 31, 2026

Questions outside the indexed figures, such as a separate export-revenue line, come back without a made-up number.

## How an answer is produced

1. The question is searched with **BM25** keyword matching and **vector search**.
2. Chunks are embedded with `sentence-transformers/all-MiniLM-L6-v2` and stored in **Chroma**.
3. Reciprocal rank fusion mixes the two rankings. A cross-encoder, `cross-encoder/ms-marco-MiniLM-L-6-v2`, reranks the shortlist.
4. The top excerpts are sent to **Azure OpenAI** (`gpt-5-mini` by default). The model is instructed to use only that evidence and to cite the supplied source labels.
5. The page shows the answer, a supporting table, and the source cards.

The model is not trained on these reports. The report-specific detail comes from retrieval at question time.

## Stack

| Piece | Role |
|---|---|
| Next.js | Chat interface |
| Python | Retrieval service on `http://127.0.0.1:8765` |
| rank-bm25 | Keyword search |
| Sentence Transformers | Query and chunk embeddings |
| Chroma | Vector index |
| Cross-encoder | Reranking |
| Azure OpenAI | Answer generation from the retrieved excerpts |

## Run it

You need Node.js, Python 3.11, and an Azure OpenAI deployment. From the repository root, use two terminals.

### 1. Install the web app and the Python environment

```powershell
npm install
python -m venv .venv
.\.venv\Scripts\python -m pip install -r .\financial-retrieval\requirements.txt
```

### 2. Add your model settings

Create a `.env` file in the repository root. It is gitignored.

```text
AZURE_OPENAI_API_KEY=your-key
AZURE_OPENAI_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
OPENAI_API_VERSION=2024-12-01-preview
AZURE_OPENAI_MODEL_NAME=gpt-5-mini
LLM_PROVIDER=azure
```

`AZURE_OPENAI_MODEL_NAME` is the Azure deployment name. Set `LLM_PROVIDER=ollama` only if you want the older local Ollama path instead. That path expects Ollama at `http://localhost:11434` and the model `qwen2.5:1.5b`.

### 3. Build the search index

```powershell
npm run index
```

This writes the chunk file under `financial-retrieval/artifacts/chunks/` and builds the Chroma index. Those files stay on your machine and are not committed.

### 4. Start the pipeline, then the site

```powershell
npm run pipeline
```

Wait until the service prints that it is listening. The first startup loads the embedding and reranking models, so it takes longer than a later restart.

In the other terminal:

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The first question after startup is the slow one. Later questions still take a few seconds, because each one searches the index and calls the model.

`POST /api/ask` with `{ "question": "..." }` returns the same answer as the page. The Next.js route forwards the question to the Python service. If that service is not on port 8765, set `PIPELINE_URL`.

## Reports

The indexed figures come from Infosys FY2026 results.

| Report | Period |
|---|---|
| [Q1 FY2026](https://www.infosys.com/investors/reports-filings/quarterly-results/2025-2026/q1/documents/q1-2026.pdf) | Quarter ended June 30, 2025 |
| [Q2 FY2026](https://www.infosys.com/investors/reports-filings/quarterly-results/2025-2026/q2/documents/q2-2026.pdf) | Quarter ended September 30, 2025 |
| [Q3 FY2026](https://www.infosys.com/investors/reports-filings/quarterly-results/2025-2026/q3/documents/q3-2026.pdf) | Quarter ended December 31, 2025 |
| [Additional information 2025-26](https://www.infosys.com/investors/reports-filings/documents/additional-information-2025-26.pdf) | Year ended March 31, 2026 |

Official PDFs are linked from the Documents page. This app reads and summarizes reported figures. It is not investment advice, and it is not a substitute for the original filings.

A growth rate marked calculated was computed from two reported totals. It was not copied from a printed growth column.

## Layout

```text
app/                     Next.js pages and /api/ask
components/              Sidebar and chat
lib/                     Indexed Infosys figures used to build chunks
scripts/export-chunks.ts Writes chunks.jsonl for the vector index
financial-retrieval/src  BM25, Chroma, reranking, and the answer service
```

`financial-retrieval/src` also contains the earlier Streamlit chat and the scripts that normalize Docling JSON, chunk records, and build an index from those records. The web app uses `api_server.py`.

## Hosting

The pages can be built with `npm run build`. Answers still need the Python service and the Azure deployment running where `PIPELINE_URL` can reach them. A serverless host that only runs Next.js cannot load the embedding models or the vector index.
