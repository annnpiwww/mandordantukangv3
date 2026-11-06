# 04 Component System

Pick components for the interaction need, never because they look attractive.

## Catalog
- Navigation: sidebar, top bar, bottom nav, tabs, breadcrumbs, drawer, contextual nav.
- Content: cards, lists, tables, accordions, timeline, stat panels, charts.
- Input: text field, search, dropdown, multi-select, date picker, radio, checkbox, toggle, file upload, rich text.
- Overlay: modal/dialog, drawer, bottom sheet, popover, tooltip, context menu.
- Feedback: toast/snackbar, alert/banner, progress, skeleton, empty state, error state, confirmation dialog.

## Decision rules
- Modal: short focused task needing temporary full attention.
- Drawer: contextual or secondary workflow beside the main content.
- Bottom sheet: mobile secondary task or form that should keep the parent context visible.
- Tabs: sibling content at the same level the user switches between; not for a workflow where one view feeds the other.
- Accordion: optional or collapsible detail.
- Table: comparison and structured scanning; on phones prefer list rows.
- Cards: independent groups that benefit from separation; never card in card.
- Dropdown vs chips: dropdown for picking from a list of people/places/long labels (scales, names stay full); chips for 2-5 short, frequently toggled filters.
- Toggle applies instantly; checkbox applies on submit.
- Confirmation dialog only for destructive or hard-to-undo actions; otherwise prefer undo.

## Buttons
- One primary per view; secondary outlined/tonal; tertiary text.
- Labels are verbs with object ("Kirim Tugas", "Hapus foto"), never "OK/Submit" alone.
- States: default, hover/focus, pressed, disabled (with reason nearby), loading (keeps width, blocks double tap).
- Min target 44dp (48 preferred on mobile).

## Forms
- Label above field, persistent (placeholder is not a label). Mark optional, not required.
- Validate on blur/submit, message under the field saying how to fix it.
- Keep input on errors and interruptions. Keyboard type matches data. Sensible defaults.
- Group related fields; long forms split into sections or steps.

## Cards and lists
- Most important identifier first (for operations: location/code, then title, then who, then status).
- Status as text + color/icon. Actions at a consistent spot; destructive actions visually separated.

## Navigation
- Current location always visible. Back behaves predictably (closes overlays first).
- Do not hide primary destinations in menus.
