# Principios de Kora

1. **Un significado, un token.** Cada decisión visual tiene un nombre por uso (`surface-raised`), no por aspecto (`gris-claro`).
2. **Sin valores sueltos.** Si no hay token, se pregunta; no se inventa.
3. **Accesible por defecto.** Foco visible, contraste AA, tamaño táctil de 48 px.
4. **Claro y oscuro con las mismas variables.** Nunca se escriben valores distintos para dark: cambia `data-theme`.

## Gobernanza mínima

- **Una sola fuente de verdad:** `tokens.json` y los contratos. El CSS, `figma/variables.json` y las referencias de los skills se **derivan**; nunca se editan a mano.
- Cambiar un token: se edita `tokens/tokens.json` y se ejecuta `npm run tokens:build` y `npm run figma:build`; después se actualiza la variable en Figma.
- Añadir un componente: línea en `components/COMPONENTS.md`, contrato (con su bloque `figma`), CSS, component set en Figma.
- Antes de dar algo por bueno: `npm run verify` (tokens, Figma, contratos y lint).
