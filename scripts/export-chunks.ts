import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CHUNKS } from "../lib/corpus";

const outputDir = path.join(
  "financial-retrieval",
  "artifacts",
  "chunks",
  "infosys",
);
mkdirSync(outputDir, { recursive: true });

const lines = CHUNKS.map((chunk) => {
  const row = chunk.rows[0];
  const values: Record<string, string> = {};
  chunk.columns.forEach((column, index) => {
    const cell = row?.cells[index];
    if (cell) values[column] = cell;
  });

  const content = [
    chunk.section,
    row?.label ?? chunk.displayLabel,
    chunk.unitNote,
    `Period: ${chunk.period}`,
    ...chunk.columns.map(
      (column, index) => `${column}: ${row?.cells[index] ?? ""}`,
    ),
    `Source: ${chunk.document}, page ${chunk.page}`,
  ].join("\n");

  return JSON.stringify({
    chunk_id: chunk.id,
    record_type: "table_row",
    title: row?.label ?? chunk.displayLabel,
    content,
    source_document: chunk.document,
    source_page: chunk.page,
    table_title: chunk.section,
    section_path: [chunk.period, chunk.section],
    headers: chunk.columns,
    values,
    normalized_unit:
      chunk.currency === "USD"
        ? "USD million"
        : chunk.currency === "INR"
          ? "INR crore"
          : chunk.currency,
    unit_note: chunk.unitNote,
  });
});

const outputPath = path.join(outputDir, "chunks.jsonl");
writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
console.log(`Wrote ${lines.length} chunks to ${outputPath}`);
