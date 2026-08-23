import type { ParsedCsv } from '../types/import.types';

/**
 * Parse a CSV string into headers and rows.
 * Handles:
 * - Quoted fields (RFC 4180)
 * - Escaped quotes ("" inside quoted fields)
 * - CRLF and LF line endings
 * - Empty rows (filtered out)
 * - Trimmed cell values
 */
export function parseCsv(text: string): ParsedCsv {
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      if (current.length > 0 || lines.length > 0) {
        lines.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }
  if (current.length > 0) lines.push(current);

  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseRow(lines[0]);
  const rows = lines
    .slice(1)
    .map(parseRow)
    .filter((r) => r.some((cell) => cell.length > 0));

  return { headers, rows };
}

/**
 * Parse a single CSV line into an array of cell values.
 */
function parseRow(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ',' && !quoted) {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += ch;
    }
  }
  cells.push(cell.trim());
  return cells;
}
