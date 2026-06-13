// src/config/mailTemplatesDefaults.js
// Default-templates voor systeemmails. Worden in Firestore opgeslagen in
// mailTemplates/{key} en kunnen via Beheer aangepast worden.
//
// Variabelen worden gesubstitueerd via {{naam}}-syntaxis. Welke variabelen
// elke template ondersteunt, staat in het `variabelen` array (puur info voor
// de Beheer-UI; de daadwerkelijke substitutie gebeurt server-side).

export const MAIL_TEMPLATE_DEFAULTS = {
  'stock-alert': {
    naam: 'Stock-waarschuwing',
    omschrijving: 'Verstuurd wanneer voorraad onder de drempel zakt.',
    onderwerp: 'Stockwaarschuwing: {{product}}',
    titel: 'Stock onder drempel',
    inhoud:
      '<p>Hallo bestuur,</p>' +
      '<p>De voorraad van <strong>{{product}}</strong> is gezakt tot <strong>{{aantal}}</strong> stuks ' +
      '(drempel: {{drempel}}).</p>' +
      '<p>Controleer de voorraad in de Clubapp onder Winkel.</p>',
    variabelen: ['product', 'aantal', 'drempel'],
  },
  'trainer-ontbreekt': {
    naam: 'Trainer ontbreekt',
    omschrijving: 'Verstuurd wanneer trainingen geen lesgever toegewezen hebben.',
    onderwerp: '{{aantalTrainingen}} training(en) zonder trainer — {{groep}}',
    titel: 'Trainer ontbreekt',
    inhoud:
      '<p>Voor de groep <strong>{{groep}}</strong> zijn er ' +
      '<strong>{{aantalTrainingen}}</strong> aankomende training(en) zonder lesgever.</p>' +
      '<p>{{trainingen}}</p>' +
      '<p>Gelieve een lesgever in te vullen via de Clubapp onder Trainingen.</p>',
    variabelen: ['groep', 'aantalTrainingen', 'trainingen'],
  },
  'assistent-ontbreekt': {
    naam: 'Assistent ontbreekt',
    omschrijving: 'Verstuurd wanneer trainingen van een groep met assistentplicht geen assistent toegewezen hebben.',
    onderwerp: '{{aantalTrainingen}} training(en) zonder assistent — {{groep}}',
    titel: 'Assistent ontbreekt',
    inhoud:
      '<p>Voor de groep <strong>{{groep}}</strong> zijn er ' +
      '<strong>{{aantalTrainingen}}</strong> aankomende training(en) zonder assistent.</p>' +
      '<p>{{trainingen}}</p>' +
      '<p>Gelieve een assistent te regelen of in te vullen via de Clubapp onder Trainingen.</p>',
    variabelen: ['groep', 'aantalTrainingen', 'trainingen'],
  },
  'nieuw-tornooi': {
    naam: 'Nieuwe wedstrijd',
    omschrijving: 'Verstuurd naar leden bij een nieuw tornooi.',
    onderwerp: 'Nieuw tornooi: {{naam}}{{datumSuffix}}',
    titel: 'Nieuw tornooi toegevoegd',
    inhoud:
      '<p>Er is een nieuw tornooi toegevoegd in de Clubapp:</p>' +
      '<p><strong>{{naam}}</strong><br>' +
      'Datum: {{datum}}<br>' +
      'Locatie: {{locatie}}</p>' +
      '<p>Bekijk de details en schrijf judoka\'s in via de Clubapp onder Wedstrijden.</p>',
    variabelen: ['naam', 'datum', 'locatie', 'datumSuffix'],
  },
  'nieuw-lid': {
    naam: 'Nieuw lid geregistreerd',
    omschrijving: 'Verstuurd naar bestuur bij elke nieuwe registratie.',
    onderwerp: 'Nieuw lid: {{naam}}',
    titel: 'Nieuw lid geregistreerd',
    inhoud:
      '<p>Er heeft zich een nieuw lid geregistreerd in de Clubapp.</p>' +
      '<table style="border-collapse:collapse;width:100%;margin-top:12px;">' +
      '<tr><td style="padding:8px 12px;background:#333333;color:#aaaaaa;font-weight:600;width:120px;">Naam</td>' +
      '<td style="padding:8px 12px;">{{naam}}</td></tr>' +
      '<tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:600;">E-mail</td>' +
      '<td style="padding:8px 12px;">{{email}}</td></tr>' +
      '</table>',
    variabelen: ['naam', 'email'],
  },
  'welkom-lid': {
    naam: 'Welkom nieuw lid',
    omschrijving: 'Verstuurd naar het nieuwe lid zelf bij aanmaak van hun account.',
    onderwerp: 'Welkom bij {{clubnaam}}, {{naam}}!',
    titel: 'Welkom bij {{clubnaam}}',
    inhoud:
      '<p>Hallo {{naam}},</p>' +
      '<p>Jouw account is aangemaakt in de Clubapp van <strong>{{clubnaam}}</strong>. Je kan nu inloggen en de app gebruiken.</p>' +
      '<p>Bij vragen kan je altijd terecht bij het bestuur.</p>' +
      '<p>Tot op de tatami!</p>',
    variabelen: ['naam', 'clubnaam'],
  },
  'rol-gewijzigd': {
    naam: 'Rol gewijzigd',
    omschrijving: 'Verstuurd naar een gebruiker wanneer hun rol in de app veranderd is.',
    onderwerp: 'Jouw rol in {{clubnaam}} is gewijzigd',
    titel: 'Rolwijziging in de Clubapp',
    inhoud:
      '<p>Hallo {{naam}},</p>' +
      '<p>Een beheerder heeft jouw rol in de Clubapp van <strong>{{clubnaam}}</strong> gewijzigd.</p>' +
      '<table style="border-collapse:collapse;width:100%;margin-top:12px;">' +
      '<tr><td style="padding:8px 12px;background:#333333;color:#aaaaaa;font-weight:600;width:140px;">Vorige rol</td>' +
      '<td style="padding:8px 12px;">{{oudeRolLabel}}</td></tr>' +
      '<tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:600;">Nieuwe rol</td>' +
      '<td style="padding:8px 12px;"><strong>{{nieuweRolLabel}}</strong></td></tr>' +
      '</table>' +
      '<p style="margin-top:16px;">Jouw toegang en mogelijkheden in de app zijn hierop aangepast. Log opnieuw in om de wijziging te activeren.</p>',
    variabelen: ['naam', 'clubnaam', 'oudeRolLabel', 'nieuweRolLabel'],
  },
  'kalender-overzicht': {
    naam: 'Wedstrijdkalender overzicht',
    omschrijving: 'Verstuurd bij een update van de wedstrijdkalender.',
    onderwerp: 'Wedstrijdkalender {{seizoenLabel}} — overzicht',
    titel: 'Wedstrijdkalender bijgewerkt',
    inhoud:
      '<p>De wedstrijdkalender voor het seizoen <strong>{{seizoenLabel}}</strong> werd bijgewerkt.</p>' +
      '{{samenvatting}}' +
      '<p>Volledig overzicht van alle tornooien dit seizoen:</p>' +
      '{{overzichtHtml}}' +
      '<p style="margin-top:16px;font-size:12px;color:#666;">' +
      '✦ = nieuw toegevoegd &nbsp;|&nbsp; <s>doorgestreept</s> = verwijderd uit kalender' +
      '</p>' +
      '<p>Bekijk de details en schrijf judoka\'s in via de Clubapp onder Wedstrijden.</p>',
    variabelen: ['seizoenLabel', 'samenvatting', 'overzichtHtml'],
  },
};

// Lijst van keys voor de Beheer-UI dropdown
export const MAIL_TEMPLATE_KEYS = Object.keys(MAIL_TEMPLATE_DEFAULTS);
