# Kora · mini sistema de diseño (para el taller)

Un sistema **a propósito pequeño**: 18 tokens semánticos × 2 modos, 4 componentes con su contrato JSON (que incluye su traducción a Figma) y 4 principios. Cabe entero en la cabeza de una persona y en el contexto de una IA.

```
kora/
├── README.md
├── package.json              scripts: tokens:build · figma:build · check · lint:ds · skill:sync · skill:sync:figma · verify
├── check.mjs                 valida contratos, su bloque figma y figma/variables.json (npm run check)
├── tokens/
│   ├── tokens.json           FUENTE ÚNICA de tokens
│   └── tokens.css            GENERADO. No se edita a mano
├── components/
│   ├── components.css        Button · TextField · Badge · Card
│   └── COMPONENTS.md         inventario + lo que NO existe
├── figma/                    la librería de Figma, descrita
│   ├── LIBRARY-SPEC.md       cómo debe ser el archivo de Figma (variables, component sets)
│   ├── binding-map.json      clave de binding → propiedad de Figma
│   └── variables.json        GENERADO desde tokens.json. No se edita a mano
├── contracts/                una ficha JSON por componente (+ bloque figma)
│   ├── component.schema.json formato (el editor te avisa)
│   ├── _template.contract.json  plantilla para contratos nuevos
│   └── Button / TextField / Badge / Card .contract.json
├── docs/principios.md        4 principios + gobernanza mínima
├── scripts/
│   ├── build-tokens.mjs      tokens.json → tokens.css
│   ├── build-figma.mjs       tokens.json + contratos → figma/variables.json
│   ├── lib/figma.mjs         regla de nombres token → variable de Figma (compartida)
│   ├── lint-ds.mjs           falla si hay colores/px sueltos
│   └── sync-skill.mjs        genera las referencias de los skills (--kind code | figma)
├── playground/index.html     todo el sistema en una página (claro/oscuro)
└── examples/
    ├── sin-skill.html        cabecera generada SIN skill (con drift a propósito)
    └── con-skill.html        la misma cabecera CON skill
```

## Comandos

```bash
npm run tokens:build   # regenera tokens/tokens.css
npm run check          # valida los contratos contra tokens y CSS
npm run lint:ds        # busca valores sueltos en el proyecto
npm run figma:build    # regenera figma/variables.json
npm run skill:sync     # referencias del skill de código (tokens.md, components.md)
npm run skill:sync:figma # referencias del skill de Figma (variables.md, components-figma.md)
npm run verify         # tokens:build + figma:build + check + lint:ds
```

Los skills **no están** aquí: los construyes en el taller y se guardan en `.claude/skills/design-system/` (código) y `.claude/skills/design-system-figma/` (Figma). En `../solucion/` hay una versión de referencia de cada uno para comparar al final.
