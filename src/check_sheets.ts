import XLSX from 'xlsx';
import * as fs from 'fs';
import path from 'path';

const filePath = path.resolve('./Mapeamento  Importado 103ki.xlsx');
const workbook = XLSX.readFile(filePath);
console.log('Abas encontradas:', workbook.SheetNames);
