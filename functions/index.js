const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

admin.initializeApp();

exports.notifyStockZero = onDocumentUpdated({
  document: 'products/{productId}',
  region: 'europe-west1',
}, async (event) => {
  const before = event.data.before.data() || {};
  const after = event.data.after.data() || {};

  const beforeStock = Number(before.stock || 0);
  const afterStock = Number(after.stock || 0);

  if (!(beforeStock > 0 && afterStock === 0)) {
    return;
  }

  if (after.active === false) {
    return;
  }

  const db = admin.firestore();
  const productId = event.params.productId;
  const naam = after.name || after.naam || 'Product';
  const variant = after.variant || '';
  const category = after.category || '';
  const tweedehands = after.tweedehands === true;

  const alertRef = await db.collection('stockAlerts').add({
    productId,
    naam,
    variant,
    category,
    tweedehands,
    beforeStock,
    afterStock,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    sent: false,
  });

  const tokensSnap = await db.collection('notificationTokens')
    .where('active', '==', true)
    .where('stockAlerts', '==', true)
    .get();

  const tokens = [];
  tokensSnap.forEach(doc => {
    const token = doc.data().token;
    if (token) tokens.push(token);
  });

  if (!tokens.length) {
    await alertRef.update({ sent: false, reason: 'Geen actieve tokens' });
    return;
  }

  const title = 'Stock op 0';
  const body = `${naam} ${variant}`.trim();
  const payloadBase = {
    notification: {
      title,
      body,
    },
    data: {
      type: 'stock_zero',
      productId,
      naam: String(naam),
      variant: String(variant),
      category: String(category),
      tweedehands: tweedehands ? 'true' : 'false',
      url: '/winkel',
    },
    webpush: {
      fcmOptions: {
        link: '/winkel',
      },
      notification: {
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
      },
    },
  };

  const invalidTokens = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500);
    const response = await admin.messaging().sendEachForMulticast({
      ...payloadBase,
      tokens: batch,
    });

    successCount += response.successCount;
    failureCount += response.failureCount;

    response.responses.forEach((result, index) => {
      if (!result.success) {
        const code = result.error?.code || '';
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          invalidTokens.push(batch[index]);
        }
      }
    });
  }

  await Promise.all(invalidTokens.map(token =>
    db.collection('notificationTokens').doc(token).set({
      active: false,
      stockAlerts: false,
      invalidatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
  ));

  await alertRef.update({
    sent: successCount > 0,
    successCount,
    failureCount,
    invalidTokens: invalidTokens.length,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
  });
});

exports.checkTrainingZonderLesgever = onSchedule({
  schedule: '0 9 * * 3,6',
  region: 'europe-west1',
  timeZone: 'Europe/Brussels',
}, async () => {
  const db = admin.firestore();

  // Datum range: vandaag tot vandaag + 5 dagen
  const nu = new Date();
  const over5 = new Date(nu);
  over5.setDate(nu.getDate() + 5);

  const vandaag = nu.toISOString().slice(0, 10);
  const grens   = over5.toISOString().slice(0, 10);

  const snap = await db.collection('trainingen')
    .where('datum', '>=', vandaag)
    .where('datum', '<=', grens)
    .get();

  if (snap.empty) return;

  const probleemTrainingen = [];
  snap.forEach(doc => {
    const t = doc.data();
    const lesgevers = t.lesgevers || [];
    const opmerking = (t.opmerking || '').toLowerCase();
    const isSporthalGesloten = opmerking.includes('sporthal gesloten');

    if (lesgevers.length === 0 && !isSporthalGesloten) {
      probleemTrainingen.push({ id: doc.id, datum: t.datum, groepId: t.groepId || '' });
    }
  });

  if (probleemTrainingen.length === 0) return;

  const tokenSnap = await db.collection('notificationTokens')
    .where('active', '==', true)
    .where('rol', 'in', ['trainer', 'beheerder'])
    .get();

  const tokens = [];
  tokenSnap.forEach(doc => {
    const token = doc.data().token;
    if (token) tokens.push(token);
  });

  if (tokens.length === 0) return;

  const aantalDagen = probleemTrainingen.length === 1
    ? `training op ${probleemTrainingen[0].datum}`
    : `${probleemTrainingen.length} trainingen`;

  const title = 'Trainer ontbreekt';
  const body  = `${aantalDagen} zonder lesgever de komende 5 dagen.`;

  const payload = {
    notification: { title, body },
    data: {
      type: 'trainer_reminder',
      aantalTrainingen: String(probleemTrainingen.length),
      url: '/trainingen',
    },
    webpush: {
      fcmOptions: { link: '/trainingen' },
      notification: {
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
      },
    },
  };

  const invalidTokens = [];
  let successCount = 0;

  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500);
    const response = await admin.messaging().sendEachForMulticast({
      ...payload,
      tokens: batch,
    });

    successCount += response.successCount;

    response.responses.forEach((result, index) => {
      if (!result.success) {
        const code = result.error?.code || '';
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          invalidTokens.push(batch[index]);
        }
      }
    });
  }

  await Promise.all(invalidTokens.map(token =>
    db.collection('notificationTokens').doc(token).set({
      active: false,
      invalidatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
  ));

  await db.collection('trainerReminders').add({
    uitgevoerdOp: admin.firestore.FieldValue.serverTimestamp(),
    probleemTrainingen,
    successCount,
    failureCount: invalidTokens.length,
    tokenCount: tokens.length,
  });
});
