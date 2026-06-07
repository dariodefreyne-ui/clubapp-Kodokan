# Clubapp — Judo Kodokan Merchtem

Een volledige webapplicatie voor het beheer van een judoclub. Leden, trainingen, wedstrijden, examens, financiën, communicatie en bestuur — alles op één plek, bereikbaar via browser en installeerbaar als PWA op telefoon en tablet.

> **Wil je dit gebruiken voor jouw eigen club?** Volg dan het hoofdstuk [Installatie voor een nieuwe club](#4-installatie-voor-een-nieuwe-club) stap voor stap. Je hebt **geen technische kennis of lokale software** nodig — alles verloopt via de browser, de Firebase-console en GitHub.

---

## Inhoudsopgave

1. [Wat doet de app?](#1-wat-doet-de-app)
2. [Technologie](#2-technologie)
3. [Vereisten](#3-vereisten)
4. [Installatie voor een nieuwe club](#4-installatie-voor-een-nieuwe-club)
   - [Overzicht van de stappen](#overzicht-van-de-stappen)
   - [Stap 1 — Google-account en Blaze-plan](#stap-1--google-account-en-blaze-plan)
   - [Stap 2 — Firebase-project aanmaken](#stap-2--firebase-project-aanmaken)
   - [Stap 3 — Web-app registreren en configuratiesleutels ophalen](#stap-3--web-app-registreren-en-configuratiesleutels-ophalen)
   - [Stap 4 — Firestore Database opstarten](#stap-4--firestore-database-opstarten)
   - [Stap 5 — Authentication activeren](#stap-5--authentication-activeren)
   - [Stap 6 — Firebase Storage activeren](#stap-6--firebase-storage-activeren)
   - [Stap 7 — Firebase Hosting activeren](#stap-7--firebase-hosting-activeren)
   - [Stap 8 — App Check en reCAPTCHA v3](#stap-8--app-check-en-recaptcha-v3)
   - [Stap 9 — VAPID-sleutel voor push-meldingen](#stap-9--vapid-sleutel-voor-push-meldingen)
   - [Stap 10 — Service account aanmaken en downloaden](#stap-10--service-account-aanmaken-en-downloaden)
   - [Stap 11 — IAM-rechten controleren](#stap-11--iam-rechten-controleren)
   - [Stap 12 — Repository forken op GitHub](#stap-12--repository-forken-op-github)
   - [Stap 13 — GitHub Secrets instellen](#stap-13--github-secrets-instellen)
   - [Stap 14 — Project-ID aanpassen in de repository](#stap-14--project-id-aanpassen-in-de-repository)
   - [Stap 15 — Eerste deploy uitvoeren via GitHub Actions](#stap-15--eerste-deploy-uitvoeren-via-github-actions)
   - [Stap 16 — Eerste login, admin-rol instellen en clubdata invullen](#stap-16--eerste-login-admin-rol-instellen-en-clubdata-invullen)
   - [Verificatiechecklist](#verificatiechecklist)
5. [Hoe werkt de automatische deploy?](#5-hoe-werkt-de-automatische-deploy)
6. [PWA — installeren op telefoon of tablet](#6-pwa--installeren-op-telefoon-of-tablet)
7. [Lokaal ontwikkelen (optioneel)](#7-lokaal-ontwikkelen-optioneel)
8. [Functionaliteiten](#8-functionaliteiten)
9. [Rollen en rechten](#9-rollen-en-rechten)
10. [GitHub Secrets — volledig overzicht](#10-github-secrets--volledig-overzicht)
11. [Firestore-datastructuur](#11-firestore-datastructuur)
12. [Cloud Functions](#12-cloud-functions)
13. [Beveiligingsarchitectuur](#13-beveiligingsarchitectuur)
14. [Projectstructuur](#14-projectstructuur)
15. [Architectuur-cheat-sheet](#15-architectuur-cheat-sheet)
16. [Hoe nieuwe configureerbare data toevoegen?](#16-hoe-nieuwe-configureerbare-data-toevoegen)
17. [Bekende beperkingen](#17-bekende-beperkingen)
18. [Problemen oplossen](#18-problemen-oplossen)
19. [Licentie](#19-licentie)

---

## 1. Wat doet de app?

| Module | Wat je ermee kan |
|---|---|
| **Ledenbeheer** | Leden toevoegen via wizard of CSV-import, profielen beheren, gordels en groepen bijhouden, bijdragen opvolgen, medische info en noodcontacten opslaan, leden koppelen aan een account, deactiveren of definitief verwijderen |
| **Trainingen** | Trainingsschema per groep en seizoen opstellen, aanwezigheid registreren via QR-scan (trainer-modus), technieken per les vastleggen, lesgeverbeschikbaarheid registreren |
| **Technieken** | Databank van judo-technieken per categorie en KYU-niveau, met kleurcoding per gordel, beheerbaar via Beheer |
| **Wedstrijden** | Toernooien aanmaken, deelnemers registreren, resultaten bijhouden, deelnemerslijst importeren via Excel |
| **Examens** | Examenwizard: kandidaten koppelen, resultaten bijhouden, rapport genereren |
| **Evenementen** | Clubactiviteiten aanmaken en inschrijvingen beheren |
| **Events (unified)** | Gecombineerd overzicht van wedstrijden, examens en evenementen met type-tabs en zoek/filter |
| **Agenda** | Maand- en weekoverzicht van alle activiteiten |
| **Klassement** | Clubranking en competitie-overzicht |
| **Winkel** | Merchandisebeheer, kassa, voorraadbeheer, verkoopoverzicht en openstaande schulden; automatische melding bij lage of nul-voorraad |
| **Eetfestijn** | Beheer van clubmaaltijden en inschrijvingen |
| **Uitbetalingen** | Lesgeversvergoedingen berekenen en exporteren op basis van uurloon en km-vergoeding per lesgever-type |
| **Communicatie** | Bulk-e-mails met aanpasbare templates en variabele-substitutie |
| **Documenten** | Bestanden uploaden en delen met clubleden |
| **Rapporten** | Aanwezigheid, examens, leden, lesgevers, trainingen, verkoop en voorraad in 8 tabbladen, exporteerbaar naar Excel |
| **Bestuur** | Bestuursvergaderingen, actiepunten en vertrouwelijke documenten (alleen voor bestuurders) |
| **Beheer** | Clubinstellingen, gebruikersbeheer, configureerbare lijsten (gordels, categorieën, lesgever-types, tarieven, mail-templates), auditlogboek, push-meldingsinstellingen, paginatoegang per rol |

---

## 2. Technologie

| Laag | Technologie | Versie |
|---|---|---|
| Frontend framework | React + React Router | 18.3 / 6.28 |
| Build tool | Vite | 5.4 |
| Database | Cloud Firestore (NoSQL, real-time) | — |
| Authenticatie | Firebase Authentication | — |
| Bestandsopslag | Firebase Cloud Storage | — |
| Backend-logica | Firebase Cloud Functions v2 | Node.js 22 |
| Hosting | Firebase Hosting | — |
| Push-meldingen | Firebase Cloud Messaging (FCM) | — |
| Beveiliging | Firebase App Check + reCAPTCHA v3 | — |
| PWA / offline | Vite Plugin PWA + Workbox | 0.20 / 7 |
| CSV-import | PapaParse | 5.4 |
| Excel-export | ExcelJS | 4.4 |
| QR-scanner | html5-qrcode | 2.3 |
| CI/CD | GitHub Actions | — |

**Kernafhankelijkheden frontend:**

```
firebase ^10.14 · react ^18.3 · react-dom ^18.3 · react-router-dom ^6.28
exceljs ^4.4 · html5-qrcode ^2.3 · papaparse ^5.4 · qrcode ^1.5 · date-fns ^3.2
```

**Kernafhankelijkheden Cloud Functions:**

```
firebase-admin ^13.0 · firebase-functions ^6.0
```

---

## 3. Vereisten

Je hebt **geen** programmeerkennis of lokale software nodig. Alles verloopt via de browser.

| Wat | Waarvoor |
|---|---|
| **Google-account** | Firebase Console en Google Cloud |
| **Betaalmethode gekoppeld aan Google** | Blaze-plan activeren op Firebase (vereist voor Cloud Functions) |
| **GitHub-account** | Repository forken en secrets instellen |

Dat is alles. Geen Node.js installeren, geen terminal, geen Firebase CLI op je computer.

---

## 4. Installatie voor een nieuwe club

> Voer de stappen **in volgorde** uit. Elke stap is nodig voor de volgende.

---

### Overzicht van de stappen

```
Firebase Console                    GitHub
────────────────────────────────    ────────────────────────────────────
1. Google-account + Blaze-plan      12. Repository forken
2. Firebase-project aanmaken        13. Secrets instellen (sleutels)
3. Web-app registreren              14. Project-ID aanpassen in bestanden
4. Firestore opstarten              15. Eerste deploy starten
5. Authentication activeren         16. Eerste login + admin-rol instellen
6. Storage activeren
7. Hosting activeren
8. App Check + reCAPTCHA
9. VAPID-sleutel genereren
10. Service account downloaden
11. IAM-rechten controleren
```

---

### Stap 1 — Google-account en Blaze-plan

Cloud Functions vereisen het **Blaze-betaalplan** van Firebase. Dit is betalen per gebruik — voor een kleine club normaal minder dan €5/maand. Je betaalt niets als de app niet gebruikt wordt.

**1.1 — Betaalmethode koppelen**

1. Ga naar [myaccount.google.com](https://myaccount.google.com)
2. Klik in het menu op **Betalingen en abonnementen**
3. Controleer of er een betaalmethode is. Zo niet: klik op **Betaalmethode toevoegen**

**1.2 — Blaze-plan activeren** *(doe dit zodra je project aangemaakt is in Stap 2)*

1. Open [console.firebase.google.com](https://console.firebase.google.com) → jouw project
2. Klik **linksonder** op het huidige plan (staat op "Spark")
3. Klik op **Upgraden** → kies **Blaze — Betalen per gebruik**
4. Optioneel: stel een **budgetlimiet** in (bv. €10/maand) zodat je nooit verrast wordt

---

### Stap 2 — Firebase-project aanmaken

1. Ga naar [console.firebase.google.com](https://console.firebase.google.com)
2. Klik op **"Een project toevoegen"**
3. Vul een projectnaam in, bv. `clubapp-mijnclub`
   - Firebase genereert automatisch een unieke **project-ID**, bv. `clubapp-mijnclub-a1b2`
   - **Noteer deze project-ID.** Je hebt hem later nodig in Stap 13 en 14.
4. Klik op **Doorgaan**
5. Google Analytics: kies zelf of je dit wil. Klik op **Doorgaan**
6. Klik op **Project maken** en wacht tot het aangemaakt is
7. Klik op **Doorgaan**

---

### Stap 3 — Web-app registreren en configuratiesleutels ophalen

**3.1 — Web-app toevoegen**

1. Klik op het **tandwiel-icoontje** naast "Project overview" → **Projectinstellingen**
2. Scroll naar de sectie **"Jouw apps"**
3. Klik op het **`</>`**-icoontje (web-app)
4. Vul bij "App-bijnaam" iets in, bv. `clubapp-web`
5. Vink **"Firebase Hosting ook voor deze app instellen"** aan
6. Klik op **App registreren**

**3.2 — Sleutels kopiëren**

Je ziet nu een code-blok. Kopieer alle waarden naar een tijdelijk tekstdocument — je hebt ze nodig in Stap 13.

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",                          → VITE_FB_API_KEY
  authDomain: "jouw-project-id.firebaseapp.com", → VITE_FB_AUTH_DOMAIN
  projectId: "jouw-project-id",                 → VITE_FB_PROJECT_ID
  storageBucket: "jouw-project-id.appspot.com", → VITE_FB_STORAGE_BUCKET
  messagingSenderId: "123456789012",            → VITE_FB_MESSAGING_SENDER_ID
  appId: "1:123:web:abc",                       → VITE_FB_APP_ID
  measurementId: "G-XXXXXXXXXX"                 → VITE_FB_MEASUREMENT_ID
};
```

7. Klik op **Doorgaan naar console**

---

### Stap 4 — Firestore Database opstarten

1. Klik in het linkermenu op **Build** → **Firestore Database**
2. Klik op **Database maken**
3. Kies **Productiemodus** → klik op **Volgende**
4. Kies locatie `europe-west1` (of dichtstbijzijnde Europese regio)
   > Kies **dezelfde regio** als voor Storage in Stap 6 — dit kan later niet meer gewijzigd worden
5. Klik op **Activeren** en wacht

Je ziet nu een lege database. Dit is correct.

---

### Stap 5 — Authentication activeren

1. Klik in het linkermenu op **Build** → **Authentication**
2. Klik op **Aan de slag**
3. Klik op het tabblad **Aanmeldingsmethode**
4. Klik op **E-mail/wachtwoord**
5. Zet de **eerste schakelaar** op **Aan**
6. Laat de tweede schakelaar ("E-maillink") **uit**
7. Klik op **Opslaan**

---

### Stap 6 — Firebase Storage activeren

1. Klik in het linkermenu op **Build** → **Storage**
2. Klik op **Aan de slag**
3. Kies **Productiemodus** → klik op **Volgende**
4. Kies **dezelfde regio** als bij Firestore in Stap 4 (`europe-west1`)
5. Klik op **Gereed**

---

### Stap 7 — Firebase Hosting activeren

Als je in Stap 3 het vakje "Firebase Hosting instellen" aangevinkt had, is dit al gedaan.

Controleer:
1. Klik in het linkermenu op **Build** → **Hosting**
2. Je ziet een webadres zoals `jouw-project-id.web.app` — dit wordt het adres van jouw app

---

### Stap 8 — App Check en reCAPTCHA v3

App Check beschermt de database tegen ongeautoriseerde toegang van buitenaf.

**8.1 — reCAPTCHA v3-site registreren**

1. Ga naar [google.com/recaptcha/admin/create](https://www.google.com/recaptcha/admin/create) *(open in een nieuw tabblad)*
2. Vul het formulier in:
   - **Label**: `clubapp-mijnclub`
   - **reCAPTCHA type**: selecteer **reCAPTCHA v3**
   - **Domeinen**: voeg de volgende drie domeinen toe (typ elk in en druk op Enter):
     - `jouw-project-id.web.app`
     - `jouw-project-id.firebaseapp.com`
     - `localhost`
3. Vink de gebruiksvoorwaarden aan
4. Klik op **Verzenden**
5. Je ziet twee sleutels — kopieer de **Sitesleutel** (begint met `6L...`) naar je tijdelijk tekstdocument
   - Dit wordt `VITE_APPCHECK_KEY` in Stap 13

**8.2 — App Check koppelen in Firebase**

1. Ga terug naar Firebase Console → **Build** → **App Check**
2. Klik op het tabblad **Apps** → klik op jouw web-app
3. Selecteer **reCAPTCHA v3** als provider
4. Plak de sitesleutel in het veld
5. Klik op **Opslaan**

---

### Stap 9 — VAPID-sleutel voor push-meldingen

1. Ga naar het **tandwiel** → **Projectinstellingen**
2. Klik op het tabblad **Cloud Messaging**
3. Scroll naar beneden naar **"Web Push-certificaten"**
4. Klik op **Sleutelpaar genereren**
5. Er verschijnt een lange sleutel (~88 tekens) — kopieer deze naar je tijdelijk tekstdocument
   - Dit wordt `VITE_VAPID_KEY` in Stap 13

> Genereer dit sleutelpaar slechts eenmalig. Een nieuw sleutelpaar maakt alle bestaande push-abonnementen ongeldig.

---

### Stap 10 — Service account aanmaken en downloaden

Het service account geeft GitHub Actions de rechten om namens jou te deployen naar Firebase — zonder dat je ooit een wachtwoord in GitHub hoeft in te voeren.

1. Ga naar het **tandwiel** → **Projectinstellingen**
2. Klik op het tabblad **Serviceaccounts**
3. Klik op de knop **Nieuwe privésleutel genereren**
4. Bevestig de waarschuwing door nogmaals op **Sleutel genereren** te klikken
5. Er wordt een `.json`-bestand gedownload naar je computer, bv. `jouw-project-id-firebase-adminsdk-xxxxx.json`

**Bewaar dit bestand veilig.** Je hebt de inhoud nodig in Stap 13. Dit bestand geeft volledige toegang tot jouw Firebase-project — deel het nooit publiek.

**Wat bevat dit bestand?**

```json
{
  "type": "service_account",
  "project_id": "jouw-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\n...",
  "client_email": "firebase-adminsdk-xxxxx@jouw-project-id.iam.gserviceaccount.com",
  "client_id": "...",
  ...
}
```

---

### Stap 11 — IAM-rechten controleren

Firebase regelt de meeste rechten automatisch. In uitzonderlijke gevallen (bv. bij een nieuw Google Cloud-account) moet je bepaalde API's manueel activeren.

**11.1 — Vereiste API's activeren**

1. Ga naar [console.cloud.google.com/apis/library](https://console.cloud.google.com/apis/library)
2. Selecteer rechtsboven jouw project
3. Zoek en activeer de volgende API's als ze nog niet actief zijn:

| API | Waarvoor |
|---|---|
| **Cloud Build API** | Vereist om Cloud Functions te bouwen en deployen |
| **Artifact Registry API** | Vereist voor Cloud Functions v2 (container images) |
| **Cloud Functions API** | De Functions-dienst zelf |
| **Firebase Cloud Messaging API** | Push-meldingen |

Activeer elke API door erop te klikken → **Inschakelen**. Wacht telkens tot de pagina "Ingeschakeld" toont.

**11.2 — IAM-rollen voor het service account**

1. Ga naar [console.cloud.google.com/iam-admin/iam](https://console.cloud.google.com/iam-admin/iam)
2. Controleer of het service account `firebase-adminsdk-xxxxx@jouw-project-id.iam.gserviceaccount.com` aanwezig is
3. Het moet de rol **Firebase Admin SDK Administrator Service Agent** hebben

Normaal is dit automatisch correct. Als de rol ontbreekt:
1. Klik op het potlood-icoontje naast het service account
2. Klik op **Andere rol toevoegen**
3. Zoek op `Firebase Admin SDK` en selecteer de rol
4. Klik op **Opslaan**

**11.3 — Blaze-plan activeren** *(als je dit nog niet gedaan hebt in Stap 1.2)*

Firebase Console → links onderaan → huidig plan → **Upgraden naar Blaze**

---

### Stap 12 — Repository forken op GitHub

1. Ga naar de GitHub-repository van dit project
2. Klik rechtsboven op de knop **Fork**
3. Kies jouw eigen GitHub-account als bestemming
4. Geef de fork eventueel een andere naam, bv. `clubapp-mijnclub`
5. Klik op **Create fork**

Je hebt nu een eigen kopie van de volledige code onder jouw GitHub-account. Alle wijzigingen die je later doorvoert, gebeuren in jouw fork — niet in het origineel.

---

### Stap 13 — GitHub Secrets instellen

GitHub Secrets zijn versleutelde sleutels die GitHub Actions kan lezen tijdens een deploy. Ze staan **nooit** in de code en zijn voor niemand zichtbaar — ook niet voor de eigenaar van het account na het opslaan.

**Hoe secrets toevoegen:**

1. Ga naar jouw geforkte repository op GitHub
2. Klik op het tabblad **Settings** (tandwiel-icoontje)
3. Klik in het linkermenu op **Secrets and variables** → **Actions**
4. Klik op de knop **New repository secret**
5. Vul de naam in en de waarde, klik op **Add secret**

Herhaal dit voor elk secret hieronder.

---

#### Secret 1 — `FIREBASE_PROJECT_ID`

- **Naam**: `FIREBASE_PROJECT_ID`
- **Waarde**: jouw Firebase project-ID, bv. `clubapp-mijnclub-a1b2`

Je project-ID is zichtbaar in de URL van de Firebase-console:
`https://console.firebase.google.com/project/`**`jouw-project-id`**`/overview`

---

#### Secret 2 — `FIREBASE_SERVICE_ACCOUNT`

- **Naam**: `FIREBASE_SERVICE_ACCOUNT`
- **Waarde**: de volledige inhoud van het `.json`-bestand dat je gedownload hebt in Stap 10

**Hoe:**
1. Open het gedownloade `.json`-bestand met een teksteditor (Kladblok op Windows, TextEdit op Mac)
2. Selecteer **alle tekst** (Ctrl+A of Cmd+A)
3. Kopieer (Ctrl+C of Cmd+C)
4. Plak de tekst als waarde van het secret

De waarde begint met `{` en eindigt met `}` en bevat meerdere regels.

---

#### Secret 3 — `ENV_LOCAL`

Dit secret bevat alle omgevingsvariabelen van de app — het equivalent van een lokaal `.env.local`-bestand.

- **Naam**: `ENV_LOCAL`
- **Waarde**: kopieer de onderstaande template en vervang elke waarde:

```
VITE_FB_API_KEY=plak-hier-jouw-apiKey
VITE_FB_AUTH_DOMAIN=jouw-project-id.firebaseapp.com
VITE_FB_PROJECT_ID=jouw-project-id
VITE_FB_STORAGE_BUCKET=jouw-project-id.appspot.com
VITE_FB_MESSAGING_SENDER_ID=plak-hier-jouw-messagingSenderId
VITE_FB_APP_ID=plak-hier-jouw-appId
VITE_FB_MEASUREMENT_ID=plak-hier-jouw-measurementId
VITE_VAPID_KEY=plak-hier-jouw-vapid-sleutel
VITE_APPCHECK_KEY=plak-hier-jouw-recaptcha-sitesleutel
VITE_CLUB_NAAM=Judo Club Mijnstad
VITE_CLUB_NAAM_KORT=JC Mijnstad
VITE_CLUB_STORAGE_PREFIX=mijnclub
VITE_THEME_COLOR=#E63346
```

| Variabele | Waarde ophalen via |
|---|---|
| `VITE_FB_API_KEY` t.e.m. `VITE_FB_APP_ID` | Firebase Console → Projectinstellingen → Jouw apps (Stap 3.2) |
| `VITE_FB_MEASUREMENT_ID` | idem (laat leeg als Analytics uitgeschakeld) |
| `VITE_VAPID_KEY` | Stap 9 |
| `VITE_APPCHECK_KEY` | Stap 8 — de reCAPTCHA **Sitesleutel** |
| `VITE_CLUB_NAAM` | Volledige naam van jouw club |
| `VITE_CLUB_NAAM_KORT` | Korte naam (in de navigatiebalk en PWA) |
| `VITE_CLUB_STORAGE_PREFIX` | Zelf kiezen — **geen spaties**, bv. `jcleuven` |
| `VITE_THEME_COLOR` | Primaire kleur van de club in hexadecimaal, bv. `#1A56A4` |

**Verificatie:** je hebt nu drie secrets aangemaakt:

| Naam | Status |
|---|---|
| `FIREBASE_PROJECT_ID` | ✓ |
| `FIREBASE_SERVICE_ACCOUNT` | ✓ |
| `ENV_LOCAL` | ✓ |

---

### Stap 14 — Project-ID aanpassen in de repository

Er is één bestand in de code dat het project-ID van het origineel bevat en dat je moet aanpassen voor jouw club: `.firebaserc`.

**Via de GitHub-webinterface:**

1. Ga naar jouw geforkte repository
2. Klik op het bestand `.firebaserc` in de bestandslijst
3. Klik op het **potlood-icoontje** (Edit this file) rechtsboven
4. Je ziet:
   ```json
   {
     "projects": {
       "default": "club-app-kodokan-merchtem"
     }
   }
   ```
5. Vervang `club-app-kodokan-merchtem` door **jouw project-ID** (uit Stap 2), bv.:
   ```json
   {
     "projects": {
       "default": "clubapp-mijnclub-a1b2"
     }
   }
   ```
6. Scroll naar beneden naar **"Commit changes"**
7. Vul een korte beschrijving in, bv. `Project-ID bijgewerkt voor mijnclub`
8. Kies **"Commit directly to the `main` branch"**
9. Klik op **Commit changes**

> Deze commit triggert automatisch de eerste deploy via GitHub Actions. Ga snel naar Stap 15 om de voortgang te bekijken.

---

### Stap 15 — Eerste deploy uitvoeren via GitHub Actions

De commit in Stap 14 start automatisch de GitHub Actions workflow. Deze bouwt de app en deployt alles naar Firebase.

**15.1 — Voortgang bekijken**

1. Ga naar jouw GitHub-repository
2. Klik op het tabblad **Actions**
3. Je ziet een workflow-run bovenaan met de naam "Deploy to Firebase"
4. Klik erop om de details te zien
5. Je ziet de stappen doorlopen. Dit duurt **5–10 minuten** bij de eerste run.

**15.2 — Wat deployt de workflow?**

De workflow voert de volgende stappen uit in volgorde:

1. Code ophalen (checkout)
2. Node.js 22 instellen
3. Frontend-afhankelijkheden installeren (`npm install`)
4. `.env.local` aanmaken vanuit het `ENV_LOCAL` secret
5. App bouwen (`npm run build`) — inclusief PWA-manifest en service worker
6. Firebase service account instellen
7. Firebase CLI installeren
8. Functions-afhankelijkheden installeren
9. Firestore-regels deployen
10. Firestore-indexen deployen
11. Storage-regels deployen
12. Cloud Functions deployen
13. Hosting deployen (de gebouwde app)

**15.3 — Succesvolle deploy herkennen**

Een groene vinkje naast de workflow-run betekent: de app is online. Je ziet aan het einde van de logs een URL zoals:
```
Hosting URL: https://jouw-project-id.web.app
```

**15.4 — Wat als de deploy mislukt?**

Klik op de mislukte stap (rode ×) om de foutmelding te lezen.

| Foutmelding | Oplossing |
|---|---|
| `Error: HTTP Error: 403` of `PERMISSION_DENIED` | Blaze-plan niet actief — zie Stap 1.2 |
| `Could not load the default credentials` | `FIREBASE_SERVICE_ACCOUNT` secret incorrect — controleer of de volledige JSON gekopieerd is |
| `Error: Unknown project id` | `FIREBASE_PROJECT_ID` secret incorrect of `.firebaserc` niet bijgewerkt |
| `Cloud Build API has not been used` | Activeer de Cloud Build API in Google Cloud Console (Stap 11.1) |
| `Artifact Registry API has not been used` | Activeer de Artifact Registry API in Google Cloud Console (Stap 11.1) |
| `npm ERR!` | Dependency-probleem — zie [Problemen oplossen](#18-problemen-oplossen) |

Na het oplossen van een probleem: ga naar **Actions** → klik op de mislukte run → klik op **Re-run all jobs**.

---

### Stap 16 — Eerste login, admin-rol instellen en clubdata invullen

**16.1 — Eerste account aanmaken**

1. Ga naar `https://jouw-project-id.web.app`
2. Klik op **"Nog geen account? Registreer je"**
3. Vul je e-mailadres en een wachtwoord in (min. 6 tekens)
4. Klik op **Registreren**
5. Doorloop de **onboarding-wizard** (4 stappen: welkom → persoonlijke info → clubinfo → meldingsvoorkeuren)

Na de wizard ben je ingelogd als gewoon **lid** zonder beheersrechten.

**16.2 — Jezelf admin maken via Firestore Console**

Dit is een éénmalige manuele stap via de Firebase-console.

1. Ga naar [console.firebase.google.com](https://console.firebase.google.com) → jouw project
2. Klik in het linkermenu op **Firestore Database**
3. Klik in de collectielijst op **`users`**
4. Klik op het document van jouw account (er staat maar één document)
5. Zoek het veld **`rol`** — de waarde is waarschijnlijk `lid`
6. Klik op het **potlood-icoontje** naast de waarde
7. Verander de waarde naar `admin`
8. Klik op het **vinkje** om op te slaan

9. Wacht **1–2 minuten** en ververs daarna de app (`F5` of `Cmd+R`)
10. Log opnieuw in als de app dat vraagt

Na het verversen zie je extra menu-items: **Beheer**, **Bestuur**, **Rapporten**, enz.

**16.3 — Clubdata invullen**

1. Ga in de app naar **Beheer** → sectie **Club** → tabblad **Clubinstellingen**
2. Vul in: naam, korte naam, contact-e-mailadres, logo (optioneel via Firebase Storage URL)
3. Klik op **Opslaan**

4. Ga naar sectie **Clubdata**
5. In elk tabblad staat een blauwe banner "Deze lijst is nog leeg" — klik op **"Standaardwaarden importeren"** in:
   - **Leeftijdscategorieën** — U7 t.e.m. Senior (10 items)
   - **Gordels / KYU** — wit t.e.m. zwart (7 items)
   - **Lesgever-types** — Aspirant t.e.m. Trainer A (4 items)
   - **Communicatie-categorieën** (6 items)
   - **Techniek-categorieën** (5 items: val, worpen, grondtechnieken, ...)

6. Ga naar tabblad **Uitbetalingstarieven** en vul handmatig in:
   - Uurloon per lesgever-type (bv. Trainer A: €15/uur)
   - Km-vergoeding (bv. €0,21/km)

7. Ga naar tabblad **Seizoen** en controleer de startmaand (standaard: september)

**De app is klaar voor gebruik.**

---

### Verificatiechecklist

- [ ] App opent op `https://jouw-project-id.web.app` zonder foutmeldingen
- [ ] Inloggen lukt met het account aangemaakt in Stap 16
- [ ] Menu toont **Beheer**, **Bestuur** en **Rapporten** (admin-menu-items)
- [ ] Beheer → Clubdata toont de geïmporteerde lijsten
- [ ] **Leden** → **+ Nieuw lid** → wizard opent (3 stappen)
- [ ] **Trainingen** → **Nieuwe training** → formulier opent
- [ ] **Beheer** → **Logboek** → auditlogs zijn zichtbaar
- [ ] App werkt correct op smartphone-browser (menu schuift open via hamburger-knop)
- [ ] GitHub Actions → tabblad Actions → laatste run heeft een groen vinkje
- [ ] Push-meldingstoegang aanvragen in browser → melding ontvangen bij testactie

---

## 5. Hoe werkt de automatische deploy?

Elke keer dat je een wijziging in de code doorvoert naar de `main`-branch op GitHub, start automatisch een deploy. Je hoeft zelf nooit een terminal te openen.

```
Jij past een bestand aan via GitHub webeditor
           │
           ▼
    Commit naar main (of Main)
           │
           ▼
  GitHub Actions start (deploy.yml)
           │
    ┌──────┴──────────────────────┐
    │  1. Code ophalen            │
    │  2. Node.js 22 instellen    │
    │  3. npm install             │
    │  4. .env.local aanmaken     │  ← uit secret ENV_LOCAL
    │  5. npm run build           │  ← Vite + VitePWA injectManifest
    │  6. Service account setup   │  ← uit secret FIREBASE_SERVICE_ACCOUNT
    │  7. Firebase CLI installeren│
    │  8. Functions npm install   │
    │  9. Deploy firestore:rules  │  ← firestore.rules
    │  10. Deploy firestore:indexes│ ← firestore.indexes.json
    │  11. Deploy storage rules   │  ← storage.rules
    │  12. Deploy functions       │  ← functions/index.js
    │  13. Deploy hosting         │  ← dist/
    └─────────────────────────────┘
           │
           ▼
  App is live op web.app
```

**Handmatige deploy starten** (zonder code te wijzigen):

1. Ga naar GitHub-repository → tabblad **Actions**
2. Klik op **"Deploy to Firebase"** in de linkerkolom
3. Klik op de knop **"Run workflow"** → **"Run workflow"**

---

## 6. PWA — installeren op telefoon of tablet

De app is een **Progressive Web App (PWA)** en kan als een gewone app op het startscherm geïnstalleerd worden — zonder App Store of Play Store.

**Op Android (Chrome):**
1. Open de app in Chrome
2. Tik op het menu (drie puntjes) → **"Toevoegen aan startscherm"**
3. Bevestig met **Toevoegen**

**Op iOS (Safari):**
1. Open de app in Safari
2. Tik op het **Delen-icoontje** (vak met pijltje omhoog)
3. Scroll naar beneden → tik op **"Voeg toe aan beginscherm"**
4. Bevestig met **Toevoegen**

**Automatische updates:**
De app detecteert automatisch wanneer een nieuwe versie beschikbaar is na een deploy. Gebruikers zien dan een banner onderaan het scherm met de knop **"Bijwerken"**. Na één tik herlaadt de app en is de nieuwste versie actief. Zonder dit te doen blijft de vorige versie in gebruik — de data (Firestore) is altijd actueel, maar de app-schermen zelf worden pas bijgewerkt na het klikken op "Bijwerken".

**Offline gedrag:**
- De app-shell (schermen, navigatie, stijl) werkt offline dankzij Workbox-precaching
- Firestore-data vereist een verbinding — offline wordt geen data geladen
- Firebase Storage (logo, uploads) wordt kort gecached (7 dagen) via StaleWhileRevalidate

---

## 7. Lokaal ontwikkelen (optioneel)

Dit hoofdstuk is alleen relevant als je de app lokaal op je computer wil draaien — bv. om aanpassingen te testen voor je ze deployt. Je hebt hiervoor Node.js 22 en Git nodig op je computer.

```bash
# Repository klonen
git clone https://github.com/jouw-gebruikersnaam/clubapp-mijnclub.git
cd clubapp-mijnclub

# Afhankelijkheden installeren
npm install
cd functions && npm install && cd ..

# .env.local aanmaken (kopieer inhoud uit jouw ENV_LOCAL secret)
# Maak het bestand aan in de root en plak de inhoud

# Ontwikkelserver starten
npm run dev
# App opent op http://localhost:3000
```

> **Let op bij bouwen:** de buildstap valideert of `VITE_APPCHECK_KEY` aanwezig is. Ontbreekt deze variabele, dan stopt de build met een fout. Je kan dit omzeilen voor lokale tests door een tijdelijke waarde mee te geven:
> ```bash
> VITE_APPCHECK_KEY=dummy npm run build
> ```

**Bundle-analyse:** de build splitst automatisch zware bibliotheken in eigen chunks:

| Chunk | Inhoud |
|---|---|
| `firebase` | firebase/app, firestore, auth, storage, messaging |
| `vendor` | react, react-dom, react-router-dom |
| `exceljs` | exceljs (Excel-export) |
| `qrcode` | html5-qrcode, qrcode |

---

## 8. Functionaliteiten

### Ledenbeheer

- Leden toevoegen via een wizard (3 stappen met voortgangsbalk: persoonsgegevens → lidmaatschap → contactinfo)
- Bulkimport via CSV-bestand (atomair via `writeBatch`, max. 499 leden per batch)
- Ledenprofiel met 3 tabbladen: 👤 Profiel / 🏅 Lidmaatschap / 📊 Activiteit
- Gordel en leeftijdsgroep bijhouden (waarden dynamisch uit Firestore-configuratie)
- Bijdrage betaald/niet betaald (enkel aanpasbaar door bestuur — afgedwongen via Firestore-regels)
- Vergunningsnummer en inschrijvingsjaar registreren
- Medische informatie en noodcontacten opslaan
- Lid deactiveren (soft-delete: `actief: false`, blijft in database) of definitief verwijderen (hard-delete, enkel admin)
- Lid koppelen aan een gebruikersaccount via e-mailadres (automatisch via Cloud Function `koppelLidViaEmail`)
- Gezinslinks beheren (meerdere leden koppelen als gezin)
- Exporteren naar CSV
- Alle wijzigingen worden gelogd in het auditlogboek

### Trainingen

- Trainingsschema per groep en seizoen
- **Trainer-modus**: mobiel aanwezigheidsscherm met QR-scanner (html5-qrcode), notities per aanwezige, lesgever-bevestiging, historiek
- Technieken per training vastleggen
- Lesgevers per training aanduiden
- Beschikbaarheid van trainers registreren
- Automatische push-melding aan beheerders bij training zonder lesgever (dagelijkse scheduled function + manuele trigger)
- Importeren via Excel

### Technieken

- Databank per categorie (val, worpen, grondtechnieken, …)
- KYU-niveau en kleurcodering per techniek (dynamisch via `useKyuKleuren()` hook)
- Categorieën beheerbaar via Beheer → Clubdata → Techniek-categorieën
- Koppeling met trainingen

### Wedstrijden, Examens & Evenementen

- **Unified Events** (`/events`): gecombineerd overzicht met type-tabs (wedstrijden / examens / evenementen), zoekfunctie en toggle voor voorbij/toekomstig
- Bestaande routes `/wedstrijden`, `/examens`, `/evenementen` blijven werken (backward-compatible)
- Deelnemers registreren en opvolgen
- Examen-wizard met kandidatenbeheer en rapport
- Wedstrijddeelnemers importeren via Excel of e-mail
- Automatische cascade-delete van alle subcollecties en inschrijvingen bij verwijdering van een evenement (Cloud Function `verwijderEventData`)
- Push-melding bij nieuw wedstrijdevenement (Cloud Function `notifyNieuweWedstrijd`)

### Winkel

- Productenbeheer met categorieën, varianten en stock
- Kassascherm voor directe verkoop
- Verkoopoverzicht en openstaande schulden
- Automatische push-melding én e-mail bij lage of nul-voorraad (Cloud Function `notifyStockZero`)
- Stock kan nooit negatief worden (afgedwongen via Firestore-regels)

### Uitbetalingen

- Vergoedingsmatrix per lesgever en periode
- Uurloon + km-vergoeding per lesgever-type (instelbaar via Beheer → Clubdata → Uitbetalingstarieven)
- Exporteerbaar naar Excel

### Communicatie

- Bulk-e-mails naar alle leden of een selectie
- Aanpasbare templates met variabelen: `{{naam}}`, `{{datum}}`, `{{club}}`
- Templates beheerbaar via Beheer → Clubdata → Mail-templates (4 standaard templates)
- Volledig verzendhistoriek

### Rapporten

- Aanwezigheid, examens, leden, lesgevers, trainingen, verkoop, voorraad
- 8 tabbladen, alles exporteerbaar naar Excel

### Beheer

- **Gebruikersbeheer**: rollen toekennen (admin, bestuurslid, trainer, assistent, lid)
- **Groepen**: trainingsgroepen beheren
- **Lesgeverprofielen**: financiële info, km-afstand, type
- **Configureerbare lijsten** (allemaal via `CrudLijstBeheer`):
  - Leeftijdscategorieën
  - Gordels / KYU
  - Lesgever-types
  - Communicatie-categorieën
  - Techniek-categorieën
  - Uitbetalingstarieven
  - Mail-templates
- **Clubinstellingen**: naam, korte naam, contact-e-mail, logo
- **Seizoensinstellingen**: startmaand, eindmaand
- **Auditlogboek**: alle database-wijzigingen, filters op periode/collectie/actie/gebruiker, diff op klik (enkel admin)
- **Push-meldingsinstellingen**: welke meldingen welke rollen ontvangen
- **Paginatoegang per rol**: instelbaar welke pagina's welke rol ziet

### Bestuur *(vertrouwelijk, enkel admin en bestuurslid)*

- Bestuursvergaderingen met agenda en verslag
- Actiepunten met verantwoordelijke en deadline
- Vertrouwelijke documenten
- Automatische herinnering 24u voor een bestuursvergadering (scheduled function)

### Onboarding

- Nieuwe gebruikers doorlopen een wizard bij eerste registratie (4 stappen: welkom → persoonlijke info → clubinfo → meldingsvoorkeuren)
- `onboardingVoltooid: true` op het user-document na voltooiing
- Bestaande gebruikers die de wizard nog niet hebben doorlopen: zie [Problemen oplossen](#18-problemen-oplossen)

---

## 9. Rollen en rechten

### Rolhiërarchie

| Rol | Beschrijving |
|---|---|
| `admin` | Volledige toegang, inclusief hard-delete van leden en auditlogboek |
| `bestuurslid` | Administratieve functies, gebruikersbeheer, geen hard-delete |
| `trainer` | Trainingen, leden (beperkt), evenementen, aanwezigheid, uitbetalingen |
| `assistent` | Trainingen bekijken, zichzelf als lesgever koppelen, uitbetalingen |
| `lid` | Eigen profiel, inschrijvingen, publieke informatie |

> `isBeheerder()` = `admin` of `bestuurslid`. `isTrainer()` = `trainer`, `bestuurslid` of `admin`.

### Standaardtoegang per pagina

| Pagina | admin | bestuurslid | trainer | assistent | lid |
|---|:---:|:---:|:---:|:---:|:---:|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ |
| Trainingen | ✓ | ✓ | ✓ | ✓ | — |
| Leden | ✓ | ✓ | — | — | — |
| Technieken | ✓ | ✓ | ✓ | — | — |
| Events (unified) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Wedstrijden | ✓ | ✓ | ✓ | ✓ | ✓ |
| Examens | ✓ | ✓ | ✓ | ✓ | ✓ |
| Clubevenementen | ✓ | ✓ | ✓ | ✓ | ✓ |
| Agenda | ✓ | ✓ | ✓ | ✓ | ✓ |
| Klassement | ✓ | ✓ | ✓ | ✓ | ✓ |
| Winkel | ✓ | ✓ | ✓ | — | — |
| Uitbetalingen | ✓ | ✓ | ✓ | ✓ | — |
| Communicatie | ✓ | ✓ | ✓ | — | — |
| Documenten | ✓ | ✓ | ✓ | — | — |
| Rapporten | ✓ | ✓ | ✓ | — | — |
| Bestuur | ✓ | ✓ | — | — | — |
| Beheer | ✓ | ✓ | — | — | — |
| Mijn profiel | ✓ | ✓ | ✓ | ✓ | ✓ |
| Instellingen | ✓ | ✓ | ✓ | ✓ | ✓ |

> Paginatoegang is volledig configureerbaar via Beheer → Paginatoegang. De tabel hierboven toont de standaardwaarden.

### Veldrestricties voor trainers

Trainers mogen deze velden bij leden **niet** wijzigen (afgedwongen via Firestore-regels én gespiegeld in de UI):

- `bijdrageBetaald` en `bijdrageVervaldatum`
- `lidnummer` en `vergunningsnummer`
- `ingeschrevenJaar`

Alles wat een trainer wel kan aanpassen: naam, telefoon, e-mail, gordel, groepen, medisch, noodcontact, actief-status.

---

## 10. GitHub Secrets — volledig overzicht

Alle secrets worden ingesteld via GitHub → Settings → Secrets and variables → Actions.

| Secret | Verplicht | Inhoud |
|---|:---:|---|
| `FIREBASE_PROJECT_ID` | ✓ | Jouw Firebase project-ID, bv. `clubapp-mijnclub-a1b2` |
| `FIREBASE_SERVICE_ACCOUNT` | ✓ | Volledige inhoud van het gedownloade service account `.json`-bestand |
| `ENV_LOCAL` | ✓ | Alle `VITE_`-omgevingsvariabelen (zie template in Stap 13) |

### Variabelen in `ENV_LOCAL`

| Variabele | Verplicht | Beschrijving | Bron |
|---|:---:|---|---|
| `VITE_FB_API_KEY` | ✓ | Firebase Web API-sleutel | Firebase Console → Projectinstellingen → Jouw apps |
| `VITE_FB_AUTH_DOMAIN` | ✓ | Auth-domein | idem |
| `VITE_FB_PROJECT_ID` | ✓ | Project-ID | idem |
| `VITE_FB_STORAGE_BUCKET` | ✓ | Storage bucket | idem |
| `VITE_FB_MESSAGING_SENDER_ID` | ✓ | FCM Sender ID | idem |
| `VITE_FB_APP_ID` | ✓ | Web App ID | idem |
| `VITE_FB_MEASUREMENT_ID` | — | Analytics ID (weglaten als Analytics uitgeschakeld) | idem |
| `VITE_VAPID_KEY` | ✓ | Web Push VAPID sleutel | Firebase → Projectinstellingen → Cloud Messaging |
| `VITE_APPCHECK_KEY` | ✓ | reCAPTCHA v3 sitesleutel | google.com/recaptcha → jouw site |
| `VITE_CLUB_NAAM` | ✓ | Volledige clubnaam | Zelf invullen |
| `VITE_CLUB_NAAM_KORT` | ✓ | Korte naam (sidebar en PWA-titel) | Zelf invullen |
| `VITE_CLUB_STORAGE_PREFIX` | ✓ | Mapprefix in Storage en QR-schema (geen spaties) | Zelf kiezen |
| `VITE_THEME_COLOR` | ✓ | Primaire kleur (hex, ook PWA-themakleur) | Zelf kiezen |

> `VITE_CLUB_NAAM`, `VITE_CLUB_NAAM_KORT` en `VITE_THEME_COLOR` worden ook verwerkt in het PWA-manifest (`manifest.webmanifest`) tijdens de Vite-build. Logo wordt automatisch opgehaald uit `settings/club.logoUrl` in Firestore tijdens de build als `VITE_LOGO_URL` niet ingesteld is.

---

## 11. Firestore-datastructuur

### Hoofdcollecties

| Collectie | Inhoud |
|---|---|
| `users` | Gebruikersprofielen gekoppeld aan Firebase Auth (uid, naam, rol, onboardingVoltooid, …) |
| `members` | Leden/judoka's (persoonsdata, gordel, groepen, bijdrage, medisch) |
| `groepen` | Trainingsgroepen (naam, categorie, kleur) |
| `trainingen` | Trainingsschema per groep en seizoen |
| `technieken` | Judo-technieken (naam, type, kyu, omschrijving) |
| `events` | Wedstrijden en examens — gefilterd op `type` veld (`wedstrijd` of `examen`) |
| `evenementen` | Clubactiviteiten (naam, datum, locatie, inschrijvingen) |
| `products` | Merchandise en voorraad |
| `sales` | Verkoophistoriek |
| `verkoopmomenten` | Kassasessies |
| `communications` | Verzonden e-mails |
| `documents` | Gedeelde bestanden |
| `lesgevers` | Lesgeverprofielen met financiële info |
| `tarieven` | Uurloon per lesgever-type (code → `bedragPerUur`, `kmVergoeding`) |
| `uitbetalingsperiodes` | Berekende uitbetalingen per periode |
| `categorieen` | Leeftijdscategorieën (configureerbaar via Beheer) |
| `gordels` | Gordels/KYU-niveaus (configureerbaar via Beheer) |
| `lesgeverTypes` | Types lesgevers (configureerbaar via Beheer) |
| `communicatieCategorieen` | Categorieën voor communicatie (configureerbaar via Beheer) |
| `techniekCategorieen` | Categorieën voor technieken (configureerbaar via Beheer) |
| `mailTemplates` | Aanpasbare e-mailtemplates (4 defaults) |
| `settings/club` | Clubinstellingen (naam, logo, contact) |
| `settings/seizoen` | Seizoensinstellingen (startmaand, eindmaand) |
| `auditLogs` | Logboek van alle database-wijzigingen (collectie, actie, voor/na diff, uid) |
| `bestuursVergaderingen` | Bestuursvergaderingen (vertrouwelijk) |
| `bestuursActiepunten` | Actiepunten bestuur (vertrouwelijk) |
| `bestuursDocumenten` | Bestuursdocumenten (vertrouwelijk) |
| `notificationTokens` | FCM push-tokens per apparaat |
| `notificationIndex` | Gesynchroniseerde index van notificatievoorkeuren per gebruiker (voor efficiënte queries) |
| `pushTriggers` | Manuele triggers voor push-meldingen |
| `pushFailures` | Gelogde mislukte push-meldingen |
| `trainerReminderTriggers` | Triggers voor trainer-herinneringen |
| `stockAlerts` | Gelogde stock-meldingen |
| `inschrijvingen` | Inschrijvingen (collectie-level, apart van subcollecties) |
| `mail` | Uitgaande e-mails (verwerkt door Firebase Extension of Cloud Function) |

### Subcollecties

| Pad | Inhoud |
|---|---|
| `members/{id}/attendance/{datum}` | Aanwezigheidsregistraties per training |
| `trainingen/{id}/technieken/{id}` | Technieken gegeven per training |
| `trainingen/{id}/beschikbaarheid/{uid}` | Trainerbeschikbaarheid |
| `events/{id}/registrations/{memberId}` | Deelnemers per wedstrijd/examen |
| `evenementen/{id}/registrations/{memberId}` | Deelnemers per clubevenement |

### configCache (sessie-geheugen)

`AuthContext` laadt bij login eenmalig de volgende collecties in memory (`configCache`), zodat pagina's ze niet zelf hoeven te fetchen:

```
categorieen · gordels · lesgeverTypes · groepen · techniekCategorieen
clubSettings (settings/club) · seizoenSettings (settings/seizoen)
```

---

## 12. Cloud Functions

Alle functies zijn Cloud Functions v2 (Node.js 22, `firebase-functions ^6`).

| Functie | Trigger | Wat doet het |
|---|---|---|
| `notifyStockZero` | `products` bijgewerkt | Push + e-mail bij lage of nul-voorraad |
| `checkTrainingTrigger` | Document aangemaakt in `trainerReminderTriggers` | Manuele check: training zonder lesgever |
| `checkTrainingZonderLesgever` | Dagelijkse schedule | Automatische check: training zonder lesgever, stuurt herinnering |
| `bestuursVergaderingHerinnering` | Dagelijkse schedule | Herinnering 24u voor bestuursvergadering aan bestuursleden |
| `notifyNieuweWedstrijd` | Document aangemaakt in `events` (type wedstrijd) | Push + e-mail bij nieuw wedstrijdevenement |
| `verwerkPushTrigger` | Document aangemaakt in `pushTriggers` | Verwerkt manuele push-trigger, logt fouten in `pushFailures` |
| `verwijderEventData` | Document verwijderd in `events` of `evenementen` | Cascade-delete: alle subcollecties en inschrijvingen |
| `notifyNieuwLid` | Document aangemaakt in `members` | Push + e-mail aan beheerders bij nieuw lid |
| `cascadeCategorie` | `categorieen` gewijzigd | Propageert hernoemde categorie-codes naar `groepen` en `users` |
| `cascadeLesgeverType` | `lesgeverTypes` gewijzigd | Propageert hernoemde lesgever-type codes naar `lesgevers` |
| `cascadeCommunicatieCategorie` | `communicatieCategorieen` gewijzigd | Propageert codes naar `communications` |
| `cascadeTechniekCategorie` | `techniekCategorieen` gewijzigd | Propageert codes naar `technieken` |
| `cascadeGordel` | `gordels` gewijzigd | Propageert hernoemde gordel-codes naar `members` (bij verwijderen: behoud opgeslagen waarde) |
| `cascadeGroepVerwijderd` | `groepen` verwijderd | Verwijdert wees-ID's uit `users`, `members` en notificatievoorkeuren |
| `syncRolClaim` | `users` gewijzigd | Synchroniseert Firebase Auth custom claim `rol` bij rolwijziging |
| `koppelLidViaEmail` | `users` gewijzigd | Koppelt automatisch een user-account aan een lid-document via e-mailadres |
| `verwerkGezinslink` | Document aangemaakt in `gezinslinks` | Verwerkt gezinslinkverzoeken |
| `syncNotificatieIndex` | `users` gewijzigd | Houdt `notificationIndex` gesynchroniseerd voor efficiënte push-queries |
| `updateLedenCount` | `members` gewijzigd | Houdt ledentellersdocument bij via Firestore `count()` aggregatie |
| `auditLog_members` | `members` gewijzigd | Schrijft voor/na diff naar `auditLogs` |
| `auditLog_users` | `users` gewijzigd | Schrijft voor/na diff naar `auditLogs` |
| `auditLog_trainingen` | `trainingen` gewijzigd | Schrijft voor/na diff naar `auditLogs` |
| `auditLog_events` | `events` gewijzigd | Schrijft voor/na diff naar `auditLogs` |
| `migreerNotificatieVoorkeuren` | HTTP-trigger (eenmalig) | Migratiehulp voor notificatiestructuur |

**Mail-helpers** (gedeeld tussen frontend en backend):

- `functions/mailHtmlBuilder.js` — bouwt HTML-mail vanuit template + data
- `functions/mailTemplateStore.js` — beheert variabele-substitutie (`{{naam}}`, `{{club}}`, …)
- `functions/notifications/dispatcher.js` — verzendt push-meldingen via FCM
- `functions/notifications/categories.js` — categorieën en doelgroepen per meldingstype
- `src/notifications/mailTemplate.js` — gedeelde template-logica voor frontend

---

## 13. Beveiligingsarchitectuur

### App Check

Elke API-aanroep vanuit de browser wordt gevalideerd door Firebase App Check met reCAPTCHA v3. Directe aanvragen van buiten de app worden geblokkeerd. De reCAPTCHA-token wordt bij de build ingebakken via `VITE_APPCHECK_KEY`.

### Firestore-beveiligingsregels

- **Rolcontrole** via Firebase Auth JWT custom claims met Firestore-fallback (als de claim nog niet vervangen is na rolwijziging, leest de regel het `users/{uid}.rol` veld)
- `isBeheerder()` = `admin` of `bestuurslid`
- `isTrainer()` = `trainer`, `bestuurslid` of `admin`
- **Ledendata**: trainers mogen `bijdrageBetaald`, `bijdrageVervaldatum`, `lidnummer`, `vergunningsnummer`, `ingeschrevenJaar` niet wijzigen
- **Hard-delete** van leden: enkel `admin` of `bestuurslid`
- **Stock**: kan nooit negatief worden
- **Bestuurscollecties**: enkel leesbaar voor `bestuurslid` en `admin`
- **auditLogs**: enkel leesbaar voor `admin`, niet schrijfbaar via client (enkel via Cloud Functions admin SDK)

### Storage-beveiligingsregels

- Ingelogde gebruikers mogen bestanden lezen en uploaden
- Eigendomscontrole op documentniveau wordt afgedwongen via Firestore-regels (niet via Storage-regels, om complexiteit te vermijden)

### HTTP-beveiligingsheaders

`firebase.json` stelt de volgende headers in:

| Header | Waarde / Bescherming |
|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` — HTTPS voor 1 jaar inclusief subdomeinen |
| `X-Frame-Options` | `SAMEORIGIN` — beschermt tegen clickjacking |
| `X-Content-Type-Options` | `nosniff` — voorkomt MIME-type aanvallen |
| `Referrer-Policy` | `strict-origin-when-cross-origin` — beperkt URL-lekken |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` — schakelt gevoelige browser-API's uit |
| `Content-Security-Policy` | Strikt: eigen scripts, gstatic, googleapis, recaptcha, accounts.google.com — blokkeert inline scripts en externe iframes |

**Cache-strategie:**

| Bron | Cache-Control |
|---|---|
| `index.html` | `no-cache, no-store, must-revalidate` (altijd vers) |
| JS en CSS bestanden | `public, max-age=31536000, immutable` (1 jaar, hash in bestandsnaam) |
| Afbeeldingen, fonts | `public, max-age=604800` (7 dagen) |

### PWA Service Worker

- `self.skipWaiting()` + `clientsClaim()` — nieuwe SW neemt meteen de controle over
- Precaching van alle app-shell bestanden via Workbox `injectManifest`
- Firestore, Auth en tokenendpoints: `NetworkOnly` — nooit gecached
- Firebase Storage: `StaleWhileRevalidate` — gecached met achtergrondverversing
- Update-detectie: `useAppUpdate` hook controleert bij elke app-focus en bij mount op nieuwe SW; bij update verschijnt de `UpdateBanner` component

### IAM-rollen (Google Cloud)

| Service account | Rol |
|---|---|
| `firebase-adminsdk-*` | Firebase Admin SDK Administrator |
| `[project]@appspot.gserviceaccount.com` | Editor (App Engine default) |

---

## 14. Projectstructuur

```
clubapp-kodokan/
├── .env.example                  # Voorbeeld variabelen (nooit .env.local in Git)
├── .firebaserc                   # Firebase-projectkoppeling ← aanpassen in Stap 14
├── firebase.json                 # Firebase CLI-configuratie + hosting headers
├── firestore.rules               # Firestore beveiligingsregels
├── firestore.indexes.json        # Samengestelde database-indexen
├── storage.rules                 # Storage beveiligingsregels
├── vite.config.js                # Vite build + PWA injectManifest + logo-download
├── index.html                    # HTML-ingangspunt
├── package.json                  # Frontend-afhankelijkheden
│
├── .github/
│   └── workflows/
│       └── deploy.yml            # GitHub Actions deploy-workflow (13 stappen)
│
├── public/                       # Statische bestanden
│   ├── manifest.webmanifest      # PWA-manifest (gegenereerd tijdens build)
│   ├── pwa-192x192.png           # PWA-icoon (vervangen door club-logo tijdens build)
│   ├── pwa-512x512.png           # PWA-icoon groot
│   ├── apple-touch-icon.png      # iOS-icoon
│   ├── base.css                  # Minimale reset voor eerste paint
│   └── fonts/                    # Plus Jakarta Sans woff2
│
├── src/
│   ├── App.jsx                   # Routing, sidebar, mobiele header, ConnectionDot, UpdateBanner
│   ├── main.jsx                  # React root + service worker registratie
│   ├── sw.js                     # Gecombineerde Workbox + FCM service worker
│   │
│   ├── config/
│   │   ├── appConfig.js          # ALLE_PAGINAS, NAV_GROEPEN, ROLLEN, COLLECTIONS, QR-schema
│   │   ├── clubdataDefaults.js   # Standaardwaarden voor configureerbare lijsten
│   │   └── mailTemplatesDefaults.js # Standaard mail-templates
│   │
│   ├── contexts/
│   │   ├── AuthContext.jsx       # Auth-state, rol, configCache (gordels, groepen, settings, …)
│   │   ├── ConfirmContext.jsx    # Globale bevestigingsdialog
│   │   ├── GroepenContext.jsx    # Real-time groepen (legacy, vervangen door configCache)
│   │   ├── LesgeversContext.jsx  # Real-time lesgevers
│   │   └── PaginaRollenContext.jsx # Toegestane paginapaden per ingelogde rol
│   │
│   ├── hooks/
│   │   ├── useAgendaItems.js     # Samengestelde agenda-items uit meerdere collecties
│   │   ├── useAppUpdate.js       # Service worker update-detectie (focus + mount check)
│   │   ├── useGordelOpties.js    # Gordel-opties vanuit configCache
│   │   ├── useIsMobile.js        # Responsiviteitsdetectie
│   │   ├── useLesgeversRealtime.js # Real-time lesgevers hook
│   │   ├── useMediaQuery.js      # Generieke media query hook
│   │   └── useRapportenData.js   # Data-aggregatie voor Rapporten-pagina
│   │
│   ├── pages/                    # Alle paginacomponenten (lazy-loaded behalve Dashboard)
│   │   ├── Dashboard.jsx         # Rolspecifieke snelkoppelingen + agenda-overzicht
│   │   ├── LoginPagina.jsx       # Login + registratie (toont clubnaam uit localStorage)
│   │   ├── Onboarding.jsx        # 4-stappen wizard voor nieuwe gebruikers
│   │   ├── Ledenbeheer.jsx       # Ledenlijst met zoek, filter, CSV-export
│   │   ├── NieuwLid.jsx          # 3-stappen wizard voor nieuw lid
│   │   ├── LidDetail.jsx         # Ledenprofiel (3 tabbladen + QR-code)
│   │   ├── Trainingen.jsx        # Trainingsschema + trainer-modus QR-scanner
│   │   ├── Technieken.jsx        # Techniekendatabank per categorie en KYU
│   │   ├── Events.jsx            # Unified events (wedstrijden + examens + evenementen)
│   │   ├── Wedstrijden.jsx       # Wedstrijdenbeheer (backward-compatible route)
│   │   ├── Examens.jsx           # Examens + wizard
│   │   ├── Evenementen.jsx       # Clubevenementen
│   │   ├── Agenda.jsx            # Maand- en weekoverzicht
│   │   ├── Klassement.jsx        # Clubranking
│   │   ├── Winkel.jsx            # Merchandise + kassa
│   │   ├── Eetfestijn.jsx        # Eetfestijnbeheer
│   │   ├── Uitbetalingen.jsx     # Lesgeververgoedingen + Excel-export
│   │   ├── Communicatie.jsx      # Bulk e-mail + historiek
│   │   ├── Documenten.jsx        # Bestanden upload en download
│   │   ├── Rapporten.jsx         # 8-tabbladen rapport + Excel-export
│   │   ├── Bestuur.jsx           # Vergaderingen, actiepunten, documenten (vertrouwelijk)
│   │   ├── Beheer.jsx            # Centraal beheer (gebruikt InstellingenBeheer sub-secties)
│   │   ├── DeviceInstellingen.jsx # Push-meldingsvoorkeuren per apparaat
│   │   └── ProfielPagina.jsx     # Persoonlijk profiel + wachtwoord wijzigen
│   │
│   ├── components/
│   │   ├── ConfirmDialog.jsx     # Bevestigingsdialog (via ConfirmContext)
│   │   ├── RequireRole.jsx       # Route-guard op basis van PaginaRollenContext
│   │   ├── ui/
│   │   │   ├── Toast.jsx         # Toast-systeem (useToast hook + ToastProvider)
│   │   │   ├── FormField.jsx     # Universele veldcomponent
│   │   │   ├── DataTable.jsx     # Sorteerbare/zoekbare tabel
│   │   │   └── UpdateBanner.jsx  # PWA-updatebanner (verschijnt bij nieuwe SW-versie)
│   │   ├── agenda/               # Maand- en weekroosterview-componenten
│   │   ├── beheer/               # Beheer sub-secties (CrudLijstBeheer, InstellingenBeheer, …)
│   │   ├── dashboard/            # Dashboard widgets (KpiStrip, WeekStrip, Berichten, …)
│   │   ├── details/              # Detail-panels voor evenementen, examens, wedstrijden
│   │   └── trainingen/           # Trainings-gerelateerde componenten
│   │
│   ├── services/
│   │   ├── firestoreService.js   # CRUD-helpers incl. updateMetAudit() / setMetAudit()
│   │   └── pushService.js        # Push-token registratie en beheer
│   │
│   ├── notifications/
│   │   ├── firebaseMessaging.js  # FCM initialisatie, token, voorgrondmeldingen
│   │   ├── mailTemplate.js       # Gedeelde mail-template logica (frontend)
│   │   ├── notificationCategories.js # Categorieën en doelgroepen
│   │   └── verstuurMail.js       # Frontend mail-verzending via Firestore trigger
│   │
│   ├── utils/
│   │   ├── categorieLogica.js    # Categorie-matching helpers
│   │   ├── datumUtils.js         # formatDatum(), formatDatumTijd(), datumNaarIso(), isoNaarDatum()
│   │   ├── ledenKoppeling.js     # Helpers voor lid-account koppeling
│   │   ├── mailParser.js         # E-mailadres parsing
│   │   └── seizoenUtils.js       # seizoenBereik(), huidigSeizoen() — instelbaar via settings/seizoen
│   │
│   └── styles/
│       ├── theme.css             # CSS custom properties (design tokens als CSS vars)
│       └── tokens.js             # Design tokens in JS (C, buttonStyle, cardStyle, …)
│
└── functions/
    ├── index.js                  # Alle Cloud Functions (24 exports)
    ├── mailHtmlBuilder.js        # HTML e-mailbouwer (gedeeld via getClubNaam helper)
    ├── mailTemplateStore.js      # Template variabele-substitutie
    └── notifications/
        ├── categories.js         # Push-categorieën en doelgroepen
        ├── dispatcher.js         # FCM-verzender via Admin SDK
        └── migrate.js            # Migratiehulp notificatiestructuur
```

---

## 15. Architectuur-cheat-sheet

Wanneer je iets nieuws wil doen, weet hier waar wat staat.

| Wat | Waar |
|---|---|
| Globale config (rollen, paginas, collecties, QR-schema) | `src/config/appConfig.js` |
| Defaults voor clubdata-collecties | `src/config/clubdataDefaults.js` |
| Defaults voor mail-templates | `src/config/mailTemplatesDefaults.js` |
| Generieke CRUD voor configureerbare lijsten | `src/components/beheer/CrudLijstBeheer.jsx` |
| Clubinstellingen + seizoensinstellingen forms | `src/components/beheer/AlgemeenInstellingenBeheer.jsx` |
| Uitbetalingstarieven | `src/components/beheer/UitbetalingstarievenBeheer.jsx` |
| Auth + configCache (gordels, groepen, settings, …) | `src/contexts/AuthContext.jsx` |
| Toegestane paginapaden per rol | `src/contexts/PaginaRollenContext.jsx` |
| Toast-systeem | `src/components/ui/Toast.jsx` |
| Universele datumopmaak (dd/mm/yyyy) | `src/utils/datumUtils.js` |
| Seizoen helpers (instelbaar via settings/seizoen) | `src/utils/seizoenUtils.js` |
| Gordel-opties hook | `src/hooks/useGordelOpties.js` |
| KYU kleuren (Technieken) | `src/pages/Technieken.jsx` → `useKyuKleuren()` |
| CRUD helpers met automatische audit | `src/services/firestoreService.js` → `updateMetAudit()`, `setMetAudit()` |
| Mail-template (frontend) | `src/notifications/mailTemplate.js` |
| Mail-template (backend) | `functions/mailTemplateStore.js` |
| Cascade-delete + audit-triggers | `functions/index.js` |
| Firestore rules | `firestore.rules` |
| PWA service worker | `src/sw.js` |
| Update-detectie (banner bij nieuwe versie) | `src/hooks/useAppUpdate.js` + `src/components/ui/UpdateBanner.jsx` |

---

## 16. Hoe nieuwe configureerbare data toevoegen?

Voorbeeld: je wil "examen-locaties" beheerbaar maken via Beheer.

**1. Defaults definiëren** — `src/config/clubdataDefaults.js`:
```js
export const DEFAULT_EXAMEN_LOCATIES = [
  { code: 'merchtem', label: 'Sporthal Merchtem', adres: '...', volgorde: 10 },
];
```

**2. Collectienaam toevoegen** — `src/config/appConfig.js`:
```js
COLLECTIONS = {
  // ...bestaande...
  EXAMEN_LOCATIES: 'examenLocaties',
};
```

**3. Firestore-regel toevoegen** — `firestore.rules`:
```
match /examenLocaties/{id} {
  allow read: if isIngelogd();
  allow write: if isBeheerder();
}
```

**4. Toevoegen aan configCache** — `src/contexts/AuthContext.jsx`, in de `Promise.all`:
```js
getDocs(query(collection(db, 'examenLocaties'), orderBy('volgorde')))
  .then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })))
```
En mappen naar `configCache.examenLocaties`.

**5. Beheer-component aanmaken** — nieuw bestand of export in `InstellingenBeheer.jsx`:
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
    defaults={DEFAULT_EXAMEN_LOCATIES}
  />;
}
```

**6. Toevoegen aan `Beheer.jsx`** — in de Clubdata-sectie + subComponents map.

**7. Gebruiken in pagina's:**
```js
const { configCache } = useAuth();
const locaties = configCache?.examenLocaties || [];
```

---

## 17. Bekende beperkingen

### LoginPagina toont hardcoded clubnaam bij eerste bezoek

**Reden**: niet-gëauthenticeerde gebruikers kunnen geen Firestore lezen. Na de eerste succesvolle login wordt de clubnaam gecached in localStorage en getoond bij volgende bezoeken.
**Workaround**: `CLUB_NAAM` in `src/config/appConfig.js` aanpassen vraagt een code-deploy. Voor multi-club ondersteuning: publiek manifest-bestand `/public/public-config.json` bouwen.

### configCache laadt alleen bij sessie-start

Als je in Beheer een categorie toevoegt, zien andere ingelogde tabs dit pas na een page refresh. Voor directe propagatie zou je `onSnapshot` moeten gebruiken in AuthContext (afweging: meer Firestore reads).

### Seizoeninstellingen vereisen page-refresh

`seizoenUtils.js` werkt een module-level cache bij na `setSeizoenSettings()`; componenten die de seizoenberekening al hadden aangeroepen zien de oude waarde pas na een refresh.

### Twee event-collecties (`events` + `evenementen`)

Wedstrijden en examens staan in `events` (gefilterd op `type`-veld); clubevenementen hebben een eigen collectie `evenementen`. `Events.jsx` leest beide samen. Migratie naar één collectie vereist een data-migratie — bewust niet gedaan om risico te beperken.

### `tarieven` vs `lesgeverTypes` zijn twee documenten per concept

Lesgever-types staan in `lesgeverTypes/{id}`; hun uurloon staat in `tarieven/{code}/bedragPerUur`. Twee documenten voor één concept, maar werkt naadloos. Samenvoeging zou backwards-compat breken.

### Trainer-form: verboden velden geven save-fout bij wijziging

Als een trainer een veld wijzigt dat door Firestore-regels geblokkeerd is, mislukt de volledige save. Ideaal tonen we die velden als `disabled` voor trainers in de UI — dit staat nog open als TODO.

---

## 18. Problemen oplossen

### GitHub Actions mislukt — "Could not load the default credentials"

Het `FIREBASE_SERVICE_ACCOUNT` secret is incorrect:
1. Ga naar Stap 10 en download opnieuw een service account JSON
2. Kopieer de **volledige** inhoud (van `{` tot `}`)
3. Vervang het secret in GitHub → Settings → Secrets

### GitHub Actions mislukt — "Error: Unknown project id"

- Controleer of `FIREBASE_PROJECT_ID` correct is (exact het project-ID van Firebase)
- Controleer of `.firebaserc` bijgewerkt is met jouw project-ID (Stap 14)

### GitHub Actions mislukt — "API not enabled"

Ga naar [console.cloud.google.com/apis/library](https://console.cloud.google.com/apis/library), selecteer jouw project en activeer:
- **Cloud Build API**
- **Artifact Registry API**

Wacht 2–3 minuten en start de workflow opnieuw via Actions → Re-run.

### App toont een lege pagina of foutmelding na deploy

1. Ga naar GitHub → Actions → klik op de laatste run → controleer of alles groen is
2. Controleer of het `ENV_LOCAL` secret alle verplichte variabelen bevat
3. Open de browser-console (F12) en noteer de foutmelding

### De "Standaardwaarden importeren"-knop doet niets

- Controleer of je ingelogd bent als `admin` of `bestuurslid`
- Controleer of de Firestore-regels correct gedeployed zijn (groene Actions-run)
- Open de browser-console (F12) voor meer details

### E-mails tonen de verkeerde clubnaam

- Heb je Beheer → Club → Clubinstellingen ingevuld (`settings/club`)?
- Start een nieuwe deploy via GitHub Actions (workflow_dispatch) om de Functions te herdeployen met de nieuwe clubnaam

### Trainer kan bepaalde ledenvelden niet opslaan

Dit is correct beveiligingsgedrag. Trainers mogen niet aanpassen:
- `bijdrageBetaald`, `bijdrageVervaldatum`, `lidnummer`, `vergunningsnummer`, `ingeschrevenJaar`

Alleen bestuurslid of admin kan deze velden wijzigen. Als de trainer het volledige formulier probeert op te slaan terwijl één verboden veld gewijzigd is, mislukt de volledige save (Firestore-regel). Zorg dat die velden `disabled` zijn voor trainers in de UI (nog open TODO).

### De onboarding-wizard blijft opnieuw verschijnen

Ga naar Firebase Console → Firestore → `users/{uid}` → stel het veld `onboardingVoltooid` in op `true`. Of voer een eenmalig script uit om alle bestaande users bij te werken.

### Push-meldingen werken niet

1. Controleer of `VITE_VAPID_KEY` correct is in het `ENV_LOCAL` secret
2. Start een nieuwe deploy via GitHub Actions
3. Controleer in de browser of de gebruiker toestemming gegeven heeft voor meldingen (Instellingen → Notifications)
4. Bekijk Firestore → collectie `pushFailures` voor foutmeldingen van mislukte pushes

### Eerste gebruiker heeft geen admin-rol na inloggen

Ga naar Firebase Console → Firestore → `users` → open jouw document → stel `rol` in op `admin` → wacht 1–2 minuten → ververs de app. De custom claim wordt pas actief na een automatische token-refresh (~1u) of na opnieuw inloggen.

### App Check blokkeert de app

1. Ga naar Firebase Console → App Check → Apps → zet Handhaving tijdelijk uit
2. Controleer of `VITE_APPCHECK_KEY` de juiste reCAPTCHA **Sitesleutel** is
3. Controleer of jouw domein (`web.app` en `firebaseapp.com`) toegevoegd is bij de reCAPTCHA-site (Stap 8.1)

### Configuratiewijzigingen zijn niet zichtbaar voor andere ingelogde gebruikers

Andere gebruikers zien wijzigingen in gordels, categorieën of clubinstellingen pas na een page refresh, omdat `configCache` eenmalig wordt geladen bij sessie-start. Dit is normaal gedrag. De beheerder die de wijziging maakt, ziet ze onmiddellijk.

### Cascade-delete verwijdert geen subcollecties

Cloud Functions niet gedeployed? Voer `firebase deploy --only functions` opnieuw uit, of start een volledige deploy via GitHub Actions. Controleer Firebase Console → Functions → logs van `verwijderEventData`.

### Build faalt na pull

```bash
rm -rf node_modules dist
npm install
npm run build
```

Als de Functions-build faalt:
```bash
cd functions
rm -rf node_modules
npm install
```

### De app op het startscherm wordt niet automatisch bijgewerkt

Dit is het verwachte gedrag van PWA's: de service worker downloadt de nieuwe versie op de achtergrond, maar neemt pas over na gebruikersactie. Gebruikers krijgen een blauwe **"Bijwerken"**-banner onderaan het scherm zodra een nieuwe versie beschikbaar is. Na één tik herlaadt de app. Zonder die tik blijft de vorige versie actief (Firestore-data is altijd live en actueel).

### Audit-log collectie blijft leeg

Cloud Functions niet gedeployed? Check Firebase Console → Functions → logs van `auditLog_members`, `auditLog_users`, `auditLog_trainingen`, `auditLog_events`. De logs zijn zichtbaar via Beheer → Logboek (enkel admin).

---

## 19. Licentie

Dit project is ontwikkeld voor intern gebruik door Judo Kodokan Merchtem. Neem contact op met de ontwikkelaar voor gebruik door andere clubs.
