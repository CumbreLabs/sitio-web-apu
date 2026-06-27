#!/usr/bin/env node
/**
 * Structural-integrity check for `AUDIT_CHECKLIST.md`.
 *
 * The checklist is a living document with 19+ sections and 150+ rows. Subtle
 * structural rot is easy to introduce by hand (duplicate row IDs, broken
 * cross-references, section-numbering gaps after a renumber, Audit-log
 * entries that don't match the headers below). This gate catches them.
 *
 * Asserts:
 *   - Section headers (`## N. Title`) are monotonic (1, 2, 3, … no gaps).
 *   - Row IDs (`| 1.1 |`, `| 1.2 |`, …) are unique within their section.
 *   - Row IDs are monotonic within a section (1.1, 1.2, 1.3 — no jumps).
 *   - Every `row X.Y` cross-reference (e.g. "see row 9.6") points at an
 *     existing row.
 *   - The Audit-log table at the top lists every section header that exists
 *     in the body (no orphans, no missing entries).
 *
 * Wired into `npm run audit:all`; fails fast on any violation so an editor
 * sees structural drift the moment they save.
 * @module scripts/checks/check-audit-checklist
 */

import { readFileSync, existsSync } from "node:fs";

const AUDIT = "AUDIT_CHECKLIST.md";

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

if (!existsSync(AUDIT)) {
  console.error(`${RED}check-audit-checklist: ${AUDIT} not found.${RESET}`);
  process.exit(1);
}

const lines = readFileSync(AUDIT, "utf8").split("\n");
const violations = [];

// 1. Collect section headers `## N. Title` (skip non-numbered ## headers like
//    "Audit log", "How to use", "Backlog", "Won't fix").
const sections = []; // { num: number, title: string, lineNum: number }
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^##\s+(\d+)\.\s+(.+?)\s*$/);
  if (m) {
    sections.push({ num: parseInt(m[1], 10), title: m[2], lineNum: i + 1 });
  }
}

// 2. Section numbers must be monotonic.
for (let i = 0; i < sections.length; i++) {
  if (sections[i].num !== i + 1) {
    violations.push(
      `Section numbering broken: expected ${i + 1} at line ${sections[i].lineNum}, got ${sections[i].num} (${sections[i].title})`,
    );
  }
}

// 3. Row IDs within each section. A row is `| X.Y |` where X is the section
//    number and Y is the row index.
const allRowIds = new Set();
const rowsBySection = new Map(); // sectionNum -> [{ id, lineNum }]
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^\|\s*(\d+)\.(\d+)\s*\|/);
  if (m) {
    const sectionNum = parseInt(m[1], 10);
    const rowIdx = parseInt(m[2], 10);
    const id = `${sectionNum}.${rowIdx}`;
    if (allRowIds.has(id)) {
      violations.push(`Duplicate row ID ${id} at line ${i + 1}`);
    }
    allRowIds.add(id);
    if (!rowsBySection.has(sectionNum)) rowsBySection.set(sectionNum, []);
    rowsBySection.get(sectionNum).push({ id, rowIdx, lineNum: i + 1 });
  }
}

// 4. Within each section, row indices must be monotonic.
for (const [sectionNum, rows] of rowsBySection) {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].rowIdx !== i + 1) {
      violations.push(
        `Section ${sectionNum} row IDs out of order at line ${rows[i].lineNum}: expected ${sectionNum}.${i + 1}, got ${rows[i].id}`,
      );
    }
  }
}

// 5. Every "row X.Y" / "see row X.Y" / "(row X.Y)" cross-reference must resolve.
//    Use matchAll over the whole file content to catch every ref.
const content = lines.join("\n");
for (const match of content.matchAll(/\brow\s+(\d+)\.(\d+)\b/gi)) {
  const id = `${match[1]}.${match[2]}`;
  if (!allRowIds.has(id)) {
    // Compute a line number from the match index for the error
    const before = content.slice(0, match.index);
    const lineNum = before.split("\n").length;
    violations.push(`Cross-reference to non-existent row ${id} at line ${lineNum}`);
  }
}
// Also catch numeric refs like "#9.6" (used in some prose)
for (const match of content.matchAll(/#(\d+)\.(\d+)\b/g)) {
  const id = `${match[1]}.${match[2]}`;
  if (!allRowIds.has(id)) {
    const before = content.slice(0, match.index);
    const lineNum = before.split("\n").length;
    violations.push(`Cross-reference to non-existent row #${id} at line ${lineNum}`);
  }
}

// 6. Audit-log table must match the section headers in the body.
//    Audit log row format: `| 1. Build & Artifacts | 2026-05-16 | ... |`
const auditLogEntries = []; // { num, title }
for (const line of lines) {
  const m = line.match(/^\|\s*(\d+)\.\s+([^|]+?)\s*\|\s*\d{4}-\d{2}-\d{2}/);
  if (m) {
    auditLogEntries.push({
      num: parseInt(m[1], 10),
      title: m[2].replace(/\s*_\(new\)_\s*$/, "").trim(),
    });
  }
}
const sectionByNum = new Map(sections.map((s) => [s.num, s.title]));
const auditLogByNum = new Map(auditLogEntries.map((e) => [e.num, e.title]));
for (const [num, title] of sectionByNum) {
  if (!auditLogByNum.has(num)) {
    violations.push(`Audit-log missing entry for Section ${num}. ${title}`);
  }
}
for (const [num, title] of auditLogByNum) {
  if (!sectionByNum.has(num)) {
    violations.push(
      `Audit-log has orphan entry ${num}. ${title} (no matching section header in body)`,
    );
  }
}

if (violations.length > 0) {
  console.error(`${RED}✗ check-audit-checklist: ${violations.length} violation(s)${RESET}`);
  for (const v of violations.slice(0, 25)) console.error(`  ${DIM}${v}${RESET}`);
  if (violations.length > 25) {
    console.error(`  ${DIM}... and ${violations.length - 25} more${RESET}`);
  }
  process.exit(1);
}

console.log(
  `${GREEN}check-audit-checklist: ${sections.length} sections, ${allRowIds.size} rows — structurally valid.${RESET}`,
);
