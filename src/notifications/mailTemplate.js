// src/notifications/mailTemplate.js
// Centrale HTML-mailtemplate. Gedeeld tussen front-end (verstuurMail.js)
// en Cloud Functions (functions/index.js importeert zijn eigen kopie).

/**
 * Bouw een standaard HTML-mailtemplate.
 * @param {string} titel     - Hoofdtitel bovenaan de mail
 * @param {string} inhoud    - HTML-inhoud (mag <table>, <p> bevatten)
 * @param {string} clubnaam  - Naam van de club (default: Kodokan Merchtem)
 * @returns {string}         - Volledige HTML-string
 */
export function bouwMailHtml(titel, inhoud, clubnaam = 'Kodokan Merchtem') {
  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="background:#c0392b;padding:20px 24px;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:bold;">${clubnaam}</h1>
    </div>
    <div style="padding:24px;">
      <h2 style="margin:0 0 16px 0;color:#1a1a1a;font-size:18px;">${titel}</h2>
      <div style="color:#333333;font-size:14px;line-height:1.6;">${inhoud}</div>
    </div>
    <div style="background:#f5f5f5;padding:16px 24px;border-top:1px solid #e0e0e0;">
      <p style="margin:0;color:#888888;font-size:12px;">
        Dit is een automatische melding van de ${clubnaam} Clubapp.<br>
        Wijzig je meldingsvoorkeuren via de app.
      </p>
    </div>
  </div>
</body>
</html>`;
}
