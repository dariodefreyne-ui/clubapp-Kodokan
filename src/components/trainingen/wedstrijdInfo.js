// src/components/trainingen/wedstrijdInfo.js
// Weekendwedstrijden bij een zaterdag-training (zaterdag + zondag).
// Gedeeld door Beheer (Trainingen.jsx) en Trainer-modus.
// Datumrekenen gebeurt in UTC zodat "morgen" nooit verschuift door tijdzones.

function volgendeDag(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function wedstrijdInfoVoorTraining(training, groep, wedstrijdEvents) {
  if (!training?.datum || !wedstrijdEvents?.length) return [];
  if (groep?.dag?.toLowerCase() !== 'zaterdag') return [];
  const cats = groep.categorieen || [];
  const relevant = (e) => {
    const dc = e.doelgroepCodes || [];
    if (dc.length === 0 || cats.length === 0) return true;
    return dc.some(c => cats.includes(c));
  };
  const zondag = volgendeDag(training.datum);
  const maak = (e, dag) => ({ eventId: e.id, naam: e.naam || e.name || 'Wedstrijd', dag });
  return wedstrijdEvents.filter(e => relevant(e) && (e.datum || e.date) === training.datum).map(e => maak(e, 'zaterdag'))
    .concat(wedstrijdEvents.filter(e => relevant(e) && (e.datum || e.date) === zondag).map(e => maak(e, 'zondag')));
}
