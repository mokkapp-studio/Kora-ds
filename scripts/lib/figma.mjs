// Lógica compartida entre build-figma, check y sync-skill: cómo se llama en Figma cada token.
// REGLA DE NOMBRES (determinista, sin tablas a mano):
//   token semántico  surface-base            →  color/surface/base          (colección Semantic, modos Light/Dark)
//   token de escala  space-3, font-size-sm   →  space/3, font-size/sm       (colección Scale)
//   sombra           shadow-sm               →  estilo de efecto shadow/sm
//   primitiva        primitive.gray.50       →  gray/50                      (colección Primitives, oculta al publicar)
import fs from 'node:fs';
import path from 'node:path';

export const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const FONT_MAP = { sans: 'Inter' }; // Figma no tiene system-ui: cámbialo por tu fuente
const SCALE_SCOPES = {
  space: ['WIDTH_HEIGHT', 'GAP'], radius: ['CORNER_RADIUS'], 'font-size': ['FONT_SIZE'],
  'font-weight': ['FONT_WEIGHT'], 'line-height': ['LINE_HEIGHT'], 'font-family': ['FONT_FAMILY'],
};
const DEFAULT_COLOR_SCOPES = { surface: ['FRAME_FILL', 'SHAPE_FILL'], text: ['TEXT_FILL'], border: ['STROKE_COLOR'], action: ['ALL_FILLS'], feedback: ['ALL_FILLS'], focus: ['STROKE_COLOR'] };

export function figmaName(token, tokens) {
  if (token in (tokens.semantic ?? {})) return { kind: 'color', name: 'color/' + token.split('-').join('/') };
  const groups = Object.keys(tokens.scale ?? {}).sort((a, b) => b.length - a.length);
  const g = groups.find((x) => token.startsWith(x + '-'));
  if (!g) return null;
  const name = `${g}/${token.slice(g.length + 1)}`;
  return { kind: g === 'shadow' ? 'effect' : 'scale', name };
}

const resolve = (t, ref) => ref.slice(1, -1).split('.').reduce((o, k) => o?.[k], t);
const aliasName = (ref) => ref.slice(1, -1).replace(/^primitive\./, '').replace(/\./g, '/');
const num = (v) => parseFloat(String(v));

// Qué ámbitos (scopes) necesita cada token de color, según cómo lo usan los contratos.
export function colorUsage(contractsList, bindingMap) {
  const use = new Map();
  const walk = (o, cb) => { for (const [k, v] of Object.entries(o ?? {})) { if (v && typeof v === 'object') walk(v, cb); else if (typeof v === 'string') cb(k, v); } };
  for (const c of contractsList) walk(c.tokens?.bindings, (key, tok) => {
    const sc = bindingMap.colors?.[key]?.scope;
    if (sc) use.set(tok, new Set([...(use.get(tok) ?? []), ...sc]));
  });
  return use;
}

export function buildFigmaVariables(tokens, contractsList, bindingMap) {
  const usage = colorUsage(contractsList, bindingMap);
  const prim = [];
  for (const [g, steps] of Object.entries(tokens.primitive)) for (const [s, v] of Object.entries(steps)) prim.push({ name: `${g}/${s}`, type: 'COLOR', value: v });
  const sem = Object.entries(tokens.semantic).map(([tok, t]) => {
    const scopes = usage.has(tok) ? [...usage.get(tok)].sort() : DEFAULT_COLOR_SCOPES[tok.split('-')[0]] ?? ['ALL_SCOPES'];
    return { name: figmaName(tok, tokens).name, token: tok, type: 'COLOR', scopes, description: t.use, values: { Light: { alias: aliasName(t.light) }, Dark: { alias: aliasName(t.dark) } } };
  });
  const scale = []; const effects = [];
  for (const [g, items] of Object.entries(tokens.scale)) {
    for (const [k, v] of Object.entries(items)) {
      const token = `${g}-${k}`; const name = `${g}/${k}`;
      if (g === 'shadow') effects.push({ name, token, css: v });
      else if (g === 'font-family') scale.push({ name, token, type: 'STRING', scopes: SCALE_SCOPES[g], value: FONT_MAP[k] ?? v.split(',')[0].replace(/['"]/g, '').trim(), note: `Equivale a la pila CSS: ${v}` });
      else if (g === 'line-height') scale.push({ name, token, type: 'FLOAT', scopes: SCALE_SCOPES[g], value: Math.round(num(v) * 100), note: 'Porcentaje (1.25 → 125)' });
      else scale.push({ name, token, type: 'FLOAT', scopes: SCALE_SCOPES[g], value: num(v) });
    }
  }
  return {
    $description: 'GENERADO por scripts/build-figma.mjs desde tokens/tokens.json y contracts/. No editar a mano: cambia la fuente y ejecuta npm run figma:build. Sirve para crear las variables en Figma (a mano, con un plugin o con el conector MCP).',
    naming: { semantic: 'surface-base → color/surface/base', scale: 'space-3 → space/3 · font-size-sm → font-size/sm', effect: 'shadow-sm → estilo de efecto shadow/sm', primitive: 'primitive.gray.50 → gray/50 (colección oculta al publicar)' },
    collections: [
      { name: 'Primitives', modes: ['Value'], hiddenFromPublishing: true, variables: prim },
      { name: 'Semantic', modes: ['Light', 'Dark'], variables: sem },
      { name: 'Scale', modes: ['Value'], variables: scale },
    ],
    effectStyles: effects,
  };
}

export function loadAll(root) {
  const tokens = readJson(path.join(root, 'tokens/tokens.json'));
  const bindingMap = readJson(path.join(root, 'figma/binding-map.json'));
  const cdir = path.join(root, 'contracts');
  const files = fs.readdirSync(cdir).filter((f) => f.endsWith('.contract.json') && !f.startsWith('_')).sort();
  const contracts = files.map((f) => readJson(path.join(cdir, f)));
  return { tokens, bindingMap, contracts, files, cdir };
}
