const SPREADSHEET_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

export interface SpreadsheetSheet {
  name: string;
  csv: string;
}

export interface SpreadsheetWorkbook {
  sheets: SpreadsheetSheet[];
}

export function isSpreadsheetFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return SPREADSHEET_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function cellToCsvField(cell: unknown): string {
  if (cell == null) return '';
  const s = cell instanceof Date ? cell.toISOString().slice(0, 10) : String(cell);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Convert parsed spreadsheet rows to CSV text for the shared import pipeline. */
export function rowsToCSV(rows: unknown[][]): string {
  return rows
    .map((row) => row.map(cellToCsvField).join(','))
    .join('\n');
}

/**
 * Parse CSV or Excel. Excel parsing is lazy-loaded so the main bundle stays small.
 * Legacy .xls is not supported — re-save as .xlsx if needed.
 */
export async function parseSpreadsheetFile(file: File): Promise<SpreadsheetWorkbook> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.csv')) {
    const csv = await file.text();
    return { sheets: [{ name: 'Sheet1', csv }] };
  }

  if (name.endsWith('.xlsx')) {
    const { default: readExcelFile } = await import('read-excel-file/browser');
    const sheets = await readExcelFile(file);
    if (!sheets.length) throw new Error('Workbook has no sheets');
    return {
      sheets: sheets.map((sheet) => ({
        name: sheet.sheet,
        csv: rowsToCSV(sheet.data as unknown[][]),
      })),
    };
  }

  if (name.endsWith('.xls')) {
    throw new Error('Legacy .xls is not supported. Open the file in Excel and save as .xlsx.');
  }

  throw new Error('Unsupported file type. Use .csv or .xlsx');
}

/** @deprecated Use parseSpreadsheetFile — kept for tests that only need one sheet. */
export async function spreadsheetToCSVText(file: File, sheetName?: string): Promise<string> {
  const workbook = await parseSpreadsheetFile(file);
  if (sheetName) {
    const match = workbook.sheets.find((s) => s.name === sheetName);
    if (!match) throw new Error(`Sheet "${sheetName}" not found`);
    return match.csv;
  }
  return workbook.sheets[0]?.csv ?? '';
}

export function spreadsheetFormatLabel(fileName: string): string {
  const name = fileName.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return 'Excel';
  if (name.endsWith('.csv')) return 'CSV';
  return 'Spreadsheet';
}
