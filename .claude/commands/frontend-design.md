# Frontend Design — Kodokan Clubapp

Apply this project's design system when building or reviewing UI. All styling uses JS inline styles with tokens from `src/styles/tokens.js` (no Tailwind, no CSS modules, no external component libraries).

## Design tokens (`src/styles/tokens.js`)

Always import from `../../styles/tokens` (adjust depth as needed):

```js
import { C, font, buttonStyle, badgeStyle, cardStyle, inputStyle,
         tabBarStyle, tabButtonStyle, chipStyle } from '../../styles/tokens';
```

### Color palette

Exact values live in `src/styles/tokens.js`. Use the token names — never hardcode hex in components.

| Token | Use |
|---|---|
| `C.bg` | Page background |
| `C.surface` | Sidebar, headers, table header |
| `C.card` | Cards, modals, panels |
| `C.cardHover` | Card hover state |
| `C.border` | Strong borders |
| `C.borderSoft` | Subtle borders, dividers |
| `C.red` / `C.redHover` / `C.redDim` | Primary action, accent, tint |
| `C.text` / `C.textPrimary` | Body text |
| `C.textSec` | Secondary/label text |
| `C.textMuted` | Placeholder, empty state |
| `C.green` / `C.greenDim` | Success |
| `C.blue` / `C.blueDim` | Info, accent |
| `C.orange` / `C.orangeDim` | Warning |
| `C.purple` / `C.purpleDim` | Special/highlight |

Font: `font = "'Plus Jakarta Sans', system-ui, sans-serif"`

## Component patterns

### Buttons — `buttonStyle(variant)`

```jsx
<button style={buttonStyle('primary')}>Opslaan</button>   // red fill
<button style={buttonStyle('danger')}>Verwijderen</button> // red outline
<button style={buttonStyle('success')}>Bevestig</button>   // green fill
<button style={buttonStyle('accent')}>Info actie</button>  // blue outline
<button style={buttonStyle('subtle')}>Annuleer</button>    // muted
```

### Badges — `badgeStyle(color)`

```jsx
<span style={badgeStyle('green')}>Actief</span>
<span style={badgeStyle('red')}>Inactief</span>
<span style={badgeStyle('blue')}>Info</span>
<span style={badgeStyle('orange')}>Waarschuwing</span>
```

### Cards — `cardStyle({ padded?, gradient? })`

```jsx
<div style={cardStyle()}>Standaard kaart</div>
<div style={cardStyle({ gradient: true })}>Uitgelichte kaart</div>
<div style={cardStyle({ padded: false })}>Kaart zonder padding</div>
```

### Form fields — `<FormField>`

Use `src/components/ui/FormField.jsx` for all form inputs. Never create custom inputs for types it handles (`text`, `email`, `number`, `date`, `select`, `textarea`, `checkbox`, `color`).

```jsx
import FormField from '../ui/FormField';

<FormField label="Naam" type="text" value={naam} onChange={setNaam} required />
<FormField label="Rol" type="select" value={rol} onChange={setRol}
  opties={[{ value: 'lid', label: 'Lid' }, { value: 'trainer', label: 'Trainer' }]} />
<FormField label="Notities" type="textarea" value={notities} onChange={setNotities} rijen={4} />
<FormField label="Actief" type="checkbox" value={actief} onChange={setActief} />
// fout="..." shows red error; hint="..." shows muted help text
```

### Tables — `<DataTable>`

Use `src/components/ui/DataTable.jsx` for listing data. Avoid custom table implementations.

```jsx
import DataTable from '../ui/DataTable';

<DataTable
  kolommen={[
    { key: 'naam', label: 'Naam', sorteerbaar: true },
    { key: 'actief', label: 'Status', render: (r) => <span style={badgeStyle(r.actief ? 'green' : 'red')}>{r.actief ? 'Actief' : 'Inactief'}</span> },
  ]}
  rijen={leden}
  zoekVeld="naam,email"
  standaardSort="naam"
  acties={(rij) => <button style={buttonStyle('subtle')} onClick={() => bewerk(rij)}>Bewerk</button>}
  leegTekst="Geen leden gevonden"
/>
```

### Tabs — `tabBarStyle` + `tabButtonStyle(active)`

```jsx
<div style={tabBarStyle}>
  {tabs.map(t => (
    <button key={t} style={tabButtonStyle(tab === t)} onClick={() => setTab(t)}>{t}</button>
  ))}
</div>
```

### Chips (filter pills) — `chipStyle(active, accent?)`

```jsx
{opties.map(o => (
  <button key={o} style={chipStyle(filter === o)} onClick={() => setFilter(o)}>{o}</button>
))}
```

### Inputs (raw) — `inputStyle`

```jsx
<input style={inputStyle} value={zoek} onChange={e => setZoek(e.target.value)} placeholder="Zoeken..." />
```

### Toast notifications — `useToast()`

Never use `alert()` or inline success banners. Always use `showToast`.

```jsx
import { useToast } from '../ui/Toast';
const { showToast } = useToast();
showToast('Opgeslagen!', 'success');   // 'success' | 'error' | 'info'
```

## Layout conventions

```js
// Page wrapper
{ padding: '16px', maxWidth: '960px' }

// Typography
{ fontSize: '24px', fontWeight: '800', color: C.textPrimary, marginBottom: '20px' }  // page title
{ fontSize: '16px', fontWeight: '700', color: C.textPrimary, marginBottom: '12px' }  // section heading
{ fontSize: '12px', color: C.textSec, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px' }  // label

// Structural
{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))', gap: '12px' }  // card grid
{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }  // action row
```

Empty state: centered, `color: C.textMuted`, `fontSize: '13px'`, optionally a large icon above.

## Mobile

- Minimum tap target: `44px` height/width (enforced by `buttonStyle`).
- Use `useIsMobile()` from `src/hooks/useIsMobile.js` for responsive logic.
- Prefer `flex-wrap: wrap` and fluid widths over fixed pixel widths in grids.
- Horizontal scroll tabs: `tabBarStyle` already sets `overflowX: auto`.

## Do / Don't

| Do | Don't |
|---|---|
| `C.*` tokens for all colors | Hardcode hex values in components |
| `buttonStyle(variant)` | Hardcode button colors |
| `badgeStyle(color)` | Inline pill styles |
| `cardStyle()` for surfaces | Hardcode card backgrounds |
| `FormField` for all inputs | Custom `<input>` wrappers |
| `DataTable` for lists | Ad-hoc `<table>` markup |
| `showToast` for feedback | `alert()` or inline banners |

## CSS custom properties (theme.css)

`src/styles/theme.css` declares CSS variables like `--bg-primary`, `--text-primary`, `--text-secondary` that mirror the JS tokens. Use JS tokens in inline styles; CSS vars in any `.css` files.
