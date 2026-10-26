# Librería de Figma de Kora · especificación

Para que el skill `design-system-figma` pueda **instanciar y enlazar** en vez de dibujar formas sueltas, el archivo de Figma necesita una librería que coincida con las fuentes de Kora. Este documento dice cómo debe ser. No describe diseño nuevo: traduce `tokens/tokens.json` y `contracts/*.contract.json`.

## 1. De dónde sale cada cosa

| En Figma | Fuente única | Cómo se obtiene |
| --- | --- | --- |
| Variables y estilos de efecto | `tokens/tokens.json` | `npm run figma:build` → `figma/variables.json` |
| Component sets, propiedades y capas | bloque `figma` de cada contrato | se lee del contrato |
| Qué variable va en cada capa | `tokens.bindings` del contrato + `figma/binding-map.json` | `npm run skill:sync:figma` → `references/components-figma.md` |

Nunca se escribe un nombre de variable de Figma a mano en un contrato: se calcula con la regla del apartado 3.

## 2. Estructura del archivo «Kora Library»

| Página | Contenido |
| --- | --- |
| `Cover` | Nombre, versión de Kora, enlace al repositorio |
| `Foundations` | Documentación visual de variables: paleta, escalas, sombras |
| `Components` | Una sección por component set: Button, TextField, Badge, Card |
| `Playground` | Pantallas de prueba. Aquí trabaja el skill; no es parte de la librería publicada |

## 3. Variables (colecciones y nombres)

| Colección | Modos | Contenido | Oculta al publicar |
| --- | --- | --- | --- |
| `Primitives` | Value | Paleta (`gray/50`, `indigo/600`…) | Sí |
| `Semantic` | Light, Dark | 18 colores `color/<grupo>/<nombre>`, con alias a Primitives | No |
| `Scale` | Value | `space/*`, `radius/*`, `font-size/*`, `font-weight/*`, `line-height/*`, `font-family/*` | No |

Regla de nombres (la usan `check.mjs`, `build-figma.mjs` y `sync-skill.mjs`):
- `surface-base` → `color/surface/base` · `action-primary-hover` → `color/action/primary/hover`
- `space-3` → `space/3` · `font-size-sm` → `font-size/sm`
- `shadow-sm` → **estilo de efecto** `shadow/sm` (no es variable)

Detalles de `figma/variables.json`: los colores semánticos llevan **alias** a Primitives (no hex), un valor distinto por modo y los **ámbitos** (scopes) que los contratos necesitan (un color de texto solo se puede aplicar a texto). `line-height` va en porcentaje (1.25 → 125). `font-family/sans` usa «Inter» como equivalente de `system-ui`; cámbialo en `scripts/lib/figma.mjs` si usas otra fuente.

## 4. Component sets

Para cada contrato, un component set con **el nombre de `figma.set`** y:
1. **Propiedades** exactamente las de `figma.variantProperties`, `textProperties`, `booleanProperties` y `slotProperties` (nombres y valores tal cual). Si tu archivo aún no tiene slots, usa Instance swap con el mismo nombre.
2. **Capas** con los nombres de `figma.layers`. Ninguna capa se llama «Frame 12» ni «Rectangle 4».
3. **Auto layout** en todo contenedor. Las notas de cada contrato (`figma.notes`) dicen dirección y tamaño.
4. **Variables enlazadas**, no valores: cada clave de `tokens.bindings` se traduce con `figma/binding-map.json` (por ejemplo `paddingX` → padding izquierdo y derecho; `focusRing` → stroke de 2px en `State=Focus`).
5. **Estados** como una propiedad de variante `State` (Default, Hover, Focus, Error, Disabled según el contrato). Disabled anula Hover.
6. **Descripción** del component set = `description` del contrato.

## 5. Cómo construirla (elige un camino)

| Camino | Cuándo | Cómo |
| --- | --- | --- |
| A · A mano o con un plugin de importación de variables | Sin conector, equipos pequeños | Crea las colecciones con `figma/variables.json` abierto al lado; luego los 4 component sets con `references/components-figma.md` |
| B · Con Claude y el conector oficial de Figma | Lo normal en el taller | Prompt de la fase F1 en `taller/1b-prompt-skill-figma.md`. Claude crea variables y component sets; tú revisas cada paso |
| C · Con un conector de consola de Figma (si lo tienes) | Muchas variables o iteración rápida | Mismo prompt; el conector cambia, el orden no |

Orden de construcción: **variables → estilos de efecto → component sets → página Foundations**. Revisa en Figma después de cada paso.

## 6. Comprobación de la librería (5 min)

- [ ] Existen las 3 colecciones; `Semantic` tiene los modos Light y Dark
- [ ] `Semantic` tiene 18 variables y todas son alias, no hex
- [ ] `Scale` tiene 22 variables; hay 2 estilos de efecto (`shadow/sm`, `shadow/md`)
- [ ] Hay 4 component sets con los nombres de `figma.set`
- [ ] Cada set tiene exactamente las propiedades del contrato (ni una más)
- [ ] Ninguna capa de la librería tiene un fill, stroke, padding o radio sin variable
- [ ] Al cambiar un frame de Light a Dark, ningún color se queda fijo

## 7. Publicar y cerrar el círculo

1. Publica la librería (Assets → Publish).
2. Pide a Claude que lea la clave de cada component set y la escriba en `figma.key` de su contrato.
3. `npm run check` y `npm run skill:sync:figma`. Con la clave, el skill localiza el componente sin ambigüedad.

## 8. Mantenerla viva

| Cambia… | Haces… |
| --- | --- |
| Un valor de `tokens.json` | `npm run tokens:build` y `npm run figma:build`; actualiza la variable en Figma |
| Un contrato (prop, estado, parte) | `npm run check`; actualiza el component set; `npm run skill:sync:figma` |
| Un componente nuevo | Contrato con su bloque `figma`, component set en Figma, `npm run verify` |

> Aviso: esta especificación se ha validado contra los scripts de Kora, no contra un archivo de Figma real. Ensáyala con tu archivo antes del taller y ajusta lo que difiera (por ejemplo, ámbitos de variable o slots según tu versión de Figma).
