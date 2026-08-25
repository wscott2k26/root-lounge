import { readFile, writeFile } from 'node:fs/promises';

const files = [
  'recovered-live/app1.js',
  'recovered-live/app2.js',
  'recovered-live/app3.js',
  'recovered-live/gui.js',
];

const standaloneDollarCall = /(?<![\w$])\$\(/g;

for (const file of files) {
  let text = await readFile(file, 'utf8');
  if (file.endsWith('app1.js')) {
    text = text.replace("const $=(id)=>document.getElementById(id);", "const RL$=(id)=>document.getElementById(id);");
  }
  text = text.replace(standaloneDollarCall, 'RL$(');
  await writeFile(file, text, 'utf8');
}

const combined = (await Promise.all(files.map(file => readFile(file, 'utf8')))).join('\n');
const remaining = combined.match(/(?<![\w$])\$\(/g) || [];
if (/const \$=/.test(combined) || remaining.length) {
  throw new Error(`Standalone $ selector helper references remain after hardening: ${remaining.length}`);
}
if (!combined.includes('const RL$=(id)=>document.getElementById(id);')) {
  throw new Error('RL$ selector helper was not installed.');
}
console.log('Root Lounge selector helper hardened across app1/app2/app3/gui.');
