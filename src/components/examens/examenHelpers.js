// Gedeelde helper-functies voor de examenpagina
import {
  GORDEL_KYU, TYPE_LABELS, TYPE_VOLGORDE, DEFAULT_EXAM_CONFIG,
} from './examenConstants';

export function getDoelKyu(belt, kyuMap = GORDEL_KYU) { return kyuMap[belt] || null; }

export function isTechniekNieuw(t, targetKyu) {
  if (!t?.kyu_graden?.length || !targetKyu) return false;
  return Math.max(...t.kyu_graden.map(Number)) === parseInt(targetKyu);
}

export function getRelevanteTechnieken(allTechnieken, targetBelt, isStreepje, kyuMap) {
  const targetKyu = getDoelKyu(targetBelt, kyuMap);
  if (!targetKyu) return [];
  if (isStreepje) return allTechnieken.filter(t => t.kyu_graden?.includes(targetKyu));
  return allTechnieken.filter(t => t.kyu_graden?.some(k => parseInt(k) >= parseInt(targetKyu)));
}

export function groepeerPerType(technieken) {
  const g = {};
  technieken.forEach(t => { const k = t.type || 'overig'; if (!g[k]) g[k] = []; g[k].push(t); });
  return g;
}

export function bouwInitieleSecties(allTechnieken, targetBelt, isStreepje, kyuMap) {
  const doelKyu = getDoelKyu(targetBelt, kyuMap);
  const relevante = getRelevanteTechnieken(allTechnieken, targetBelt, !!isStreepje, kyuMap)
    .map(t => ({ ...t, isNieuw: isTechniekNieuw(t, doelKyu) }));
  const perType = groepeerPerType(relevante);
  const sortedTypes = TYPE_VOLGORDE
    .filter(type => perType[type]?.length > 0)
    .concat(Object.keys(perType).filter(k => !TYPE_VOLGORDE.includes(k) && perType[k]?.length > 0));
  return sortedTypes.map(type => ({
    categorie: type,
    categorieLabel: TYPE_LABELS[type] || type,
    aantalTeBevragen: Math.min(3, perType[type].length),
    beschikbaar: perType[type],
    aantalNieuw: perType[type].filter(t => t.isNieuw).length,
    technieken: [],
  }));
}

export function selecteerWillekeurig(secties) {
  const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);
  return secties.map(s => {
    if (s.aantalTeBevragen === 0 || !s.beschikbaar?.length) return { ...s, technieken: [] };
    const nieuws = s.beschikbaar.filter(t => t.isNieuw);
    const oud = s.beschikbaar.filter(t => !t.isNieuw);
    let sel = [];
    if (nieuws.length > 0 && s.aantalTeBevragen >= 1) {
      sel.push({ ...shuffle(nieuws)[0], score: null, notitie: '' });
      if (s.aantalTeBevragen > 1) {
        const overige = shuffle([...nieuws.slice(1), ...oud]);
        overige.slice(0, s.aantalTeBevragen - 1).forEach(t => sel.push({ ...t, score: null, notitie: '' }));
      }
    } else {
      shuffle(s.beschikbaar).slice(0, s.aantalTeBevragen).forEach(t => sel.push({ ...t, score: null, notitie: '' }));
    }
    return { ...s, technieken: sel.slice(0, s.aantalTeBevragen) };
  });
}

export function berekenGemiddelde(secties) {
  // Gebruik fase-specifieke scores als die beschikbaar zijn, anders generieke score
  const scores = (secties || [])
    .flatMap(s => s.technieken || [])
    .flatMap(t => {
      const fs = [];
      if (t.basisScore !== null && t.basisScore !== undefined) fs.push(t.basisScore);
      if (t.verdiepingScore !== null && t.verdiepingScore !== undefined) fs.push(t.verdiepingScore);
      if (fs.length === 0 && t.score !== null && t.score !== undefined) fs.push(t.score);
      return fs;
    });
  if (!scores.length) return null;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}

export function classifeerScore(gem, config) {
  if (gem === null || gem === undefined) return null;
  const c = { ...DEFAULT_EXAM_CONFIG, ...(config || {}) };
  if (gem >= c.drempelUitstekend) return 'uitstekend';
  if (gem >= c.drempelGoed) return 'goed';
  return 'onvoldoende';
}

export function getResultTekst(conclusie, config) {
  const c = { ...DEFAULT_EXAM_CONFIG, ...(config || {}) };
  if (conclusie === 'uitstekend') return c.tekstUitstekend;
  if (conclusie === 'goed') return c.tekstGoed;
  return c.tekstOnvoldoende;
}

export function alleGescored(secties) {
  if (!secties?.length) return false;
  const techs = secties.flatMap(s => s.technieken || []);
  return techs.length > 0 && techs.every(t => t.score !== null && t.score !== undefined);
}

export function bouwFirestoreSecties(secties) {
  return secties
    .filter(s => s.aantalTeBevragen > 0 && s.technieken?.length > 0)
    .map(s => ({
      categorie: s.categorie,
      categorieLabel: s.categorieLabel,
      aantalTeBevragen: s.aantalTeBevragen,
      technieken: s.technieken.map(t => ({
        id: t.id || '',
        naam: t.techniek || t.naam || '',
        kyu: String(t.kyu_graden?.[0] || ''),
        isNieuw: !!t.isNieuw,
        score: t.score ?? null,
        basisScore: t.basisScore ?? null,
        verdiepingScore: t.verdiepingScore ?? null,
        notitie: t.notitie || '',
      })),
    }));
}

export function herstelSecties(examSecties, allTechnieken, targetBelt, isStreepje, kyuMap) {
  const doelKyu = getDoelKyu(targetBelt, kyuMap);
  const relevante = getRelevanteTechnieken(allTechnieken, targetBelt, !!isStreepje, kyuMap)
    .map(t => ({ ...t, isNieuw: isTechniekNieuw(t, doelKyu) }));
  const perType = groepeerPerType(relevante);
  return examSecties.map(s => ({
    ...s,
    beschikbaar: perType[s.categorie] || [],
    aantalNieuw: (perType[s.categorie] || []).filter(t => t.isNieuw).length,
  }));
}

// Geeft 'gepland' | 'vandaag' | 'voorbij'
export function getExamenStatus(event) {
  const datum = event?.datum || event?.date || '';
  if (!datum) return 'gepland';
  const today = new Date().toISOString().slice(0, 10);
  if (datum > today) return 'gepland';
  if (datum === today) return 'vandaag';
  return 'voorbij';
}

export function formatDatumNL(datum) {
  if (!datum) return '';
  try {
    return new Date(datum + 'T12:00:00').toLocaleDateString('nl-BE', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return datum; }
}

export function formatDatumKort(datum) {
  if (!datum) return '';
  try {
    return new Date(datum + 'T12:00:00').toLocaleDateString('nl-BE', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return datum; }
}

// 'basis' | 'verdieping' | null afhankelijk van targetKyu en techniek-velden
export function getTechniekFase(t, targetKyu) {
  if (!targetKyu || !t) return null;
  const kyu = parseInt(targetKyu);
  if (parseInt(t.basis_vanaf_kyu) === kyu) return 'basis';
  if (parseInt(t.verdieping_vanaf_kyu) === kyu) return 'verdieping';
  return null;
}
