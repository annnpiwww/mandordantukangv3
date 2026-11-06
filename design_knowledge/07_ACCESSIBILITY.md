# 07 Accessibility and Inclusion

Accessibility outranks visual preference (priority 1).

## Standards
WCAG 2.2 AA plus platform guidance (Material, Apple HIG).

## Checklist
- Contrast: 4.5:1 text, 3:1 large text and UI components/focus indicators. Check every state and both themes.
- Text: min 12sp readable text; supports system text scale up to at least 1.3 (target 2.0 without loss of function where feasible).
- Targets: >= 44x44dp (48 preferred), 8dp between adjacent targets.
- Semantics: meaningful labels for icons/buttons ("Hapus tugas", not "icon"), headings marked, logical reading/focus order, form fields linked to labels and errors.
- Keyboard/switch: everything reachable and operable, visible focus, no traps (desktop/web; tablets with keyboards).
- Screen readers: state changes announced (loading done, error, item added).
- Never color-only, sound-only, or gesture-only meaning.
- Motion: respect reduced motion; no flashing > 3/s; animations short and purposeful.
- Time limits: avoid or allow extension.
- Errors: identified in text, with fix instructions.

## Inclusive design
Design for varied ability, age, experience, language, device quality, and environment (glare, noise, one hand, gloves, low bandwidth). Plain local-language copy, no jargon the user would not use.

## Verification
Widget/semantic tests for labels and target sizes, contrast checked with real token values, manual pass with TalkBack/VoiceOver when feasible. Report unverified items as unverified.
