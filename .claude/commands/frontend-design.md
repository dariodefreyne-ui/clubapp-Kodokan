# Frontend Design — Kodokan Clubapp

Apply this project's design system when building or reviewing UI. All styling uses JS inline styles with tokens from `src/styles/tokens.js` (no Tailwind, no CSS modules, no external component libraries).

## Design tokens (`src/styles/tokens.js`)

Always import from `../../styles/tokens` (adjust depth as needed):

```js
import { C, font, buttonStyle, badgeStyle, cardStyle, inputStyle,
         tabBarStyle, tabButtonStyle, chipStyle } from '../../styles/tokens';
```

### Color palette

| Token | Value | Use |
|---|---|---|
| `C.bg` | `#06101A` | Page background |
| `C.surface` | `#0D1B2A` | Sidebar, headers, table header |
| `C.card` | `#1B2A3D` | Cards, modals, panels |
| `C.cardHover` | `#243549` | Card hover state |
| `C.border` | `#2A3F5A` | Strong borders |
| `C.borderSoft` | `#1F3046` | Subtle borders, dividers |
| `C.red` | `#E63346` | Primary action, accent |
| `C.redHover` | `#C41F31` | Hover state for red |
| `C.redDim` | `rgba(230,51,70,0.16)` | Red background tint |
| `C.text` / `C.textPrimary` | `#F8FAFC` | Body text |
| `C.textSec` | `#94A3B8` | Secondary/label text |
| `C.textMuted` | `#64748B` | Placeholder, empty state |
| `C.green` | `#22C55E` | Success |
| `C.greenDim` | `rgba(34,197,94,0.18)` | Success tint |
| `C.blue` | `#38BDF8` | Info, accent |
| `C.blueDim` | `rgba(56,189,248,0.16)` | Info tint |
| `C.orange` | `#FB923C` | Warning |
| `C.orangeDim` | `rgba(251,146,60,0.16)` | Warning tint |
| `C.purple` | `#A78BFA` | Special/highlight |
| `C.purpleDim` | `rgba(167,139,250,0.18)` | Special tint |

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

All buttons: `minHeight: 44px`, `borderRadius: 8px`, `fontSize: 13px`, `fontWeight: 700`.

### Badges — `badgeStyle(color)`

```jsx
<span style={badgeStyle('green')}>Actief</span>
<span style={badgeStyle('red')}>Inactief</span>
<span style={badgeStyle('blue')}>Info</span>
<span style={badgeStyle('orange')}>Waarschuwing</span>
```

Shape: pill (`borderRadius: 999px`), `fontSize: 12px`, `fontWeight: 700`.

### Cards — `cardStyle({ padded?, gradient? })`

```jsx
<div style={cardStyle()}>Standaard kaart</div>
<div style={cardStyle({ gradient: true })}>Uitgelichte kaart</div>
<div style={cardStyle({ padded: false })}>Kaart zonder padding</div>
```

Default: `background: C.card`, `border: 1px solid C.borderSoft`, `borderRadius: 16px`, `padding: 16px`.

### Form fields — `<FormField>`

Use `src/components/ui/FormField.jsx` for all form inputs. Never create custom inputs for types it handles.

```jsx
import FormField from '../ui/FormField';

<FormField label="Naam" type="text" value={naam} onChange={setNaam} required />
<FormField label="Geboortedatum" type="date" value={datum} onChange={setDatum} />
<FormField label="Rol" type="select" value={rol} onChange={setRol}
  opties={[{ value: 'lid', label: 'Lid' }, { value: 'trainer', label: 'Trainer' }]} />
<FormField label="Actief" type="checkbox" value={actief} onChange={setActief} />
<FormField label="Notities" type="textarea" value={notities} onChange={setNotities} rijen={4} />
<FormField label="Kleur" type="color" value={kleur} onChange={setKleur} />
<FormField label="Bedrag" type="number" value={bedrag} onChange={setBedrag} min={0} />
```

Prop `fout` shows a red error message below the field. Prop `hint` shows muted help text.

### Tables — `<DataTable>`

Use `src/components/ui/DataTable.jsx` for listing data. Avoid custom table implementations.

```jsx
import DataTable from '../ui/DataTable';

const kolommen = [
  { key: 'naam', label: 'Naam', sorteerbaar: true },
  { key: 'email', label: 'E-mail', sorteerbaar: true, breedte: '200px' },
  { key: 'actief', label: 'Status', render: (r) => <span style={badgeStyle(r.actief ? 'green' : 'red')}>{r.actief ? 'Actief' : 'Inactief'}</span> },
];

<DataTable
  kolommen={kolommen}
  rijen={leden}
  zoekVeld="naam,email"
  standaardSort="naam"
  acties={(rij) => <button style={buttonStyle('subtle')} onClick={() => bewerk(rij)}>Bewerk</button>}
  leegTekst="Geen leden gevonden"
/>
```

### Tabs — `tabBarStyle` + `tabButtonStyle(active)`

```jsx
const tabs = ['Overzicht', 'Instellingen', 'Historiek'];
const [tab, setTab] = useState(tabs[0]);

<div style={tabBarStyle}>
  {tabs.map(t => (
    <button key={t} style={tabButtonStyle(tab === t)} onClick={() => setTab(t)}>{t}</button>
  ))}
</div>
```

Active tab: underline `2px solid C.red`, `fontWeight: 800`. Inactive: `C.textMuted`, `fontWeight: 500`.

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

```jsx
import { useToast } from '../ui/Toast';

const { showToast } = useToast();
showToast('Opgeslagen!', 'success');   // 'success' | 'error' | 'info'
```

Never use `alert()` or inline success banners. Always use `showToast`.

## Layout conventions

- **Page wrapper**: `{ padding: '16px', maxWidth: '960px' }` for content pages.
- **Page title**: `{ fontSize: '24px', fontWeight: '800', color: C.textPrimary, marginBottom: '20px' }`.
- **Section heading**: `{ fontSize: '16px', fontWeight: '700', color: C.textPrimary, marginBottom: '12px' }`.
- **Label / helper text**: `{ fontSize: '12px', color: C.textSec, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px' }`.
- **Empty state**: centered, `color: C.textMuted`, `fontSize: '13px'`, optionally a large icon above.
- **Grid for cards**: `{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))', gap: '12px' }`.
- **Action row** (buttons at bottom of form): `{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }`.

## Mobile

- Minimum tap target: `44px` height/width (enforced by `buttonStyle`).
- Use `useIsMobile()` from `src/hooks/useIsMobile.js` for responsive logic.
- Prefer `flex-wrap: wrap` and fluid widths over fixed pixel widths in grids.
- Horizontal scroll tabs: `tabBarStyle` already sets `overflowX: auto`.

## Do / Don't

| Do | Don't |
|---|---|
| Import from `src/styles/tokens` | Hardcode hex colors in components |
| Use `FormField` for all inputs | Build custom `<input>` wrappers |
| Use `DataTable` for lists | Write ad-hoc `<table>` markup |
| `showToast` for feedback | Inline `alert()` or success `<div>` banners |
| `cardStyle()` for surfaces | Hardcode `background: #1B2A3D` |
| `buttonStyle(variant)` | Hardcode button colors |
| `badgeStyle(color)` | Inline pill styles |
| `C.textSec` for labels | `color: '#94A3B8'` directly |

## CSS custom properties (theme.css)

`src/styles/theme.css` declares CSS variables like `--bg-primary`, `--text-primary`, `--text-secondary`. These mirror the JS tokens and are available in any CSS context (e.g. `var(--text-secondary)`). Use JS tokens in inline styles, CSS vars in any `.css` files.
