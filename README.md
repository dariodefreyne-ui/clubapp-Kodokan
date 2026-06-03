# Clubapp — Judo Kodokan Merchtem

Een volledige webapplicatie voor het beheer van een judoclub. Leden, trainingen, wedstrijden, examens, financiën, communicatie en bestuur — alles op één plek.

> **Wil je dit gebruiken voor jouw eigen club?** Volg dan het hoofdstuk [Installatie voor een nieuwe club](#installatie-voor-een-nieuwe-club) stap voor stap. Sla geen stap over.

---

## Inhoudsopgave

1. [Wat doet de app?](#wat-doet-de-app)
2. [Technologie](#technologie)
3. [Vereisten](#vereisten)
4. [Installatie voor een nieuwe club](#installatie-voor-een-nieuwe-club)
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
5. [Lokaal ontwikkelen](#lokaal-ontwikkelen)
6. [Functionaliteiten](#functionaliteiten)
7. [Rollen en rechten](#rollen-en-rechten)
8. [Omgevingsvariabelen — volledig overzicht](#omgevingsvariabelen--volledig-overzicht)
9. [Firestore-datastructuur](#firestore-datastructuur)
10. [Cloud Functions](#cloud-functions)
11. [Projectstructuur](#projectstructuur)
12. [Beschikbare scripts](#beschikbare-scripts)
13. [Problemen oplossen](#problemen-oplossen)
14. [Licentie](#licentie)

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

## Technologie

| Laag | Technologie |
|---|---|
| Frontend | React 18, React Router 6, Vite 5 |
| Database | Cloud Firestore (NoSQL, real-time) |
| Authenticatie | Firebase Authentication (e-mail + wachtwoord) |
| Opslag | Firebase Cloud Storage (documenten, logo's) |
| Backend-logica | Firebase Cloud Functions (Node.js 22) |
| Hosting | Firebase Hosting |
| Push-meldingen | Firebase Cloud Messaging (FCM) |
| Beveiliging | Firebase App Check (reCAPTCHA v3) |
| PWA | Vite Plugin PWA + Workbox (offline, installeerbaar) |
| QR-scan | html5-qrcode |
| Excel/CSV | ExcelJS + PapaParse |

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
- `VITE_CLUB_STORAGE_PREFIX`: een korte unieke code zonder spaties, bv. `jcleuven` — wordt gebruikt als mapnaam in Firebase Storage
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
# Vervang "jouw-project-id" door de werkelijke project-ID uit Firebase Console
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

| Rol | Beschrijving | Rechten |
|---|---|---|
| `admin` | Hoofdbeheerder | Volledige toegang, inclusief harde verwijdering en auditlogboek |
| `bestuurslid` | Bestuurslid | Administratieve functies, gebruikersbeheer, geen harde verwijdering |
| `trainer` | Trainer | Trainingen, leden (beperkt), evenementen, aanwezigheid |
| `assistent` | Assistent-trainer | Trainingen bekijken, zichzelf als lesgever koppelen |
| `lid` | Gewoon lid | Eigen profiel, inschrijvingen, publieke informatie |

**Wat trainers NIET mogen wijzigen bij leden:**
- Bijdrage betaald/vervaldatum
- Lidnummer
- Vergunningsnummer
- Inschrijvingsjaar

Deze velden zijn enkel aanpasbaar door bestuurders en admins.

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
| `VITE_CLUB_STORAGE_PREFIX` | Mapnaam in Firebase Storage | Zelf kiezen (geen spaties) |
| `VITE_THEME_COLOR` | Primaire kleur (hex) | Zelf kiezen, bv. `#1A56A4` |

---

## Firestore-datastructuur

De database is opgebouwd uit de volgende hoofdcollecties:

| Collectie | Inhoud |
|---|---|
| `users` | Gebruikersprofielen (gekoppeld aan Firebase Auth) |
| `members` | Leden/judoka's |
| `groepen` | Leeftijdsgroepen (U7, U9, …) |
| `trainingen` | Trainingen per groep en seizoen |
| `technieken` | Judo-technieken databank |
| `events` | Wedstrijden en examens |
| `evenementen` | Clubactiviteiten |
| `examens` | Examens met kandidaten |
| `products` | Merchandise en voorraad |
| `sales` | Verkoophistoriek |
| `communications` | Verzonden e-mails |
| `documents` | Gedeelde bestanden |
| `lesgevers` | Lesgeverprofielen met financiële info |
| `tarieven` | Uurloon en km-vergoeding per type |
| `uitbetalingsperiodes` | Uitbetalingsperiodes |
| `categorieen` | Leeftijdscategorieën (configureerbaar) |
| `gordels` | Gordels/KYU-niveaus (configureerbaar) |
| `lesgeverTypes` | Types lesgevers (configureerbaar) |
| `mailTemplates` | E-mailtemplates |
| `settings/club` | Clubinstellingen |
| `settings/seizoen` | Seizoensinstellingen |
| `auditLogs` | Logboek van alle wijzigingen |
| `bestuursVergaderingen` | Bestuursvergaderingen (vertrouwelijk) |
| `bestuursActiepunten` | Actiepunten bestuur (vertrouwelijk) |
| `bestuursDocumenten` | Bestuursdocumenten (vertrouwelijk) |
| `notificationTokens` | Push-meldingstokens per apparaat |
| `pushFailures` | Mislukte push-meldingen (voor debugging) |

**Subcollecties:**

- `members/{id}/attendance/{datum}` — Aanwezigheidsregistraties
- `trainingen/{id}/technieken/{id}` — Technieken per training
- `trainingen/{id}/beschikbaarheid/{uid}` — Trainerbeschikbaarheid
- `events/{id}/registrations/{memberId}` — Deelnemers per evenement

---

## Cloud Functions

De volgende server-side functies draaien automatisch:

| Functie | Wanneer | Wat |
|---|---|---|
| `verwijderEventSubcollecties` | Wedstrijd/examen verwijderd | Verwijdert alle subcollecties (inschrijvingen, …) |
| `verwijderInschrijvingenBijEvent` | Evenement verwijderd | Verwijdert alle inschrijvingen |
| `auditLog_members` | Lid aangemaakt/gewijzigd/verwijderd | Schrijft naar `auditLogs` |
| `auditLog_users` | Gebruiker gewijzigd | Schrijft naar `auditLogs` |
| `auditLog_trainingen` | Training gewijzigd | Schrijft naar `auditLogs` |
| `auditLog_events` | Evenement gewijzigd | Schrijft naar `auditLogs` |
| `notifyStockZero` | Stock van product op 0 | Stuurt push-melding en e-mail |
| `verwerkPushTrigger` | Push-melding mislukt | Logt naar `pushFailures` |
| `verzendTrainerHerinneringAuto` | Elke dag (scheduled) | Stuurt herinnering aan trainers |

---

## Projectstructuur

```
clubapp-kodokan/
├── .env.example              # Voorbeeld van omgevingsvariabelen (kopieer naar .env.local)
├── .firebaserc               # Firebase-projectkoppeling
├── firebase.json             # Firebase CLI-configuratie
├── firestore.rules           # Beveiligingsregels voor de database
├── firestore.indexes.json    # Database-indexen
├── storage.rules             # Beveiligingsregels voor bestanden
├── vite.config.js            # Build-configuratie
├── index.html                # Startpagina (PWA)
├── package.json              # Frontend-afhankelijkheden en scripts
├── public/                   # Statische bestanden (iconen, manifest)
├── src/
│   ├── App.jsx               # Hoofdrouting en navigatie
│   ├── firebase.js           # Firebase-initialisatie
│   ├── config/               # Centrale configuratie (rollen, collectienamen, …)
│   ├── contexts/             # React-contexten (auth, groepen, lesgevers, …)
│   ├── hooks/                # Herbruikbare React-hooks
│   ├── pages/                # Alle paginacomponenten
│   ├── components/           # Herbruikbare UI-componenten
│   ├── services/             # Firestore CRUD-helpers
│   ├── notifications/        # Push-meldingen en e-mail
│   ├── utils/                # Hulpfuncties (datums, seizoen, …)
│   └── styles/               # Design-tokens en CSS
└── functions/
    ├── index.js              # Alle Cloud Functions
    ├── mailHtmlBuilder.js    # HTML-e-mailbouwer
    ├── mailTemplateStore.js  # E-mailtemplates
    └── notifications/        # Push-meldingslogica
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

# Bekijk de logs van Cloud Functions
firebase functions:log
```

Alles in één keer deployen:

```bash
firebase deploy
```

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

- Controleer of `VITE_VAPID_KEY` correct ingevuld is in `.env.local`
- Controleer of de gebruiker toestemming heeft gegeven voor meldingen in de browser
- Kijk in de Firestore-collectie `pushFailures` voor foutmeldingen

### De build mislukt na een update

```bash
rm -rf node_modules dist
npm install
npm run build
```

### Cascade-delete werkt niet (subcollecties blijven staan na verwijderen)

Cloud Functions zijn waarschijnlijk niet gedeployed. Voer uit:

```bash
firebase deploy --only functions
```

Controleer daarna in Firebase Console → Functions of de functies zichtbaar zijn.

### Eerste gebruiker heeft geen admin-rol

Volg Stap 16 opnieuw: ga in Firestore naar de `users`-collectie, open het document van de gebruiker, en stel het veld `rol` handmatig in op `admin`. Ververs daarna de app.

---

## Licentie

Dit project is private en ontwikkeld voor intern gebruik door Judo Kodokan Merchtem. Neem contact op met de ontwikkelaar voor gebruik door andere clubs.
