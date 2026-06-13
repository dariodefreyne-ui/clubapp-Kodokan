// functions/mailHtmlBuilder.js
// Bouwt de HTML-structuur van uitgaande mails.
// Kopie van src/notifications/mailTemplate.js voor gebruik in Cloud Functions (CommonJS).

/**
 * Bouw een standaard HTML-mailtemplate met donker thema.
 * @param {string} titel     - Hoofdtitel in de header
 * @param {string} inhoud    - HTML-inhoud van de mail
 * @param {string} clubnaam  - Naam van de club (brandbar)
 * @param {{label:string,url:string}|null} cta - Optionele knop onderaan de inhoud
 */
function bouwMailHtml(titel, inhoud, clubnaam = 'Kodokan Merchtem', cta = null) {
  const ctaHtml = cta?.url
    ? `<div style="text-align:center;margin:30px 0;">
        <a href="${cta.url}" style="display:inline-block;background-color:#d99999;color:#2a2a2a;padding:16px 40px;text-decoration:none;border-radius:4px;font-weight:700;font-size:16px;">→ ${cta.label || 'Open de app'}</a>
       </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#1e1e1e;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#2a2a2a;">
    <div style="background:#2a2a2a;padding:30px 20px;border-bottom:4px solid #d99999;">
      <h1 style="margin:0;font-size:28px;font-weight:700;color:#ffffff;line-height:1.2;">${titel}</h1>
    </div>
    <div style="background:#d99999;padding:20px;text-align:center;">
      <p style="margin:0;font-size:18px;font-weight:700;color:#2a2a2a;">${clubnaam}</p>
    </div>
    <div style="padding:30px 20px;background:#2a2a2a;">
      <div style="color:#e0e0e0;font-size:15px;line-height:1.6;">${inhoud}</div>
      ${ctaHtml}
    </div>
    <div style="background:#222222;padding:20px;border-top:1px solid #444444;">
      <p style="margin:0;color:#888888;font-size:12px;line-height:1.6;">
        Dit is een automatische melding van de ${clubnaam} Clubapp.<br>
        Wijzig je meldingsvoorkeuren via de app.
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Haal clubnaam én app-URL op uit settings/club.
 * appUrl: Firestore settings/club.appUrl, fallback naar Firebase Hosting URL
 * afgeleid van het project-ID (GCLOUD_PROJECT env var).
 */
async function getClubSettings(db) {
  const projectId = process.env.GCLOUD_PROJECT || '';
  const fallbackUrl = projectId ? `https://${projectId}.web.app` : '';
  try {
    const snap = await db.collection('settings').doc('club').get();
    if (!snap.exists) return { naam: 'Kodokan Merchtem', appUrl: fallbackUrl };
    const data = snap.data();
    return {
      naam: data.naamKort || data.clubname || data.naam || 'Kodokan Merchtem',
      appUrl: data.appUrl || fallbackUrl,
    };
  } catch {
    return { naam: 'Kodokan Merchtem', appUrl: fallbackUrl };
  }
}

// Backwards-compatibel alias voor call sites die alleen de naam nodig hebben.
async function getClubNaam(db) {
  const { naam } = await getClubSettings(db);
  return naam;
}

module.exports = { bouwMailHtml, getClubNaam, getClubSettings };
