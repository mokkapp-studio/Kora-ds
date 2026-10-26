#!/usr/bin/env node
// tokens/tokens.json + contracts/  →  figma/variables.json  (la especificación de variables de la librería de Figma)
// Uso: npm run figma:build
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAll, buildFigmaVariables } from './lib/figma.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { tokens, bindingMap, contracts } = loadAll(root);
const out = buildFigmaVariables(tokens, contracts, bindingMap);
fs.mkdirSync(path.join(root, 'figma'), { recursive: true });
fs.writeFileSync(path.join(root, 'figma/variables.json'), JSON.stringify(out, null, 2) + '\n');
const n = out.collections.map((c) => `${c.name} ${c.variables.length}`).join(' · ');
console.log(`✔ figma/variables.json · ${n} · ${out.effectStyles.length} estilos de efecto`);
