# AquaTrack Design System

This document defines the visual and interaction language for **AquaTrack** (aqua-map-keeper). It reflects the current prototype implementation and is the single source of truth for new UI work.

**Implementation:** tokens live in `src/index.css` (`:root` CSS variables + `@layer components` utilities). Tailwind maps tokens in `tailwind.config.ts`. Prefer utility classes over one-off inline styles.

---

## 1. Product context

| Attribute | Value |
|-----------|--------|
| Platform | Mobile-first web app (PWA-friendly) |
| Max content width | `32rem` (`max-w-lg` / 512px) |
| Primary font | Inter (400, 500, 600, 700) |
| Brand personality | Clean, institutional, field-ready — aqua/teal accent on cool gray surfaces |
| Navigation | Bottom tab bar (Home, Survey, Campus) + sticky top header |

---

## 2. Color system

All colors use **HSL components** stored without the `hsl()` wrapper. Tailwind resolves them as `hsl(var(--token))`.

### 2.1 Core palette (light mode)

| Token | HSL | Hex (approx.) | Usage |
|-------|-----|---------------|--------|
| `--background` | `210 25% 98%` | `#F7F9FB` | Page background |
| `--foreground` | `210 40% 12%` | `#121C26` | Primary text |
| `--card` | `0 0% 100%` | `#FFFFFF` | Cards, panels, inputs |
| `--secondary` | `210 20% 94%` | `#EEF1F4` | Subtle fills, inactive chips |
| `--secondary-foreground` | `210 25% 28%` | `#3A4554` | Text on secondary |
| `--muted` | `210 18% 95%` | `#F1F3F5` | Disabled / placeholder surfaces |
| `--muted-foreground` | `210 12% 46%` | `#677583` | Captions, labels, hints |
| `--border` | `210 18% 90%` | `#E2E6EA` | Borders, dividers |
| `--primary` | `192 76% 36%` | `#168899` | **Brand actions, links, active states** |
| `--primary-foreground` | `0 0% 100%` | `#FFFFFF` | Text on primary |
| `--destructive` | `0 72% 51%` | `#E02424` | Errors, destructive actions |
| `--ring` | `192 76% 36%` | — | Focus rings |

> **Note:** `--accent` is currently **identical to `--primary`**. Use **`primary`** in all new app code. Reserve `accent` for shadcn hover states only.

### 2.2 Status colors

| Token | HSL | Meaning |
|-------|-----|---------|
| `--status-good` | `152 60% 38%` | Maintenance OK, floor complete |
| `--status-warning` | `38 92% 48%` | Due soon, in progress |
| `--status-urgent` | `0 72% 51%` | Overdue, locked, errors |

**Status surface pattern:** `{bg}-status-{name}/10` or `/15` background + `text-status-{name}` foreground.

Examples:
- Badge: `bg-status-good/10 text-status-good`
- Warning callout: `border-status-warning/25 bg-status-warning/5`
- Error callout: `border-status-urgent/40 bg-status-urgent/10 text-status-urgent`

### 2.3 Surface hierarchy

```
Level 0  app-surface     Page (gradient wash)
Level 1  bg-background   Base
Level 2  bg-card         Cards, list rows, inputs
Level 3  bg-secondary/20–30   Nested panels, preview areas
Level 4  bg-card/70           Info tiles inside cards
```

**Selected / active:** `border-primary/30 bg-primary/5` or `bg-primary/10`.

**Inverse CTA** (secondary emphasis): `bg-foreground text-background` — use `.btn-inverse` sparingly for retry / mark-done actions.

### 2.4 Overlays

| Context | Style |
|---------|--------|
| Dialog (shadcn) | `bg-foreground/30 backdrop-blur-sm` |
| Welcome screen | `.welcome-overlay` — same scrim |
| Inline modals | `.overlay-scrim` + `.overlay-panel` |

Do **not** use `bg-black/80` or `bg-black/50` in app code.

---

## 3. Typography

### 3.1 Type scale

| Role | Class / size | Weight | Use |
|------|----------------|--------|-----|
| Auth hero | `text-2xl` | `font-bold` | Auth page title |
| Page title | `.page-title` → `text-xl` | `font-bold tracking-tight` | Every page H1 |
| Dialog title | `text-lg` | `font-semibold` | Modal headers |
| Section label | `.section-label` → `text-xs uppercase tracking-wide` | `font-semibold` | Section headers, filter groups |
| Body | `text-sm` | `font-normal` | Descriptions, form help |
| Body emphasis | `text-sm` | `font-semibold` | List titles, card headings |
| Caption | `.text-caption` → `11px` | `font-normal` or `font-medium` | Metadata, tile subtitles |
| Micro | `.text-micro` → `10px` | `font-medium` or `font-semibold` | Nav tabs, stat labels, pills |
| Stat value | `text-xl` | `font-bold tabular-nums` | QuickStat numbers |

Page subtitle: `.page-subtitle` → `text-sm text-muted-foreground`.

### 3.2 Font weights

| Weight | When |
|--------|------|
| `font-bold` (700) | Page titles, stat values |
| `font-semibold` (600) | Buttons, list titles, badges, section emphasis |
| `font-medium` (500) | Nav tabs, field labels, secondary labels |
| `font-normal` (400) | Body copy |

### 3.3 Rules

- **List row titles:** always `font-semibold` (`.list-row-title`)
- **List row subtitles:** `text-xs text-muted-foreground` (`.list-row-subtitle`)
- **Field labels (standard forms):** `.field-label` — xs, muted
- **Wizard step labels:** `.field-label-lg` — sm, foreground
- **Links / text actions:** `.link-action` or `.link-back` — xs, `text-primary`
- **Input value text:** `text-sm` (`.field-input`, `.search-input`) — fixed at 14px, does not change on focus
- **Placeholder text:** fixed **11px** via `::placeholder` — always smaller than typed text; never scales with focus or platform

### 3.4 Copy style

- **Captions** under titles, tiles, and templates: one short line, no filler (“Choose a file…”, “Upload CSV or Excel”)
- Prefer verbs + object: “Record fixtures by floor”, not “Record fixtures floor by floor on site”
- Dialog subtitles use `.text-caption`; section labels use `.section-label` (uppercase micro heading)

---

## 4. Spacing & layout

### 4.1 Page shell

Every authenticated page uses:

```html
<div class="page-shell">
  <!-- mx-auto max-w-lg px-4 pt-5 pb-8 -->
</div>
```

AppShell main adds `pb-24` for bottom nav clearance.

### 4.2 Spacing scale

| Token | Tailwind | Usage |
|-------|----------|--------|
| Tight stack | `space-y-2` | List items, action tiles |
| Form sections | `space-y-3` / `space-y-4` | Form fields, wizard steps |
| Grouped content | `space-y-5` | Dialog sections |
| Section gap | `mt-4` – `mt-6` | Between page sections |
| Header margin | `mb-2` – `mb-5` | Below headers / labels |

### 4.3 Horizontal padding

| Context | Padding |
|---------|---------|
| Page | `px-4` (via `.page-shell`) |
| Card default | `p-4` |
| Auth / dialog | `p-5` / `sm:p-6` |
| List row | `px-3 py-3` |
| Quick stat | `px-3 py-2.5` |

### 4.4 Safe areas

- `body` applies `env(safe-area-inset-*)` padding
- Dialogs: `w-[min(28rem, calc(100vw - 2rem - safe-area))]` — never touch screen edges
- Dialog max height: `min(92dvh, 100dvh - 2rem - safe-area)`

### 4.5 Grid patterns

| Pattern | Classes |
|---------|---------|
| Quick stats | `flex gap-2` with `.quick-stat` children |
| Info tiles (2-col) | `grid grid-cols-2 gap-2` or `gap-3` |
| Photo grid | `grid grid-cols-2 gap-3` |
| Chip scroller | `.chip-row` |

---

## 5. Border radius

Base token: `--radius: 0.75rem` (12px).

| Radius | Class | Use |
|--------|-------|-----|
| 16px | `rounded-2xl` | Page cards (`.card-soft`), dialogs, major sections, full-width CTAs |
| 12px | `rounded-xl` | Buttons, inputs, list rows, inner tiles, quick stats |
| 10px | `rounded-lg` | Segmented options, compact nested controls |
| 8px | `rounded-md` | shadcn defaults (avoid in new app code) |
| Pill | `rounded-full` | Chips, badges, status pills, progress bars |

**Rule:** outer container → `rounded-2xl`; interactive interior → `rounded-xl`; pills → `rounded-full`.

---

## 6. Elevation & borders

- Default border: `border` (uses `--border`)
- Cards: `border bg-card shadow-sm` (`.card-soft`)
- Hover list row: `hover:bg-secondary/40`
- Hover action tile: `hover:border-primary/30 hover:shadow-sm`
- Dialog: `shadow-lg`; welcome panel: `shadow-xl`
- No heavy drop shadows elsewhere

---

## 7. Iconography

**Library:** [Lucide React](https://lucide-react.dev)

### 7.1 Size scale

| Tier | Size | Class | Context |
|------|------|-------|---------|
| XS | 12px | `h-3 w-3` | Inline in labels, chevrons in links |
| SM | 14px | `h-3.5 w-3.5` | Badges, compact buttons |
| MD | 16px | `h-4 w-4` | **Default** — headers, search, dialog close |
| LG | 20px | `h-5 w-5` | Action tiles, nav tabs, dialog titles |
| XL | 32px | `h-8 w-8` | Empty states, header logo area |

### 7.2 Color

| Context | Color |
|---------|-------|
| Default inline | `text-muted-foreground` |
| Brand / active | `text-primary` |
| On primary button | `text-primary-foreground` |
| Status | `text-status-{good\|warning\|urgent}` |
| Empty state | `opacity-40` on muted icon |

### 7.3 Stroke

- Default: Lucide default (2)
- Nav active tab: `strokeWidth={2.4}`

---

## 8. Components

### 8.1 Buttons

| Class | Use |
|-------|-----|
| `.btn-primary` | Primary actions — filled teal, **white label + icons** |
| `.btn-secondary` | Secondary actions — bordered card |
| `.btn-icon` | Icon-only 36×36 back/close |
| `.btn-cta` | Full-width page CTA (maintenance complete, etc.) |
| `.btn-inverse` | Inverse pill (retry scan) |
| `.btn-inverse-block` | Full-width inverse block (mark floor done) |
| shadcn `Button` | Dialog footers only — aligned to app tokens |

**Do not** mix `rounded-lg bg-accent` one-offs — use `.btn-primary` or shadcn Button.

### 8.2 Chips & filters

| Class | State |
|-------|-------|
| `.chip-active` | Selected filter / campus |
| `.chip-inactive` | Unselected |
| `.chip-row` | Horizontal scroller wrapper |

### 8.3 Cards & sections

| Class | Use |
|-------|-----|
| `.card-soft` | Standard elevated card (no default padding) |
| `.card-section` | Bordered card with overflow hidden + optional `.panel-header` / `.panel-body` |
| `.action-tile` | Full-width navigation row |
| `.list-row` | Clickable list item |
| `.quick-stat` | Dashboard stat tile |
| `.info-tile` | Label + value grid cell |

### 8.4 Forms

| Class | Use |
|-------|-----|
| `.field-label` | Standard label |
| `.field-label-lg` | Wizard section label |
| `.field-input` | Text input, select |
| `.field-textarea` | Multi-line input |
| `.search-input` | Search with left icon padding (`pl-10`) |

**Input rules:**
- Value: `text-sm`; placeholder: fixed 11px via `::placeholder`
- Date fields use the same full-width `.field-input` layout as other controls (label on one line, input below)
- Never use `text-base` on placeholders — they should read lighter and slightly smaller than typed text

### 8.5 Selectable cards

| Class | Use |
|-------|-----|
| `.selectable-card` / `.selectable-card-active` | Campus/building pickers (large) |
| `.selectable-card-sm` / `.selectable-card-sm-active` | Category grid (small) |

### 8.6 Callouts

| Class | Use |
|-------|-----|
| `.callout-warning` | Shared workspace notice |
| `.callout-error` | Import/export errors |
| `.callout-accent` | Info with brand tint (photo reminder) |
| `.callout-info` | Neutral info panel |

### 8.7 Dialogs

Structure (Export, Import, and future modals):

```html
<DialogContent class="dialog-shell">
  <DialogHeader class="dialog-shell-header">…</DialogHeader>
  <div class="dialog-shell-body">…</div>
  <DialogFooter class="dialog-shell-footer">…</DialogFooter>
</DialogContent>
```

- Shell uses **`!flex flex-col`** (overrides shadcn `grid` on `DialogContent`) so the body can scroll
- Header: **always left-aligned** (`.dialog-shell-header`, `pr-12` for close button)
- Body: `.dialog-shell-body` — `flex-1 min-h-0 overflow-y-auto overflow-x-hidden`; scrollbar hidden (touch/trackpad scroll still works)
- No horizontal scroll tables — use stacked key-value preview
- Footer: `.dialog-shell-footer` — full-width buttons on mobile

**Primary actions in dialogs:** `bg-primary text-primary-foreground` — icons and label text must stay **white** on brand fills.

### 8.8 Badges

| Component | Pattern |
|-----------|---------|
| `StatusBadge` | Pill + icon + status color at 10% bg |
| `RoleBadge` | `bg-primary/10 text-micro text-primary` |
| Floor status | `.status-pill` + `floorStatusPillClass` from `lib/statusStyles.ts` |

### 8.9 Empty states

```html
<div class="empty-state">
  <Icon class="empty-state-icon" />
  <p class="text-sm font-medium text-foreground">Title</p>
  <p class="mt-1 text-caption text-muted-foreground">Hint</p>
</div>
```

### 8.10 Navigation

| Element | Class |
|---------|-------|
| Bottom bar | `.nav-bar` |
| Tab | `.nav-tab` / `.nav-tab-active` |
| Page back | `.btn-icon` + ChevronLeft in `PageHeader` |
| Text back | `.link-back` |

---

## 9. Page templates

### Standard page

```
.page-shell
  PageHeader | .page-header + .section-label + .page-title + .page-subtitle
  [QuickStat row]
  [chip-row filters]
  content (card-soft | list-row stacks | forms)
```

### Auth (exception)

Centered `max-w-sm` on `.app-surface`, hero logo + `.card-soft` form card.

### 404 (exception)

`.app-surface` + `.page-shell` centered content — no raw `bg-muted`.

---

## 10. Motion & interaction

- Transitions: `transition-colors`, `transition-opacity`, `transition-all` on hover states
- Dialog: fade + zoom (shadcn animate)
- Disabled: `opacity-50` or `opacity-40`
- Touch: `touch-action: manipulation` on body
- Focus: `focus:ring-2 focus:ring-primary/30` on inputs

---

## 11. Accessibility

- Minimum tap target: ~36px height for buttons (`.btn-icon` = 36px, `.btn-primary` py-2.5)
- Form inputs: `text-sm` value + fixed 11px placeholders (no platform-specific font-size overrides)
- Icon-only buttons: `aria-label` required
- Dialog close: sr-only "Close" text
- Color is not the only status indicator — StatusBadge includes icons

---

## 12. Dark mode

Dark tokens exist in `index.css` (`.dark`) but **dark mode is not enabled** in the prototype. Do not add dark-specific UI until ThemeProvider is wired.

---

## 13. shadcn/ui policy

| Keep & use | Avoid in pages |
|------------|----------------|
| Dialog, Button, Checkbox | Card, Input, Label, Badge, Select (use CSS utilities instead) |

When extending shadcn components, match app tokens: `rounded-xl`, `font-semibold`, `primary` brand color.

---

## 14. File reference

| File | Purpose |
|------|---------|
| `src/index.css` | Tokens + component utilities |
| `tailwind.config.ts` | Tailwind color/radius/font mapping |
| `src/lib/statusStyles.ts` | Shared status pill classes |
| `src/components/layout/PageHeader.tsx` | Standard page header |
| `src/components/layout/ActionTile.tsx` | Primary navigation tiles |
| `src/components/layout/QuickStat.tsx` | Dashboard stats |
| `src/components/StatusBadge.tsx` | Fixture maintenance status |

---

## 15. Checklist for new UI

- [ ] Uses `.page-shell` for page layout
- [ ] Uses design tokens — no hardcoded hex colors
- [ ] List titles are `font-semibold`
- [ ] Buttons use `.btn-*` or shadcn Button — not ad-hoc `bg-accent`
- [ ] Inputs use `.field-input` / `.search-input`
- [ ] Cards use `.card-soft` or `.card-section`
- [ ] Dialogs use `.dialog-shell*` classes
- [ ] No horizontal scroll in modals
- [ ] Icons follow size scale (12 / 14 / 16 / 20 / 32)
- [ ] Status colors use `status-*` tokens
- [ ] Safe-area-aware dialog width on mobile
