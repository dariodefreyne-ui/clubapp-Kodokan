// functions/mailTemplateStore.js
// Helper voor het laden van mail-templatedata uit Firestore met fallback op defaults.
// Variabelen-substitutie via {{naam}}-syntaxis.

const DEFAULTS = {
  'stock-alert': {
    onderwerp: 'Stockwaarschuwing: {{product}}',
    titel: 'Stock onder drempel',
    inhoud:
      '<p>Hallo bestuur,</p>' +
      '<p>De voorraad van <strong>{{product}}</strong> is gezakt tot <strong>{{aantal}}</strong> stuks ' +
      '(drempel: {{drempel}}).</p>' +
      '<p>Controleer de voorraad in de Clubapp onder Winkel.</p>',
  },
  'trainer-ontbreekt': {
    onderwerp: '{{aantalTrainingen}} training(en) zonder trainer — {{groep}}',
    titel: 'Trainer ontbreekt',
    inhoud:
      '<p>Voor de groep <strong>{{groep}}</strong> zijn er ' +
      '<strong>{{aantalTrainingen}}</strong> aankomende training(en) zonder lesgever.</p>' +
      '<p>{{trainingen}}</p>' +
      '<p>Gelieve een lesgever in te vullen via de Clubapp onder Trainingen.</p>',
  },
  'assistent-ontbreekt': {
    onderwerp: '{{aantalTrainingen}} training(en) zonder assistent — {{groep}}',
    titel: 'Assistent ontbreekt',
    inhoud:
      '<p>Voor de groep <strong>{{groep}}</strong> zijn er ' +
      '<strong>{{aantalTrainingen}}</strong> aankomende training(en) zonder assistent.</p>' +
      '<p>{{trainingen}}</p>' +
      '<p>Gelieve een assistent te regelen of in te vullen via de Clubapp onder Trainingen.</p>',
  },
  'nieuw-tornooi': {
    onderwerp: 'Nieuw tornooi: {{naam}}{{datumSuffix}}',
    titel: 'Nieuw tornooi toegevoegd',
    inhoud:
      '<p>Er is een nieuw tornooi toegevoegd in de Clubapp:</p>' +
      '<p><strong>{{naam}}</strong><br>' +
      'Datum: {{datum}}<br>' +
      'Locatie: {{locatie}}</p>' +
      '<p>Bekijk de details en schrijf judoka\'s in via de Clubapp onder Wedstrijden.</p>',
  },
  'nieuw-lid': {
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
  },
  'kalender-overzicht': {
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
  },
};

function applyVars(tekst, vars) {
  return String(tekst || '').replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] !== undefined ? String(vars[k]) : '');
}

/**
 * Laadt template uit Firestore (mailTemplates/{key}); fallback op default.
 * Past variabele-substitutie toe op onderwerp, titel en inhoud.
 * @returns {Promise<{onderwerp:string,titel:string,inhoud:string}>}
 */
async function getMailTemplate(db, key, vars = {}) {
  let template = DEFAULTS[key] || { onderwerp: key, titel: key, inhoud: '' };
  try {
    const snap = await db.collection('mailTemplates').doc(key).get();
    if (snap.exists) {
      const data = snap.data();
      template = {
        onderwerp: data.onderwerp ?? template.onderwerp,
        titel: data.titel ?? template.titel,
        inhoud: data.inhoud ?? template.inhoud,
      };
    }
  } catch (e) {
    console.warn(`getMailTemplate(${key}) gebruik fallback:`, e.message);
  }
  return {
    onderwerp: applyVars(template.onderwerp, vars),
    titel: applyVars(template.titel, vars),
    inhoud: applyVars(template.inhoud, vars),
  };
}

module.exports = { getMailTemplate, applyVars };
