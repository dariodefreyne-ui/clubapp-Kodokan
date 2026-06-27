# Handover — Clubapp Kodokan Audit & Optimalisatie

Datum: 22 mei 2026
Branch: `claude/clubapp-audit-optimization-JyMaT`
Status: alle 7 fases + opkuis afgerond, build groen, gepusht.

---

## 🚦 0. STAP-VOOR-STAP IN GEBRUIK NEMEN

> ⚠️ **Doe deze stappen in volgorde**. De app blijft werken op de oude code zolang je niet deployt, maar zonder deploy van de Firestore-rules en Cloud Functions werken **cascade-delete**, **audit-log** en **trainer-write-restricties** niet zoals bedoeld.

### 0.1 Merge naar `main`

```bash
# Lokaal of via GitHub PR:
git checkout main
git merge claude/clubapp-audit-optimization-JyMaT
git push origin main
```

### 0.2 Deploy Firestore-rules

```bash
firebase deploy --only firestore:rules
```

Dit activeert:
- Trainer kan `bijdrageBetaald`, `lidnummer`, `vergunningsnummer` NIET meer wijzigen (alleen bestuur)
- Hard-delete van leden alleen voor bestuur
- Stock kan niet meer negatief
- Nieuwe collecties `auditLogs`, `pushFailures`, `categorieen`, `gordels`, `lesgeverTypes`, `communicatieCategorieen`, `techniekCategorieen`

### 0.3 Deploy Cloud Functions

```bash
firebase deploy --only functions
```

Dit activeert:
- `verwijderEventSubcollecties` + `verwijderInschrijvingenBijEvent` — cascade-delete bij verwijderen van wedstrijden/evenementen/examens
- `auditLog_members`, `auditLog_users`, `auditLog_trainingen`, `auditLog_events` — schrijven alles naar `auditLogs/` collectie
- `verwerkPushTrigger` logt mislukte push-meldingen naar `pushFailures`
- Mail-templates lezen clubnaam uit `settings/club` (fallback "Kodokan Merchtem")

### 0.4 Deploy frontend (hosting)

> ⚠️ Nieuwe dependency `html5-qrcode` (voor QR-scan in trainer-modus). Run eerst `npm install`.

```bash
npm install
npm run build
firebase deploy --only hosting
```

### 0.4b Deploy Storage-rules (nieuw — voor logo upload)

```bash
firebase deploy --only storage
```

### 0.5 Eerste opstart — vul Clubdata in

Log in als admin → **Beheer → Clubdata**. In elk van de 8 sub-tabs verschijnt een blauwe banner *"Deze lijst is nog leeg. Wil je de X standaardwaarden importeren?"* — klik op **"Standaardwaarden importeren"** in:

1. 🏷️ Leeftijdscategorieën *(10 items: U7 → Senior)*
2. 🥋 Gordels / KYU *(7 items: wit → zwart)*
3. 👤 Lesgever-types *(4 items: aspirant → trainer A)*
4. 📣 Communicatie-categorieën *(6 items)*
5. 📖 Techniek-categorieën *(5 items: val, worpen, ...)*

Daarna handmatig invullen:

6. 🚗 **Uitbetalingstarieven** — uurloon per type + km-vergoeding
7. 🏛️ **Club** — naam, korte naam, contact-e-mail, logo URL
8. 📅 **Seizoen** — alleen aanpassen als jullie afwijken van 1 sept → 30 juni

### 0.6 Verificatie

- Open Technieken → check dat kyu-filter en kleuren tonen
- Open Leden → Groepen → check leeftijdscategorieën zichtbaar
- Open Uitbetalingen → check dat lesgever-types in de matrix verschijnen
- Verstuur een testmail via Communicatie → check dat clubnaam in de mail-header klopt
- Log in als trainer → probeer "Bijdrage betaald" toggle te zetten op een lid → moet geweigerd worden door rules

---

## ✅ 1. WAT IS GEREALISEERD

### Fase 0 — Veiligheid & data-integriteit
- Granulaire `members` rules: trainers kunnen NIET `bijdrageBetaald`, `lidnummer`, `vergunningsnummer`, `bijdrageVervaldatum`, `ingeschrevenJaar` wijzigen
- Alleen bestuur kan leden aanmaken / hard-delete
- CSV bulk-import gebruikt nu `writeBatch` (atomair, max 499 docs per batch)
- Cascade-delete via Cloud Functions: verwijder wedstrijd/examen/evenement → inschrijvingen en subcollecties weg
- `updatedBy` + `updatedAt` automatisch toegevoegd bij `updateMember()` en `updateUserRol()`
- Stock kan niet meer negatief (Firestore rule)
- Push-meldingen die falen worden gelogd in `pushFailures` collectie

### Fase 1 — Single source of truth
- `NAV_ITEMS` duplicaat in App.jsx verwijderd — alles uit `ALLE_PAGINAS` (appConfig.js)
- Mail-template gedeeld tussen frontend (`src/notifications/mailTemplate.js`) en backend (`functions/mailTemplate.js`)
- Centrale datumhelpers in `src/utils/datumUtils.js`: `formatDatum()`, `formatDatumTijd()`, `datumNaarIso()`, `isoNaarDatum()` — overal **dd/mm/yyyy** weergave; ISO blijft in Firestore opslag

### Fase 2 — Beheer-UI voor clubdata
- 5 nieuwe CRUD-secties in **Beheer → Clubdata** (zie 0.5)
- Generiek `CrudLijstBeheer` component (inline editing, toevoegen, verwijderen, kleuren-picker)
- Defaults via "Standaardwaarden importeren" knop wanneer collectie leeg is

### Fase 3 — Generieke UI-componentenbibliotheek
- `src/components/ui/Toast.jsx` — `useToast()` hook + ToastProvider
- `src/components/ui/FormField.jsx` — universele veldcomponent
- `src/components/ui/DataTable.jsx` — sorteerbare/zoekbare tabel
- Tokens in `src/styles/tokens.js` + `src/styles/theme.css`

### Fase 4 — Navigatie & dashboard
- Sidebar groepeert items via `NAV_GROEPEN` (Club, Leden & training, Evenementen, Financieel, Communicatie, Beheer, Account)
- Dashboard rolspecifieke snelkoppelingen (4 grote knoppen per rol)

### Fase 5 — Leden-ervaring
- **Onboarding-wizard** voor nieuwe registraties (4 stappen)
- **NieuwLid** is nu een wizard (3 stappen met voortgangsbalk)
- **LidDetail** van 4 tabs naar 3: 👤 Profiel / 🏅 Lidmaatschap / 📊 Activiteit
- **ProfielPagina** toast-meldingen vervangen de inline success-banners

### Fase 6 — Unified Events
- Nieuwe `/events` pagina met type-tabs (wedstrijden / examens / evenementen) en zoek+toggle voor voorbij/toekomstig
- Bestaande routes `/wedstrijden`, `/examens`, `/evenementen` blijven werken (backward-compatible)

### Fase 7 — Performance & observability
- `AuthContext.configCache` laadt eenmalig per sessie: `categorieen`, `gordels`, `lesgeverTypes`, `groepen`, `techniekCategorieen`, `clubSettings`, `seizoenSettings`
- Audit-log Cloud Functions schrijven alle writes op `members`, `users`, `trainingen`, `events` naar `auditLogs/`

### Bonus opkuisrondes
- **Tarieven-tab uit Uitbetalingen verwijderd** → nu in Beheer → Clubdata → Uitbetalingstarieven (uurloon + km-vergoeding)
- **6 pagina's met eigen `groepen` fetch** → nu uit `configCache.groepen`
- **Hardcoded constanten dynamisch**: `LEEFTIJDSCATEGORIEEN`, `LESGEVER_TYPES`, `KYU_COLORS`, `BELT_OPTIONS`, `BELT_LABELS`, `TYPE_OPTIONS`, `CLUB_NAAM`, seizoenlogica, `FALLBACK_TARIEFTYPES` — allemaal naar Firestore met hardcoded fallback
- **Tarieftypes-CRUD verwijderd** (dubbel met Lesgever-types)
- **Mail-backend**: `getClubNaam(db)` helper leest `settings/club` in alle 4 mail-Cloud-Functions

---

## 🔧 2. WAT NOG OPEN STAAT

Niet kritisch — de app werkt zonder, maar deze items waren voorgesteld in het oorspronkelijke plan of zijn logische volgende stappen.

### ✅ Recent toegevoegd (waren open, nu klaar)
- ✅ Audit-log UI in Beheer → Logboek (admin-only, filters op periode/collectie/actie/gebruiker, diff op klik)
- ✅ Soft-delete voor members (Deactiveren via update `actief:false`; hard-delete enkel voor admin)
- ✅ Logo upload via Firebase Storage in Beheer → Club (preview + voortgang)
- ✅ Code-splitting via React.lazy (bundle 1907 KB → 942 KB initial, xlsx in eigen chunk)
- ✅ Mail-templates editor in Beheer → Clubdata → Mail-templates (4 templates, variabel-substitutie)
- ✅ LoginPagina toont nu clubnaam + logo uit localStorage cache (gevuld na eerste login)
- ✅ Centralized `updateMetAudit()` / `setMetAudit()` wrappers — toegepast op alle geaudite collecties (members/users/trainingen/events)
- ✅ `onSnapshot` limit op zware collecties (Evenementen, Communicatie)
- ✅ **Trainer-modus** in Trainingen: mobiel aanwezigheidsscherm met QR-scan, notities, lesgever-bevestiging, historiek. Activeert de voorheen ongebruikte aanwezigheidsregistratie.
- ✅ `useGordelOpties()` ook toegepast in `ExamenWizard.jsx`, `KandidaatToevoegenModal.jsx` en `Examens.jsx` (kyu-map, kleuren, labels en belt-progressie nu afgeleid uit `configCache.gordels` i.p.v. hardcoded `examenConstants.js`).
- ✅ DataTable breder uitgerold — `GebruikersBeheer.jsx` en `PushStatusDashboard` (in `MeldingenBeheer.jsx`) gebruiken nu de generieke tabel i.p.v. eigen kaartenlijst.
- ✅ Aanwezigheid-export — Rapporten → Aanwezigheid toont nu een maandoverzicht per groep (trainingen/leden/aanwezigheden/%) met CSV-export.
- ✅ **`LoginPagina` clubnaam bij eerste bezoek**: haalt `settings/club` (publiek leesbaar) al rechtstreeks op via `getDoc` bij mount, los van login-status; localStorage is enkel een no-flicker cache. Dit punt was al opgelost in de code, deze doc-regel was verouderd.
- ✅ **`onSnapshot`/`getDocs` audit Uitbetalingen, Technieken, Winkel**: `uitbetalingsperiodes` (Uitbetalingen) kreeg `limit(60)` — groeit elke maand verder. `tarieven`, `technieken`, `products`, open `sales` (betaald==false) bleven bewust ongelimiteerd: dit zijn bounded reference/config/catalog-data, geen logs die onbeperkt groeien. `allSales`/`verkoopmomenten` in Winkel blijven ook ongelimiteerd: `OverzichtTab` is een historisch rapport (totalen, kassanamen) dat de volledige set nodig heeft — een limit zou oudere data stilletjes laten verdwijnen.

### Prioriteit laag
- [x] **Bundle nog kleiner** — `exceljs` (938 kB) werd nog statisch geïmporteerd in `Technieken.jsx`, `ExcelUpload.jsx`, `UitbetalingsMatrix.jsx` en `WedstrijdKostenSectie.jsx`, waardoor het meeladdde bij elk paginabezoek. Omgezet naar `await import('exceljs')` binnen de export-functie zelf, zoals al gebeurde in `Trainingen.jsx`/`ExcelImport.jsx`/`exportWedstrijdResultaten.js`. exceljs laadt nu enkel nog bij een effectieve export-klik.

---

## 🗂️ 3. ARCHITECTUUR-CHEAT-SHEET

Wanneer je iets nieuws wil doen, weet hier waar wat staat.

| Wat | Waar |
|---|---|
| Globale config (rollen, paginas, collecties) | `src/config/appConfig.js` |
| Defaults voor clubdata-collecties | `src/config/clubdataDefaults.js` |
| Generieke CRUD voor configlijsten | `src/components/beheer/CrudLijstBeheer.jsx` |
| Settings/club + settings/seizoen forms | `src/components/beheer/AlgemeenInstellingenBeheer.jsx` |
| Uitbetalingstarieven | `src/components/beheer/UitbetalingstarievenBeheer.jsx` |
| Auth + configCache (groepen, gordels, settings, ...) | `src/contexts/AuthContext.jsx` |
| Toast-systeem | `src/components/ui/Toast.jsx` |
| Universele datumopmaak (dd/mm/yyyy) | `src/utils/datumUtils.js` |
| Seizoen helpers (instelbaar via settings/seizoen) | `src/utils/seizoenUtils.js` |
| Gordel opties/labels hook | `src/hooks/useGordelOpties.js` |
| Kyu kleuren hook (Technieken) | `src/pages/Technieken.jsx` → `useKyuKleuren()` |
| Mail-template (frontend) | `src/notifications/mailTemplate.js` |
| Mail-template (backend, Cloud Functions) | `functions/mailTemplate.js` |
| Cascade-delete + audit-log triggers | `functions/index.js` |
| Firestore rules | `firestore.rules` |

### Hoe nieuwe configureerbare data toevoegen?

Voorbeeld: stel je wil "examen-locaties" beheerbaar maken.

1. Voeg toe aan `src/config/clubdataDefaults.js`:
   ```js
   export const DEFAULT_EXAMEN_LOCATIES = [
     { code: 'merchtem', label: 'Sporthal Merchtem', adres: '...', volgorde: 10 },
     // ...
   ];
   ```
2. Voeg toe aan `src/config/appConfig.js` `COLLECTIONS`:
   ```js
   EXAMEN_LOCATIES: 'examenLocaties',
   ```
3. Voeg toe aan `firestore.rules` (in `match /...`):
   ```
   match /examenLocaties/{id} {
     allow read: if isIngelogd();
     allow write: if isBeheerder();
   }
   ```
4. In `AuthContext.jsx` → de `useEffect` met Promise.all → voeg `getDocs(query(collection(db, 'examenLocaties'), orderBy('volgorde')))` toe, mappen naar configCache.
5. Voeg een `ExamenLocatiesBeheer` export toe in `InstellingenBeheer.jsx`:
   ```jsx
   const VELDEN = [
     { key: 'code', label: 'Code', breedte: '120px', required: true },
     { key: 'label', label: 'Label', required: true },
     { key: 'adres', label: 'Adres' },
   ];
   export function ExamenLocatiesBeheer() {
     return <CrudLijstBeheer
       collectie={COLLECTIONS.EXAMEN_LOCATIES}
       velden={VELDEN}
       itemLabel="locatie"
       defaults={DEFAULT_EXAMEN_LOCATIES} />;
   }
   ```
6. Voeg toe aan `Beheer.jsx` Clubdata subs + subComponents map.
7. Gebruik in pagina's via `const { configCache } = useAuth(); const locaties = configCache?.examenLocaties || [];`

---

## ⚠️ 4. BEKENDE BEPERKINGEN

### configCache laadt alleen bij sessie-start
Als je in Beheer een leeftijdscategorie toevoegt, ziet een andere logged-in tab dit pas na refresh. Voor live propagatie: schakel naar `onSnapshot` in AuthContext (afweging: meer Firestore reads).

### Seizoeninstellingen vereisen page-refresh
`setSeizoenSettings()` werkt module-level cache bij; React-componenten die tijdens dezelfde mount al `seizoenBereik()` aanriepen, zien de oude waarde. Refresh fixt het.

### Twee event-collecties (`events` + `evenementen`)
Wedstrijden + examens gebruiken `events` (gefilterd op `type`); evenementen heeft een eigen collectie `evenementen`. Events.jsx leest beide samen. Migratie naar één collectie zou een data-migratie vereisen — niet gedaan om risico te beperken.

### `tarieven` vs `lesgeverTypes` collecties
Lesgever-types staan in `lesgeverTypes/{id}`; hun uurloon in `tarieven/{code}/bedragPerUur`. Twee documenten dus voor één concept, maar werkt naadloos. Migratie zou backwards-compat breken.

### Bundle is groot (1.9 MB)
Geen code-splitting toegevoegd om risico te vermijden. Belangrijkste verdachten: `xlsx` (Uitbetalingen export), `qrcode` (LidDetail). Beide candidates voor `import()` dynamic loading.

---

## 🐛 5. TROUBLESHOOTING

### "Standaardwaarden importeren" knop doet niets
- Check browser-console — Firestore rules niet gedeployed?
- Check dat je bent ingelogd als admin/bestuurslid (`isBeheerder()` rule)

### Mails arriveren met "Kodokan Merchtem" terwijl club andere naam heeft
- Heb je `settings/club` gevuld via Beheer → Clubdata → Club?
- Cloud Functions opnieuw deployen (mail-template haalt clubnaam pas op na deploy van `mailTemplate.js`)
- Check `functions/index.js` logs in Firebase Console

### Trainer kan ineens leden niet meer bewerken
- Klopt deels: trainers kunnen NIET meer `bijdrageBetaald`, `lidnummer`, `vergunningsnummer`, `bijdrageVervaldatum`, `ingeschrevenJaar` wijzigen.
- Ze kunnen wel naam, telefoon, e-mail, gordel, groepen, medisch, noodcontact, actief wijzigen.
- Als ze het volledige formulier proberen op te slaan terwijl één verboden veld is gewijzigd: hele save faalt. Frontend zou idealiter die velden disabled tonen voor trainers (TODO).

### Onboarding wizard verschijnt voor bestaande gebruiker
- Check `users/{uid}.onboardingVoltooid` in Firestore — moet `true` zijn voor bestaande accounts.
- Migratie-script: alle bestaande users `onboardingVoltooid: true` zetten via Firestore Console of een eenmalig script.

### Cascade-delete verwijdert geen subcollecties
- Cloud Functions niet gedeployed? `firebase deploy --only functions` opnieuw uitvoeren.
- Check Firebase Console → Functions → logs van `verwijderEventSubcollecties` en `verwijderInschrijvingenBijEvent`.

### Audit-log collectie blijft leeg
- Cloud Functions deployment vergeten? Check logs `auditLog_members`, `auditLog_users`, ...
- Geen UI om logs te bekijken (TODO punt) — voor nu via Firestore Console: `auditLogs/` collectie.

### Build faalt na pull
```bash
rm -rf node_modules dist
npm install
./node_modules/.bin/vite build
```

---

## 📞 6. EERSTE 48 UUR NA DEPLOY — CHECKLIST

- [ ] Dagelijks Firebase Functions logs checken op errors
- [ ] `auditLogs/` collectie checken op rare writes
- [ ] `pushFailures/` collectie checken op falende push-meldingen
- [ ] Eén trainer + één lid + één bestuurder laten testen en feedback verzamelen
- [ ] Mobiel testen op iOS Safari + Chrome Android (niet alleen DevTools)
- [ ] Specifiek testen: CSV-import van 50+ leden (atomair?), wedstrijd verwijderen (cascade?), nieuwe registratie (onboarding?)

---

## 🧾 7. COMMIT-HISTORIE OP DEZE BRANCH

```
06c7abd  7 opkuis-stappen: alles dynamisch via Beheer
e918a28  Opkuis: tarieven-tab uit Uitbetalingen + groepen-fetches gedupliceerd
2b3176d  Clubdata-defaults vooringevuld + dynamische reads in pagina's
c361f3f  Fase 6 & 7: unified events pagina, config-cache, audit log
b9352d6  Fase 5: leden-ervaring — onboarding, wizards, tab-herstructurering, toast
21d76b4  Fase 4: navigatie-groepering en dashboard snelkoppelingen
adffd6c  Fase 3: generieke UI-componentenbibliotheek
952d7fc  Fase 2: Beheer-UI voor configureerbare clubdata
f24f3c6  Fase 1: single source of truth voor configuratie
7ee58f3  Fase 0: veiligheid & data-integriteit
```

10 commits, 7 fases + opkuis. Build groen. Gepusht naar `origin/claude/clubapp-audit-optimization-JyMaT`.

---

*Succes — en als je later iets niet vindt: deze file zoeken op term in plaats van scrollen.*
