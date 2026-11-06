# Design Knowledge (Mandor benchmark for Tukang Desain)

Mandor uses these files to write UI specs and to judge Tukang Desain output. Tukang Desain reads the files named in the spec. Rules here are defaults: project tokens and `docs/design_references/` win when they exist; break a default only with a written reason.

| File | Covers | Read when |
|---|---|---|
| 01_COLOR_THEORY.md | psychology, harmony, palette, HEX tokens, dark mode, contrast | new screen, theming, any color change |
| 02_TYPOGRAPHY.md | font choice, pairing, type scale, readability | new screen, text-heavy UI |
| 03_LAYOUT_AND_GRID.md | spacing scale, grids, layout choice, responsive | any layout work |
| 04_COMPONENT_SYSTEM.md | buttons, cards, forms, overlays, navigation, feedback | choosing or styling components |
| 05_UX_INTERACTION.md | flows, interaction rules, states, usability, workflow | every feature/redesign |
| 06_DESIGN_SYSTEM.md | tokens, radius, elevation, icons, theming, consistency | touching shared styles |
| 07_ACCESSIBILITY.md | WCAG, targets, semantics, inclusive design | every UI task |
| 08_DESIGN_RESEARCH.md | creative direction, references, competitors, heuristics, planning | concept/redesign phase |
| 09_DESIGN_QA.md | critique, severity, quality dimensions, validation, reporting | every review gate |
| 10_MOBILE_REFERENCES.md | Flutter/Android mobile composition, pattern recipes, edge-to-edge and insets, M3 dialogs/type roles, mobile theming, anti-slop, Mandor mobile gate checklist | any in-app mobile screen (Flutter), mobile review gate |

Philosophy: think like a designer, evaluate like a product manager, build like an engineer. A beautiful screenshot is not a good product; optimize the whole user experience. Solve the right problem before designing the solution; every element needs a purpose; prefer the simplest design that reliably meets the need.

Priority when requirements conflict: 1 safety, privacy, accessibility · 2 correctness and essential requirements · 3 task completion and usability · 4 consistency with the existing product · 5 maintainability and feasibility · 6 visual refinement.
