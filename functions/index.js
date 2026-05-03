const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
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
