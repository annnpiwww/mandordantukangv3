# 05 UX and Interaction

Optimize the complete workflow, not an isolated screen.

## Flows
- Map the user flow before screens: entry point, steps, decision points, exit, error branches.
- Primary action of each screen is the fastest path; secondary actions one level deeper.
- Do not split one workflow across views that force the user to lose context (e.g. monitoring in one tab, creating in another).

## Interaction rules
- Controls discoverable, outcomes predictable, action-oriented labels.
- Feedback for every action within 100ms (pressed state), progress for >1s, result message on completion.
- Prevent errors first (constraints, defaults, disabled-with-reason), then easy recovery (undo, clear messages).
- Confirm consequential or destructive actions; say exactly what will happen.
- Preserve user input across interruptions: dismissed sheet, back navigation, app backgrounded, offline.
- Gestures always have a visible alternative.

## States (spec all, every screen)
Loading (skeleton matching final layout) · Empty (why + next action) · Filtered-empty (reset filter) · Success · Error (what happened + how to fix + retry) · Disabled (reason) · Offline/cached (data age, sync behavior).

## Edge cases
Long names/titles, missing optional data, zero/one/many items, large datasets (pagination or virtualization), slow network, permission denied, concurrent edits, time zones and date boundaries.

## Usability heuristics (Nielsen)
1 visibility of system status · 2 match the real world (user language, local terms) · 3 user control and freedom (undo, cancel) · 4 consistency and standards · 5 error prevention · 6 recognition over recall · 7 flexibility and efficiency (shortcuts for experts) · 8 aesthetic and minimalist design · 9 help users recognize and recover from errors · 10 help and documentation.

## Field / operational context
One-handed use, sunlight glare, gloves, weak signal, interruptions mid-task: large targets, high contrast, offline-tolerant, resumable flows.
