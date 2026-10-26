#!/usr/bin/env node
// Comprobación de contratos de Kora. Sin dependencias (Node 18+).
// Uso: node check.mjs      (o: npm run check)
// Comprueba también el bloque `figma` de cada contrato y que figma/variables.json está al día.
// Comprueba: JSON válido · bloques núcleo · sin placeholders <...> · tokens que existen y permitidos
//            · clases CSS que existen en components.css · enlaces entre componentes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFigmaVariables, figmaName } from './scripts/lib/figma.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const errors = [];
const warnings = [];
const err = (f, m) => errors.push(`${f}: ${m}`);
const warn = (f, m) => warnings.push(`${f}: ${m}`);
const readJson = (p) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { err(path.relative(root, p), `JSON inválido (${e.message})`); return null; }
};

// 1. Tokens: nombres de variable CSS que existen (iguales a las de tokens.css)
const tokens = readJson(path.join(root, 'tokens/tokens.json'));
const names = new Set();
if (tokens) {
  for (const [k, t] of Object.entries(tokens.semantic ?? {})) {
    names.add(k);
    for (const mode of ['light', 'dark']) {
      const m = /^\{(.+)\}$/.exec(t[mode] ?? '');
      if (!m) err('tokens.json', `«${k}» necesita valor ${mode} con forma {primitive.x.y}`);
      else if (typeof m[1].split('.').reduce((o, p) => o?.[p], tokens) !== 'string') err('tokens.json', `«${k}» (${mode}): referencia rota ${t[mode]}`);
    }
    if (!t.use) err('tokens.json', `«${k}» necesita el campo use (cuándo se elige)`);
  }
  for (const [g, items] of Object.entries(tokens.scale ?? {})) for (const i of Object.keys(items)) names.add(`${g}-${i}`);
}

// 2. CSS: clases disponibles
const cssText = fs.readFileSync(path.join(root, 'components/components.css'), 'utf8');
const cssClasses = new Set([...cssText.matchAll(/\.(k-[a-z0-9_-]+)/g)].map((m) => m[1]));

// 3. Contratos
const dir = path.join(root, 'contracts');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.contract.json'));
const known = new Set(files.filter((f) => !f.startsWith('_')).map((f) => f.split('.')[0]));
const core = ['id', 'name', 'version', 'status', 'category', 'description', 'guidance', 'semantics', 'props', 'states', 'anatomy', 'tokens', 'a11y'];
const strings = (o, out = []) => {
  if (typeof o === 'string') out.push(o);
  else if (o && typeof o === 'object') Object.values(o).forEach((v) => strings(v, out));
  return out;
};
const bindingMap = readJson(path.join(root, 'figma/binding-map.json'));
const varsFile = readJson(path.join(root, 'figma/variables.json'));
const figmaNames = new Set();
for (const col of varsFile?.collections ?? []) if (col.name !== 'Primitives') for (const v of col.variables) figmaNames.add(v.name);
for (const e of varsFile?.effectStyles ?? []) figmaNames.add(e.name);
const parsed = [];
const noKey = [];
const has = (c, cls, f, where) => { if (!cssClasses.has(cls)) (c.status === 'draft' ? warn : err)(f, `${where}: la clase «.${cls}» no existe en components.css${c.status === 'draft' ? ' (borrador: aún sin CSS)' : ''}`); };

for (const f of files) {
  const c = readJson(path.join(dir, f));
  if (!c || f.startsWith('_')) continue; // la plantilla solo debe ser JSON válido
  parsed.push(c);
  for (const k of core) if (!(k in c)) err(f, `falta el bloque «${k}»`);
  if (strings({ ...c, example: null }).some((s) => /^<[^>]+>/.test(s))) err(f, 'quedan placeholders <...> sin rellenar');
  if (c.name && f.split('.')[0] !== c.name) err(f, `el archivo debe llamarse ${c.name}.contract.json`);
  if (c.version && !/^\d+\.\d+\.\d+$/.test(c.version)) err(f, `version «${c.version}» no es x.y.z`);

  // props
  const seen = new Set();
  for (const p of c.props ?? []) {
    if (seen.has(p.name)) err(f, `prop duplicada «${p.name}»`);
    seen.add(p.name);
    const values = [...String(p.type).matchAll(/'([^']+)'/g)].map((m) => m[1]);
    if (p.default != null && values.length && !values.includes(p.default)) err(f, `prop «${p.name}»: default «${p.default}» no está en su tipo`);
    const cc = p.cssClass;
    if (typeof cc === 'string') {
      if (cc.includes('{value}')) for (const v of values) has(c, cc.replace('{value}', v), f, `prop ${p.name}`);
      else has(c, cc, f, `prop ${p.name}`);
    } else if (cc && typeof cc === 'object') {
      for (const [v, cls] of Object.entries(cc)) {
        if (values.length && !values.includes(v)) err(f, `prop «${p.name}»: cssClass usa el valor «${v}» que no está en su tipo`);
        if (cls) has(c, cls, f, `prop ${p.name}`);
      }
    }
    if (p.part && !(p.part in (c.anatomy ?? {}))) err(f, `prop «${p.name}»: part «${p.part}» no es una parte de anatomy`);
  }

  // anatomía y semántica
  for (const [part, def] of Object.entries(c.anatomy ?? {})) has(c, def.class, f, `anatomy.${part}`);
  if (c.semantics?.refTarget && !(c.semantics.refTarget in (c.anatomy ?? {}))) err(f, `refTarget «${c.semantics.refTarget}» no es una parte de anatomy`);
  const rootClass = c.anchors?.css?.rootClass;
  if (rootClass && c.anatomy?.root?.class !== rootClass) err(f, `anchors.css.rootClass («${rootClass}») no coincide con anatomy.root.class`);
  if (c.example && rootClass && !c.example.includes(rootClass)) warn(f, 'el ejemplo no usa la clase raíz');

  // estados controlados enlazan con props
  for (const s of c.states?.controlled ?? []) if (!seen.has(s.prop)) err(f, `estado «${s.name}»: la prop «${s.prop}» no existe`);

  // guidance
  for (const d of c.guidance?.donts ?? []) if (!d.case || !d.useInstead || !d.why) err(f, 'cada don\'t necesita case, useInstead y why');
  for (const r of c.guidance?.related ?? []) if (!known.has(r.component)) warn(f, `related: «${r.component}» aún no tiene contrato`);

  // tokens: existen, permitidos, no prohibidos
  const { allowed = [], forbidden = [] } = c.tokens?.policy ?? {};
  const ok = (t) => allowed.some((a) => t.startsWith(a));
  const bad = (t) => forbidden.some((a) => t.startsWith(a));
  const walk = (o, trail) => {
    for (const [k, v] of Object.entries(o ?? {})) {
      if (v && typeof v === 'object') walk(v, `${trail}.${k}`);
      else if (typeof v === 'string') {
        if (names.size && !names.has(v)) err(f, `tokens.bindings${trail}.${k}: el token «${v}» no existe`);
        else if (bad(v)) err(f, `tokens.bindings${trail}.${k}: «${v}» está prohibido por policy.forbidden`);
        else if (!ok(v)) err(f, `tokens.bindings${trail}.${k}: «${v}» no está en policy.allowed`);
      } else if (v !== null && typeof v !== 'number') err(f, `tokens.bindings${trail}.${k}: valor no válido (token, número o null)`);
    }
  };
  walk(c.tokens?.bindings, '');

  // ---- Figma: el contrato debe poder montarse en la librería ----
  const fg = c.figma;
  if (!fg) { err(f, 'falta el bloque «figma»'); continue; }
  const propNames = new Set((c.props ?? []).map((p) => p.name));
  const propType = (n) => (c.props ?? []).find((p) => p.name === n)?.type;
  const enumOf = (n) => [...String(propType(n) ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const stateNames = [...(c.states?.native ?? []), ...(c.states?.controlled ?? [])].map((s) => s.name);
  const partNames = Object.keys(c.anatomy ?? {});
  const mapped = new Map(); // prop → cuántas veces se representa
  const use = (p) => mapped.set(p, (mapped.get(p) ?? 0) + 1);
  const diff = (want, got) => [want.filter((x) => !got.includes(x)), got.filter((x) => !want.includes(x))];
  const uniq = (obj, what) => { const v = Object.values(obj ?? {}); if (new Set(v).size !== v.length) err(f, `figma.${what}: hay valores repetidos`); };

  if (fg.set !== c.name) err(f, `figma.set («${fg.set}») debe ser igual que name («${c.name}»)`);
  for (const [fp, def] of Object.entries(fg.variantProperties ?? {})) {
    const where = `figma.variantProperties.${fp}`;
    if (def.fromProp && def.fromStates) err(f, `${where}: usa fromProp o fromStates, no los dos`);
    else if (def.fromProp) {
      if (!propNames.has(def.fromProp)) { err(f, `${where}: la prop «${def.fromProp}» no existe`); continue; }
      use(def.fromProp);
      const ev = enumOf(def.fromProp);
      if (!ev.length) { err(f, `${where}: «${def.fromProp}» no es un enum`); continue; }
      const [miss, extra] = diff(ev, Object.keys(def.values ?? {}));
      if (miss.length) err(f, `${where}: faltan valores de «${def.fromProp}»: ${miss.join(', ')}`);
      if (extra.length) err(f, `${where}: valores que «${def.fromProp}» no tiene: ${extra.join(', ')}`);
      uniq(def.values, `variantProperties.${fp}.values`);
    } else if (def.fromStates) {
      const keys = Object.keys(def.fromStates);
      if (!keys.includes('default')) err(f, `${where}: falta la clave «default»`);
      const [miss, extra] = diff(stateNames, keys.filter((k) => k !== 'default'));
      if (miss.length) err(f, `${where}: faltan estados del contrato: ${miss.join(', ')}`);
      if (extra.length) err(f, `${where}: estados que el contrato no tiene: ${extra.join(', ')}`);
      uniq(def.fromStates, `variantProperties.${fp}`);
      for (const s of c.states?.controlled ?? []) use(s.prop);
    } else err(f, `${where}: necesita fromProp o fromStates`);
  }
  for (const [fp, def] of Object.entries(fg.textProperties ?? {})) {
    if (!propNames.has(def.fromProp)) err(f, `figma.textProperties.${fp}: la prop «${def.fromProp}» no existe`);
    else { use(def.fromProp); if (propType(def.fromProp) !== 'string') err(f, `figma.textProperties.${fp}: «${def.fromProp}» debe ser de tipo string`); }
  }
  const optionalParts = Object.entries(c.anatomy ?? {}).filter(([, d]) => d.optional).map(([k]) => k);
  const coveredParts = new Set();
  for (const [fp, def] of Object.entries(fg.booleanProperties ?? {})) {
    if (def.fromPart) {
      if (!optionalParts.includes(def.fromPart)) err(f, `figma.booleanProperties.${fp}: «${def.fromPart}» no es una parte opcional de anatomy`);
      coveredParts.add(def.fromPart);
    } else if (def.fromProp) {
      if (!propNames.has(def.fromProp) || propType(def.fromProp) !== 'boolean') err(f, `figma.booleanProperties.${fp}: «${def.fromProp}» no es una prop boolean`);
      else use(def.fromProp);
    } else err(f, `figma.booleanProperties.${fp}: necesita fromPart o fromProp`);
  }
  for (const p of optionalParts) if (!coveredParts.has(p)) err(f, `la parte opcional «${p}» necesita una propiedad booleana (Show/Hide) en figma.booleanProperties`);
  for (const [fp, def] of Object.entries(fg.slotProperties ?? {})) {
    if (!propNames.has(def.fromProp)) err(f, `figma.slotProperties.${fp}: la prop «${def.fromProp}» no existe`);
    else { use(def.fromProp); if (propType(def.fromProp) !== 'node') err(f, `figma.slotProperties.${fp}: «${def.fromProp}» debe ser de tipo node`); }
  }
  for (const [p, why] of Object.entries(fg.ignoredProps ?? {})) {
    if (!propNames.has(p)) err(f, `figma.ignoredProps: la prop «${p}» no existe`);
    else if (!String(why).trim()) err(f, `figma.ignoredProps.${p}: falta el motivo`);
    else if (mapped.has(p)) err(f, `la prop «${p}» está en ignoredProps y también mapeada`);
    else use(p);
  }
  for (const p of propNames) if (!mapped.has(p)) err(f, `la prop «${p}» no tiene representación en Figma: mapéala o ponla en figma.ignoredProps con el motivo`);
  {
    const [miss, extra] = diff(partNames, Object.keys(fg.layers ?? {}));
    if (miss.length) err(f, `figma.layers: faltan partes de anatomy: ${miss.join(', ')}`);
    if (extra.length) err(f, `figma.layers: partes que anatomy no tiene: ${extra.join(', ')}`);
    uniq(fg.layers, 'layers');
  }
  // estructura de bindings y traducción de cada token a una variable de Figma
  const b = c.tokens?.bindings ?? {};
  for (const k of Object.keys(b.byPart ?? {})) if (!partNames.includes(k)) err(f, `tokens.bindings.byPart: «${k}» no es una parte de anatomy`);
  for (const k of Object.keys(b.byState ?? {})) if (!stateNames.includes(k)) err(f, `tokens.bindings.byState: «${k}» no es un estado del contrato`);
  for (const k of Object.keys(b.byVariant ?? {})) if (!enumOf('variant').includes(k)) err(f, `tokens.bindings.byVariant: «${k}» no es un valor de variant`);
  for (const k of Object.keys(b.bySize ?? {})) if (!enumOf('size').includes(k)) err(f, `tokens.bindings.bySize: «${k}» no es un valor de size`);
  const kinds = { colors: 'color', numbers: 'scale', styles: 'effect' };
  const toFigma = (o, trail) => {
    for (const [k, v] of Object.entries(o ?? {})) {
      if (v && typeof v === 'object') { toFigma(v, `${trail}.${k}`); continue; }
      if (typeof v !== 'string') continue;
      const group = Object.keys(kinds).find((g) => k in (bindingMap[g] ?? {}));
      if (!group) { err(f, `tokens.bindings${trail}.${k}: la clave «${k}» no tiene equivalente en Figma (añádela a figma/binding-map.json o cámbiala)`); continue; }
      const fn = tokens ? figmaName(v, tokens) : null;
      if (!fn || !figmaNames.has(fn.name)) err(f, `tokens.bindings${trail}.${k}: «${v}» no tiene variable en figma/variables.json (¿falta npm run figma:build?)`);
      else if (fn.kind !== kinds[group]) err(f, `tokens.bindings${trail}.${k}: «${v}» es un token de tipo ${fn.kind}, pero «${k}» espera ${kinds[group]}`);
    }
  };
  toFigma(b, '');
  if (fg.key == null) noKey.push(c.name);
}

// 3b. figma/variables.json debe estar al día con tokens.json y contratos
if (tokens && bindingMap && varsFile && !errors.length) {
  if (JSON.stringify(buildFigmaVariables(tokens, parsed, bindingMap)) !== JSON.stringify(varsFile)) err('figma/variables.json', 'está desactualizado: ejecuta npm run figma:build');
}

// 4. Salida
if (noKey.length) console.log(`info   figma.key vacío en ${noKey.join(', ')} (normal hasta publicar la librería de Figma)`);
for (const w of warnings) console.log(`aviso  ${w}`);
for (const e of errors) console.log(`ERROR  ${e}`);
const n = [...known].length;
console.log(errors.length ? `\n✖ ${errors.length} error(es), ${warnings.length} aviso(s) en ${n} contrato(s)` : `✔ ${n} contrato(s) correctos · ${names.size} tokens · ${figmaNames.size} variables/estilos de Figma · ${warnings.length} aviso(s)`);
process.exit(errors.length ? 1 : 0);
