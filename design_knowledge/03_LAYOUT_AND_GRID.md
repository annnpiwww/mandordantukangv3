# 03 Layout and Grid

## Spacing scale (4/8 base)
4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64. No arbitrary values without a reason. Related items closer than unrelated ones (proximity carries grouping).

## Grids
- Mobile 4 columns, 16dp margins (12 on dense operational screens).
- Tablet 8 columns. Desktop 12 columns with max content width.
- Fluid vs fixed columns chosen per content; never force desktop layouts onto phones.

## Layout choice by information structure
| Layout | Use for |
|---|---|
| Sidebar | complex desktop apps |
| Top navigation | websites, simple platforms |
| Bottom navigation | mobile apps, 3-5 top destinations |
| Card grid | overview, grouped independent items |
| List | scannable records on mobile |
| Table | comparison, precise structured data |
| Kanban | workflow stages |
| Split view | master-detail |
| Dashboard grid | metrics, monitoring |
| Timeline | history, activity |
| Wizard | multi-step processes |
Every layout needs a stated information architecture: what is primary, what is secondary, what is hidden until asked.

## Responsive
- Adapt to platform and width; target 360-412dp phones first for field apps, then tablet.
- No clipping, overflow, or unreachable controls at any supported width or text scale 1.3.
- Fixed chrome (app bar, filters, headers) as small as possible; the content the screen is named after must be visible without scrolling.
- Respect safe areas, keyboard insets, and thumb reach (primary actions in the lower half on mobile).
- Wrap or scroll horizontally instead of shrinking text.

## Visual rhythm
Align to a few strong edges, balance whitespace with density for the task (operational screens can be denser than marketing), repeat spacing consistently between sections.
