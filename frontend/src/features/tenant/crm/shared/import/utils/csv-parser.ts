import type { ParsedCsv } from '../types/import.types';

/** One pass preserves quoted commas, escaped quotes, and embedded newlines. */
export function parseCsv(text: string): ParsedCsv {
  const records: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let closed = false;
  const finishCell = () => { row.push(cell.trim()); cell = ''; closed = false; };
  const finishRow = () => { finishCell(); if (row.some(value => value.length)) records.push(row); row = []; };
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else cell += char;
    } else if (char === ',') finishCell();
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      finishRow();
    } else if (char === '"' && !cell && !closed) quoted = true;
    else {
      if (char === '"' || (closed && char.trim())) throw new Error('Malformed CSV: unexpected text outside a quoted field.');
      if (!closed) cell += char;
    }
  }
  if (quoted) throw new Error('Malformed CSV: a quoted field is not closed.');
  if (cell || row.length || closed) finishRow();
  if (!records.length) return { headers: [], rows: [] };
  const [headers, ...rows] = records;
  if (headers.some(header => !header) || new Set(headers).size !== headers.length) throw new Error('CSV headers must be nonempty and unique.');
  if (rows.some(record => record.length !== headers.length)) throw new Error('Malformed CSV: every row must have the same number of columns as the header.');
  return { headers, rows };
}
