# Stijlgids — Clubapp structuur & patronen

Kleuren worden bewust weggelaten. Gebruik voor alle kleuren de tokens uit `src/styles/tokens.js`.

---

## Inhoudsopgave

1. [Globale lay-out](#1-globale-lay-out)
2. [Paginastructuur — de standaard volgorde](#2-paginastructuur--de-standaard-volgorde)
3. [Tegel-grid](#3-tegel-grid-het-centrale-patroon)
4. [Doorklikpatronen — drie smaken](#4-doorklikpatronen--drie-smaken)
5. [Detailpagina na doorklik](#5-detailpagina-na-doorklik-smaak-a)
6. [Beheer-pagina met geneste navigatie](#6-beheer-pagina-met-geneste-navigatie-twee-lagen)
7. [KPI-strip](#7-kpi-strip)
8. [Tags, badges en chips](#8-tags-badges-en-chips)
9. [Lege staat](#9-lege-staat)
10. [Laadindicator](#10-laadindicator)
11. [Bottom-sheet modal](#11-bottom-sheet-modal-detailmodal)
12. [Bannering / inline info-blok](#12-bannering--inline-info-blok)
13. [Samenvatting — structuurpatronen op één blad](#13-samenvatting--structuurpatronen-op-één-blad)

---

## 1. Globale lay-out

De app heeft een **vaste sidebar links** (260 px breed op desktop) en een **scrollbaar content-gebied** rechts. Op mobiel schuift de sidebar in als een overlay via een hamburger-knop; de content-pagina neemt dan de volledige breedte.

```
┌──────────────┬──────────────────────────────────────┐
│  Sidebar     │  Content-pagina                       │
│  260px       │  flex: 1, overflowY: auto             │
│              │  padding: 16px                        │
│  logo        │  maxWidth: (geen max, maar 960px      │
│  clubnaam    │  is de gangbare maat voor formulieren)│
│  nav-groepen │                                       │
│  ──────────  │                                       │
│  logout      │                                       │
└──────────────┴──────────────────────────────────────┘
```

Elke content-pagina start met:

```jsx
<div style={{
  minHeight: '100vh',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  padding: '16px',
  paddingBottom: '40px',
}}>
```

---

## 2. Paginastructuur — de standaard volgorde

Elke pagina volgt consequent dit patroon van boven naar beneden:

```
1. Pagina-header          (titel + ondertitel)
2. Top action bar         (zoekbalk + filters + actieknoppen)
3. Stats/chips bar        (optioneel telstrookje)
4. Tabbladen              (indien meerdere weergaves)
5. Inhoud                 (grid met tegels, tabel of lege staat)
```

**Pagina-header:**

```jsx
<div style={{ marginBottom: '20px' }}>
  <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 4px 0' }}>
    Ledenbeheer
  </h1>
  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
    Overzicht en beheer van alle clubleden
  </p>
</div>
```

**Top action bar** — zoek + filters + knoppen in één `flex`-rij:

```jsx
<div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
  <input
    style={{ flex: '1 1 200px', minWidth: 0 }}
    placeholder="Zoeken..."
  />
  <select style={{ flex: '0 1 140px' }}>...</select>
  <button style={buttonStyle('subtle')}>Exporteer</button>
  <button style={buttonStyle('primary')}>+ Nieuw item</button>   {/* primaire actie rechts */}
</div>
```

**Stats/chips bar** — kleine pill-achtige telletjes:

```jsx
<div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
  <span style={{
    padding: '6px 12px',
    background: 'var(--bg-card)',
    borderRadius: '20px',
    fontSize: '13px',
    color: 'var(--text-secondary)',
  }}>
    Totaal: <strong style={{ color: 'var(--accent-red)' }}>47</strong>
  </span>
</div>
```

---

## 3. Tegel-grid (het centrale patroon)

De meest gebruikte layout voor overzichtspagina's is een `auto-fill` grid van klikbare tegels:

```jsx
<div style={{
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
  gap: '12px',
}}>
  {items.map(item => <ItemTegel key={item.id} item={item} />)}
</div>
```

| Tegeltype | `minmax` |
|---|---|
| Snelkoppelingen, KPI's | `minmax(140px, 1fr)` |
| Leden, evenementen (standaard) | `minmax(300px, 1fr)` |
| Trainingsblokken, grote kaarten | `minmax(360px, 1fr)` |

**Anatomie van een klikbare tegel:**

```
┌─────────────────────────────────────┐  ← border: 1px solid var(--border-color)
│  Hoofd-info          Badge/status  │  ← cardTop: flex, space-between
│  Naam (16px 600)     [Actief]       │
│  Subregel (#123)                    │
│─────────────────────────────────────│
│  [Tag groep] [Tag gordel] [✓ Betaald]│  ← cardMeta: flex, flexWrap, gap 6px
└─────────────────────────────────────┘
```

```jsx
// Standaard tegel-stijl
const card = {
  background: 'var(--bg-card)',
  borderRadius: 'var(--radius-lg)',    // 12–16px
  padding: '16px',
  cursor: 'pointer',
  border: '1px solid var(--border-color)',
  transition: 'border-color 0.2s, transform 0.1s',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

// Hover-effect: inline onMouse*, geen CSS class
onMouseOver={e => {
  e.currentTarget.style.borderColor = 'var(--accent-red)';
  e.currentTarget.style.transform = 'translateY(-1px)';
}}
onMouseOut={e => {
  e.currentTarget.style.borderColor = 'var(--border-color)';
  e.currentTarget.style.transform = 'translateY(0)';
}}
```

---

## 4. Doorklikpatronen — drie smaken

### Smaak A — Navigeer naar detailpagina

Gebruik dit wanneer een item veel velden heeft om te bekijken of bewerken.

```jsx
onClick={() => navigate(`/leden/${member.id}`)}
```

De detailpagina heeft bovenaan een **← terug**-knop die teruggaat naar de lijst.

### Smaak B — Bottom-sheet / slide-up panel

Gebruik dit wanneer je snel iets wil tonen zonder de huidige context (lijst) te verlaten.

```jsx
// State bijhouden
const [actiefDetail, setActiefDetail] = useState(null);

// Op de tegel
onClick={() => setActiefDetail({ type: 'training', id: item.id })}

// Buiten de grid, onderin de pagina
{actiefDetail?.type === 'training' && (
  <TrainingDetailPanel
    trainingId={actiefDetail.id}
    onClose={() => setActiefDetail(null)}
  />
)}
```

De `DetailModal` rendert als een panel dat van onderen omhoogschuift (`alignItems: 'flex-end'`). Maximale hoogte 85 vh, sluit via ×-knop, backdrop-klik of Escape.

### Smaak C — Uitklapaccordeon

Gebruik dit voor hiërarchische data op dezelfde pagina (bv. technieken per categorie).

```jsx
const [openId, setOpenId] = useState(null);

// Op de rij
onClick={() => setOpenId(id => id === item.id ? null : item.id)}

// Inhoud conditioneel tonen
{openId === item.id && <ItemDetail item={item} />}
```

**Beslisregel:**

| Situatie | Smaak |
|---|---|
| Veel velden, bewerken mogelijk | A — eigen pagina |
| Snel bekijken, context behouden | B — bottom-sheet |
| Hiërarchie op dezelfde pagina | C — accordeon |

---

## 5. Detailpagina na doorklik (smaak A)

```
1. Header: ← terug-knop  +  Naam als h1  +  Status-badge
2. Tabbladen (2–4 tabs): Profiel / Lidmaatschap / Activiteit / ...
3. Per tab: meerdere sectiekaarten
4. Binnen een kaart: fieldGrid met label + waarde per veld
5. Onderaan de actieve kaart: actionBar (Annuleer + Opslaan + eventueel Verwijder)
```

**Header:**

```jsx
<div style={{
  display: 'flex', alignItems: 'center', gap: '12px',
  marginBottom: '20px', flexWrap: 'wrap',
}}>
  <button
    onClick={() => navigate(-1)}
    style={{
      background: 'none', border: 'none',
      color: 'var(--text-secondary)',
      cursor: 'pointer', fontSize: '14px',
    }}
  >
    ← Terug
  </button>
  <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>{naam}</h1>
  <span style={badgeStyle(actief ? 'green' : 'red')}>
    {actief ? 'Actief' : 'Inactief'}
  </span>
</div>
```

**Tabbladen:**

```jsx
<div style={{
  display: 'flex', gap: '8px', marginBottom: '20px',
  borderBottom: '1px solid var(--border-color)',
  overflowX: 'auto',
}}>
  {tabs.map(t => (
    <button key={t} onClick={() => setTab(t)} style={{
      background: 'none', border: 'none',
      color: tab === t ? 'var(--accent-red)' : 'var(--text-secondary)',
      padding: '10px 16px', cursor: 'pointer', fontSize: '14px',
      fontWeight: tab === t ? '700' : '400',
      borderBottom: tab === t ? '2px solid var(--accent-red)' : '2px solid transparent',
      whiteSpace: 'nowrap',
    }}>
      {t}
    </button>
  ))}
</div>
```

**Sectiekaart binnen een tab:**

```jsx
<div style={{
  background: 'var(--bg-card)',
  borderRadius: 'var(--radius-lg)',
  padding: '20px',
  border: '1px solid var(--border-color)',
  marginBottom: '16px',
}}>
  {/* Sectietitel */}
  <div style={{
    fontSize: '12px', fontWeight: '600',
    color: 'var(--accent-red)',
    textTransform: 'uppercase', letterSpacing: '0.8px',
    marginBottom: '16px', paddingBottom: '8px',
    borderBottom: '1px solid var(--border-color)',
  }}>
    Contactgegevens
  </div>

  {/* Velden in een auto-fill grid */}
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' }}>
    {/* label + waarde of input */}
  </div>
</div>
```

**Label + veld-patroon (lees/bewerkwissel):**

```jsx
<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>
    E-mail
  </div>
  {bewerkModus
    ? <input style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} />
    : <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{email || '—'}</div>
  }
</div>
```

**Actie-balk onderaan:**

```jsx
<div style={{
  display: 'flex', gap: '12px', flexWrap: 'wrap',
  marginTop: '8px', justifyContent: 'flex-end',
}}>
  <button style={buttonStyle('subtle')} onClick={cancel}>Annuleer</button>
  <button style={buttonStyle('danger')} onClick={verwijder}>Verwijderen</button>
  <button style={buttonStyle('primary')} onClick={sla}>Opslaan</button>
</div>
```

---

## 6. Beheer-pagina met geneste navigatie (twee lagen)

Voor pagina's met veel sub-secties is het patroon: **tegelkiezer bovenaan → detailzone eronder**.

```
┌──────────────────────────────────────────────────────┐
│  [🏠 Club]  [👥 Gebruikers]  [🥋 Groepen]  [📋 Data] │  ← hoofdcategorie-tegels
│  geselecteerde tegel heeft accent-border bovenaan    │
└──────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────┐
│  (sub-tabs als de gekozen categorie subs heeft)       │
│  [🏛️ Clubinstellingen]  [📅 Seizoen]  ...            │
└──────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────┐
│  Inhoud van de gekozen sub-sectie                    │
└──────────────────────────────────────────────────────┘
```

De categorie-tegels staan in een `flex, flexWrap: 'wrap'`-rij, niet in een grid. Elke tegel:

- Vaste minimumbreedte (~120 px), groeit via `flex: '1 1 auto'`
- `borderTop: '3px solid [accentkleur]'` wanneer actief (elke sectie heeft eigen accentkleur)
- Icon groot (24–28 px), label klein (12 px), beschrijving muted (11 px)

---

## 7. KPI-strip

KPI-tegels staan in een `flex, flexWrap: 'wrap', gap: 12px`-rij. Elke tegel:

```
┌────────────────────┐
│▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔│  ← borderTop: 3px solid [accentkleur per KPI]
│ LEDEN              │  ← uppercase label, 11px, muted
│ 47                 │  ← groot getal, 26px, fontWeight 800
│ actief             │  ← sub-label, 11px, muted
└────────────────────┘
```

```jsx
function KpiTegel({ label, waarde, sub, kleur, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex: '1 1 0', minWidth: '140px',
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderTop: `3px solid ${kleur}`,
      borderRadius: 'var(--radius-md)',
      padding: '12px 16px',
      cursor: onClick ? 'pointer' : 'default',
      textAlign: 'left',
      fontFamily: 'inherit',
      color: 'inherit',
    }}>
      <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '26px', fontWeight: '800', lineHeight: '1.1' }}>
        {waarde}
      </div>
      {sub && (
        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
          {sub}
        </div>
      )}
    </button>
  );
}
```

Klikbare KPI's navigeren via `useNavigate()` naar de bijbehorende pagina.

---

## 8. Tags, badges en chips

### Badge — `badgeStyle(color)`

Pill-vorm, `border-radius: 999px`, gekleurde achtergrond (`Dim`) met volle kleur als tekst en rand. Gebruik voor **statische labels** (status, rol, gordel).

```jsx
<span style={badgeStyle('green')}>Actief</span>
<span style={badgeStyle('red')}>Inactief</span>
<span style={badgeStyle('blue')}>Info</span>
<span style={badgeStyle('orange')}>Waarschuwing</span>
```

### Chip — `chipStyle(active)`

Zelfde pill-vorm maar **klikbaar** als filter. Inactief = subtiel, actief = gekleurd met lichte glow-shadow.

```jsx
{filterOpties.map(o => (
  <button key={o} style={chipStyle(filter === o)} onClick={() => setFilter(o)}>{o}</button>
))}
```

### Tag (groep, categorie)

Kleiner dan een badge, rechthoekig met lichte border-radius (6–8 px). Achtergrond is `var(--bg-primary)`, tekst `var(--text-secondary)`. Niet klikbaar.

```jsx
<span style={{
  padding: '3px 8px',
  background: 'var(--bg-primary)',
  borderRadius: '6px',
  fontSize: '12px',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-color)',
}}>
  U13
</span>
```

**Beslisregel:**

| Wat | Component |
|---|---|
| Statisch label op een tegel | Badge |
| Klikbaar filter in een balk | Chip |
| Groep/categorie als klein label | Tag |

---

## 9. Lege staat

Altijd gecentreerd, met groot emoji-icoon:

```jsx
<div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
  <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
  <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
    Geen leden gevonden
  </div>
  <div style={{ fontSize: '14px' }}>
    Pas je zoekopdracht aan of voeg een nieuw lid toe.
  </div>
</div>
```

---

## 10. Laadindicator

Eén draaiende ring, gecentreerd in de inhoudszone:

```jsx
<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px' }}>
  <div style={{
    width: '36px', height: '36px',
    border: '3px solid var(--border-color)',
    borderTop: '3px solid var(--accent-red)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  }} />
</div>

{/* Eenmalig in de pagina-component */}
<style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
```

---

## 11. Bottom-sheet modal (DetailModal)

`src/components/details/DetailModal.jsx` — gebruik altijd deze wrapper voor pop-ups.

| Eigenschap | Waarde |
|---|---|
| Positie | `fixed, inset: 0`, content van onderen |
| Breedte | `100%, maxWidth: 600px` |
| Hoogte | `maxHeight: 85vh`, intern scrollbaar |
| Border-radius | `16px 16px 0 0` |
| Sluiten | ×-knop, backdrop-klik, Escape-toets |
| Optionele accentborder | `borderTop: 3px solid [accentKleur]` |

```jsx
<DetailModal
  open={open}
  onClose={() => setOpen(false)}
  title="Trainingsdetail"
  accentKleur={C.green}
>
  {/* inhoud */}
</DetailModal>
```

---

## 12. Bannering / inline info-blok

Voor **contextgebonden meldingen** op een pagina (niet voor feedback na een actie):

```jsx
<div style={{
  background: C.blueDim,           // of redDim, greenDim, orangeDim
  border: `1px solid ${C.blue}`,   // corresponderende kleur
  borderRadius: '10px',
  padding: '12px 16px',
  fontSize: '13px',
  marginBottom: '16px',
  display: 'flex',
  alignItems: 'flex-start',
  gap: '10px',
}}>
  <span style={{ fontSize: '18px' }}>ℹ️</span>
  <span>Deze lijst is nog leeg. Importeer de standaardwaarden om te beginnen.</span>
</div>
```

Voor **feedback na een actie** (opslaan gelukt, fout, …): gebruik altijd `showToast` via `useToast()` — nooit `alert()` of een inline success-banner.

```jsx
import { useToast } from '../ui/Toast';
const { showToast } = useToast();

showToast('Opgeslagen!', 'success');
showToast('Er ging iets mis.', 'error');
showToast('Let op: dit kan niet ongedaan gemaakt worden.', 'info');
```

---

## 13. Samenvatting — structuurpatronen op één blad

| Situatie | Patroon |
|---|---|
| Overzicht van items | `auto-fill` grid van klikbare tegels |
| Weinig items, veel kolommen | `DataTable` component |
| Tegel klikken → details zien, veel velden | Smaak A — navigeer naar eigen pagina |
| Tegel klikken → snel bekijken | Smaak B — `DetailModal` bottom-sheet |
| Hiërarchische data op dezelfde pagina | Smaak C — uitklapaccordeon |
| Sub-secties op één pagina | Tabbladen (`tabBarStyle` + `tabButtonStyle`) |
| Beheer met categorieën en sub-secties | Tegelkiezer bovenaan + geneste sub-tabs |
| KPI's en statistieken | KPI-strip (flex-rij van accent-border tegels) |
| Filters naast zoekbalk | Chips (`chipStyle`) of `<select>` in topbar |
| Status op een tegel | Badge (`badgeStyle`) rechtsboven in de tegel |
| Groep/categorie als klein label | Tag (kleine pill, niet klikbaar) |
| Feedback na actie | `showToast('...', 'success'|'error'|'info')` |
| Contextuele info op pagina | Gekleurd bannerblok met Dim-achtergrond |
| Niets gevonden | Gecentreerde lege staat met emoji + tekst |
| Data aan het laden | Gecentreerde draaiende ring |
