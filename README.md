# Clubapp — Judo Kodokan Merchtem

Een volledige webapplicatie voor het beheer van een judoclub. Leden, trainingen, wedstrijden, examens, financiën, communicatie en bestuur — alles op één plek.

> **Wil je dit gebruiken voor jouw eigen club?** Volg dan het hoofdstuk [Installatie voor een nieuwe club](#installatie-voor-een-nieuwe-club) stap voor stap. Sla geen stap over.

---

## Inhoudsopgave

1. [Wat doet de app?](#wat-doet-de-app)
2. [Architectuuroverzicht](#architectuuroverzicht)
3. [Technologie](#technologie)
4. [Vereisten](#vereisten)
5. [Installatie voor een nieuwe club](#installatie-voor-een-nieuwe-club)
   - [Stap 1 — Firebase-project aanmaken](#stap-1--firebase-project-aanmaken)
   - [Stap 2 — Firestore opstarten](#stap-2--firestore-opstarten)
   - [Stap 3 — Authentication activeren](#stap-3--authentication-activeren)
   - [Stap 4 — Firebase Storage activeren](#stap-4--firebase-storage-activeren)
   - [Stap 5 — Firebase Hosting instellen](#stap-5--firebase-hosting-instellen)
   - [Stap 6 — App Check (reCAPTCHA) activeren](#stap-6--app-check-recaptcha-activeren)
   - [Stap 7 — Push Notifications (VAPID-sleutel)](#stap-7--push-notifications-vapid-sleutel)
   - [Stap 8 — Code klonen en afhankelijkheden installeren](#stap-8--code-klonen-en-afhankelijkheden-installeren)
   - [Stap 9 — Omgevingsvariabelen invullen (.env.local)](#stap-9--omgevingsvariabelen-invullen-envlocal)
   - [Stap 10 — Firebase CLI installeren en inloggen](#stap-10--firebase-cli-installeren-en-inloggen)
   - [Stap 11 — Firebase-project koppelen aan de code](#stap-11--firebase-project-koppelen-aan-de-code)
   - [Stap 12 — Firestore-regels en -indexen deployen](#stap-12--firestore-regels-en--indexen-deployen)
   - [Stap 13 — Cloud Functions deployen](#stap-13--cloud-functions-deployen)
   - [Stap 14 — Frontend bouwen en deployen](#stap-14--frontend-bouwen-en-deployen)
   - [Stap 15 — Eerste login en clubdata invullen](#stap-15--eerste-login-en-clubdata-invullen)
   - [Stap 16 — Eerste gebruiker admin maken](#stap-16--eerste-gebruiker-admin-maken)
6. [Lokaal ontwikkelen](#lokaal-ontwikkelen)
7. [Functionaliteiten](#functionaliteiten)
8. [Rollen en rechten](#rollen-en-rechten)
9. [Authenticatie en configuratiecaching](#authenticatie-en-configuratiecaching)
10. [Push-meldingssysteem](#push-meldingssysteem)
11. [Omgevingsvariabelen — volledig overzicht](#omgevingsvariabelen--volledig-overzicht)
12. [Firestore-datastructuur](#firestore-datastructuur)
13. [Firestore-beveiligingsregels](#firestore-beveiligingsregels)
14. [Cloud Functions](#cloud-functions)
15. [Projectstructuur](#projectstructuur)
16. [Beschikbare scripts](#beschikbare-scripts)
17. [Uitzonderingen en bekende beperkingen](#uitzonderingen-en-bekende-beperkingen)
18. [Problemen oplossen](#problemen-oplossen)
19. [Licentie](#licentie)

---

## Wat doet de app?

| Module | Wat je ermee kan |
|---|---|
| **Ledenbeheer** | Leden toevoegen (handmatig of via CSV-import), profielen beheren, gordels/groepen bijhouden, bijdragen opvolgen, medische info en noodcontacten opslaan |
| **Trainingen** | Trainingsschema per groep en seizoen opstellen, aanwezigheid registreren via QR-scan (trainer-modus), technieken per les vastleggen |
| **Technieken** | Databank van judo-technieken per categorie en KYU-niveau, met kleurcoding per gordel |
| **Wedstrijden** | Toernooien aanmaken, deelnemers registreren, resultaten bijhouden, deelnemerslijst importeren via Excel |
| **Examens** | Examenwizard: kandidaten koppelen, resultaten bijhouden, rapport genereren |
| **Evenementen** | Clubactiviteiten aanmaken en inschrijvingen beheren |
| **Agenda** | Maand- en weekoverzicht van alle activiteiten |
| **Klassement** | Clubranking en competitie-overzicht |
| **Winkel** | Merchandisebeheer, kassa, voorraadbeheer, verkoopoverzicht en openstaande schulden |
| **Uitbetalingen** | Lesgeversvergoedingen berekenen en exporteren op basis van uurloon en km-vergoeding |
| **Communicatie** | Bulk-e-mails met aanpasbare templates en variabele-substitutie |
| **Documenten** | Bestanden uploaden en delen met club-leden |
| **Rapporten** | Aanwezigheid, examens, leden, lesgevers, trainingen, verkoop en voorraad in 8 tabbladen |
| **Bestuur** | Bestuursvergaderingen, actiepunten en vertrouwelijke documenten (alleen voor bestuurders) |
| **Beheer** | Clubinstellingen, gebruikersbeheer, configureerbare lijsten (gordels, categorieën, tarieven, …), auditlogboek, push-meldingsinstellingen |

---

## Architectuuroverzicht

```
┌──────────────────────────────────────────────────────────────┐
│                      Browser (PWA)                           │
│  React 18 + React Router 6 + Vite 5                          │
│  Workbox Service Worker (offline cache + FCM achtergrond)    │
└──────────┬────────────────────────────┬─────────────────────┘
           │ Firebase SDK 10            │ HTTPS
           ▼                            ▼
┌─────────────────────┐    ┌────────────────────────────────┐
│  Firebase Auth      │    │  Firebase Cloud Messaging      │
│  (email+wachtwoord) │    │  (FCM — push-meldingen)        │
└─────────────────────┘    └────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                  Cloud Firestore                             │
│  Collecties: users, members, groepen, trainingen, events,   │
│  evenementen, examens, products, sales, communications, … │
│  Persistent lokale cache (IndexedDB, multi-tab sync)        │
└──────────────────────────┬──────────────────────────────────┘
                           │ Document-triggers / scheduled
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Firebase Cloud Functions (Node.js 22)          │
│  - Cascade-delete subcollecties                             │
│  - Auditlogs bij elke schrijfoperatie                       │
│  - Push-meldingen via FCM multicast                         │
│  - Trainer-herinneringen (dagelijks, 06:00)                 │
│  - Lid-gebruikerkoppeling (server-side, veilig)             │
│  - Rol-synchronisatie naar custom claim                     │
│  - E-mail via Trigger Email-extensie                        │
└─────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│             Firebase Hosting (CDN)                          │
│  SPA-rewrite naar index.html, immutable JS/CSS-caching,     │
│  CSP + HSTS security headers                                │
└─────────────────────────────────────────────────────────────┘
```

**Gegevensstroom voor configuratie:**

```
Firestore (settings/club, settings/seizoen, gordels, categorieen, …)
  └─► AuthContext laadt bij login → sessionStorage cache (1 uur TTL)
        └─► useGordelOpties / useSeizoenSettings / … lezen uit cache
              └─► Beheer-pagina slaat op → refreshConfigCache() → cache leeggemaakt
```

**Gegevensstroom voor rollen:**

```
Firestore users/{uid}.rol  ──► Cloud Function syncRolClaim
                                  └─► Firebase Auth custom claim { rol }
                                        └─► firestore.rules & frontend-checks
```

---

## Technologie

| Laag | Technologie | Versie |
|---|---|---|
| Frontend Framework | React | 18.3.1 |
| Routing | React Router | 6.28.2 |
| Build | Vite | 5.4.19 |
| Database | Cloud Firestore | Firebase SDK 10.14.1 |
| Authenticatie | Firebase Authentication | 10.14.1 |
| Opslag | Firebase Cloud Storage | 10.14.1 |
| Push-meldingen | Firebase Cloud Messaging (FCM) | 10.14.1 |
| Beveiliging | Firebase App Check (reCAPTCHA v3) | 10.14.1 |
| Hosting | Firebase Hosting | — |
| Backend | Cloud Functions | Node.js 22 |
| Admin SDK | firebase-admin | 13.0.0 |
| PWA | Vite Plugin PWA + Workbox | 7.0.0 |
| QR-scan | html5-qrcode | 2.3.8 |
| Excel/CSV | ExcelJS + PapaParse | 4.4.0 / 5.4.1 |
| Datumverwerking | date-fns | 3.2.0 |

---

## Vereisten

Zorg dat je het volgende hebt voor je begint:

- Een **Google-account** (voor Firebase)
- **Node.js v18 of hoger** geïnstalleerd op je computer — download via [nodejs.org](https://nodejs.org)
- **npm** — wordt automatisch meegeïnstalleerd met Node.js
- **Git** — download via [git-scm.com](https://git-scm.com)
- Een **creditcard of bankkaart** gekoppeld aan je Google-account voor Firebase (je wordt niet automatisch aangerekend; het gratis plan (Spark) is voldoende om te starten, maar Cloud Functions vereisen het Blaze-plan — betalen per gebruik, normaal enkele euro's per maand voor een kleine club)

---

## Installatie voor een nieuwe club

> Lees elke stap volledig voor je iets doet. De stappen moeten **in volgorde** uitgevoerd worden.

---

### Stap 1 — Firebase-project aanmaken

1. Ga naar [console.firebase.google.com](https://console.firebase.google.com)
2. Klik op de grote knop **"Een project toevoegen"** (of "Add project")
3. Geef je project een naam, bv. `clubapp-mijnclub`
4. Klik op **Doorgaan**
5. Google Analytics: je kan dit uitschakelen als je het niet nodig hebt. Klik op **Doorgaan**
6. Klik op **Project maken**
7. Wacht tot het project aangemaakt is en klik op **Doorgaan**

Je zit nu in de Firebase-console van jouw project.

8. Klik linksboven op het tandwiel-icoontje naast "Project overview" → **Projectinstellingen**
9. Scroll naar beneden naar **"Jouw apps"** en klik op het web-icoontje (`</>`)
10. Geef de app een naam (bv. `clubapp-web`) en vink **"Firebase Hosting instellen"** aan
11. Klik op **App registreren**
12. Je ziet nu een blok code zoals:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "clubapp-mijnclub.firebaseapp.com",
  projectId: "clubapp-mijnclub",
  storageBucket: "clubapp-mijnclub.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123",
  measurementId: "G-XXXXXXX"
};
```

**Laat dit venster open staan of kopieer deze waarden ergens veilig.** Je hebt ze nodig in Stap 9.

13. Klik op **Doorgaan naar console**

---

### Stap 2 — Firestore opstarten

Firestore is de database waar alle gegevens van je club worden opgeslagen.

1. Klik in het linkermenu op **Build** → **Firestore Database**
2. Klik op **Database maken** (of "Create database")
3. Kies **Productiemodus** (Production mode) — de beveiligingsregels worden later goed ingesteld
4. Kies een locatie die dicht bij jou ligt, bv. `europe-west1` (België/Nederland)
5. Klik op **Activeren** en wacht tot de database aangemaakt is

Je ziet nu een lege database. Dit is normaal.

---

### Stap 3 — Authentication activeren

Hiermee kunnen gebruikers inloggen met e-mail en wachtwoord.

1. Klik in het linkermenu op **Build** → **Authentication**
2. Klik op **Aan de slag** (of "Get started")
3. Klik op het tabblad **Aanmeldingsmethode** (Sign-in method)
4. Klik op **E-mail/wachtwoord**
5. Zet de eerste schakelaar op **Aan** (Enabled)
6. Laat de tweede schakelaar ("E-maillink / wachtwoordloos") **uit**
7. Klik op **Opslaan**

---

### Stap 4 — Firebase Storage activeren

Hiermee kunnen bestanden (documenten, logo's) geüpload worden.

1. Klik in het linkermenu op **Build** → **Storage**
2. Klik op **Aan de slag** (Get started)
3. Kies opnieuw **Productiemodus**
4. Kies dezelfde locatie als bij Firestore (bv. `europe-west1`)
5. Klik op **Gereed**

---

### Stap 5 — Firebase Hosting instellen

Hiermee wordt de website online gezet.

Als je in Stap 1 bij het registreren van de app al "Firebase Hosting instellen" aangevinkt had, is dit al in orde. Ga anders:

1. Klik in het linkermenu op **Build** → **Hosting**
2. Klik op **Aan de slag** en volg de instructies op het scherm (je kan de Firebase CLI-instructies overslaan — die komen in Stap 10)

---

### Stap 6 — App Check (reCAPTCHA) activeren

App Check beschermt je database tegen misbruik van buitenaf.

1. Klik in het linkermenu op **Build** → **App Check**
2. Klik op je web-app in de lijst
3. Kies **reCAPTCHA v3** als provider
4. Je wordt doorgestuurd naar [google.com/recaptcha](https://www.google.com/recaptcha/admin/create)
5. Vul het formulier in:
   - **Label**: naam van je app (bv. `clubapp`)
   - **Type**: kies **reCAPTCHA v3**
   - **Domeinen**: voeg `localhost` toe (voor testen) en later het echte domein van je app (bv. `clubapp-mijnclub.web.app`)
6. Klik op **Verzenden**
7. Je ziet een **Sitesleutel** (Site Key) en een **Geheime sleutel** (Secret Key)
8. Kopieer de **Sitesleutel** — dit wordt je `VITE_APPCHECK_KEY` in Stap 9
9. Ga terug naar de Firebase-console → App Check → voer de sitesleutel in en klik op **Opslaan**

---

### Stap 7 — Push Notifications (VAPID-sleutel)

Hiermee kunnen push-meldingen verstuurd worden naar de telefoons van trainers en bestuursleden.

1. Klik in het linkermenu op het tandwiel → **Projectinstellingen**
2. Klik op het tabblad **Cloud Messaging**
3. Scroll naar beneden naar **Web Push-certificaten**
4. Klik op **Sleutelpaar genereren** (Generate key pair)
5. Er verschijnt een lange reeks tekens — dit is je **VAPID-sleutel**
6. Kopieer deze sleutel — dit wordt je `VITE_VAPID_KEY` in Stap 9

> **Let op:** FCM vereist de Firebase Cloud Messaging API (V1). Als de API niet actief is in je Google Cloud Console, mislukken push-meldingen met een authenticatiefout. Controleer dit via [console.cloud.google.com](https://console.cloud.google.com) → jouw project → APIs & Services → Library → zoek "Firebase Cloud Messaging API" en activeer het indien nodig.

---

### Stap 8 — Code klonen en afhankelijkheden installeren

Open een **Terminal** (op Mac: zoek "Terminal" in Spotlight; op Windows: zoek "Command Prompt" of "PowerShell") en voer deze commando's één voor één uit:

```bash
# Haal de code op van GitHub
git clone https://github.com/dariodefreyne-ui/clubapp-kodokan.git mijnclub-app

# Ga naar de map
cd mijnclub-app

# Installeer alle Node.js-afhankelijkheden voor de frontend
npm install

# Ga naar de Cloud Functions map en installeer ook daar de afhankelijkheden
cd functions
npm install

# Ga terug naar de hoofdmap
cd ..
```

Als alles goed gaat, zie je geen rode foutmeldingen.

---

### Stap 9 — Omgevingsvariabelen invullen (.env.local)

Dit bestand bevat alle geheime sleutels van jouw Firebase-project. Het staat **nooit** in Git en is **alleen op jouw computer**.

1. Maak een nieuw bestand aan in de hoofdmap van het project met de naam `.env.local`
2. Kopieer de inhoud hieronder en vervang elke waarde door de juiste gegevens van jouw project:

```env
# Firebase-configuratie — haal deze op uit Firebase Console > Projectinstellingen > Jouw apps
VITE_FB_API_KEY=plak-hier-jouw-apiKey
VITE_FB_AUTH_DOMAIN=jouw-project-id.firebaseapp.com
VITE_FB_PROJECT_ID=jouw-project-id
VITE_FB_STORAGE_BUCKET=jouw-project-id.appspot.com
VITE_FB_MESSAGING_SENDER_ID=plak-hier-jouw-messagingSenderId
VITE_FB_APP_ID=plak-hier-jouw-appId
VITE_FB_MEASUREMENT_ID=plak-hier-jouw-measurementId

# VAPID-sleutel — haal op via Firebase Console > Projectinstellingen > Cloud Messaging > Web Push-certificaten
VITE_VAPID_KEY=plak-hier-jouw-vapid-sleutel

# App Check — haal op via Google reCAPTCHA (zie Stap 6)
VITE_APPCHECK_KEY=plak-hier-jouw-recaptcha-sitesleutel

# Club-identiteit — pas aan voor jouw club
VITE_CLUB_NAAM=Judo Club Mijnstad
VITE_CLUB_NAAM_KORT=JC Mijnstad
VITE_CLUB_STORAGE_PREFIX=mijnclub
VITE_THEME_COLOR=#E63346
```

**Hoe de waarden vinden:**

- `VITE_FB_API_KEY` t.e.m. `VITE_FB_MEASUREMENT_ID`: ga naar Firebase Console → tandwiel → Projectinstellingen → scroll naar "Jouw apps" → klik op je web-app → je ziet het `firebaseConfig`-object met alle waarden
- `VITE_VAPID_KEY`: zie Stap 7
- `VITE_APPCHECK_KEY`: zie Stap 6
- `VITE_CLUB_NAAM`: de volledige naam van jouw club, bv. `Judo Club Leuven`
- `VITE_CLUB_NAAM_KORT`: de kortere naam, bv. `JC Leuven`
- `VITE_CLUB_STORAGE_PREFIX`: een korte unieke code zonder spaties, bv. `jcleuven` — wordt gebruikt als mapnaam in Firebase Storage en als prefix voor QR-codes
- `VITE_THEME_COLOR`: de primaire kleur van je club in hexadecimaal, bv. `#E63346` (rood)

> **Let op:** het bestand heet `.env.local` — met een punt ervoor. Op Mac/Linux zijn bestanden die beginnen met een punt verborgen in de Finder. Je kan ze wel zien in de Terminal.

---

### Stap 10 — Firebase CLI installeren en inloggen

De Firebase CLI is een programma waarmee je de app naar Firebase kan sturen vanuit de Terminal.

```bash
# Installeer de Firebase CLI globaal op je computer
npm install -g firebase-tools

# Log in met je Google-account (er opent een browservenster)
firebase login
```

Geef toegang in het browservenster dat verschijnt. Daarna verschijnt in de Terminal: `Success! Logged in as jouw@email.com`

---

### Stap 11 — Firebase-project koppelen aan de code

```bash
# Koppel de code aan jouw Firebase-project
firebase use --add

# Je krijgt een lijst van je Firebase-projecten te zien
# Selecteer het juiste project met de pijltjestoetsen en druk op Enter
# Geef een alias (bv. "default") en druk op Enter
```

Controleer daarna of het gelukt is:

```bash
firebase projects:list
# Je ziet je project in de lijst, met een sterretje (*) naast het actieve project
```

---

### Stap 12 — Firestore-regels en -indexen deployen

De beveiligingsregels bepalen wie wat mag lezen en schrijven in de database.

```bash
# Deploy de beveiligingsregels voor de database
firebase deploy --only firestore:rules

# Deploy de beveiligingsregels voor opslag (bestanden/afbeeldingen)
firebase deploy --only storage

# Deploy de database-indexen (nodig voor gefilterde zoekopdrachten)
firebase deploy --only firestore:indexes
```

Elk commando toont `Deploy complete!` als het gelukt is.

---

### Stap 13 — Cloud Functions deployen

Cloud Functions zijn stukjes server-logica die automatisch draaien bij bepaalde gebeurtenissen (bv. een lid wordt verwijderd → alle inschrijvingen worden ook verwijderd).

> **Belangrijk:** Cloud Functions vereisen het **Blaze-plan** (betalen per gebruik) op Firebase. Ga naar Firebase Console → links onderaan klik op het huidige plan → kies **Upgraden naar Blaze**. Kleine clubs betalen hier normaal minder dan €5 per maand.

```bash
# Deploy alle Cloud Functions
firebase deploy --only functions
```

Dit kan enkele minuten duren. Je ziet onderaan `Deploy complete!` als alles gelukt is.

Als je een foutmelding krijgt zoals `Error: Functions did not deploy properly`, controleer dan of je bent ingelogd op het Blaze-plan.

---

### Stap 14 — Frontend bouwen en deployen

```bash
# Bouw de productieversie van de app
npm run build

# Zet de app online
firebase deploy --only hosting
```

Na `Deploy complete!` verschijnt een URL zoals `https://jouw-project-id.web.app`. Bezoek deze URL — je ziet de inlogpagina van de app!

---

### Stap 15 — Eerste login en clubdata invullen

1. Ga naar jouw app-URL
2. Klik op **"Registreren"** (of "Account aanmaken") — er bestaat nog geen account
3. Vul een e-mailadres en wachtwoord in
4. Doorloop de onboarding-wizard (4 stappen)

Na de onboarding ben je ingelogd, maar je hebt nog geen admin-rechten. Dat gaan we nu instellen.

---

### Stap 16 — Eerste gebruiker admin maken

Omdat je de eerste gebruiker bent, moet je jezelf admin maken via de Firestore-console. Dit doe je éénmalig.

1. Ga naar [console.firebase.google.com](https://console.firebase.google.com) → jouw project
2. Klik op **Firestore Database** in het linkermenu
3. Klik op de collectie **`users`**
4. Je ziet één document — klik erop. Dit is jouw gebruikersprofiel
5. Zoek het veld **`rol`** in de lijst met velden
6. Klik op het potlood-icoontje naast de waarde (waarschijnlijk staat er `lid`)
7. Verander de waarde naar `admin`
8. Klik op **Bijwerken** (Update)

> **Wacht nu 1 minuut** zodat de wijziging volledig verwerkt is. Ververs dan de app-pagina in de browser. Je ziet nu extra menu-items verschijnen, waaronder **Beheer**.

**Clubdata invullen als admin:**

9. Ga in de app naar **Beheer → Clubdata**
10. In elk tabblad zie je een blauwe banner *"Deze lijst is nog leeg. Wil je de standaardwaarden importeren?"*
11. Klik op **"Standaardwaarden importeren"** in de volgende tabbladen:
    - **Leeftijdscategorieën** (U7 t.e.m. Senior)
    - **Gordels / KYU** (wit t.e.m. zwart)
    - **Lesgever-types** (aspirant t.e.m. trainer A)
    - **Communicatie-categorieën**
    - **Techniek-categorieën**
12. Ga naar het tabblad **Club** en vul in:
    - Naam van de club
    - Korte naam
    - Contact-e-mailadres
    - Logo (optioneel: upload een afbeelding)
13. Ga naar het tabblad **Uitbetalingstarieven** en vul de uurlonen en km-vergoeding in voor de verschillende lesgever-types
14. Ga naar het tabblad **Seizoen** en controleer of de startmaand klopt (standaard september)

De app is nu klaar voor gebruik!

---

## Lokaal ontwikkelen

Als je wijzigingen wil aanbrengen aan de code, kan je de app lokaal starten:

```bash
# Start de ontwikkelserver (opent automatisch in de browser op http://localhost:5173)
npm run dev
```

De app werkt dan lokaal maar praat nog steeds met de echte Firebase-database. Wijzigingen in de code worden onmiddellijk zichtbaar in de browser.

Om een lokale productie-build te testen:

```bash
npm run build
npm run preview
```

> **Let op bij bouwen:** de buildstap valideert of `VITE_APPCHECK_KEY` aanwezig is. Ontbreekt deze variabele, dan stopt de build met een fout. Je kan dit omzeilen voor lokale tests door een tijdelijke waarde mee te geven:
> ```bash
> VITE_APPCHECK_KEY=dummy npm run build
> ```

---

## Functionaliteiten

### Ledenbeheer

- Leden toevoegen via een wizard (3 stappen: persoonsgegevens, lidmaatschap, contactinfo)
- Bulkimport van leden via CSV-bestand
- Ledenprofiel met 3 tabbladen: Profiel, Lidmaatschap, Activiteit
- Gordel en leeftijdsgroep per lid
- Bijdrage betaald/niet betaald bijhouden
- Vergunningsnummer en inschrijvingsjaar registreren
- Medische informatie en noodcontacten opslaan
- Lid deactiveren (zacht verwijderen) of definitief verwijderen (enkel admin)
- Lid koppelen aan een gebruikersaccount
- Gordel-kleurcodes worden beheerd in Firestore (niet hardcoded in de app)

### Trainingen

- Trainingsschema per groep en seizoen
- Trainer-modus: mobiel scherm met QR-scanner voor aanwezigheidsregistratie
- Technieken per training registreren
- Lesgevers per training aanduiden
- Beschikbaarheid van trainers registreren
- Trainingen importeren via Excel

### Technieken

- Databank van judo-technieken per categorie (valtechnieken, worpen, …)
- KYU-niveau per techniek
- Kleurcodering op basis van gordelniveau

### Wedstrijden, Examens & Evenementen

- Uniforme evenementenpagina met tabbladen per type
- Deelnemers registreren en opvolgen
- Examen-wizard met kandidatenbeheer
- Wedstrijddeelnemers importeren via Excel of e-mail
- Inschrijvingen worden automatisch verwijderd als een evenement verwijderd wordt
- Inschrijvingen slaan het seizoen op (voor seizoensgebonden rapportages)

### Winkel

- Productenbeheer met categorieën, varianten en stockbeheer
- Kassascherm voor directe verkoop
- Verkoopoverzicht en openstaande schulden
- Automatische stockmelding bij lage voorraad

### Uitbetalingen

- Vergoedingsmatrix per lesgever en periode
- Uurloon + km-vergoeding per lesgever-type
- Exporteerbaar naar Excel

### Communicatie

- Bulk-e-mails naar alle leden of een selectie
- Aanpasbare e-mailtemplates met variabelen zoals `{{naam}}`, `{{datum}}`
- Verzendhistoriek

### Rapporten

- Aanwezigheidsrapporten per groep en trainer
- Examenresultaten
- Ledenoverzicht en statistieken
- Lesgeversactiviteit
- Verkooprapport en voorraadrapport
- Exporteerbaar naar Excel

### Beheer

- Gebruikersbeheer: rollen toekennen, accounts beheren
- Configureerbare lijsten: gordels, leeftijdscategorieën, lesgever-types, uitbetalingstarieven
- Clubinstellingen: naam, logo, contactgegevens
- Seizoensinstellingen: startmaand, standaard trainingstijd
- Auditlogboek: alle wijzigingen bijgehouden (enkel admin)
- Push-meldingsinstellingen per gebruiker

### Bestuur (vertrouwelijk)

- Bestuursvergaderingen met agenda en verslag
- Actiepunten met verantwoordelijke en deadline
- Vertrouwelijke bestuursdocumenten

---

## Rollen en rechten

De app hanteert een rolhiërarchie met vijf niveaus. Rollen worden bewaard als een custom claim in Firebase Auth (veld `rol`) én in het Firestore `users`-document. De Cloud Function `syncRolClaim` synchroniseert beide automatisch wanneer het Firestore-document gewijzigd wordt.

```
admin > bestuurslid > trainer > assistent > lid
```

| Rol | Beschrijving | Bevoegdheden |
|---|---|---|
| `admin` | Hoofdbeheerder | Volledige toegang, harde verwijdering van leden en evenementen, auditlogboek lezen |
| `bestuurslid` | Bestuurslid | Administratieve functies, gebruikersbeheer, financiën, geen harde verwijdering |
| `trainer` | Hoofdtrainer | Trainingen beheren, leden raadplegen (beperkt), evenementen en examens beheren, push-herinneringen ontvangen |
| `assistent` | Assistent-trainer | Trainingen bekijken, zichzelf als lesgever koppelen, géén schrijfrechten op leden |
| `lid` | Gewoon lid | Eigen profiel, inschrijvingen op evenementen, publieke informatie |

**Schrijfrechten per veld bij ledenbeheer:**

| Veld | Trainer | Bestuurslid | Admin |
|---|---|---|---|
| Naam, geboortedatum, gordel, groep | Ja | Ja | Ja |
| Bijdrage betaald / vervaldatum | Nee | Ja | Ja |
| Lidnummer, vergunningsnummer, inschrijvingsjaar | Nee | Ja | Ja |
| Medische info, noodcontact | Beperkt | Ja | Ja |
| `linkedMemberId` / `linkedUserId` | Nooit (server-side) | Nooit (server-side) | Nooit (server-side) |

> **Kritieke beveiliging:** de velden `linkedMemberId` en `linkedUserId` bepalen de koppeling tussen een Firebase-account en een lid. Ze worden **uitsluitend** gezet door de Cloud Function `koppelLidViaEmail`. De app blokkeert client-side wijzigingen via `updateMember`, en de Firestore-regels verwerpen ze ook. Probeer dit nooit te omzeilen.

---

## Authenticatie en configuratiecaching

### Authenticatiestroom

```
Bezoek de app
  └─► onAuthStateChanged (Firebase Auth)
        ├─► Geen gebruiker → LoginPagina
        └─► Gebruiker gevonden
              ├─► Real-time listener op users/{uid}
              ├─► Lees seizoensinstellingen (real-time)
              ├─► Lees configCache uit sessionStorage (TTL 1 uur)
              │     ├─► Cache geldig → gebruik cache
              │     └─► Cache verlopen/leeg → lees Firestore en sla op in cache
              └─► onboardingVoltooid === false → Onboarding wizard
```

### Configuratiecaching (1-uur TTL)

De volgende gegevens worden bij inloggen eenmalig geladen en daarna 1 uur gecached in `sessionStorage`:

- `categorieen` (leeftijdscategorieën)
- `gordels` (KYU-niveaus met kleuren)
- `lesgeverTypes`
- `communicatieCategorieen`
- `techniekCategorieen`
- `settings/club` (clubnaam, logo, thema)
- `settings/seizoen` (startmaand)

**Gevolg:** wanneer een beheerder deze gegevens wijzigt via Beheer → Clubdata of Beheer → Instellingen, zien andere gebruikers de wijziging pas na verloop van 1 uur (of na een nieuw tabblad). Beide instellingenpagina's roepen na opslaan zelf `refreshConfigCache()` aan, zodat de beheerder de wijziging onmiddellijk ziet.

---

## Push-meldingssysteem

### Rubrieken (categorieën)

| Rubriek | Rollen die het ontvangen | Standaard actief | E-mailvariant |
|---|---|---|---|
| `trainingen` | Iedereen | Ja | Nee |
| `wedstrijden` | Iedereen | Ja | **Ja** |
| `inschrijvingen` | Admin, bestuur, trainer | Ja (lid: nee) | Nee |
| `examens` | Admin, bestuur, trainer | Ja (lid: nee) | Nee |
| `graad` | Iedereen | Ja | Nee |
| `trainerHerinnering` | Admin, bestuur, trainer | Ja | **Ja** |
| `stock` | Admin, bestuurslid | Ja | **Ja** |
| `clubBerichten` | Iedereen | Ja | Nee |
| `evenementen` | Iedereen | Ja | Nee |
| `nieuweLeden` | Admin, bestuurslid | Ja | Nee |
| `bestuur` | Admin, bestuurslid | Ja | Nee |

### Per-apparaat overrides

Naast de globale voorkeur per rubriek kan elke gebruiker via **Instellingen → Apparaatinstellingen** een override instellen voor het huidige toestel. Dit laat toe om op een werk-pc geen meldingen te ontvangen, maar op je gsm wel, zonder de globale instelling te wijzigen.

De effectieve instelling volgt deze logica:
1. Als er een apparaat-override is voor de rubriek → gebruik die
2. Anders → gebruik de globale voorkeur van de gebruiker

### Trainer-herinneringen en samengevoegde groepen

De Cloud Function `verzendTrainerHerinneringAuto` loopt elke dag om 06:00 en stuurt een herinnering wanneer er voor een training geen trainer gekoppeld is.

Groepen die **samengevoegd zijn met een andere groep** of **inactief** zijn, moeten geen herinneringen sturen. Stel het veld `trainerReminderActief` in op `false` via **Beheer → Groepen → [groep selecteren] → Trainer-reminders actief**. De Cloud Function slaat die groep dan over.

Standaard (veld afwezig) wordt een groep als actief beschouwd — er is geen migratie nodig voor bestaande groepen.

### Technische vereisten voor push-meldingen

Push-meldingen vereisen drie correcte instellingen:
1. De **VAPID-sleutel** in `.env.local` (`VITE_VAPID_KEY`)
2. De **Firebase Cloud Messaging API (V1)** actief in Google Cloud Console
3. De gebruiker heeft **toestemming voor meldingen** gegeven in de browser

Als de FCM API niet actief is, verschijnt de fout: `messaging/token-subscribe-failed` met "missing required authentication credential". Dit is een **Google Cloud Console**-probleem, niet een code-probleem.

---

## Omgevingsvariabelen — volledig overzicht

Alle variabelen worden ingesteld in het bestand `.env.local` in de hoofdmap van het project.

| Variabele | Beschrijving | Waar vinden |
|---|---|---|
| `VITE_FB_API_KEY` | Firebase API-sleutel | Firebase Console → Projectinstellingen → Jouw apps |
| `VITE_FB_AUTH_DOMAIN` | Firebase Auth-domein | idem |
| `VITE_FB_PROJECT_ID` | Firebase project-ID | idem |
| `VITE_FB_STORAGE_BUCKET` | Firebase Storage-bucket | idem |
| `VITE_FB_MESSAGING_SENDER_ID` | FCM sender-ID | idem |
| `VITE_FB_APP_ID` | Firebase app-ID | idem |
| `VITE_FB_MEASUREMENT_ID` | Google Analytics ID | idem (optioneel) |
| `VITE_VAPID_KEY` | Push notification VAPID-sleutel | Firebase Console → Projectinstellingen → Cloud Messaging → Web Push |
| `VITE_APPCHECK_KEY` | reCAPTCHA v3 sitesleutel | google.com/recaptcha → jouw site |
| `VITE_CLUB_NAAM` | Volledige naam van de club | Zelf invullen |
| `VITE_CLUB_NAAM_KORT` | Korte naam van de club | Zelf invullen |
| `VITE_CLUB_STORAGE_PREFIX` | Mapnaam in Firebase Storage + QR-prefix | Zelf kiezen (geen spaties) |
| `VITE_THEME_COLOR` | Primaire kleur (hex) | Zelf kiezen, bv. `#1A56A4` |

---

## Firestore-datastructuur

### Kerngegevens

| Collectie | Inhoud | Subcollecties |
|---|---|---|
| `users` | Gebruikersprofielen (rol, groepen, notificatieVoorkeuren, onboardingVoltooid) | — |
| `members` | Judoka's (naam, geboortedatum, gordel, bijdrage, vergunning, medisch, noodcontact) | `attendance/{datum}` |
| `groepen` | Leeftijdsgroepen met schema en trainer-reminder-vlag | — |
| `trainingen` | Trainingen per groep en seizoen | `technieken/{id}`, `beschikbaarheid/{uid}` |
| `technieken` | Judo-techniekenbank | — |

### Evenementen

| Collectie | Inhoud | Subcollecties |
|---|---|---|
| `events` | Wedstrijden en toernooien | `registrations/{memberId}` |
| `evenementen` | Clubactiviteiten (BBQ, open dag, …) | `registrations/{memberId}` |
| `examens` | Examens met kandidaten en resultaten | — |

### Financiën

| Collectie | Inhoud |
|---|---|
| `products` | Merchandise met stock, varianten en categorieën |
| `sales` | Verkooptransacties (koper, bedrag, betaald) |
| `tarieven` | Uurloon per lesgever-type |
| `uitbetalingsperiodes` | Uitbetalingsperiodes per maand |
| `lesgevers` | Trainer-metadata (koppeling users ↔ lesgevers) |

### Communicatie en documenten

| Collectie | Inhoud |
|---|---|
| `communications` | Verzonden bulk-e-mails (template, ontvangers, status) |
| `documents` | Gedeelde bestanden (metadata + Storage-referentie) |
| `mailTemplates` | E-mailtemplates met `{{variabelen}}`-syntax |
| `mail` | Write-only voor Trigger Email-extensie (Cloud Function schrijft, extensie verzendt) |

### Configuratie

| Collectie | Inhoud |
|---|---|
| `settings/club` | Clubnaam, logo, contact-e-mail, thema — publiek leesbaar (vereist voor loginpagina) |
| `settings/seizoen` | Startmaand en -dag van het seizoen |
| `categorieen` | Leeftijdscategorieën (configureerbaar via Beheer) |
| `gordels` | KYU-niveaus met kleur (configureerbaar) |
| `lesgeverTypes` | Types lesgevers (configureerbaar) |
| `communicatieCategorieen` | Categorieën voor bulk-e-mails |
| `techniekCategorieen` | Categorieën voor technieken-databank |

### Meldingen en tokens

| Collectie | Inhoud |
|---|---|
| `notificationTokens` | FCM-tokens per apparaat (uid, rol, actief, alertsOverride) |
| `pushTriggers` | Write-only trigger-documenten voor de `verwerkPushTrigger`-functie |
| `pushFailures` | Mislukte push-meldingen (voor debugging) |
| `notificatieLogs` | Audit trail van alle push-pogingen |
| `trainerReminderTriggers` | Scheduled trainer-herinneringen |

### Bestuur en audit

| Collectie | Inhoud |
|---|---|
| `auditLogs` | Alle wijzigingen (wie, wanneer, voor/na) — enkel leesbaar voor admins |
| `bestuursVergaderingen` | Bestuursvergaderingen (vertrouwelijk) |
| `bestuursActiepunten` | Actiepunten bestuur (vertrouwelijk) |
| `bestuursDocumenten` | Vertrouwelijke bestuursdocumenten |

---

## Firestore-beveiligingsregels

De regels in `firestore.rules` handelen alle lees- en schrijfrechten af op basis van de custom claim `request.auth.token.rol`.

**Belangrijkste principes:**

- `settings/club` is **publiek leesbaar** zonder authenticatie — dit is noodzakelijk zodat de loginpagina de clubnaam en het logo kan tonen voordat een gebruiker ingelogd is.
- `linkedMemberId` en `linkedUserId` op een `users`-document mogen enkel door de server geschreven worden (Cloud Function), nooit door de client.
- `members`-documenten kennen gelaagde schrijfrechten: trainers mogen enkel contactgegevens en medische info aanpassen, geen financiële of administratieve velden.
- Collection-group queries op `attendance` en `registrations` zijn beschikbaar voor ingelogde trainers.
- De collecties `mail`, `pushTriggers` en `trainerReminderTriggers` zijn **write-only** vanuit de client — lezen is voorbehouden aan Cloud Functions.
- `auditLogs` zijn schrijfbaar door Cloud Functions, leesbaar door admins.

---

## Cloud Functions

Alle functies staan in `functions/index.js` en draaien op Node.js 22 (Firebase Functions v2 API).

### Cascade-delete

| Functie | Trigger | Wat |
|---|---|---|
| `verwijderEventSubcollecties` | `events/{id}` verwijderd | Verwijdert alle subcollecties (registrations) |
| `verwijderInschrijvingenBijEvent` | `evenementen/{id}` verwijderd | Verwijdert alle inschrijvingen |

### Auditlogs

| Functie | Trigger | Wat |
|---|---|---|
| `auditLog_members` | `members/{id}` aangemaakt/gewijzigd/verwijderd | Schrijft naar `auditLogs` |
| `auditLog_users` | `users/{uid}` gewijzigd | Schrijft naar `auditLogs` |
| `auditLog_trainingen` | `trainingen/{id}` gewijzigd | Schrijft naar `auditLogs` |
| `auditLog_events` | `events/{id}` gewijzigd | Schrijft naar `auditLogs` |

### Rollen en koppeling

| Functie | Trigger | Wat |
|---|---|---|
| `syncRolClaim` | `users/{uid}.rol` gewijzigd | Zet custom claim `{ rol }` in Firebase Auth — overschrijft nooit andere claims |
| `koppelLidViaEmail` | HTTP-aanroep vanuit onboarding | Koppelt Firebase-account aan lid op basis van e-mail; zet `linkedMemberId` en `linkedUserId` server-side |

### Meldingen en e-mail

| Functie | Trigger | Wat |
|---|---|---|
| `notifyStockZero` | `products/{id}` gewijzigd | Stuurt push + e-mail wanneer voorraad de drempelwaarde bereikt |
| `verwerkPushTrigger` | `pushTriggers/{id}` aangemaakt | Stuurt FCM multicast naar gefilterde gebruikers op basis van rol en voorkeur |
| `verzendTrainerHerinneringAuto` | Elke dag 06:00 (scheduled) | Stuurt herinnering aan trainers voor trainingen zonder lesgever; slaat groepen over waarbij `trainerReminderActief === false` |

---

## Projectstructuur

```
clubapp-kodokan/
├── .env.example              # Voorbeeld van omgevingsvariabelen (kopieer naar .env.local)
├── .firebaserc               # Firebase-projectkoppeling
├── firebase.json             # Firebase CLI-configuratie (hosting, functions, rules)
├── firestore.rules           # Beveiligingsregels voor de database
├── firestore.indexes.json    # Database-indexen (composite + collection-group)
├── storage.rules             # Beveiligingsregels voor bestanden
├── vite.config.js            # Build-configuratie (code splitting, PWA, headers)
├── index.html                # Startpagina (PWA entry point)
├── package.json              # Frontend-afhankelijkheden en scripts
├── public/                   # Statische bestanden (PWA-iconen, manifest)
├── src/
│   ├── App.jsx               # Hoofdrouting, navigatie, push-token registratie
│   ├── firebase.js           # Firebase-initialisatie (App Check, persistent cache)
│   ├── sw.js                 # Service Worker (Workbox inject manifest + FCM)
│   ├── config/
│   │   ├── appConfig.js      # Centrale constanten (rollen, collectienamen, paginadefinities)
│   │   └── paginaRollen.js   # Standaard paginatoegang per rol
│   ├── contexts/
│   │   ├── AuthContext.jsx   # Auth-state, rol, configCache, refreshConfigCache
│   │   ├── GroepenContext.jsx # Real-time lijst van groepen
│   │   └── LesgeversContext.jsx # Real-time lijst van lesgevers
│   ├── hooks/
│   │   ├── useGordelOpties.js      # Gordels en kleuren uit configCache
│   │   ├── useIsMobile.js          # Responsive breakpoint (768px)
│   │   ├── useAppUpdate.js         # SW-update detectie
│   │   ├── useAgendaItems.js       # Kalenderdata (trainingen + events + evenementen)
│   │   └── useRapportenData.js     # Geaggregeerde rapportagedata
│   ├── pages/                # Alle paginacomponenten (24 pagina's)
│   ├── components/           # Herbruikbare UI-componenten
│   │   ├── beheer/           # Beheer-subcomponenten (groepen, leden, instellingen, …)
│   │   ├── details/          # Detail-panelen (lid, training, event, evenement)
│   │   └── trainingen/       # Trainingen-gerelateerde componenten
│   ├── services/
│   │   └── firestoreService.js  # Alle Firestore CRUD-operaties (gecentreerd)
│   ├── notifications/
│   │   ├── firebaseMessaging.js     # FCM-token registratie en -beheer
│   │   ├── notificationCategories.js # Rubrieken + standaardwaarden (MOET gesynchroniseerd blijven met functions/)
│   │   └── notificationPreferences.js # Voorkeursbeheer (laden, opslaan, effectief berekenen)
│   ├── utils/                # Hulpfuncties (datums, seizoen, CSV-parsing, …)
│   └── styles/
│       └── tokens.js         # Design-tokens (kleuren, typografie, spacing)
└── functions/
    ├── index.js              # Alle Cloud Functions (triggers + scheduled)
    ├── mailHtmlBuilder.js    # HTML e-mailbouwer (template-engine)
    ├── mailTemplateStore.js  # Standaard e-mailtemplates
    └── notifications/
        ├── categories.js     # Rubrieken (MOET gesynchroniseerd blijven met src/)
        └── sender.js         # FCM multicast-logica
```

---

## Beschikbare scripts

Voer deze commando's uit vanuit de hoofdmap van het project:

```bash
# Start de ontwikkelserver op http://localhost:5173
npm run dev

# Bouw de productieversie (output in /dist)
npm run build

# Bekijk de productieversie lokaal
npm run preview
```

Voor Cloud Functions (vanuit de `functions/` map):

```bash
cd functions

# Deploy alleen de Cloud Functions
firebase deploy --only functions

# Bekijk de logs van Cloud Functions in real-time
firebase functions:log
```

Alles in één keer deployen:

```bash
firebase deploy
```

---

## Uitzonderingen en bekende beperkingen

### Configuratiecache (1 uur TTL)

Wijzigingen aan gordels, categorieën, lesgever-types of clubinstellingen zijn pas na maximaal 1 uur zichtbaar voor andere aangemelde gebruikers, tenzij ze een nieuw tabblad openen. De instellingenpagina's (Beheer → Clubdata en Beheer → Instellingen) roepen na opslaan `refreshConfigCache()` aan, zodat de beheerder de wijziging onmiddellijk ziet. Andere gebruikers zien de wijziging pas bij het opnieuw laden van hun cache.

### Rol `assistent` — beperkt vergeleken met `trainer`

De assistent-rol heeft bewust minder rechten dan een trainer:
- Geen schrijfrechten op leden
- Kan zichzelf koppelen als lesgever aan een training, maar kan de training zelf niet aanmaken of verwijderen
- Ontvangt **geen** trainer-herinneringen (behandeld als `lid` voor notificatie-standaardwaarden)
- Kan de deelnemerslijst van examens en wedstrijden niet beheren

### Samengevoegde of inactieve groepen — trainer-herinneringen

Wanneer een groep samengevoegd wordt met een andere groep (bv. U12 en U14 trainen samen), is het normaal dat er geen aparte trainer gekoppeld is aan de subgroep. Zet in dat geval het veld `trainerReminderActief` op `false` via Beheer → Groepen → [groep] → het selectievakje onderaan. De dagelijkse herinnering slaat die groep dan over.

Het veld is standaard **niet aanwezig** bij bestaande groepen, wat gelijkgesteld wordt aan `true` (herinnering actief). Er is dus geen migratie nodig voor bestaande groepen.

### `linkedMemberId` en `linkedUserId` — nooit client-side wijzigen

Deze velden koppelen een Firebase-account aan een lid in de `members`-collectie. Ze worden **uitsluitend** gezet door de Cloud Function `koppelLidViaEmail`, die overeenkomsten op e-mailadres valideert. Client-side wijzigingen worden geblokkeerd door zowel `updateMember` in `firestoreService.js` als de Firestore-beveiligingsregels.

### Gordel-kleuren zijn dynamisch

De kleurcodes voor gordels (wit, geel, oranje, …) zijn niet hardcoded in de broncode maar worden beheerd in Firestore (collectie `gordels`). Componenten zoals Ledenbeheer en LidDetail lezen deze kleuren via de `useGordelOpties`-hook. Als een gordel-document een lege of ontbrekende kleur heeft, valt de app terug op grijs (`#cccccc`). Als de witte gordel ontbreekt in de lijst, wordt automatisch een fallback voor wit toegevoegd.

### Push-meldingen — browserondersteuning

Push-meldingen werken enkel in browsers die de Push API en Service Workers ondersteunen. iOS Safari ondersteunt dit pas volledig vanaf iOS 16.4 (als de app als PWA op het startscherm staat). In andere browsers op iOS (Chrome, Firefox) werken push-meldingen **niet**, omdat Apple geen toegang geeft tot de Push API voor niet-Safari browsers op iOS.

### PWA — manifest en iconen worden gegenereerd bij de build

Het bestand `public/manifest.webmanifest` en de PWA-iconen (`pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon.png`) worden automatisch aangemaakt door de Vite-build. Ze zijn opgenomen in Git zodat ze beschikbaar zijn zonder een build te hoeven draaien. Na een `npm run build` kunnen deze bestanden gewijzigd zijn als `VITE_CLUB_NAAM` of `VITE_THEME_COLOR` veranderd is.

### `settings/club` — publiek leesbaar zonder authenticatie

Dit is een bewuste uitzondering op de beveiligingsregels. De loginpagina heeft de clubnaam en het logo nodig om te tonen voordat een gebruiker ingelogd is. Dit document mag geen gevoelige informatie bevatten.

### Seizoen-berekening

Het seizoen wordt berekend op basis van de `startMaand` in `settings/seizoen` (standaard september, maand 9). Als de huidige maand vóór de startmaand valt, geldt het vorige jaar als startjaar. Voorbeeld: startmaand september, datum = maart 2026 → seizoen = `2025-2026`. Trainingen en inschrijvingen slaan het seizoen op als string in dit formaat.

### E-mail via Trigger Email-extensie

E-mails worden **niet** rechtstreeks verzonden vanuit Cloud Functions. De functie schrijft een document naar de `mail`-collectie; de **Firebase Trigger Email**-extensie leest dit document en verzendt de e-mail via de geconfigureerde SMTP-server. Als de extensie niet geïnstalleerd is of de SMTP-configuratie ontbreekt, blijven e-mails stilzwijgend achter in Firestore zonder te worden verstuurd.

### Synchronisatie van notificatierubrieken

Het bestand `src/notifications/notificationCategories.js` (frontend) en `functions/notifications/categories.js` (backend) definiëren allebei de lijst van rubrieken en standaardwaarden. Ze **moeten** altijd gesynchroniseerd worden. Bij het toevoegen van een nieuwe rubriek moet je **beide bestanden** aanpassen en daarna de Cloud Functions opnieuw deployen.

### Offline-ondersteuning — lezen vs. schrijven

De app ondersteunt offline lezen dankzij de Firestore persistente lokale cache en de Workbox service worker. Schrijfoperaties worden in de wachtrij gezet en uitgevoerd zodra de verbinding hersteld is. De UI toont geen expliciete offline-melding behalve de `ConnectionDot`-indicator (verdwijnt na 3 seconden). Complexe operaties die meerdere documenten aanraken (bv. cascade-delete via Cloud Functions) worden pas uitgevoerd wanneer de verbinding hersteld is.

### Harde verwijdering van leden

Leden worden standaard **zacht verwijderd** (veld `actief: false`). Harde verwijdering is enkel mogelijk voor admins. Na harde verwijdering worden de aanwezigheidsgegevens in de subcollectie `attendance` **niet** automatisch verwijderd — dat vereist een handmatige opruiming of een aparte Cloud Function.

---

## Problemen oplossen

### De "Standaardwaarden importeren"-knop doet niets

- Controleer of je ingelogd bent als `admin` of `bestuurslid`
- Controleer of de Firestore-regels gedeployed zijn: `firebase deploy --only firestore:rules`
- Open de browser-console (F12) en kijk of er een foutmelding staat

### E-mails tonen de verkeerde clubnaam

- Heb je de clubinstellingen ingevuld via Beheer → Clubdata → Club?
- Deploy de Cloud Functions opnieuw: `firebase deploy --only functions`
- Controleer de logs in Firebase Console → Functions

### Trainer kan bepaalde velden van een lid niet opslaan

Dit is correct gedrag. Trainers mogen de volgende velden niet wijzigen:
- Bijdrage betaald / vervaldatum
- Lidnummer
- Vergunningsnummer
- Inschrijvingsjaar

Alleen een bestuurslid of admin kan deze velden aanpassen.

### De onboarding-wizard verschijnt opnieuw voor een bestaand account

Ga in Firestore naar `users/{uid}` en controleer of het veld `onboardingVoltooid` op `true` staat. Als het er niet is, voeg het toe met waarde `true`.

### Push-meldingen werken niet

Controleer in volgorde:

1. **API actief?** Ga naar [console.cloud.google.com](https://console.cloud.google.com) → jouw project → APIs & Services → Library → zoek "Firebase Cloud Messaging API" → controleer of het actief is
2. **VAPID-sleutel correct?** Controleer `VITE_VAPID_KEY` in `.env.local`; dit moet overeenkomen met de sleutel in Firebase Console → Projectinstellingen → Cloud Messaging → Web Push-certificaten
3. **Toestemming gegeven?** Controleer of de gebruiker in de browser toestemming heeft gegeven (Instellingen → Privacy → Meldingen)
4. **Foutmeldingen?** Kijk in Firestore → `pushFailures` voor details over mislukte verzendingen
5. **iOS?** Op iOS werken push-meldingen enkel via Safari, en enkel als de app als PWA geïnstalleerd is op het startscherm (iOS 16.4+)

De fout `messaging/token-subscribe-failed` met "missing required authentication credential" wijst altijd op een FCM API-probleem in Google Cloud Console (punt 1 hierboven), niet op een fout in de applicatiecode.

### De build mislukt na een update

```bash
rm -rf node_modules dist
npm install
npm run build
```

### `npm run build` mislukt met "VITE_APPCHECK_KEY is required"

De buildstap vereist de App Check-sleutel. Voeg de sleutel toe aan `.env.local` of, voor een tijdelijke test:

```bash
VITE_APPCHECK_KEY=dummy npm run build
```

### Cascade-delete werkt niet (subcollecties blijven staan na verwijderen)

Cloud Functions zijn waarschijnlijk niet gedeployed. Voer uit:

```bash
firebase deploy --only functions
```

Controleer daarna in Firebase Console → Functions of de functies zichtbaar zijn.

### Trainer-herinneringen voor een inactieve groep

Stel `trainerReminderActief` in op `false` voor die groep via Beheer → Groepen → [groep selecteren] → vink "Trainer-reminders actief voor deze groep" uit.

### Eerste gebruiker heeft geen admin-rol

Volg Stap 16 opnieuw: ga in Firestore naar de `users`-collectie, open het document van de gebruiker, en stel het veld `rol` handmatig in op `admin`. Ververs daarna de app.

### Configuratiewijzigingen zijn niet direct zichtbaar voor andere gebruikers

Andere gebruikers zien wijzigingen in gordels, categorieën of clubinstellingen pas na 1 uur (of na het openen van een nieuw tabblad), vanwege de sessionStorage-cache. Dit is normaal gedrag. De beheerder die de wijziging maakt, ziet ze onmiddellijk omdat de cache na opslaan automatisch ververst wordt.

---

## Licentie

Dit project is private en ontwikkeld voor intern gebruik door Judo Kodokan Merchtem. Neem contact op met de ontwikkelaar voor gebruik door andere clubs.
