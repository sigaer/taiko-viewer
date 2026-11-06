import { readFileSync } from 'node:fs';
import { analyzeTJA, LongNoteHandling } from '../../vendor/tja/TJAAnalyzer/offline-analysis/tja-gaps';
const text = readFileSync(0, 'utf8');
process.stdout.write(JSON.stringify(analyzeTJA(text, 'ms', LongNoteHandling.Skip)));
