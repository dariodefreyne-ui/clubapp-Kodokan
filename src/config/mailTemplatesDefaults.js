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
      '<tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:600;width:120px;">Naam</td>' +
      '<td style="padding:8px 12px;">{{naam}}</td></tr>' +
      '<tr><td style="padding:8px 12px;background:#f5f5f5;font-weight:600;">E-mail</td>' +
      '<td style="padding:8px 12px;">{{email}}</td></tr>' +
      '</table>',
    variabelen: ['naam', 'email'],
  },
};

// Lijst van keys voor de Beheer-UI dropdown
export const MAIL_TEMPLATE_KEYS = Object.keys(MAIL_TEMPLATE_DEFAULTS);
