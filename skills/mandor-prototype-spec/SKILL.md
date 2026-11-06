---
name: mandor-prototype-spec
description: Use when Mandor plans any UI/UX work (new screen, redesign, mockup from the user) and must write a prototype spec that Tukang Desain can build exactly, without improvising.
---

# Mandor Prototype Spec

Mandor designs, Tukang builds. The spec is the prototype: if Tukang has to guess, the spec failed.

## 0. Before writing (ground truth, 5 minutes max)
1. Read the data model the screen renders (model class, table schema, service return type). List every field.
2. Read the current screen only at the build() root and the widgets the change touches.
3. Look at the user's mockup/reference: write down what it shows that the data does NOT have. Those items get cut or become a question to the user, never placeholders.

## 1. Product frame (3 lines)
- User and moment: who opens this, where, with what goal (e.g. operator in the field, one hand, checking status).
- Primary action: the one thing the screen must make fastest.
- Success signal: what the user sees in the first second without scrolling.

## 2. Data mapping table (mandatory, prevents invented data)
| UI element | Source field / formula | Empty value |
|---|---|---|
| "3 / 5" result | `completedCount / totalCount` of latest phase | "No data available" |

Any UI element without a source row is forbidden.

## 3. Wireframe (ASCII, mobile 360-412dp width)
```
┌ AppBar: title · subtitle ───────────── [action] ┐
│ [‹] November 2026 [›]                           │
│ (All)(Region A)(Region B)  chips, scroll-x      │
├─────────────────────────────────────────────────┤
│ MAP full bleed                     [fit][+][-]  │
│  ┌ floating summary card ┐                       │
├══ sheet handle ═════════════════════════════════┤
│ [ Items (5) | Pending (3) ]  pinned segmented   │
│ ! label 16/600            [Urgent]              │
│   reason 14 secondary, 2 lines                  │
└─────────────────────────────────────────────────┘
```
Mark: fixed vs scrolling regions, what is pinned, sheet sizes, z-order.

## 4. Tokens (reuse project tokens first; new ones only if missing)
| Token | Value | Use |
|---|---|---|
Type scale (sizes/weights, min 12sp), spacing scale (4/8/12/16/24), radius set (max 3 values), elevation levels (max 2), semantic colors with the contrast ratio against their background.

## 5. Component spec (one row per component)
| Component | Anatomy | Variants | States | Size/hit area | a11y label |
|---|---|---|---|---|---|
States always cover: default, pressed, selected, disabled, loading, empty, error.

## 6. Interaction table
| Trigger | Result | Motion | Edge case |
|---|---|---|---|
| tap marker | select + callout | 180ms fade | marker with lat 0 not rendered |

Include: back behavior, refresh/polling, offline, reduced motion, text scale 1.3.

## 7. Acceptance (Given/When/Then, testable)
- Given 2 items with issues and 1 urgent, When the sheet opens, Then the Issues tab is selected and the urgent item is first.
Each criterion maps to a widget test or a visible check Security can run.

## 8. Cut list and questions
- Cut: mockup items without data (say why in one line).
- Ask the user only for real tradeoffs (new backend data, new dependency, scope growth).

## Writing rules
- English, imperative, file:line for every touched place, no "make it nice". Numbers, not adjectives.
- One coherent style; reference the project design doc (e.g. `docs/design_references/`) by path, the bridge adds the REFS line.
- Split: UI spec to `ui`; data/service changes to `coder` with a shared contract in `docs/contracts/<feature>.md`; tests/a11y/regression to `sec`.

## Review checklist (Mandor gate on Tukang Desain report)
Data table honored (no invented field) · wireframe regions match · tokens used, no stray hex · all states present · hit areas and labels · no card in card · min 12sp · motion respects reduced motion · tests cover acceptance.
