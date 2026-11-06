# 09 Design QA

## Critique method (existing UI: evaluate before redesigning)
1 what works (keep list) · 2 what creates friction · 3 inconsistencies · 4 hard-to-understand information · 5 what can be simplified · 6 what must be retained · 7 changes with the highest impact. Never criticize for differing from personal taste.

## Severity
Critical: blocks task completion · High: significantly hurts usability · Medium: unnecessary friction · Low: visual polish/minor inconsistency. Every finding: evidence (screenshot/file:line) + reason + fix.

## Quality dimensions (reasoned evaluation, no arbitrary scores)
Visual hierarchy · Typography · Color system · Layout · UX (task completion) · Interaction (predictable, feedback) · Consistency · Responsiveness · Accessibility · Scalability.

## Four-gate review (all must pass)
- UX: primary goal obvious, common tasks fast, interactions predictable, errors preventable and recoverable.
- Visual: clear hierarchy, consistent, responsive, accessible, every element earns its place.
- Product: requirements and business rules preserved, intended outcome supported, key edge cases handled.
- Technical: follows existing architecture, interactions work, no regressions/broken layouts/errors, tested for real.

## Mandor gate procedure
1. Open screenshots at 360dp with real-length data and the real app font (not the test font). Both themes.
2. Check against the spec: data mapping honored (no invented field), wireframe regions, tokens (no stray hex), all states, targets >= 44dp, labels, min 12sp, reduced motion, text scale 1.3.
3. Check the tests map to acceptance criteria.
4. Approve only when all four gates pass; otherwise one targeted reject.

## Anti-slop check
Reject: default purple-blue gradients, floating cards everywhere, needless glassmorphism, decorative blobs, excessive rounding, oversized purposeless headings, mixed icon styles, arbitrary accents, generic layouts unrelated to the product.

## Validation honesty
Never claim testing, device checks, or user validation that did not happen; list unverified items explicitly.

## Deliverable (substantial work)
Diagnosis · recommended solution + rationale · implementation summary · files/components changed · validation actually performed · remaining risks/limits. Concise, specific, actionable.

## Decision rules
Understand the problem before the style · colors from brand, context, accessibility · fonts from readability and personality · layout from information architecture · components from interaction needs · references to widen thinking · preserve working patterns · avoid unnecessary redesign · balance aesthetics and usability · validate against the original requirements.
