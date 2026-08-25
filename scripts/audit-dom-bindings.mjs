import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const files = [
  'recovered-live/app1.js',
  'recovered-live/app2.js',
  'recovered-live/app3.js',
  'recovered-live/gui.js',
];

const report = {
  generatedAt: new Date().toISOString(),
  sourceFiles: {},
  requiredIds: [],
  selectors: [],
};
const ids = new Set();
const selectors = new Set();

for (const file of files) {
  const text = await readFile(file, 'utf8');
  report.sourceFiles[file] = {
    bytes: Buffer.byteLength(text),
    sha256: createHash('sha256').update(text).digest('hex'),
  };

  for (const match of text.matchAll(/\$\(\s*['"]([^'"]+)['"]\s*\)/g)) ids.add(match[1]);
  for (const match of text.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)) ids.add(match[1]);
  for (const match of text.matchAll(/querySelector(?:All)?\(\s*['"]([^'"]+)['"]\s*\)/g)) selectors.add(match[1]);
}

report.requiredIds = [...ids].sort();
report.selectors = [...selectors].sort();
report.requiredIdCount = report.requiredIds.length;
report.selectorCount = report.selectors.length;

await writeFile('recovered-live/dom-binding-audit.json', JSON.stringify(report, null, 2) + '\n');
console.log(`Required static IDs: ${report.requiredIdCount}`);
console.log(report.requiredIds.join('\n'));
console.log(`Static selectors: ${report.selectorCount}`);
console.log(report.selectors.join('\n'));
