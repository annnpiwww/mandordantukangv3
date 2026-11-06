# 10 Mobile References (Flutter, Android)

Distilled from mobile design sources. Scope: in-app mobile UI (e.g. Flutter / Android field app). Platform rules are written as Flutter/M3 equivalents. Base rules live in 04 (components), 02 (type scale), 06 (tokens), 09 (gate). This file adds mobile thresholds and Flutter recipes.

## 1. Source list
- imagegen-frontend-mobile (first screen, safe area, anti-AI-tells)
- figma-designer (spacing, radius, token layers, states)
- cwb-theming (theme-change re-render, two theme layers; principles only)
- android edge-to-edge (insets, system bar icons, dialogs, IME)
- android jetpack-compose adaptive (adaptive columns, state preservation)
- screenshot-optimization: skipped, ASO/store screenshots, nothing for in-app UI.
- awesome-agent-skills (mobile-relevant design references)
  - anthropics/frontend-design
  - microsoft/frontend-design-review
  - google-labs-code/design-md
  - expo/expo-ui-jetpack-compose (Compose, Expo-bound, reference only)

## 2. Composition rules
- One primary focal point per screen. One primary action, pinned in lower half (thumb zone). Other actions secondary or tertiary.
- Screen margin 16dp (12dp dense operational lists). Section gap 24dp. Field gap 16dp. Card inner padding 16dp. Inside-card row gap 8-12dp.
- Spacing scale: 4, 8, 12, 16, 24, 32. Nothing else. Bind to constants, no magic numbers.
- Density: field screens show the working data above the fold (task list, map, status). App bar title one line. Header chrome under ~120dp.
- Tap target min 48x48dp (`IconButton` default is 48; custom taps wrap `SizedBox`/`InkWell` to 48).
- Text floor 12sp. Body 14sp. Screen title 20-22sp.
- Height budget at 360x800 dp: app bar 56, primary action 52 plus 16 padding, bottom nav 80 if present.
- Test width 360 and 412dp, text scale 1.3, both themes. Never fixed-height text containers.

## 3. Pattern catalog (Flutter recipes)

### KPI / summary tiles
- Max 4 tiles. 2 per row on 360dp (`Expanded` pairs, gap 12), or horizontal `ListView` if more.
- Layout: value (20-22sp, w700) on top, label (12sp, w500, textSecondary) below. One accent max.
- Tap only if it drills down (`InkWell` 48dp min). Non-tappable tiles must not look tappable.
- No tile without a product reason. No sparkline or chart in a tile unless the user needs trend.

### Filter pickers: choose by count and label length
- 2-5 short labels, frequent toggle: `Wrap` or horizontal `ListView` of `FilterChip`. Height 40, hit area padded to 48.
- More than 5 options, or any label longer than about 16 characters, or option counts needed: a list picker with `ListTile`-style rows, min 48dp. Trailing count (`Text`, textSecondary), trailing `Icons.check_rounded` on selected. Selected state uses icon plus weight, not color alone. Apply button only if multi-select.
- Container for that list: centered `Dialog` (radius 16, maxWidth 360, maxHeight 70% screen, title + close `IconButton`, scrollable list). Use a bottom sheet only when the spec says so.
- `AlertDialog` for a single decision or confirm step.

### List rows and cards
- Row min height 56 (one line), 72 (two lines). Use `ListTile` with `dense: false` for field screens.
- Order: identifier (code or location) first, title, who or when, status. Status = text plus icon plus color.
- Trailing action 48dp target, consistent position across rows. Destructive action visually separated, behind confirm.
- Dividers: `Divider(height: 1, color: Theme.of(context).colorScheme.outlineVariant)`. No one-side borders on cards.
- Card: `Card` or `Container`, radius 16, `BorderSide` all sides or none. Never card in card; inside a card use dividers.
- Lists: `ListView.separated`, not `Column` of many rows. Use `itemExtent` only when every row has fixed height.

### Bottom sheet vs full screen detail
- Sheet: quick view or form with at most 3 fields and one action, fits in 60% of screen height. Parent context stays visible (map, list).
- Full screen (`context.push` or `Navigator.push`): detail with photos, maps, multi-section forms, or its own actions and back stack.
- Skip the intermediate sheet: when a list row opens a record that has a primary action ("Start task", "Take photo"), push the detail route directly. Never tap-sheet-then-tap-screen for the same record.
- Sheet dismiss: drag handle plus scrim tap. Form sheets block dismiss while dirty (`isDismissible: false` plus confirm). Use `useSafeArea: true`.

### Empty, loading, error
- Loading: placeholder shaped like the real layout (grey `Container` blocks, same heights). No spinner for layouts that have known shape. Respect `MediaQuery.disableAnimationsOf(context)` (no shimmer when true).
- Empty: one sentence of what is empty + one action ("Add task"). Not an illustration wall.
- Error: plain message + retry button. Keep last good data visible above the error. Never show raw exception or stack text (security core 2).
- Action buttons in these states keep width and block double tap (`onPressed: null` while loading).

### Map overlays
- Use `GoogleMap(padding: EdgeInsets.only(bottom: panelHeight))` so markers and camera stay out of the covered region.
- Floating controls: 16dp from edges, `SafeArea` aware, 48dp targets. Max 2 floating controls at once (zoom or locate, plus one action).
- Bottom panel: `DraggableScrollableSheet` with snap sizes 0.12 (peek), 0.4 (half), 0.9 (full). Peek shows identifier and status only.
- Marker status: color plus shape or icon. Keep map attribution visible (do not cover it).
- Keep the active task pinned, do not stack two sheets over a map.

## 4. Material 3 and Android platform rules for Flutter

### Edge-to-edge and insets
- Enable once in `main()`: `SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge)`. Android 15+ forces edge-to-edge for targetSdk 35+, so content must handle insets regardless.
- `Scaffold` handles app bar, `NavigationBar`, `BottomAppBar`, and FAB insets. Pass `body` content that does not add its own top or bottom padding.
- Outside `Scaffold`: `SafeArea` (top and bottom) or `MediaQuery.paddingOf(context)`. Choose one method per subtree to avoid double padding.
- Scrollable lists under system bars: pass insets to the list `padding` (`EdgeInsets.fromLTRB(16, 8, 16, 16 + MediaQuery.paddingOf(context).bottom)`), not as an outer `Padding` that clips scroll.
- Nested padded children: `MediaQuery.removePadding(context: context, removeTop: true, child: ...)` after a parent consumed insets.
- Scaffold with `extendBody: true` is only for maps or full-bleed media; the content then owns its bottom padding.
- Keyboard: `Scaffold(resizeToAvoidBottomInset: true)` (default). Scrollable forms: `SingleChildScrollView(padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom))`. Do not add both `SafeArea` bottom and `viewInsets` for the same field.
- Android manifest `windowSoftInputMode` must be `adjustResize`.

### System bar icons
- Use `AnnotatedRegion<SystemUiOverlayStyle>` at the root. Light theme: `statusBarIconBrightness: Brightness.dark`, `systemNavigationBarIconBrightness: Brightness.dark`. Dark theme: inverse.
- `systemNavigationBarColor: Colors.transparent` with edge-to-edge. Set `systemNavigationBarContrastEnforced: false` where a bottom bar color must reach the edge.
- Under status bar with a colored app bar: app bar owns the color. Do not add a gradient scrim unless content scrolls under the bar on an image.

### Dialogs
- M3 default `AlertDialog` radius is 28. Project radius is 16. Set once: `DialogTheme(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)))` in `ThemeData`. Also `BottomSheetThemeData` top radius 16 (or 28 if M3 default kept, decided once, not per widget).
- Full-screen dialog: `Dialog.fullscreen`, body wrapped in `SafeArea`.
- Dialog buttons: max 2, right-aligned, label as verb with object.

### Tap targets and typography
- Min 48x48dp hit area on every interactive element, including icon-only and chips.
- Map M3 `TextTheme` roles to project sizes:
  - `titleLarge` 22 w700 (screen title, max 20 on dense screens)
  - `titleMedium` 16 w700 (section title)
  - `titleSmall` 14 w700 (card title)
  - `bodyLarge` 16 w400, `bodyMedium` 14 w400 (body)
  - `labelLarge` 14 w600 (button text)
  - `labelMedium` 12 w600 (chip, badge)
  - `labelSmall` override to 12, not M3 default 11 (floor)
- Set `textScaler` test at 1.3; text must wrap, never clip. Use `Flexible`/`Expanded` and `maxLines` with `overflow: TextOverflow.ellipsis` only for identifiers.

### Adaptive widths
- Phone compact: under 600dp logical width. Project target: 360-412dp. Layout must hold at 360 and 412 with text scale 1.3.
- Window size classes for tablet/foldable (only if asked): compact <600, medium 600-839, expanded 840+.
- Adaptive grid: `SliverGridDelegateWithMaxCrossAxisExtent(maxCrossAxisExtent: 360)`. Use for lists of tiles, not for list-detail rows.
- Two-pane (list plus detail) only on width >= 840. Below that, push routes.
- State survives rotation: keep state in providers or `PageStorageKey` on scrollables, not in widget `State` only.

## 5. Theming
- One source of colors: `ColorScheme` (M3) plus a `ThemeExtension<AppTokens>` for roles missing from `ColorScheme` (status success, warning, info, map marker colors). Project palette feeds these; widgets read only `Theme.of(context)`.
- Read colors via `Theme.of(context).colorScheme` or the extension. Never hardcode hex colors inside widgets.
- Theme change re-renders: `MaterialApp(themeMode: ...)` plus `ThemeData` built for light and dark. Do not cache colors in `static final` fields; they will not switch.
- Two theme layers: app `ThemeData` covers app bar, `NavigationBar`, sheets, dialogs, inputs. Map style (JSON) is a separate layer; switch it on brightness too.
- Dark mode: `ColorScheme.fromSeed(brightness: Brightness.dark)` or explicit dark tokens. Surfaces flat, elevation shown with `surfaceContainer*` tones, not shadows (shadows vanish on dark).
- `ThemeExtension` must implement `copyWith` and `lerp`.

## 6. Anti-slop list (mobile, concrete bans)
- No purple-blue or other gradient backgrounds, no gradient buttons.
- No `BackdropFilter` glass, no decorative blobs or orbs, no neon glow `BoxShadow`.
- No radius above 16 on cards and sheets; no radius on everything (pills only for real chips).
- No card in card. No more than 2 badges or pills per row.
- No KPI row with more than 4 tiles or with tiles that have no action or product reason.
- No placeholder brand names and no filler copy.
- No hero headline inside app screens. No "website hero in phone frame".
- No icon from two families on one screen. Use the project's existing icon set only.
- No avatar rows, fake status chips, or random charts that carry no data.
- No animation without purpose; honor reduced motion.

## 7. Review checklist (Mandor gate, mobile)
- [ ] One primary action, pinned in lower half, 48dp+ tall, label is a verb plus object.
- [ ] Screenshot at 360 and 412dp, text scale 1.3, both themes: no overflow, no clipped text.
- [ ] `Scaffold` or `SafeArea` used once per subtree; no double inset padding.
- [ ] Lists pass insets via `padding`; FAB and bottom bar clear of gesture area.
- [ ] Keyboard: focused field stays visible; no field hidden behind keyboard.
- [ ] System bar icon brightness matches theme.
- [ ] Dialog and sheet radius match theme (16 or the chosen single value), not mixed.
- [ ] Every interactive element hit area >= 48dp (icon buttons, chips, map controls).
- [ ] Filter pattern matches rule: chips for 2-5 short, centered Dialog list for more or long labels.
- [ ] No sheet-then-screen detour for a record with a primary action.
- [ ] Empty, loading (layout-shaped), and error (retry, last data kept) states exist.
- [ ] Zero hex literals in widget files; colors come from theme or tokens.
- [ ] Anti-slop bans in section 6 absent.
- [ ] Map: markers and camera clear the bottom panel; attribution visible.
- [ ] Unverified items (device, real GPS, real camera) listed as unverified, not claimed.
