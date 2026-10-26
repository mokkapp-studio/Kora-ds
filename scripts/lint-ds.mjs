#!/usr/bin/env node
// Lint mínimo de sistema de diseño: falla si hay valores sueltos fuera de tokens/.
// Un prompt es una petición; este script es una garantía.
// Uso: node scripts/lint-ds.mjs [carpeta-o-archivo ...]   (por defecto: el proyecto entero)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = process.argv.slice(2).length ? process.argv.slice(2) : [root];
const EXT = new Set(['.css', '.html', '.tsx', '.jsx', '.ts', '.js', '.vue', '.svelte']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'tokens', 'scripts', '.claude', 'solucion', 'taller', 'pruebas', 'figma']);
const SKIP_FILES = new Set(['sin-skill.html']); // ejemplo "malo" a propósito: se lintea explícitamente

const rules = [
  { id: 'color-literal', re: /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/g, msg: 'Color suelto. Usa una variable semántica (var(--surface-raised), var(--text-muted)…).' },
  { id: 'px-arbitrario', re: /(?<![\w-])(?!0px\b|1px\b|2px\b)\d+(\.\d+)?px\b/g, msg: 'Medida suelta en px. Usa var(--space-*), var(--radius-*) o var(--font-size-*).' },
  { id: 'tailwind-arbitrario', re: /\b[a-z-]+-\[[^\]]*\]/g, msg: 'Valor arbitrario de Tailwind. No permitido.' },
  { id: 'outline-none', re: /outline\s*:\s*(none|0)\b/g, msg: 'No se quita el foco visible. Usa :focus-visible con var(--focus-ring).' },
];

const files = [];
const walk = (p, explicit) => {
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    if (SKIP_DIRS.has(path.basename(p)) && !explicit) return;
    for (const e of fs.readdirSync(p)) walk(path.join(p, e), false);
  } else if (EXT.has(path.extname(p)) && (explicit || !SKIP_FILES.has(path.basename(p)))) files.push(p);
};
targets.forEach((t) => walk(path.resolve(t), true));

let problems = 0;
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (/lint-ds-ignore/.test(line)) return;
    for (const r of rules) {
      r.re.lastIndex = 0;
      const hit = r.re.exec(line);
      if (hit) {
        problems++;
        console.log(`${path.relative(root, f)}:${i + 1}  [${r.id}] ${hit[0]}  → ${r.msg}`);
      }
    }
  });
}
console.log(problems ? `\n✖ ${problems} problema(s) en ${files.length} archivo(s)` : `✔ Sin valores sueltos en ${files.length} archivo(s)`);
process.exit(problems ? 1 : 0);
