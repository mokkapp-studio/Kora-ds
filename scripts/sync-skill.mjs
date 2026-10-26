#!/usr/bin/env node
// Genera las referencias de un skill a partir de las FUENTES (tokens.json, contracts/*.json, figma/variables.json).
// Así los skills nunca hablan de tokens, props o variables que ya no existen.
//
// Uso:
//   node scripts/sync-skill.mjs                                  → skill de CÓDIGO  en .claude/skills/design-system
//   node scripts/sync-skill.mjs --kind figma                     → skill de FIGMA   en .claude/skills/design-system-figma
//   node scripts/sync-skill.mjs --kind figma --target <carpeta>  → otra carpeta
//   añade --copy-contracts para que el skill lleve dentro contracts/ (skill personal o subido a claude.ai)
//   atajos: npm run skill:sync · npm run skill:sync:figma
//
// Escribe en <target>/references/:
//   code : tokens.md · components.md
//   figma: variables.md · components-figma.md
//   --copy-contracts: contracts/*.json (+ variables.json, binding-map.json y LIBRARY-SPEC.md si es figma)
// Nunca toca SKILL.md ni los .md que escribes tú (patterns, contract-format, figma-workflow).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAll, figmaName } from './lib/figma.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const val = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const kind = val('--kind', 'code');
if (!['code', 'figma'].includes(kind)) { console.error('--kind debe ser code o figma'); process.exit(1); }
const target = path.resolve(root, val('--target', kind === 'figma' ? '.claude/skills/design-system-figma' : '.claude/skills/design-system'));
const refs = path.join(target, 'references');
fs.mkdirSync(refs, { recursive: true });

const BANNER = (cmd) => `<!-- GENERADO por scripts/sync-skill.mjs. No editar a mano: cambia la fuente y vuelve a ejecutar \`${cmd}\`. -->\n`;
const { tokens: tk, bindingMap, contracts, files, cdir } = loadAll(root);
const resolveRef = (t, ref) => ref.slice(1, -1).split('.').reduce((o, k) => o?.[k], t);
const esc = (s) => String(s).replace(/\|/g, '\\|');
const note = [];

if (kind === 'code') {
  // ---------- tokens.md ----------
  let md = BANNER('npm run skill:sync') + '# Tokens · qué elegir\n\nFuente: `tokens/tokens.json`. En código solo se usan las variables CSS de `tokens/tokens.css` (`var(--nombre)`). Las primitivas de paleta no se usan en componentes.\n\n';
  md += '## Semánticos (cambian con el modo claro/oscuro)\n\n| Variable | Claro | Oscuro | Se usa para |\n| --- | --- | --- | --- |\n';
  for (const [name, t] of Object.entries(tk.semantic)) md += `| \`--${name}\` | ${resolveRef(tk, t.light)} | ${resolveRef(tk, t.dark)} | ${t.use} |\n`;
  md += '\n## Escalas\n\n| Grupo | Variables |\n| --- | --- |\n';
  for (const [g, items] of Object.entries(tk.scale)) md += `| ${g} | ${Object.entries(items).map(([k, v]) => `\`--${g}-${k}\` ${v}`).join(' · ')} |\n`;
  fs.writeFileSync(path.join(refs, 'tokens.md'), md);
  note.push(`tokens.md (${Object.keys(tk.semantic).length} semánticos)`);

  // ---------- components.md ----------
  let cm = BANNER('npm run skill:sync') + '# Componentes · resumen de los contratos\n\nEl contrato completo manda: `contracts/<Componente>.contract.json`. Este resumen solo orienta; lee el contrato antes de usar un componente. (Ignora su bloque `figma`: es del skill de Figma.)\n\n';
  cm += '| Componente | Clase raíz | Categoría | Para qué |\n| --- | --- | --- | --- |\n';
  for (const c of contracts) cm += `| ${c.name} | \`.${c.anatomy.root.class}\` | ${c.category} | ${c.description} |\n`;
  for (const c of contracts) {
    cm += `\n## ${c.name} (v${c.version})\n\n| Prop | Tipo | Por defecto | Obligatoria | Efecto |\n| --- | --- | --- | --- | --- |\n`;
    for (const p of c.props) {
      const eff = typeof p.cssClass === 'string' ? `clase \`${p.cssClass}\`` : p.cssClass ? `clases ${Object.entries(p.cssClass).filter(([, v]) => v).map(([k, v]) => `${k}→\`${v}\``).join(', ')}` : p.attribute ? `atributo \`${p.attribute}\`` : p.part ? `contenido de la parte \`${p.part}\`` : '';
      cm += `| \`${p.name}\` | ${esc(p.type)} | ${p.default ?? '—'} | ${p.required ? 'sí' : 'no'} | ${eff} |\n`;
    }
    cm += `\n**Partes:** ${Object.entries(c.anatomy).map(([k, v]) => `\`${k}\` → \`.${v.class}\`${v.optional ? ' (opcional)' : ''}`).join(' · ')}\n`;
    cm += `\n**Haz:** ${c.guidance.dos.join(' · ')}\n\n**No hagas:**\n` + c.guidance.donts.map((d) => `- ${d.case} → ${d.useInstead}`).join('\n') + '\n';
    if (c.example) cm += `\n\`\`\`html\n${c.example}\n\`\`\`\n`;
  }
  fs.writeFileSync(path.join(refs, 'components.md'), cm);
  note.push(`components.md (${contracts.length} componentes)`);
} else {
  const vars = JSON.parse(fs.readFileSync(path.join(root, 'figma/variables.json'), 'utf8'));
  const cmd = 'npm run skill:sync:figma';
  // ---------- variables.md ----------
  const sem = vars.collections.find((c) => c.name === 'Semantic');
  const scale = vars.collections.find((c) => c.name === 'Scale');
  let md = BANNER(cmd) + '# Variables de Figma · qué enlazar\n\nFuente: `figma/variables.json` (generado desde `tokens/tokens.json`). **Todo color, espacio, radio y tipografía de una capa se enlaza a una variable de esta lista.** Nunca un valor suelto. Las primitivas (colección Primitives) no se usan en componentes.\n\n';
  md += 'Regla de nombres: `surface-base` → `color/surface/base` · `space-3` → `space/3` · `shadow-sm` → estilo de efecto `shadow/sm`.\n\n';
  md += '## Color · colección Semantic (modos Light y Dark)\n\n| Variable de Figma | Token | Claro | Oscuro | Se usa para |\n| --- | --- | --- | --- | --- |\n';
  for (const v of sem.variables) {
    const lightHex = tk.primitive[v.values.Light.alias.split('/')[0]][v.values.Light.alias.split('/')[1]];
    const darkHex = tk.primitive[v.values.Dark.alias.split('/')[0]][v.values.Dark.alias.split('/')[1]];
    md += `| \`${v.name}\` | \`${v.token}\` | ${lightHex} | ${darkHex} | ${v.description} |\n`;
  }
  md += '\n## Escalas · colección Scale\n\n| Grupo | Variables de Figma |\n| --- | --- |\n';
  const groups = {};
  for (const v of scale.variables) (groups[v.name.split('/')[0]] ??= []).push(`\`${v.name}\` ${v.value}`);
  for (const [g, items] of Object.entries(groups)) md += `| ${g} | ${items.join(' · ')} |\n`;
  md += `| shadow (estilos de efecto) | ${vars.effectStyles.map((e) => `\`${e.name}\``).join(' · ')} |\n`;
  md += '\nLa fuente `font-family/sans` usa «Inter» en Figma como equivalente de la pila `system-ui` del código.\n';
  fs.writeFileSync(path.join(refs, 'variables.md'), md);
  note.push(`variables.md (${sem.variables.length} colores, ${scale.variables.length} de escala)`);

  // ---------- components-figma.md ----------
  const tr = (tok) => figmaName(tok, tk)?.name ?? `?${tok}`;
  const where = (key) => bindingMap.colors?.[key]?.figma ?? bindingMap.numbers?.[key]?.figma ?? bindingMap.styles?.[key]?.figma ?? key;
  const rows = (o) => Object.entries(o ?? {}).filter(([, v]) => typeof v === 'string').map(([k, v]) => `| ${where(k)} | \`${tr(v)}\` |`).join('\n');
  let cm = BANNER(cmd) + '# Componentes en Figma · cómo montarlos\n\nEl contrato completo manda: `contracts/<Componente>.contract.json`. Aquí está traducido a Figma: component set, propiedades, capas y variables. Si un componente no aparece aquí, **no existe**: no lo dibujes.\n\n';
  cm += '| Component set | Propiedades | Para qué |\n| --- | --- | --- |\n';
  for (const c of contracts) cm += `| \`${c.figma.set}\` | ${[...Object.keys(c.figma.variantProperties), ...Object.keys(c.figma.textProperties), ...Object.keys(c.figma.booleanProperties), ...Object.keys(c.figma.slotProperties)].join(', ')} | ${c.description} |\n`;
  for (const c of contracts) {
    const f = c.figma;
    cm += `\n## ${f.set}\n\n`;
    cm += '| Propiedad en Figma | Tipo | Valores | Viene del contrato |\n| --- | --- | --- | --- |\n';
    for (const [n, d] of Object.entries(f.variantProperties)) {
      cm += d.fromProp
        ? `| ${n} | Variante | ${Object.values(d.values).join(' · ')} | prop \`${d.fromProp}\` |\n`
        : `| ${n} | Variante | ${Object.values(d.fromStates).join(' · ')} | estados |\n`;
    }
    for (const [n, d] of Object.entries(f.textProperties)) cm += `| ${n} | Texto | ej. «${d.example}» | prop \`${d.fromProp}\` |\n`;
    for (const [n, d] of Object.entries(f.booleanProperties)) cm += `| ${n} | Booleano | por defecto ${d.default ? 'sí' : 'no'} | parte opcional \`${d.fromPart ?? d.fromProp}\` |\n`;
    for (const [n, d] of Object.entries(f.slotProperties)) cm += `| ${n} | Slot / Instance swap | contenido libre | prop \`${d.fromProp}\` |\n`;
    if (Object.keys(f.ignoredProps).length) cm += `\n**Sin representación en Figma:** ${Object.entries(f.ignoredProps).map(([p, w]) => `\`${p}\` (${w})`).join(' · ')}\n`;
    cm += `\n**Capas:** ${Object.entries(f.layers).map(([p, l]) => `\`${p}\` → «${l}»`).join(' · ')}\n`;
    const b = c.tokens.bindings;
    const block = (title, o) => (rows(o) ? `\n**${title}**\n\n| Propiedad de Figma | Variable |\n| --- | --- |\n${rows(o)}\n` : '');
    cm += '\n### Variables enlazadas\n';
    cm += block('Base', b.base);
    for (const [part, o] of Object.entries(b.byPart ?? {})) cm += block(`Capa «${f.layers[part]}»`, o);
    for (const [v, o] of Object.entries(b.byVariant ?? {})) cm += block(`Variant = ${f.variantProperties.Variant?.values?.[v] ?? v}`, o);
    for (const [v, o] of Object.entries(b.bySize ?? {})) cm += block(`Size = ${f.variantProperties.Size?.values?.[v] ?? v}`, o);
    for (const [s, o] of Object.entries(b.byState ?? {})) cm += block(`State = ${f.variantProperties.State?.fromStates?.[s] ?? s}`, o);
    cm += '\n**Haz:** ' + c.guidance.dos.join(' · ') + '\n\n**No hagas:**\n' + c.guidance.donts.map((d) => `- ${d.case} → ${d.useInstead}`).join('\n') + '\n';
    if (f.notes?.length) cm += '\n**Notas de montaje:**\n' + f.notes.map((n) => `- ${n}`).join('\n') + '\n';
    cm += `\n**Clave en la librería publicada:** ${f.key ?? 'sin publicar (rellénala en figma.key)'}\n`;
  }
  fs.writeFileSync(path.join(refs, 'components-figma.md'), cm);
  note.push(`components-figma.md (${contracts.length} componentes)`);
}

if (flag('--copy-contracts')) {
  const out = path.join(refs, 'contracts');
  fs.mkdirSync(out, { recursive: true });
  for (const f of [...files, 'component.schema.json']) fs.copyFileSync(path.join(cdir, f), path.join(out, f));
  if (kind === 'figma') { for (const f of ['variables.json', 'binding-map.json', 'LIBRARY-SPEC.md']) fs.copyFileSync(path.join(root, 'figma', f), path.join(refs, f)); }
  note.push('contracts/ copiados' + (kind === 'figma' ? ' (+ variables.json, binding-map.json, LIBRARY-SPEC.md)' : ''));
}
console.log(`✔ [${kind}] ${path.relative(root, target) || '.'}/references: ${note.join(', ')}`);
