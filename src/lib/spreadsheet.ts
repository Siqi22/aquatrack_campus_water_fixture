import * as XLSX from 'xlsx';

const SPREADSHEET_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

export function isSpreadsheetFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return SPREADSHEET_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/** Convert uploaded CSV or Excel file to CSV text for the shared import pipeline. */
export async function spreadsheetToCSVText(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.csv')) {
    return file.text();
  }

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error('Workbook has no sheets');
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
  }

  throw new Error('Unsupported file type. Use .csv, .xlsx, or .xls');
}

export function spreadsheetFormatLabel(fileName: string): string {
  const name = fileName.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return 'Excel';
  if (name.endsWith('.csv')) return 'CSV';
  return 'Spreadsheet';
}
