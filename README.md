# Clubapp — Judo Kodokan Merchtem

Een volledige webapplicatie voor het beheer van een judoclub. Leden, trainingen, wedstrijden, examens, financiën, communicatie en bestuur — alles op één plek.

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
6. [Lokaal ontwikkelen (optioneel)](#6-lokaal-ontwikkelen-optioneel)
7. [Functionaliteiten](#7-functionaliteiten)
8. [Rollen en rechten](#8-rollen-en-rechten)
9. [GitHub Secrets — volledig overzicht](#9-github-secrets--volledig-overzicht)
10. [Firestore-datastructuur](#10-firestore-datastructuur)
11. [Cloud Functions](#11-cloud-functions)
12. [Beveiligingsarchitectuur](#12-beveiligingsarchitectuur)
13. [Projectstructuur](#13-projectstructuur)
14. [Problemen oplossen](#14-problemen-oplossen)
15. [Licentie](#15-licentie)

---

## 1. Wat doet de app?

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

## 2. Technologie

| Laag | Technologie | Versie |
|---|---|---|
| Frontend framework | React + React Router | 18.3 / 6.28 |
| Build tool | Vite | 5.4 |
| Database | Cloud Firestore (NoSQL, real-time) | — |
| Authenticatie | Firebase Authentication | — |
| Bestandsopslag | Firebase Cloud Storage | — |
| Backend-logica | Firebase Cloud Functions | Node.js 22 |
| Hosting | Firebase Hosting | — |
| Push-meldingen | Firebase Cloud Messaging (FCM) | — |
| Beveiliging | Firebase App Check + reCAPTCHA v3 | — |
| PWA / offline | Vite Plugin PWA + Workbox | — |
| CI/CD | GitHub Actions | — |

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
| `VITE_CLUB_NAAM_KORT` | Korte naam (in de navigatiebalk) |
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

**15.2 — Succesvolle deploy herkennen**

Een groene vinkje naast de workflow-run betekent: de app is online. Je ziet aan het einde van de logs een URL zoals:
```
Hosting URL: https://jouw-project-id.web.app
```

**15.3 — Wat als de deploy mislukt?**

Klik op de mislukte stap (rode ×) om de foutmelding te lezen.

| Foutmelding | Oplossing |
|---|---|
| `Error: HTTP Error: 403` of `PERMISSION_DENIED` | Blaze-plan niet actief — zie Stap 1.2 |
| `Could not load the default credentials` | `FIREBASE_SERVICE_ACCOUNT` secret incorrect — controleer of de volledige JSON gekopieerd is |
| `Error: Unknown project id` | `FIREBASE_PROJECT_ID` secret incorrect of `.firebaserc` niet bijgewerkt |
| `Cloud Build API has not been used` | Activeer de Cloud Build API in Google Cloud Console (Stap 11.1) |
| `Artifact Registry API has not been used` | Activeer de Artifact Registry API in Google Cloud Console (Stap 11.1) |
| `npm ERR!` | Dependency-probleem — zie [Problemen oplossen](#14-problemen-oplossen) |

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
2. Vul in: naam, korte naam, contact-e-mailadres, logo (optioneel)
3. Klik op **Opslaan**

4. Ga naar sectie **Clubdata**
5. In elk tabblad staat een blauwe banner "Deze lijst is nog leeg" — klik op **"Standaardwaarden importeren"** in:
   - **Leeftijdscategorieën** — U7 t.e.m. Veteranen
   - **Gordels / KYU** — wit t.e.m. zwart
   - **Lesgever-types** — Aspirant t.e.m. Trainer A
   - **Communicatie-categorieën**
   - **Techniek-categorieën**

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
- [ ] **Leden** → **+ Nieuw lid** → wizard opent
- [ ] **Trainingen** → **Nieuwe training** → formulier opent
- [ ] **Beheer** → **Logboek** → auditlogs zijn zichtbaar
- [ ] App werkt correct op smartphone-browser (menu schuift open via hamburger-knop)
- [ ] GitHub Actions → tabblad Actions → laatste run heeft een groen vinkje

---

## 5. Hoe werkt de automatische deploy?

Elke keer dat je een wijziging in de code doorvoert naar de `main`-branch op GitHub, start automatisch een deploy. Je hoeft zelf nooit een terminal te openen.

```
Jij past een bestand aan via GitHub webeditor
           │
           ▼
    Commit naar main
           │
           ▼
  GitHub Actions start
           │
    ┌──────┴──────────────┐
    │  1. Code ophalen    │
    │  2. npm install     │
    │  3. .env.local      │  ← uit GitHub secret ENV_LOCAL
    │     aanmaken        │
    │  4. npm run build   │
    │  5. Firebase deploy │  ← gebruikt FIREBASE_SERVICE_ACCOUNT
    │     - Firestore     │     en FIREBASE_PROJECT_ID
    │       regels        │
    │     - Indexen       │
    │     - Storage       │
    │     - Functions     │
    │     - Hosting       │
    └─────────────────────┘
           │
           ▼
  App is live op web.app
```

**Handmatige deploy starten** (zonder code te wijzigen):

1. Ga naar GitHub-repository → tabblad **Actions**
2. Klik op **"Deploy to Firebase"** in de linkerkolom
3. Klik op de knop **"Run workflow"** → **"Run workflow"**

---

## 6. Lokaal ontwikkelen (optioneel)

Dit hoofdstuk is alleen relevant als je de app lokaal op je computer wil draaien — bv. om aanpassingen te testen voor je ze deployt. Je hebt hiervoor Node.js en Git nodig op je computer.

```bash
# Repository klonen
git clone https://github.com/jouw-gebruikersnaam/clubapp-mijnclub.git
cd clubapp-mijnclub

# Afhankelijkheden installeren
npm install
cd functions && npm install && cd ..

# .env.local aanmaken (kopieer inhoud uit jouw ENV_LOCAL secret)
# Maak het bestand aan en plak de inhoud

# Ontwikkelserver starten
npm run dev
# App opent op http://localhost:5173
```

> **Let op bij bouwen:** de buildstap valideert of `VITE_APPCHECK_KEY` aanwezig is. Ontbreekt deze variabele, dan stopt de build met een fout. Je kan dit omzeilen voor lokale tests door een tijdelijke waarde mee te geven:
> ```bash
> VITE_APPCHECK_KEY=dummy npm run build
> ```

---

## 7. Functionaliteiten

### Ledenbeheer

- Leden toevoegen via een wizard (3 stappen: persoonsgegevens, lidmaatschap, contactinfo)
- Bulkimport via CSV-bestand (atomair, max. 499 leden per batch)
- Ledenprofiel: 3 tabbladen — Profiel, Lidmaatschap, Activiteit
- Gordel en leeftijdsgroep bijhouden
- Bijdrage betaald/niet betaald (enkel aanpasbaar door bestuur)
- Vergunningsnummer en inschrijvingsjaar registreren
- Medische informatie en noodcontacten opslaan
- Lid deactiveren (blijft in database) of definitief verwijderen (enkel admin)
- Lid koppelen aan een gebruikersaccount
- Exporteren naar CSV

### Trainingen

- Trainingsschema per groep en seizoen
- Trainer-modus: mobiel scherm met QR-scanner voor aanwezigheidsregistratie
- Technieken per training vastleggen
- Lesgevers per training aanduiden
- Beschikbaarheid van trainers registreren
- Importeren via Excel

### Technieken

- Databank per categorie (valtechnieken, worpen, grondtechnieken, …)
- KYU-niveau en kleurcodering per techniek
- Koppeling met trainingen

### Wedstrijden, Examens & Evenementen

- Uniforme evenementenpagina met tabbladen per type
- Deelnemers registreren en opvolgen
- Examen-wizard met kandidatenbeheer
- Wedstrijddeelnemers importeren via Excel of e-mail
- Automatische cascade-delete van inschrijvingen bij verwijderen van een evenement

### Winkel

- Productenbeheer met categorieën, varianten en stock
- Kassascherm voor directe verkoop
- Verkoopoverzicht en openstaande schulden
- Automatische push-melding en e-mail bij lage of nul-voorraad

### Uitbetalingen

- Vergoedingsmatrix per lesgever en periode
- Uurloon + km-vergoeding per lesgever-type (instelbaar in Beheer)
- Exporteerbaar naar Excel

### Communicatie

- Bulk-e-mails naar alle leden of een selectie
- Aanpasbare templates met variabelen: `{{naam}}`, `{{datum}}`, `{{club}}`
- Volledig verzendhistoriek

### Rapporten

- Aanwezigheid, examens, leden, lesgevers, trainingen, verkoop, voorraad
- 8 tabbladen, alles exporteerbaar naar Excel

### Beheer

- Gebruikersbeheer: rollen toekennen
- Groepen, lesgeverprofielen, configureerbare lijsten
- Clubinstellingen, seizoensinstellingen
- Auditlogboek (alle wijzigingen, enkel admin)
- E-mailtemplates en push-meldingsinstellingen
- Paginatoegangsbeheer per rol

### Bestuur *(vertrouwelijk, enkel admin en bestuurslid)*

- Bestuursvergaderingen met agenda en verslag
- Actiepunten met verantwoordelijke en deadline
- Vertrouwelijke documenten

---

## 8. Rollen en rechten

### Rolhiërarchie

| Rol | Beschrijving |
|---|---|
| `admin` | Volledige toegang, inclusief harde verwijdering en auditlogboek |
| `bestuurslid` | Administratieve functies, gebruikersbeheer, geen harde verwijdering |
| `trainer` | Trainingen, leden (beperkt), evenementen, aanwezigheid |
| `assistent` | Trainingen bekijken, zichzelf als lesgever koppelen |
| `lid` | Eigen profiel, inschrijvingen, publieke informatie |

### Toegang per pagina (standaard)

| Pagina | admin | bestuurslid | trainer | assistent | lid |
|---|:---:|:---:|:---:|:---:|:---:|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ |
| Ledenbeheer | ✓ | ✓ | — | — | — |
| Trainingen | ✓ | ✓ | ✓ | ✓ | — |
| Technieken | ✓ | ✓ | ✓ | — | — |
| Wedstrijden | ✓ | ✓ | ✓ | — | — |
| Examens | ✓ | ✓ | ✓ | — | — |
| Evenementen | ✓ | ✓ | ✓ | ✓ | ✓ |
| Winkel | ✓ | ✓ | ✓ | — | — |
| Uitbetalingen | ✓ | ✓ | ✓ | ✓ | — |
| Communicatie | ✓ | ✓ | ✓ | — | — |
| Rapporten | ✓ | ✓ | ✓ | — | — |
| Bestuur | ✓ | ✓ | — | — | — |
| Beheer | ✓ | ✓ | — | — | — |

> Paginatoegang is configureerbaar via Beheer → Paginatoegang.

### Veldrestricties voor trainers

Trainers mogen deze velden bij leden **niet** wijzigen (afgedwongen via Firestore-regels):

- `bijdrageBetaald` en `bijdrageVervaldatum`
- `lidnummer` en `vergunningsnummer`
- `ingeschrevenJaar`

---

## 9. GitHub Secrets — volledig overzicht

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
| `VITE_FB_MEASUREMENT_ID` | — | Analytics ID | idem (weglaten als Analytics uitgeschakeld) |
| `VITE_VAPID_KEY` | ✓ | Web Push VAPID sleutel | Firebase → Projectinstellingen → Cloud Messaging |
| `VITE_APPCHECK_KEY` | ✓ | reCAPTCHA v3 sitesleutel | google.com/recaptcha → jouw site |
| `VITE_CLUB_NAAM` | ✓ | Volledige clubnaam | Zelf invullen |
| `VITE_CLUB_NAAM_KORT` | ✓ | Korte naam | Zelf invullen |
| `VITE_CLUB_STORAGE_PREFIX` | ✓ | Mapprefix in Storage (geen spaties) | Zelf kiezen |
| `VITE_THEME_COLOR` | ✓ | Primaire kleur (hex) | Zelf kiezen |

---

## 10. Firestore-datastructuur

### Hoofdcollecties

| Collectie | Inhoud |
|---|---|
| `users` | Gebruikersprofielen gekoppeld aan Firebase Auth |
| `members` | Leden/judoka's |
| `groepen` | Trainingsgroepen (U7, U9, …) |
| `trainingen` | Trainingsschema per groep en seizoen |
| `technieken` | Judo-technieken databank |
| `events` | Wedstrijden en examens (gefilterd op `type`) |
| `evenementen` | Clubactiviteiten |
| `products` | Merchandise en voorraad |
| `sales` | Verkoophistoriek |
| `communications` | Verzonden e-mails |
| `documents` | Gedeelde bestanden |
| `lesgevers` | Lesgeverprofielen met financiële info |
| `tarieven` | Uurloon en km-vergoeding per type |
| `categorieen` | Leeftijdscategorieën (configureerbaar) |
| `gordels` | Gordels/KYU-niveaus (configureerbaar) |
| `lesgeverTypes` | Types lesgevers (configureerbaar) |
| `mailTemplates` | Aanpasbare e-mailtemplates |
| `settings/club` | Clubinstellingen |
| `settings/seizoen` | Seizoensinstellingen |
| `auditLogs` | Logboek van alle database-wijzigingen |
| `bestuursVergaderingen` | Bestuursvergaderingen (vertrouwelijk) |
| `bestuursActiepunten` | Actiepunten bestuur (vertrouwelijk) |
| `bestuursDocumenten` | Bestuursdocumenten (vertrouwelijk) |
| `notificationTokens` | FCM push-tokens per apparaat |
| `pushFailures` | Mislukte push-meldingen |

### Subcollecties

| Pad | Inhoud |
|---|---|
| `members/{id}/attendance/{datum}` | Aanwezigheidsregistraties per training |
| `trainingen/{id}/technieken/{id}` | Technieken gegeven per training |
| `trainingen/{id}/beschikbaarheid/{uid}` | Trainerbeschikbaarheid |
| `events/{id}/registrations/{memberId}` | Deelnemers per evenement |
| `evenementen/{id}/registrations/{memberId}` | Deelnemers per clubevenement |

---

## 11. Cloud Functions

| Functie | Trigger | Wat doet het |
|---|---|---|
| `verwijderEventSubcollecties` | `events` verwijderd | Verwijdert alle subcollecties |
| `verwijderInschrijvingenBijEvent` | `evenementen` verwijderd | Verwijdert alle inschrijvingen |
| `auditLog_members` | `members` gewijzigd | Schrijft naar `auditLogs` |
| `auditLog_users` | `users` gewijzigd | Schrijft naar `auditLogs` |
| `auditLog_trainingen` | `trainingen` gewijzigd | Schrijft naar `auditLogs` |
| `auditLog_events` | `events` gewijzigd | Schrijft naar `auditLogs` |
| `notifyStockZero` | `products` voorraad wijzigt | Push-melding + e-mail bij lage voorraad |
| `verwerkPushTrigger` | Push-trigger aangemaakt | Verwerkt en logt mislukte push-meldingen |
| `verzendTrainerHerinneringAuto` | Dagelijks (schedule) | Automatische herinnering aan trainers |

---

## 12. Beveiligingsarchitectuur

### Firestore-beveiligingsregels

- Rolcontrole via Firebase Auth JWT-claims met Firestore-fallback (als de claim verouderd is)
- `isBeheerder()` = `admin` of `bestuurslid`
- `isTrainer()` = `trainer` of elke beheerder
- Stock kan nooit negatief worden
- Bestuursdocumenten enkel leesbaar voor `bestuurslid` en `admin`
- Financiële velden van leden enkel aanpasbaar door bestuur

### HTTP-beveiligingsheaders

`firebase.json` stelt de volgende headers in voor alle gehoste pagina's:

| Header | Bescherming tegen |
|---|---|
| `Strict-Transport-Security` | Verbindt HTTPS voor 1 jaar |
| `X-Frame-Options: SAMEORIGIN` | Clickjacking |
| `X-Content-Type-Options: nosniff` | MIME-type aanvallen |
| `Content-Security-Policy` | XSS, ongeautoriseerde scripts/verbindingen |
| `Referrer-Policy` | Lekken van URL-informatie |

### IAM-rollen (Google Cloud)

| Service account | Rol |
|---|---|
| `firebase-adminsdk-*` | Firebase Admin SDK Administrator |
| `[project]@appspot.gserviceaccount.com` | Editor (App Engine default) |

---

## 13. Projectstructuur

```
clubapp-kodokan/
├── .env.example                  # Voorbeeld variabelen (nooit .env.local in Git)
├── .firebaserc                   # Firebase-projectkoppeling ← aanpassen in Stap 14
├── firebase.json                 # Firebase CLI-configuratie
├── firestore.rules               # Firestore beveiligingsregels
├── firestore.indexes.json        # Samengestelde database-indexen
├── storage.rules                 # Storage beveiligingsregels
├── vite.config.js                # Vite build + PWA-manifest
├── index.html                    # HTML-ingangspunt
├── package.json                  # Frontend-afhankelijkheden
│
├── .github/
│   └── workflows/
│       └── deploy.yml            # GitHub Actions deploy-workflow
│
├── public/                       # Statische bestanden (iconen)
│
├── src/
│   ├── App.jsx                   # Routing + sidebar
│   ├── firebase.js               # Firebase initialisatie + App Check
│   ├── config/                   # Centrale configuratie
│   ├── contexts/                 # React-contexten (auth, groepen, …)
│   ├── hooks/                    # Herbruikbare React-hooks
│   ├── pages/                    # Alle paginacomponenten (20 pagina's)
│   ├── components/               # UI-componenten (beheer, dashboard, trainingen, …)
│   ├── services/                 # Firestore CRUD + audit-helpers
│   ├── notifications/            # FCM + e-mail logica
│   ├── utils/                    # Hulpfuncties (datums, seizoen, …)
│   └── styles/                   # Design-tokens en CSS
│
└── functions/
    ├── index.js                  # Alle Cloud Functions
    ├── mailHtmlBuilder.js        # HTML e-mailbouwer
    ├── mailTemplateStore.js      # Template variabele-substitutie
    └── notifications/            # FCM push-dispatcher
```

---

## 14. Problemen oplossen

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

- Heb je Beheer → Club → Clubinstellingen ingevuld?
- Start een nieuwe deploy via GitHub Actions (workflow_dispatch) om de Functions te herdeployen

### Trainer kan bepaalde ledenfields niet opslaan

Dit is correct beveiligingsgedrag. Trainers mogen niet aanpassen:
- Bijdrage betaald/vervaldatum, lidnummer, vergunningsnummer, inschrijvingsjaar

Alleen bestuurslid of admin kan deze velden wijzigen.

### De onboarding-wizard blijft opnieuw verschijnen

Ga naar Firebase Console → Firestore → `users/{uid}` → stel het veld `onboardingVoltooid` in op `true`.

### Push-meldingen werken niet

1. Controleer of `VITE_VAPID_KEY` correct is in het `ENV_LOCAL` secret
2. Start een nieuwe deploy via GitHub Actions
3. Controleer in de browser of de gebruiker toestemming gegeven heeft voor meldingen
4. Bekijk Firestore → collectie `pushFailures` voor foutmeldingen

### Eerste gebruiker heeft geen admin-rol na inloggen

Ga naar Firebase Console → Firestore → `users` → open jouw document → stel `rol` in op `admin` → wacht 1–2 minuten → ververs de app.

### App Check blokkeert de app

1. Ga naar Firebase Console → App Check → Apps → zet Handhaving tijdelijk uit
2. Controleer of `VITE_APPCHECK_KEY` de juiste reCAPTCHA **Sitesleutel** is
3. Controleer of jouw domein (`web.app` en `firebaseapp.com`) toegevoegd is bij de reCAPTCHA-site

### Configuratiewijzigingen zijn niet direct zichtbaar voor andere gebruikers

Andere gebruikers zien wijzigingen in gordels, categorieën of clubinstellingen pas na 1 uur (of na het openen van een nieuw tabblad), vanwege de sessionStorage-cache. Dit is normaal gedrag. De beheerder die de wijziging maakt, ziet ze onmiddellijk omdat de cache na opslaan automatisch ververst wordt.

---

## 15. Licentie

Dit project is ontwikkeld voor intern gebruik door Judo Kodokan Merchtem. Neem contact op met de ontwikkelaar voor gebruik door andere clubs.
