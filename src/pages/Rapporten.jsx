// src/pages/Rapporten.jsx — shell
// Seizoensbeheer, tab-navigatie en data-caching.
// Data-fetching: src/hooks/useRapportenData.js
// UI per tab:    src/components/rapporten/
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  huidigSeizoenStartJaar, beschikbareSeizoenStartJaren, seizoenBereikVanJaar,
} from '../utils/seizoenUtils';
import { useLesgeversRealtime } from '../hooks/useLesgeversRealtime';
import { C } from '../styles/tokens';
import {
  laadMembers, laadTrainingData, laadLedenData, laadWedstrijdenData,
  laadAanwezigheid, laadWinkel, laadVerkoop, laadExamens,
} from '../hooks/useRapportenData';
import { S } from '../components/rapporten/RapportenStyles';
import TrainingenTab   from '../components/rapporten/TrainingenTab';
import LesgeversTab    from '../components/rapporten/LesgeversTab';
import LedenTab        from '../components/rapporten/LedenTab';
import WedstrijdenTab  from '../components/rapporten/WedstrijdenTab';
import AanwezigheidTab from '../components/rapporten/AanwezigheidTab';
import WinkelTab       from '../components/rapporten/WinkelTab';
import VerkoopTab      from '../components/rapporten/VerkoopTab';
import ExamensTab      from '../components/rapporten/ExamensTab';
import { useToast } from '../components/ui/Toast';

const TABS = [
  { id:'trainingen',   label:'🥋 Trainingen' },
  { id:'lesgevers',    label:'👥 Lesgevers' },
  { id:'leden',        label:'📈 Leden' },
  { id:'wedstrijden',  label:'🏆 Wedstrijden' },
  { id:'aanwezigheid', label:'📅 Aanwezigheid' },
  { id:'winkel',       label:'📦 Winkel' },
  { id:'verkoop',      label:'💳 Verkoop' },
  { id:'examens',      label:'📘 Examens' },
];

export default function Rapporten() {
  const toast = useToast();
  const { isBeheerder } = useAuth();
  const { lesgevers: lesgeversData } = useLesgeversRealtime();
  // Filter inactieve/oude lesgever-records weg, anders kan vindLesgever() een
  // verlaten record met een verouderde naam matchen i.p.v. het actieve record
  // (zelfde lesgever-id, maar de naam op het oude record is niet meegewijzigd).
  const lesgeversLijst = lesgeversData.filter(l => l.actief !== false);

  const seizoenen = beschikbareSeizoenStartJaren().filter(j => j <= huidigSeizoenStartJaar());

  const [seizoenJaar, setSeizoenJaar] = useState(() => huidigSeizoenStartJaar());
  const [tab,         setTab]         = useState('trainingen');
  const [cache,       setCache]       = useState({});
  const [loading,     setLoading]     = useState(false);
  const [members,      setMembers]      = useState(null);
  const [membersLaden, setMembersLaden] = useState(true);

  if (!isBeheerder) {
    return (
      <div style={{ padding:'40px', textAlign:'center', color:C.textPrimary }}>
        <div style={{ fontSize:'48px', marginBottom:'16px' }}>🔒</div>
        <div style={{ color:C.textSec }}>Rapporten zijn enkel beschikbaar voor admin of bestuurslid.</div>
      </div>
    );
  }

  // trainingen en lesgevers tabs delen dezelfde Firestore-data
  const sharedTrainKey = `_train:${seizoenJaar}`;
  const cacheKey = tab === 'winkel'
    ? 'winkel'
    : (tab === 'trainingen' || tab === 'lesgevers')
      ? `${tab}:${seizoenJaar}`
      : `${tab}:${seizoenJaar}`;

  useEffect(() => {
    laadMembers()
      .then(data => setMembers(data))
      .catch(err => console.error('Members laden mislukt:', err))
      .finally(() => setMembersLaden(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cache[cacheKey]) return;

    const tabNeedsMembers = ['leden', 'wedstrijden', 'aanwezigheid'].includes(tab);
    if (tabNeedsMembers && members === null) return;

    setLoading(true);
    const bereik = seizoenBereikVanJaar(seizoenJaar);

    async function laden() {
      try {
        if (tab === 'trainingen' || tab === 'lesgevers') {
          const data = cache[sharedTrainKey] || await laadTrainingData(bereik);
          setCache(prev => ({
            ...prev,
            [sharedTrainKey]: data,
            [`trainingen:${seizoenJaar}`]: data,
            [`lesgevers:${seizoenJaar}`]: data,
          }));
        } else if (tab === 'leden') {
          const data = await laadLedenData(bereik, seizoenJaar, members);
          setCache(prev => ({ ...prev, [cacheKey]: data }));
        } else if (tab === 'wedstrijden') {
          const data = await laadWedstrijdenData(bereik, members);
          setCache(prev => ({ ...prev, [cacheKey]: data }));
        } else if (tab === 'aanwezigheid') {
          const data = await laadAanwezigheid(bereik, members);
          setCache(prev => ({ ...prev, [cacheKey]: data }));
        } else if (tab === 'winkel') {
          const data = await laadWinkel();
          setCache(prev => ({ ...prev, winkel: data }));
        } else if (tab === 'verkoop') {
          const data = await laadVerkoop(bereik);
          setCache(prev => ({ ...prev, [cacheKey]: data }));
        } else if (tab === 'examens') {
          const data = await laadExamens(bereik);
          setCache(prev => ({ ...prev, [cacheKey]: data }));
        }
      } catch (err) {
        console.error('Rapport laden mislukt:', err);
        toast({ bericht: 'Fout bij laden rapport', type: 'error' });
      } finally {
        setLoading(false);
      }
    }

    laden();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, seizoenJaar, members]);

  const tabData         = cache[cacheKey];
  const bereik          = seizoenBereikVanJaar(seizoenJaar);
  const tabNeedsMembers = ['leden', 'wedstrijden', 'aanwezigheid'].includes(tab);
  const isLoading       = loading || (tabNeedsMembers && membersLaden);

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>📊 Rapporten</h1>
        <p style={S.subtitle}>Overzichten en statistieken per seizoen</p>
      </div>

      {/* Seizoenkiezer */}
      <div style={{ marginBottom:'16px' }}>
        <div style={S.sLabel}>Seizoen</div>
        <div style={S.chipRij}>
          {seizoenen.map(jaar => (
            <button key={jaar} style={S.chip(seizoenJaar===jaar)} onClick={() => setSeizoenJaar(jaar)}>
              {seizoenBereikVanJaar(jaar).label}
            </button>
          ))}
        </div>
        <div style={{ fontSize:'12px', color:C.textMuted }}>{bereik.start} → {bereik.einde}</div>
      </div>

      {/* Tabbladen */}
      <div style={S.tabBar}>
        {TABS.map(({ id, label }) => (
          <button key={id} style={S.tab(tab===id)} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {isLoading && (
        <div style={{ color:C.textMuted, textAlign:'center', padding:'48px', fontSize:'14px' }}>Berekenen…</div>
      )}

      {!isLoading && tabData && (
        <>
          {tab === 'trainingen'   && <TrainingenTab   trainingen={tabData.trainingen} groepenMap={tabData.groepenMap} />}
          {tab === 'lesgevers'    && <LesgeversTab    trainingen={tabData.trainingen} lesgeversLijst={lesgeversLijst} tarieven={tabData.tarieven} />}
          {tab === 'leden'        && <LedenTab        data={tabData} seizoenJaar={seizoenJaar} />}
          {tab === 'wedstrijden'  && <WedstrijdenTab  data={tabData} seizoenLabel={bereik.label} />}
          {tab === 'aanwezigheid' && <AanwezigheidTab leden={tabData} />}
          {tab === 'winkel'       && <WinkelTab       data={tabData} />}
          {tab === 'verkoop'      && <VerkoopTab      data={tabData} />}
          {tab === 'examens'      && <ExamensTab      examens={tabData} />}
        </>
      )}
    </div>
  );
}
