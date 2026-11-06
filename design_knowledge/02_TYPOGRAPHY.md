# 02 Typography

Typography drives perceived quality. Choose by readability, personality, platform, language support, and available fonts (prefer fonts already bundled in the project).

## Families
- Sans-serif (Inter, Roboto, SF Pro, Manrope, Plus Jakarta Sans, DM Sans, Geist): apps, dashboards, SaaS, mobile.
- Geometric sans (Poppins, Montserrat, Outfit, Urbanist): headings, branding.
- Humanist sans (Open Sans, Lato, Source Sans 3): content-heavy, business.
- Serif (Playfair Display, Lora, Merriweather, Libre Baskerville): editorial, premium, select landing pages.
- Monospace (JetBrains Mono, IBM Plex Mono, Fira Code): code, IDs, technical data.

## Pairing (one or two families)
| Heading | Body | Personality |
|---|---|---|
| Manrope | Inter | modern business |
| Plus Jakarta Sans | Inter | contemporary SaaS |
| DM Sans | DM Sans | minimalist |
| Playfair Display | Inter | premium editorial |
| Outfit | Roboto | modern tech |
| Geist | Geist | technical, clean |
Never pair at random; two families max, contrast in role not in mood.

## Scale
Desktop: Display 48-64/700 · H1 36-40/700 · H2 28-32/650-700 · H3 22-24/600 · H4 18-20/600 · Body L 16-18/400 · Body 14-16/400 · Caption 12-13/400-500 · Label 12-14/500-600.
Mobile (dp/sp, phones 360-412): Title 20-22/700 · Section 16-18/700 · Card title 14-16/700 · Body 14/400 · Secondary 12-13/500-600 · Label/chip 12-13/600. Floor: 12sp for any readable text; must survive text scale 1.3 without clipping.

## Rules
- Consistent line height: ~1.4-1.5 body, ~1.2-1.3 headings.
- Line length 45-75 characters for reading text.
- Max 3-4 weights per product.
- Clear heading/body hierarchy through size and weight, not color alone.
- Limit uppercase to short labels; add letter-spacing when used.
- Tabular figures for money, counts, times, stats.
- Same role = same style across all components.
- Truncate with ellipsis only for non-critical text; titles the user came for get 2 lines before truncating.
