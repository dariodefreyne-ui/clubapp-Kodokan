// migreer_trainingen_uren.js
// Eenmalig migratiescript: vult startTijd en eindTijd in op trainingen die
// deze velden missen, door ze op te halen uit de bijhorende groep.
//
// GEBRUIK:
//   1. Zet je Firebase service account JSON in dezelfde map als dit script.
//      (Firebase Console → Project Settings → Service accounts → Generate new private key)
//   2. npm install firebase-admin   (eenmalig, in deze map)
//   3. node migreer_trainingen_uren.js pad/naar/serviceAccount.json
//
// IDEMPOTENT: trainingen die al startTijd én eindTijd hebben worden overgeslagen.
// DROOG: voeg --dry-run toe als argument om enkel te tellen zonder te schrijven.
//        node migreer_trainingen_uren.js serviceAccount.json --dry-run

const admin = require('firebase-admin');

const serviceAccountPath = process.argv[2];
const dryRun = process.argv.includes('--dry-run');

if (!serviceAccountPath) {
  console.error('Gebruik: node migreer_trainingen_uren.js pad/naar/serviceAccount.json [--dry-run]');
  process.exit(1);
}

const serviceAccount = require(require('path').resolve(serviceAccountPath));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const BATCH_SIZE = 400; // Firestore max is 500 writes per batch

async function main() {
  console.log(dryRun ? '🔍 DRY RUN — geen wijzigingen worden opgeslagen\n' : '🚀 Migratie starten...\n');

  // 1. Laad alle groepen en indexeer op id
  console.log('Groepen laden...');
  const groepenSnap = await db.collection('groepen').get();
  const groepen = {};
  groepenSnap.docs.forEach(d => { groepen[d.id] = d.data(); });
  console.log(`  ${Object.keys(groepen).length} groepen geladen\n`);

  // 2. Laad alle trainingen
  console.log('Trainingen laden...');
  const trainingenSnap = await db.collection('trainingen').get();
  console.log(`  ${trainingenSnap.size} trainingen geladen\n`);

  // 3. Filter: trainingen zonder startTijd of eindTijd, maar waarvan de groep wel uren heeft
  const teUpdaten = [];
  let overgeslagenAlIngevuld = 0;
  let overgeslagenGeenGroep = 0;
  let overgeslagenGroepZonderUren = 0;

  for (const doc of trainingenSnap.docs) {
    const t = doc.data();

    // Al ingevuld → overslaan
    if (t.startTijd && t.eindTijd) {
      overgeslagenAlIngevuld++;
      continue;
    }

    const groep = groepen[t.groepId];
    if (!groep) {
      overgeslagenGeenGroep++;
      continue;
    }

    // Groep heeft geen uren ingesteld → niets te doen
    if (!groep.startTijd || !groep.eindTijd) {
      overgeslagenGroepZonderUren++;
      continue;
    }

    teUpdaten.push({
      ref: doc.ref,
      id: doc.id,
      groepNaam: groep.naam || t.groepId,
      startTijd: groep.startTijd,
      eindTijd: groep.eindTijd,
    });
  }

  console.log('Analyse:');
  console.log(`  Al ingevuld (overgeslagen):       ${overgeslagenAlIngevuld}`);
  console.log(`  Groep niet gevonden (overgeslagen): ${overgeslagenGeenGroep}`);
  console.log(`  Groep zonder uren (overgeslagen):  ${overgeslagenGroepZonderUren}`);
  console.log(`  Te updaten:                        ${teUpdaten.length}\n`);

  if (teUpdaten.length === 0) {
    console.log('✅ Niets te doen — alle trainingen zijn al up-to-date.');
    return;
  }

  if (dryRun) {
    console.log('Eerste 10 te updaten trainingen (voorbeeld):');
    teUpdaten.slice(0, 10).forEach(t => {
      console.log(`  ${t.id}  groep="${t.groepNaam}"  ${t.startTijd} – ${t.eindTijd}`);
    });
    if (teUpdaten.length > 10) console.log(`  ... en nog ${teUpdaten.length - 10} meer`);
    console.log('\nVoer zonder --dry-run uit om de wijzigingen door te voeren.');
    return;
  }

  // 4. Schrijf in batches
  let geschreven = 0;
  for (let i = 0; i < teUpdaten.length; i += BATCH_SIZE) {
    const chunk = teUpdaten.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    chunk.forEach(({ ref, startTijd, eindTijd }) => {
      batch.update(ref, { startTijd, eindTijd });
    });
    await batch.commit();
    geschreven += chunk.length;
    console.log(`  Batch geschreven: ${geschreven}/${teUpdaten.length}`);
  }

  console.log(`\n✅ Migratie voltooid — ${geschreven} trainingen bijgewerkt.`);
}

main().catch(e => {
  console.error('❌ Fout tijdens migratie:', e);
  process.exit(1);
});
