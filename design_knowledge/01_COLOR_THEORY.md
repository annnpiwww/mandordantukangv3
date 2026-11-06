# 01 Color Theory

Color is a decision, not decoration. Pick from brand, context, and accessibility, never popularity.

## Psychology (meaning depends on culture, brand, context)
| Color | Associations | Typical use |
|---|---|---|
| Blue | trust, stability, professional | business, technology |
| Navy | authority, confidence | enterprise, finance |
| Green | growth, success | positive states, operations |
| Purple | creativity, premium | AI, creative (avoid as generic default) |
| Orange | energy, attention, action | CTAs, productivity |
| Red | urgency, danger | errors, destructive actions |
| Yellow | optimism, attention | highlights, notices |
| Teal | balance, clarity | tech, services |
| Black | strength, elegance | premium, creative |
| Gray | neutral, structure | backgrounds, secondary content |

## Palette architecture (every project)
- Primary: 50-900 ramp, base, hover, active/pressed.
- Secondary: supporting brand colors.
- Neutral: background, surface, elevated surface, text primary/secondary/disabled, border, divider.
- Semantic: success, warning, error, info (each with light bg + border tint).

Illustrative token set (not defaults): Primary #2457D6, Primary hover #1946B5, Background #F7F8FC, Surface #FFFFFF, Heading #172033, Body #566176, Border #E4E8F0, Success #16865B, Warning #D98A17, Error #D64545, Info #2878D0. Generate from the real brand.

## Harmony techniques (use deliberately)
Monochromatic (one hue, many tints) · Analogous (neighbors) · Complementary (opposites, for a single strong accent) · Split complementary · Triadic · Neutral palette (restrained color, strong type).

## Distribution
60-30-10 as a starting point: 60% neutral surfaces, 30% secondary surfaces/support, 10% accent and key actions. Accent color is scarce on purpose: one primary action per view should own it.

## Contrast and states
- WCAG AA: 4.5:1 normal text, 3:1 large text (>= 18.66px bold / 24px) and UI components/icons.
- Check hover, focus, pressed, disabled, selected for every interactive color.
- Never convey status by color alone: add icon, text, or shape.

## Dark mode
- Not inverted light mode: use dark neutral surfaces (not pure black), raise elevated surfaces lighter.
- Desaturate and lighten accents to keep contrast without glare; re-check every pair.
- Semantic colors keep meaning; tint backgrounds at low alpha instead of solid blocks.

## Anti-slop
No default purple-blue gradients, no arbitrary accent per component, no neon glow, no more than one accent fighting for attention.
