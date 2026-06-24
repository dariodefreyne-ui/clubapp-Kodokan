---
name: Kodokan Clubapp
description: Dark, disciplined club-management PWA for a judo club
colors:
  bg-primary-navy: "#06101A"
  bg-secondary-navy: "#0D1B2A"
  bg-card-navy: "#1B2A3D"
  bg-card-hover-navy: "#243549"
  accent-red: "#E63346"
  accent-red-hover: "#C41F31"
  bg-primary-kodokan: "#100D07"
  bg-secondary-kodokan: "#1A1409"
  bg-card-kodokan: "#241C0D"
  bg-card-hover-kodokan: "#2E2412"
  accent-gold: "#C9A227"
  accent-gold-hover: "#A68918"
  bg-primary-light: "#F8FAFC"
  bg-secondary-light: "#FFFFFF"
  bg-card-light: "#F1F5F9"
  accent-crimson: "#DC2626"
  accent-crimson-hover: "#B91C1C"
  text-primary-navy: "#F8FAFC"
  text-primary-light: "#0F172A"
  text-secondary-navy: "#94A3B8"
  text-secondary-light: "#475569"
  text-muted-navy: "#64748B"
  border-navy: "#2A3F5A"
  border-soft-navy: "#1F3046"
  status-green: "#22C55E"
  status-blue: "#38BDF8"
  status-orange: "#FB923C"
  status-purple: "#A78BFA"
typography:
  display:
    fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.25
  headline:
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.5px"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  8: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent-red}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.accent-red-hover}"
  button-secondary:
    backgroundColor: "{colors.bg-secondary-navy}"
    textColor: "{colors.text-primary-navy}"
    rounded: "{rounded.md}"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary-navy}"
    rounded: "{rounded.md}"
  card:
    backgroundColor: "{colors.bg-card-navy}"
    rounded: "{rounded.lg}"
    padding: "16px"
  badge:
    rounded: "{rounded.full}"
    padding: "6px 10px"
    typography: "{typography.label}"
---

# Design System: Kodokan Clubapp

## 1. Overview

**Creative North Star: "The Tatami at Night"**

The app reads like the clubroom after the lights are mostly down and one lamp is left on over the registration desk: a near-black navy field, a single disciplined red accent, and nothing else competing for attention. This is a tool a trainer reaches for one-handed between rounds, not a brand experience — every screen rejects decoration in favor of the same handful of repeating structural patterns (tile-grid, detail page, bottom-sheet, tabs) so that once a user has learned one page, they have learned all of them. The system explicitly rejects generic SaaS dashboard clichés: no gradient hero cards, no glassmorphism, no stock-photo dashboard widgets, no decorative empty-state illustrations beyond a single centered emoji and two lines of text.

Two supported alternate themes exist behind a user-facing theme switcher (`src/utils/themaUtils.js`), each swapping the same CSS custom properties: "Kodokan" (dark warm, gold accent inspired by the club logo) and "Licht" (a bright, inverted light theme). All three themes share one component vocabulary; only the token values change. Status colors (green/blue/orange/purple) are hardcoded and identical across all three themes, since they carry data meaning, not brand identity.

**Key Characteristics:**
- Dark-mobile-first by default; light is an explicit opt-in, not a `prefers-color-scheme` default.
- One accent color per theme, used sparingly (primary actions, active tab underline, focus rings, KPI top-borders).
- Flat, bordered surfaces — no shadows beyond a faint ambient drop on cards and modals.
- Status/data colors (green, blue, orange, purple) never change between themes.

## 2. Colors

Three selectable themes, swapped via `[data-theme]` on `<html>`, sharing one semantic token set (`--bg-primary`, `--bg-card`, `--accent-red`, `--text-primary`, `--border-color`, etc., defined in `src/styles/theme.css`).

### Primary

- **Blue Navy — Disciplined Red** (default theme): accent `#E63346` (hover `#C41F31`) on a near-black navy field `#06101A`. Used for primary buttons, active tab underline, focus rings, link-style "back" affordances, and the borderTop accent on selected admin category tiles.
- **Kodokan — Dojo Gold**: accent `#C9A227` (hover `#A68918`) on a near-black warm brown-black `#100D07`. Inspired directly by the club logo; same role assignments as navy, different hue.
- **Licht — Bright Crimson**: accent `#DC2626` (hover `#B91C1C`) on near-white `#F8FAFC`. Same role assignments, inverted lightness.

### Neutral

- **Navy theme**: surfaces `#0D1B2A` (secondary) → `#1B2A3D` (card) → `#243549` (card hover); border `#2A3F5A` (border) / `#1F3046` (soft border); text `#F8FAFC` (primary) → `#94A3B8` (secondary) → `#64748B` (muted).
- **Kodokan theme**: surfaces `#1A1409` → `#241C0D` → `#2E2412`; border `#3E2E14` / `#2C2010`; text `#FDF6E3` → `#BDA882` → `#7D6A4A`.
- **Licht theme**: surfaces `#FFFFFF` → `#F1F5F9` → `#E8EDF3`; border `#CBD5E1` / `#E2E8F0`; text `#0F172A` → `#475569` → `#94A3B8`.

### Status (theme-invariant)

- **Green** (`#22C55E`, dim `rgba(34,197,94,0.18)`): active / paid / success.
- **Blue** (`#38BDF8`, dim `rgba(56,189,248,0.16)`): informational / neutral status.
- **Orange** (`#FB923C`, dim `rgba(251,146,60,0.16)`): warning / pending.
- **Purple** (`#A78BFA`, dim `rgba(167,139,250,0.18)`): a fourth distinct category role (e.g. inactive-but-not-deleted, special status).

### Named Rules

**The One Accent Rule.** Each theme has exactly one brand accent color. It is never duplicated by a second "secondary brand color" — variety comes from the four fixed status colors, which exist for data meaning, not decoration.

**The Theme-Invariant Status Rule.** Green/blue/orange/purple never change value across themes. A status badge must mean the same thing and look the same whether the club is on Navy, Kodokan, or Licht.

## 3. Typography

**Body Font:** Plus Jakarta Sans (self-hosted, with `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` fallback)

**Character:** One typeface for everything — display, body, and labels — distinguished only by weight and size. No serif, no mono, no second family. The pairing reads as efficient and administrative, not editorial.

### Hierarchy

- **Display** (700, 28px / `--font-size-2xl`, line-height 1.25): page `<h1>` titles only (e.g. "Ledenbeheer").
- **Headline** (700, 22px, line-height 1.25): section/detail-page `<h1>` (e.g. member name on a detail page).
- **Title** (700, 18px, line-height 1.25): card section titles, modal titles.
- **Body** (400, 14px, line-height 1.5): all running text, field values, table cells. No explicit max-width cap; forms are capped at ~960px container width instead.
- **Label** (700, 11px, letter-spacing 0.5px, uppercase): table headers, form labels, KPI labels, section-title eyebrows inside cards.

### Named Rules

**The Single-Family Rule.** Every weight and size on screen comes from Plus Jakarta Sans. Introducing a second family for "emphasis" is prohibited — emphasis is weight (400 → 700 → 800) and size, never typeface.

## 4. Elevation

The system is flat by default and bordered, not shadowed. Every card, tile, table, and panel gets a 1px `border-color` outline and a flat fill; shadows are reserved for two cases only: the ambient ramp on cards/modals (`--shadow-sm/md/lg`, all low-opacity black) and the optional `gradient: true` variant of `cardStyle()`, which adds a soft `0 12px 32px rgba(0,0,0,0.18)` lift for a small number of feature cards. Depth communicates state (open modal, hovering a tile) rather than decorating static content.

### Shadow Vocabulary

- **shadow-sm** (`0 1px 3px rgba(0,0,0,0.4)`): default card shadow, barely visible — a hint of separation from the background.
- **shadow-md** (`0 4px 12px rgba(0,0,0,0.5)`): default state for stat cards and raised elements.
- **shadow-lg** (`0 8px 24px rgba(0,0,0,0.6)`): modals only.
- **Gradient card lift** (`0 12px 32px rgba(0,0,0,0.18)`, paired with a `linear-gradient(135deg, var(--surface) 0%, var(--bg-card) 100%)` fill): opt-in via `cardStyle({ gradient: true })` for a small number of feature/hero cards. Not the default card treatment.

### Named Rules

**The Border-Before-Shadow Rule.** Reach for a 1px border first. A shadow is added only when a surface needs to read as "floating above" another (modal, hover-lift on a clickable tile), never as ambient texture on static content.

## 5. Components

### Buttons

- **Shape:** `border-radius: 8px` (`--radius-md`), `44px` minimum height (`--touch-target`).
- **Primary:** solid accent background, white text, no border. Used once per view for the single primary action (top-right of the action bar).
- **Secondary:** `bg-secondary` fill, `border-color` border, primary text color — used for the next-most-important action.
- **Subtle:** `surface` fill, `border-soft` border, secondary text color — default/low-emphasis actions (e.g. "Exporteer").
- **Danger:** dim accent-tinted background (`rgba(230,51,70,0.16)`-equivalent for the active theme) with accent-colored border and text — used for destructive actions, never solid red until confirmed.
- **Ghost:** transparent, secondary text, no border — back/cancel-level actions.
- **Hover / Focus:** primary darkens to its `-hover` token; all interactive elements get a `2px solid var(--accent-red)` focus-visible outline with 2px offset, plus a `0 0 0 3px` accent-tinted glow on focused inputs.

### Tiles (the central pattern)

- **Shape:** `border-radius: 12–16px` (`--radius-lg`), `1px solid var(--border-color)`.
- **Layout:** `auto-fill` grid, `minmax(140px,1fr)` for KPIs/shortcuts, `minmax(300px,1fr)` for standard list items (members, events), `minmax(360px,1fr)` for large blocks (training sessions).
- **Hover / Focus:** border shifts to the active accent color; `translateY(-1px)` lift; no shadow added on hover, the border-color shift and lift carry the affordance.
- **Anatomy:** header row (name + status badge) → optional subline → divider → meta row of tags/badges/chips.

### Badges, Chips, Tags

- **Badge:** pill (`border-radius: 999px`), accent-tinted dim background + full-color text + matching border. Static label only (status, role, belt). Never clickable.
- **Chip:** identical pill shape, but interactive — inactive state uses `bg-primary` fill with soft border; active state switches to the accent-tinted "dim" pair plus a soft accent-colored glow shadow. Used for filters.
- **Tag:** smaller, `6–8px` radius (not fully pill-shaped), `bg-primary` fill, secondary text, soft border. Used for group/category labels inside a tile's meta row. Never clickable.

### Cards / Containers

- **Corner Style:** 12–16px (`--radius-lg`).
- **Background:** `bg-card`, optionally the 135° gradient variant for feature cards.
- **Shadow Strategy:** see Elevation — `shadow-sm` at rest, gradient cards get the heavier ambient lift.
- **Border:** always 1px `border-soft` or `border-color`.
- **Internal Padding:** 16px standard, 20px for detail-page section cards.

### Inputs / Fields

- **Style:** `bg-primary` fill (sits a shade darker/lighter than the surrounding card), 1px `border-soft`, `8px` radius, 9–12px padding, 13px text.
- **Focus:** border switches to the accent color plus a `0 0 0 3px` accent-tinted glow ring — no layout shift.
- **Mobile:** font-size forced to 16px under 768px width to prevent iOS auto-zoom on focus, overriding the inline 13–14px default.

### Navigation

- **Sidebar:** fixed 260px on desktop, logo + club name + grouped nav links + logout pinned at the bottom; collapses to a hamburger-triggered full-width overlay on mobile.
- **Tabs:** underline style — 2px transparent border-bottom by default, switches to 2px accent on the active tab; active label goes to full text-primary + bold (700/800), inactive stays muted/secondary and lighter weight.
- **Admin sub-navigation:** two-layer pattern — a flex-wrapped row of top-level category tiles (each gets its own `borderTop: 3px solid <accent>` when active) above a row of sub-tabs for that category.

### Detail Modal (signature component)

`src/components/details/DetailModal.jsx` — the one bottom-sheet primitive used everywhere a "quick view without leaving the list" is needed. Slides up from the bottom (`alignItems: flex-end`), `16px 16px 0 0` radius, max-height 85vh with internal scroll, optional 3px accent-colored top border matching the entity's category color, closes via ×, backdrop click, or Escape.

## 6. Do's and Don'ts

### Do:
- **Do** keep one primary action per screen, placed top-right of the action bar, styled with the solid accent button.
- **Do** pair every status badge/chip with text, not color alone (colorblind-safe by construction, not as an afterthought).
- **Do** reuse the tile-grid → detail/bottom-sheet/accordion three-pattern (STIJLGIDS.md §4) instead of inventing a new navigation shape per feature.
- **Do** keep all three themes (Navy, Kodokan, Licht) working from the same semantic token names — never hardcode a hex value where a `var(--token)` exists.
- **Do** use `showToast()` for action feedback; never `alert()` or an inline success banner.

### Don't:
- **Don't** introduce gradient hero cards, glassmorphism, or stock-dashboard hero-metric widgets — generic SaaS dashboard clichés are an explicit anti-reference.
- **Don't** add a second brand accent color "for variety." One accent per theme; reach for the four fixed status colors instead.
- **Don't** use a `border-left`/`border-right` colored stripe as a card accent; the system's accent-border convention is `border-top`, used specifically on KPI tiles and active admin-category tiles, never on list rows.
- **Don't** introduce a second typeface. Plus Jakarta Sans only, distinguished by weight/size.
- **Don't** let status colors shift between themes — green/blue/orange/purple are fixed regardless of Navy/Kodokan/Licht.
- **Don't** style success/error feedback as a permanent inline banner; that's reserved for contextual, persistent page info (see `alert`/banner blocks), not transient action feedback.
