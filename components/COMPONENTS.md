# Componentes de Kora

Si un componente no está aquí, **no existe**. Se pregunta antes de crearlo. Cada componente tiene su ficha en `contracts/<Componente>.contract.json`: allí están las props exactas, los tokens permitidos, lo que no hay que hacer y cómo se monta en la librería de Figma (bloque `figma`).

| Componente | Clases | Variantes / tamaños | Cuándo |
| --- | --- | --- | --- |
| Button | `k-btn` + `k-btn--{primary,secondary,ghost,danger}` · `k-btn--sm` | primary, secondary, ghost, danger · sm, md (defecto) | Lanzar una acción |
| TextField | `k-field` > `k-field__label`, `k-field__input`, `k-field__hint` / `k-field__error` · `k-field--invalid` | normal, invalid, disabled | Texto de una línea |
| Badge | `k-badge` + `k-badge--{neutral,success,warning,danger}` | 4 variantes | Estado o categoría. Informativo, no clicable |
| Card | `k-card` > `k-card__header?`, `k-card__body`, `k-card__footer?` | — | Agrupar contenido sobre la base |

Todos se importan con `<link rel="stylesheet" href="…/tokens/tokens.css">` y `<link rel="stylesheet" href="…/components/components.css">`. La página lleva `class="k-page"` en `<body>`.

## No existen todavía (preguntar, no inventar)

Menu / Dropdown · Modal / Dialog · Table · Tabs · Toast · Select · Checkbox · Switch · Icon
