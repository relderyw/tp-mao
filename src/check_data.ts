import XLSX from 'xlsx';
import * as fs from 'fs';
import path from 'path';

const filePath = path.resolve('./Mapeamento  Importado 103ki.xlsx');
const workbook = XLSX.readFile(filePath);
const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });

console.log('--- MAPEAMENTO DE COLUNAS ---');
for (let i = 0; i < 15; i++) {
  console.log(`Linha ${i}:`, JSON.stringify(rows[i]));
}
