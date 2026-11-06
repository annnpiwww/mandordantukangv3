# 06 Design System

Every substantial product keeps one system: tokens, palette, type, spacing, grid, radius, elevation, icons, component library, interaction states, breakpoints, accessibility standards.

## Tokens
- Name by role, not value (`textSecondary`, not `gray600`). Components consume tokens only; no stray hex in widgets.
- Reuse existing project tokens first (Flutter: `AppColors`, theme). Add a token only when a real role is missing, and say why.
- Light and dark values per token.

## Radius
Small buttons 6-10 · inputs 8-12 · cards 12-16 · modals/sheets 16-24 · large surfaces 20-28 · pills fully round. Use max 3 radius values per screen.

## Elevation
- Subtle shadows for standard surfaces, stronger only for floating elements (FAB, menus, sheets).
- Prefer borders when shadow adds nothing. Max 2 elevation levels per screen. No glow.

## Iconography
- One icon family, consistent stroke/fill style; do not mix filled and outlined without meaning (e.g. filled = selected).
- Recognizable icons; ambiguous icons get a text label. No emoji as UI icons.

## Interaction states
Every interactive component defines default, hover/focus, pressed, selected, disabled, loading, error, with token-based colors.

## Theming
- One primary visual direction across the product (see 08).
- Dark mode derives from the same roles (see 01). Test both themes for every new component.

## Consistency
- Same role, same component, same style everywhere. Before creating a component, search for an existing one.
- Visual changes to shared components affect every screen: list the screens touched.
