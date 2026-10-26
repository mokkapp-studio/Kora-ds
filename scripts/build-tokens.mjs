#!/usr/bin/env node
// Genera tokens/tokens.css desde tokens/tokens.json. Sin dependencias (Node 18+).
// Uso: node scripts/build-tokens.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = JSON.parse(fs.readFileSync(path.join(root, 'tokens/tokens.json'), 'utf8'));

const resolve = (ref) => {
  const m = /^\{(.+)\}$/.exec(ref);
  if (!m) return ref;
  const value = m[1].split('.').reduce((o, k) => (o ? o[k] : undefined), src);
  if (typeof value !== 'string') throw new Error(`Referencia rota: ${ref}`);
  return value;
};

const semantic = (mode) =>
  Object.entries(src.semantic).map(([name, t]) => `  --${name}: ${resolve(t[mode])};`);

const scales = Object.entries(src.scale).flatMap(([group, items]) =>
  Object.entries(items).map(([k, v]) => `  --${group}-${k}: ${v};`)
);

const css = [
  '/* GENERADO por scripts/build-tokens.mjs desde tokens/tokens.json. No editar a mano. */',
  ':root,',
  '[data-theme="light"] {',
  '  color-scheme: light;',
  ...semantic('light'),
  ...scales,
  '}',
  '',
  '[data-theme="dark"] {',
  '  color-scheme: dark;',
  ...semantic('dark'),
  '}',
  '',
].join('\n');

fs.writeFileSync(path.join(root, 'tokens/tokens.css'), css);
console.log(`tokens.css generado: ${Object.keys(src.semantic).length} semánticos x 2 modos + ${scales.length} de escala`);
