/**
 * Coverage gate.
 *
 * Bun's `coverageThreshold` is unreliable in some versions (it reports
 * success/failure inconsistently and hides the `statements` metric). This
 * script instead parses the `.lcov` report that Bun emits and enforces
 * explicit thresholds on lines and functions, both globally and per-file.
 *
 * Exit code is non-zero when any threshold is not met, so it can gate CI and
 * the pre-commit hook deterministically.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..");
const lcovPath = join(projectRoot, "coverage", "lcov.info");

const LINES_THRESHOLD = 90.0;
const FUNCTIONS_THRESHOLD = 90.0;

interface FileCoverage {
  file: string;
  lf: number; // lines found
  lh: number; // lines hit
  fnf: number; // functions found
  fnh: number; // functions hit
}

function parseLcov(content: string): FileCoverage[] {
  const files: FileCoverage[] = [];
  let current: FileCoverage | null = null;
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("SF:")) {
      if (current !== null) files.push(current);
      current = { file: trimmed.slice(3), lf: 0, lh: 0, fnf: 0, fnh: 0 };
    } else if (trimmed.startsWith("LF:")) {
      if (current !== null) current.lf = Number.parseInt(trimmed.slice(3), 10);
    } else if (trimmed.startsWith("LH:")) {
      if (current !== null) current.lh = Number.parseInt(trimmed.slice(3), 10);
    } else if (trimmed.startsWith("FNF:")) {
      if (current !== null) current.fnf = Number.parseInt(trimmed.slice(4), 10);
    } else if (trimmed.startsWith("FNH:")) {
      if (current !== null) current.fnh = Number.parseInt(trimmed.slice(4), 10);
    }
  }
  if (current !== null) files.push(current);
  return files;
}

function pct(hit: number, found: number): number {
  return found === 0 ? 100 : (hit / found) * 100;
}

function main(): void {
  if (!existsSync(lcovPath)) {
    console.error(
      "coverage/lcov.info not found. Run `bun test --coverage-reporter=lcov` first.",
    );
    process.exit(1);
  }

  const files = parseLcov(readFileSync(lcovPath, "utf8"));
  if (files.length === 0) {
    console.error("No files found in coverage report.");
    process.exit(1);
  }

  const totalLf = files.reduce((n, f) => n + f.lf, 0);
  const totalLh = files.reduce((n, f) => n + f.lh, 0);
  const totalFnf = files.reduce((n, f) => n + f.fnf, 0);
  const totalFnh = files.reduce((n, f) => n + f.fnh, 0);

  const globalLines = pct(totalLh, totalLf);
  const globalFunctions = pct(totalFnh, totalFnf);

  const failures: string[] = [];

  const check = (label: string, value: number, threshold: number): void => {
    if (value < threshold) {
      failures.push(`${label}: ${value.toFixed(2)}% < ${threshold}%`);
    }
  };

  check("global lines", globalLines, LINES_THRESHOLD);
  check("global functions", globalFunctions, FUNCTIONS_THRESHOLD);

  for (const f of files) {
    const file = f.file.replace(/^src\//, "");
    check(`${file} lines`, pct(f.lh, f.lf), LINES_THRESHOLD);
    check(`${file} functions`, pct(f.fnh, f.fnf), FUNCTIONS_THRESHOLD);
  }

  console.log(
    `Coverage (global): lines ${globalLines.toFixed(2)}%, functions ${globalFunctions.toFixed(2)}%`,
  );
  for (const f of files) {
    const file = f.file.replace(/^src\//, "");
    console.log(
      `  ${file.padEnd(20)} lines ${pct(f.lh, f.lf).toFixed(2).padStart(6)}%  functions ${pct(f.fnh, f.fnf).toFixed(2).padStart(6)}%`,
    );
  }

  if (failures.length > 0) {
    console.error("\nCoverage gate FAILED:");
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }

  console.log("\nCoverage gate passed.");
}

main();
