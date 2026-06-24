# Product

## Register

product

## Users

Club staff and members of a judo club ("Kodokan"): board members, group trainers/lesgevers, and parents/members managing memberships, training, exams, competitions, and finances. Used on phone and tablet (installable PWA) at the dojo (trainer attendance scanning) and at home (members/parents managing profiles, registrations, payments). Primary context is task-driven, often time-pressured (e.g. scanning attendance before a class starts, checking in at a tournament).

## Product Purpose

A full club-management webapp covering members, training schedules, technique curriculum, competitions, exams, events/calendar, shop/inventory, finance (payouts, debts), bulk communication, documents, reporting, and board/admin tooling. Success looks like: staff complete administrative tasks (registration, attendance, payment tracking) in as few taps as possible, and the app stays legible and fast on a phone in a gym with one hand free.

## Brand Personality

Sport-disciplined, trustworthy, no-nonsense. The tone mirrors dojo culture: structured, respectful, no clutter, no decoration for its own sake. Confidence comes from clarity and consistency (the same tile-grid, tab, and detail patterns repeating everywhere — see STIJLGIDS.md), not from flourish.

## Anti-references

Generic SaaS dashboard clichés: gradient hero cards, glassmorphism, decorative empty templates, stock-photo dashboards, hero-metric-with-gradient-accent widgets. The app should look like a purpose-built tool for a judo club, not a generic admin-panel template.

## Design Principles

- **Consistency over novelty.** One tile-grid pattern, one detail-page pattern, one modal pattern, reused everywhere (per STIJLGIDS.md) — predictability beats per-page creativity.
- **Thumb-first, one-handed.** Primary actions reachable and tappable (44px touch targets) on a phone at the dojo, not just on desktop.
- **Status through color is informative, not decorative.** Belt/training/payment status colors (red, green, blue, orange, purple) carry meaning; never use a status color where there is no status.
- **No filler.** Lists, KPIs, and forms show only data the user came for; no marketing copy, no upsell, no empty visual flourish.
- **Respect the hierarchy.** Visual weight follows the kyu/dan and role hierarchy (board > trainer > member) the club itself runs on.

## Accessibility & Inclusion

WCAG AA baseline: ≥4.5:1 body text contrast, ≥3:1 large text, 44px minimum touch targets (already enforced via `--touch-target`), visible focus rings (already present via `:focus-visible`), and a `prefers-reduced-motion` fallback (already present in theme.css). Status badges/chips pair color with text/icon, not color alone.
