// src/pages/ProfielPagina.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import {
  RUBRIEKEN,
  rubriekenVoorRol,
  standaardVoorkeurenVoorRol,
} from '../notifications/notificationCategories';
import { getMemberById, getMembersByIds, updateMemberProfile, voegGezinslinkToe, getGezinslinkenVoorOuder } from '../services/firestoreService';
import { C, cardStyle } from '../styles/tokens';
import { useToast } from '../components/ui/Toast.jsx';
import { useGordelOpties } from '../hooks/useGordelOpties';

const S = {
  page: { minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '16px' },
  label: { display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  input: { width: '100%', padding: '12px 14px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 'var(--font-size-md)', marginBottom: '14px', boxSizing: 'border-box' },
  rolBadge: (r) => ({ display: 'inline-block', padding: '4px 14px', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-sm)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', background: (r === 'admin' || r === 'bestuurslid') ? 'var(--accent-red)' : '#2980b9', color: 'var(--text-primary)' }),
  saveBtn: { background: 'var(--accent-red)', border: 'none', color: 'var(--text-primary)', padding: '12px 24px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--font-size-md)', fontWeight: '600' },
  success: { background: 'rgba(39,174,96,0.15)', border: '1px solid var(--success)', borderRadius: 'var(--radius-md)', padding: '10px 14px', color: 'var(--success)', fontSize: 'var(--font-size-md)', marginBottom: '12px' },
  groepTag: (actief) => ({ padding: '8px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--font-size-md)', fontWeight: '600', background: actief ? 'var(--accent-red)' : 'var(--bg-primary)', border: `1px solid ${actief ? 'var(--accent-red)' : 'var(--border-color)'}`, color: 'var(--text-primary)' }),
  toggle: (actief) => ({ width: '46px', height: '26px', borderRadius: '13px', background: actief ? 'var(--accent-red)' : 'var(--border-color)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }),
  toggleDot: (actief) => ({ position: 'absolute', top: '3px', left: actief ? '23px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: 'var(--text-primary)', transition: 'left 0.2s' }),
};

const SECTIONS = [
  {
    id: 'gegevens',
    icon: '📋',
    label: 'Persoonlijke gegevens',
    desc: 'Contactinfo & noodcontact',
    accentDim: C.redDim,
  },
  {
    id: 'groepen',
    icon: '🏷️',
    label: 'Mijn groepen',
    desc: 'Standaard trainingsgroepen',
    accentDim: C.blueDim,
  },
  {
    id: 'meldingen',
    icon: '🔔',
    label: 'Meldingen',
    desc: 'Notificaties & voorkeuren',
    accentDim: C.orangeDim,
  },
  {
    id: 'agenda',
    icon: '📅',
    label: 'Agenda',
    desc: 'Standaard agendafilters',
    accentDim: C.greenDim,
  },
  {
    id: 'gezin',
    icon: '👨‍👩‍👦',
    label: 'Gezin',
    desc: 'Kinderen beheren',
    accentDim: C.purpleDim,
  },
];

function TileGrid({ items, onSelect }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onSelect(item.id)}
          style={{
            background: C.card,
            border: `1px solid ${C.borderSoft}`,
            borderRadius: '20px',
            padding: '20px 16px',
            cursor: 'pointer',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '12px',
            minHeight: '130px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{
            position: 'absolute', top: 0, right: 0,
            width: '80px', height: '80px',
            background: `radial-gradient(circle at top right, ${item.accentDim}, transparent 70%)`,
            pointerEvents: 'none',
          }} />
          <div style={{
            width: '46px', height: '46px',
            background: item.accentDim,
            borderRadius: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', flexShrink: 0,
          }}>
            {item.icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '15px', fontWeight: '800', color: C.textPrimary, lineHeight: 1.2, marginBottom: '4px' }}>
              {item.label}
            </div>
            <div style={{ fontSize: '12px', color: C.textSec, lineHeight: 1.4 }}>
              {item.desc}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

const STATUS_LABEL = {
  lookup: { tekst: 'Wordt opgezocht...', kleur: 'var(--text-secondary)' },
  pending: { tekst: 'Wacht op goedkeuring', kleur: '#FB923C' },
  goedgekeurd: { tekst: 'Goedgekeurd', kleur: 'var(--success)' },
  afgewezen: { tekst: 'Afgewezen', kleur: 'var(--accent-red)' },
  niet_gevonden: { tekst: 'Lid niet gevonden', kleur: 'var(--accent-red)' },
};

function GezinSection({ profiel, toast }) {
  const { labels: BELT_LABELS } = useGordelOpties();
  const [links, setLinks] = useState([]);
  const [members, setMembers] = useState({});
  const [laden, setLaden] = useState(true);
  const [form, setForm] = useState({ voornaam: '', achternaam: '', geboortedatum: '' });
  const [fouten, setFouten] = useState({});
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    if (!profiel?.uid) return;
    let actief = true;
    (async () => {
      try {
        const gevonden = await getGezinslinkenVoorOuder(profiel.uid);
        if (!actief) return;
        setLinks(gevonden);
        // Haal volledige ledenkaart op voor goedgekeurde links
        const approvedIds = gevonden.filter(l => l.status === 'goedgekeurd' && l.memberId).map(l => l.memberId);
        if (approvedIds.length > 0) {
          const memberData = await getMembersByIds(approvedIds);
          if (!actief) return;
          const byId = {};
          memberData.forEach(m => { byId[m.id] = m; });
          setMembers(byId);
        }
      } catch (e) {
        toast({ bericht: 'Fout bij laden gezinslinks', type: 'error' });
      } finally {
        if (actief) setLaden(false);
      }
    })();
    return () => { actief = false; };
  }, [profiel?.uid]);

  async function voegToe() {
    const f = {};
    if (!form.voornaam.trim()) f.voornaam = 'Verplicht';
    if (!form.achternaam.trim()) f.achternaam = 'Verplicht';
    if (!form.geboortedatum) f.geboortedatum = 'Verplicht';
    setFouten(f);
    if (Object.keys(f).length > 0) return;

    setBezig(true);
    const lidNaam = `${form.voornaam.trim()} ${form.achternaam.trim()}`;
    try {
      await voegGezinslinkToe(profiel.uid, profiel.naam || '', lidNaam, form.geboortedatum);
      toast({ bericht: 'Aanvraag ingediend — wordt behandeld door het bestuur', type: 'success' });
      setForm({ voornaam: '', achternaam: '', geboortedatum: '' });
      const bijgewerkt = await getGezinslinkenVoorOuder(profiel.uid);
      setLinks(bijgewerkt);
    } catch (e) {
      toast({ bericht: 'Fout bij indienen aanvraag', type: 'error' });
    } finally {
      setBezig(false);
    }
  }

  const inputS = { ...S.input, padding: '10px 12px', marginBottom: 0 };
  const inputErrS = { ...inputS, border: '1px solid var(--accent-red)' };
  const labelS = { ...S.label, marginBottom: '5px' };
  const errS = { fontSize: 'var(--font-size-sm)', color: 'var(--accent-red)', marginTop: '3px' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 'var(--font-size-lg)', color: 'var(--accent-red)' }}>Kinderen die ik beheer</h2>
        <p style={{ margin: '0 0 12px', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
          Na goedkeuring door het bestuur kun je wedstrijdinschrijvingen en andere acties uitvoeren namens je kind.
        </p>
        {laden ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>Laden...</div>
        ) : links.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>Geen gekoppelde kinderen.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {links.map(link => {
              const s = STATUS_LABEL[link.status] || { tekst: link.status, kleur: 'var(--text-secondary)' };
              const m = link.status === 'goedgekeurd' && link.memberId ? members[link.memberId] : null;
              return (
                <div key={link.id} style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: m ? '1px solid var(--border-color)' : 'none' }}>
                    <div style={{ fontWeight: '700', fontSize: 'var(--font-size-md)' }}>{link.lidNaam || '—'}</div>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: '600', color: s.kleur }}>{s.tekst}</div>
                  </div>
                  {m && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px', padding: '10px 12px' }}>
                      {[
                        ['Geboortedatum', m.geboortedatum ? new Date(m.geboortedatum).toLocaleDateString('nl-BE') : '—'],
                        ['Gordel', BELT_LABELS[m.gordel] || m.gordel || '—'],
                        ['Groepen', (m.groepen || []).join(', ') || '—'],
                        ['Vergunningsnummer', m.vergunningsnummer || m.lidnummer || '—'],
                        ['Bijdrage betaald', m.bijdrageBetaald ? 'Ja ✓' : 'Nee'],
                        ['Eigen account', link.kindUid ? 'Ja ✓' : 'Nog niet'],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <div style={{ ...S.label, marginBottom: '2px' }}>{label}</div>
                          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 'var(--font-size-lg)', color: 'var(--accent-red)' }}>Kind toevoegen</h2>
        <p style={{ margin: '0 0 14px', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
          Vul de naam en geboortedatum in zoals geregistreerd in het ledenbeheer van de club.
          Het bestuur keurt de koppeling goed of af.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label style={labelS}>Voornaam *</label>
            <input style={fouten.voornaam ? inputErrS : inputS} value={form.voornaam} onChange={e => setForm(f => ({ ...f, voornaam: e.target.value }))} />
            {fouten.voornaam && <div style={errS}>{fouten.voornaam}</div>}
          </div>
          <div>
            <label style={labelS}>Achternaam *</label>
            <input style={fouten.achternaam ? inputErrS : inputS} value={form.achternaam} onChange={e => setForm(f => ({ ...f, achternaam: e.target.value }))} />
            {fouten.achternaam && <div style={errS}>{fouten.achternaam}</div>}
          </div>
        </div>
        <div style={{ marginBottom: '14px' }}>
          <label style={labelS}>Geboortedatum *</label>
          <input type="date" style={fouten.geboortedatum ? inputErrS : inputS} value={form.geboortedatum} onChange={e => setForm(f => ({ ...f, geboortedatum: e.target.value }))} />
          {fouten.geboortedatum && <div style={errS}>{fouten.geboortedatum}</div>}
        </div>
        <button
          onClick={voegToe}
          disabled={bezig}
          style={{ padding: '11px 20px', background: 'var(--accent-red)', border: 'none', borderRadius: 'var(--radius-md)', color: '#fff', fontSize: 'var(--font-size-md)', fontWeight: '700', cursor: bezig ? 'not-allowed' : 'pointer', opacity: bezig ? 0.6 : 1, fontFamily: 'inherit' }}
        >
          {bezig ? 'Bezig...' : '+ Aanvraag indienen'}
        </button>
      </section>
    </div>
  );
}

export default function ProfielPagina() {
  const { profiel, slaProfielOp, configCache } = useAuth();
  const { labels: BELT_LABELS } = useGordelOpties();
  const toast = useToast();
  const alleGroepen = (configCache?.groepen || []).slice().sort((a, b) => (a.naam || '').localeCompare(b.naam || ''));
  const [naam, setNaam] = useState('');
  const [communicatieEmail, setCommunicatieEmail] = useState('');
  const [groepen, setGroepen] = useState([]);
  const [agendaFilters, setAgendaFilters] = useState({
    toonTrainingen: true,
    toonWedstrijden: true,
    toonExamens: true,
    toonEvenementen: true,
    enkelMijnGroepen: false,
  });
  const [voorkeuren, setVoorkeuren] = useState({});
  const [bezig, setBezig] = useState(false);
  const [linkedMember, setLinkedMember] = useState(null);
  const [lidkaartForm, setLidkaartForm] = useState({});
  const [activeSection, setActiveSection] = useState(null);

  useEffect(() => {
    if (profiel) {
      setNaam(profiel.naam || '');
      setCommunicatieEmail(profiel.communicatieEmail || '');
      setGroepen(profiel.groepen || []);
      if (profiel.agendaFilters) {
        setAgendaFilters(prev => ({ ...prev, ...profiel.agendaFilters }));
      }

      const rol = profiel.rol || 'lid';
      const defaults = standaardVoorkeurenVoorRol(rol);
      const bestaand = profiel.notificatieVoorkeuren || {};
      const legacy = profiel.notificaties || {};
      const samengevoegd = { ...defaults };
      for (const key of Object.keys(defaults)) {
        samengevoegd[key] = { ...defaults[key], ...(bestaand[key] || {}) };
      }
      // Eerste-keer-fallback uit legacy zodat de UI niet zomaar resets
      if (!bestaand.wedstrijden && samengevoegd.wedstrijden) {
        if (legacy.wedstrijdMeldingen === false) samengevoegd.wedstrijden.actief = false;
        if (Array.isArray(legacy.wedstrijdCategorieen)) samengevoegd.wedstrijden.categorieen = legacy.wedstrijdCategorieen;
      }
      if (!bestaand.trainerHerinnering && samengevoegd.trainerHerinnering) {
        if (legacy.trainerMeldingenActief === false) samengevoegd.trainerHerinnering.actief = false;
        if (Array.isArray(legacy.trainerGroepen)) samengevoegd.trainerHerinnering.groepen = legacy.trainerGroepen;
      }
      if (!bestaand.stock && samengevoegd.stock) {
        if (legacy.stockMeldingenActief === false && legacy.stockAlerts !== true) samengevoegd.stock.actief = false;
      }
      setVoorkeuren(samengevoegd);
    }
  }, [profiel]);

  useEffect(() => {
    if (profiel?.linkedMemberId) {
      getMemberById(profiel.linkedMemberId).then(m => {
        setLinkedMember(m);
        if (m) setLidkaartForm({
          email: m.email || '',
          telefoon: m.telefoon || profiel?.telefoon || '',
          medischeInfo: m.medischeInfo || '',
          noodcontactNaam: m.noodcontactNaam || '',
          noodcontactTelefoon: m.noodcontactTelefoon || '',
        });
      });
    }
  }, [profiel?.linkedMemberId]);

  const slaGegevensOp = async () => {
    setBezig(true);
    try {
      await slaProfielOp({ naam, communicatieEmail: communicatieEmail.trim() });
      if (profiel?.linkedMemberId) {
        await updateMemberProfile(profiel.linkedMemberId, lidkaartForm);
        setLinkedMember(prev => prev ? { ...prev, ...lidkaartForm } : prev);
      }
      toast({ bericht: 'Gegevens opgeslagen', type: 'success' });
    } catch (e) {
      console.error(e);
      toast({ bericht: 'Fout bij opslaan', type: 'error' });
    }
    setBezig(false);
  };

  const slaGroepenOp = async () => {
    setBezig(true);
    try {
      await slaProfielOp({ groepen });
      toast({ bericht: 'Groepen opgeslagen', type: 'success' });
    } catch (e) {
      console.error(e);
      toast({ bericht: 'Fout bij opslaan', type: 'error' });
    }
    setBezig(false);
  };

  const slaMeldingenOp = async () => {
    setBezig(true);
    try {
      await slaProfielOp({ notificatieVoorkeuren: voorkeuren });
      toast({ bericht: 'Meldingen opgeslagen', type: 'success' });
    } catch (e) {
      console.error(e);
      toast({ bericht: 'Fout bij opslaan', type: 'error' });
    }
    setBezig(false);
  };

  const slaAgendaOp = async () => {
    setBezig(true);
    try {
      await slaProfielOp({ agendaFilters });
      toast({ bericht: 'Agenda opgeslagen', type: 'success' });
    } catch (e) {
      console.error(e);
      toast({ bericht: 'Fout bij opslaan', type: 'error' });
    }
    setBezig(false);
  };

  const toggleGroep = (id) =>
    setGroepen(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);

  const verplaatsGroep = (id, richting) => {
    setGroepen(prev => {
      const index = prev.indexOf(id);
      if (index === -1) return prev;
      const nieuweIndex = index + richting;
      if (nieuweIndex < 0 || nieuweIndex >= prev.length) return prev;
      const nieuw = [...prev];
      [nieuw[index], nieuw[nieuweIndex]] = [nieuw[nieuweIndex], nieuw[index]];
      return nieuw;
    });
  };

  const maakFavoriet = (id) => {
    setGroepen(prev => prev.includes(id) ? [id, ...prev.filter(g => g !== id)] : [id, ...prev]);
  };

  const updateRubriek = (rubriek, patch) => {
    setVoorkeuren(prev => ({
      ...prev,
      [rubriek]: { ...(prev[rubriek] || {}), ...patch },
    }));
  };

  const toggleInLijst = (rubriek, veld, item) => {
    const huidige = voorkeuren[rubriek]?.[veld] || [];
    const nieuw = huidige.includes(item) ? huidige.filter(x => x !== item) : [...huidige, item];
    updateRubriek(rubriek, { [veld]: nieuw });
  };

  function renderToggle(label, beschrijving, actief, onClick) {
    return (
      <div
        onClick={onClick}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
      >
        <div style={{ flex: 1, paddingRight: '12px' }}>
          <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-primary)', fontWeight: '600' }}>{label}</div>
          {beschrijving && <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginTop: '2px' }}>{beschrijving}</div>}
        </div>
        <div style={S.toggle(actief)}>
          <div style={S.toggleDot(actief)} />
        </div>
      </div>
    );
  }

  if (!profiel) return <div style={S.page}>Laden...</div>;

  function renderSectionContent() {
    if (activeSection === 'gegevens') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 'var(--font-size-lg)', color: 'var(--accent-red)' }}>Weergavenaam</h2>
            <label style={S.label}>Naam in de app</label>
            <input
              type="text"
              value={naam}
              onChange={e => setNaam(e.target.value)}
              placeholder="Voornaam Achternaam"
              style={S.input}
            />
          </section>

          <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 'var(--font-size-lg)', color: 'var(--accent-red)' }}>E-mail voor communicatie</h2>
            <p style={{ margin: '0 0 12px', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Bijv. het e-mailadres van een ouder of voogd. Clubberichten worden naar dit adres gestuurd.
              Indien leeg wordt het account-e-mailadres ({profiel.email}) gebruikt.
            </p>
            <label style={S.label}>Communicatie-e-mailadres</label>
            <input
              type="email"
              value={communicatieEmail}
              onChange={e => setCommunicatieEmail(e.target.value)}
              placeholder={profiel.email}
              style={S.input}
            />
          </section>

          {linkedMember && (
            <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
              <h2 style={{ margin: '0 0 12px', fontSize: 'var(--font-size-lg)', color: 'var(--accent-red)' }}>Ledenkaart</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}>
                {[
                  ['Naam', linkedMember.naam || '—'],
                  ['Geboortedatum', linkedMember.geboortedatum ? new Date(linkedMember.geboortedatum).toLocaleDateString('nl-BE') : '—'],
                  ['Gordel', BELT_LABELS[linkedMember.gordel] || linkedMember.gordel || '—'],
                  ['Vergunningsnummer', linkedMember.vergunningsnummer || linkedMember.lidnummer || '—'],
                  ['Groepen', (linkedMember.groepen || []).join(', ') || '—'],
                  ['Bijdrage betaald', linkedMember.bijdrageBetaald ? 'Ja ✓' : 'Nee'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <label style={S.label}>{label}</label>
                    <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-secondary)', padding: '4px 0 8px' }}>{value}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 'var(--font-size-lg)', color: 'var(--accent-red)' }}>Contactgegevens</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}>
              <div>
                <label style={S.label}>E-mail</label>
                <input type="email" style={S.input} value={lidkaartForm.email || ''} onChange={e => setLidkaartForm(f => ({ ...f, email: e.target.value }))} placeholder="naam@voorbeeld.be" />
              </div>
              <div>
                <label style={S.label}>Telefoon</label>
                <input type="tel" style={S.input} value={lidkaartForm.telefoon || ''} onChange={e => setLidkaartForm(f => ({ ...f, telefoon: e.target.value }))} placeholder="+32 ..." />
              </div>
              <div>
                <label style={S.label}>Noodcontact naam</label>
                <input type="text" style={S.input} value={lidkaartForm.noodcontactNaam || ''} onChange={e => setLidkaartForm(f => ({ ...f, noodcontactNaam: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Noodcontact telefoon</label>
                <input type="tel" style={S.input} value={lidkaartForm.noodcontactTelefoon || ''} onChange={e => setLidkaartForm(f => ({ ...f, noodcontactTelefoon: e.target.value }))} placeholder="+32 ..." />
              </div>
            </div>
            <div>
              <label style={S.label}>Medische info</label>
              <textarea
                style={{ ...S.input, resize: 'vertical', minHeight: '80px' }}
                value={lidkaartForm.medischeInfo || ''}
                onChange={e => setLidkaartForm(f => ({ ...f, medischeInfo: e.target.value }))}
                placeholder="Allergieën, medicatie, beperkingen..."
              />
            </div>
          </section>

          <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
            <button onClick={slaGegevensOp} disabled={bezig} style={{ ...S.saveBtn, opacity: bezig ? 0.6 : 1 }}>
              {bezig ? 'Bezig...' : '💾 Opslaan'}
            </button>
          </section>
        </div>
      );
    }

    if (activeSection === 'groepen') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: 0, marginBottom: '12px' }}>
              De eerste groep in deze lijst wordt standaard geopend op de trainingspagina. Gebruik Omhoog/Omlaag of Maak favoriet om de volgorde te bepalen.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
              {alleGroepen.map(g => (
                <button key={g.id} onClick={() => toggleGroep(g.id)} style={S.groepTag(groepen.includes(g.id))}>
                  {g.naam} <span style={{ fontSize: '11px', opacity: 0.7 }}>({g.dag})</span>
                </button>
              ))}
            </div>
            {groepen.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {groepen.map((id, index) => {
                  const groep = alleGroepen.find(g => g.id === id);
                  if (!groep) return null;
                  return (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-primary)', border: index === 0 ? '1px solid var(--accent-red)' : '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '10px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '160px' }}>
                        <div style={{ fontWeight: '700' }}>{index + 1}. {groep.naam}</div>
                        <div style={{ color: index === 0 ? 'var(--accent-red)' : 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                          {index === 0 ? 'Favoriete groep - standaard op Trainingen' : 'Standaardgroep'}{groep.dag ? ` (${groep.dag})` : ''}
                        </div>
                      </div>
                      <button onClick={() => verplaatsGroep(id, -1)} disabled={index === 0} style={{ padding: '7px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: index === 0 ? 'not-allowed' : 'pointer', opacity: index === 0 ? 0.5 : 1 }}>Omhoog</button>
                      <button onClick={() => verplaatsGroep(id, 1)} disabled={index === groepen.length - 1} style={{ padding: '7px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: index === groepen.length - 1 ? 'not-allowed' : 'pointer', opacity: index === groepen.length - 1 ? 0.5 : 1 }}>Omlaag</button>
                      {index !== 0 && <button onClick={() => maakFavoriet(id)} style={{ padding: '7px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent-red)', background: 'transparent', color: 'var(--accent-red)', cursor: 'pointer' }}>Maak favoriet</button>}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
            <button onClick={slaGroepenOp} disabled={bezig} style={{ ...S.saveBtn, opacity: bezig ? 0.6 : 1 }}>
              {bezig ? 'Bezig...' : '💾 Opslaan'}
            </button>
          </section>
        </div>
      );
    }

    if (activeSection === 'meldingen') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: 0, marginBottom: '16px' }}>
              Per rubriek kun je hier aan/uit zetten welke meldingen je ontvangt.
              Dit geldt voor al je toestellen. Per toestel afwijken kan via Instellingen.
            </p>
            {rubriekenVoorRol(profiel.rol || 'lid').map((sleutel, idx, lijst) => {
              const rubriek = RUBRIEKEN[sleutel];
              const v = voorkeuren[sleutel] || { actief: false };
              const isLaatste = idx === lijst.length - 1;
              return (
                <div key={sleutel} style={{ marginBottom: isLaatste ? 0 : '18px' }}>
                  {renderToggle(
                    rubriek.label,
                    rubriek.sublabel,
                    v.actief !== false,
                    () => updateRubriek(sleutel, { actief: !(v.actief !== false) })
                  )}
                  {rubriek.subInstellingen.map(sub => {
                    const huidige = v[sub.veld] || [];
                    const dimmed = v.actief === false;
                    if (sub.type === 'tagsLijst') {
                      // Categorie-opties komen live uit de configuratie (Beheer →
                      // Leeftijdscategorieën) i.p.v. de hardcoded lijst, zodat
                      // toegevoegde/hernoemde categorieën meteen verschijnen.
                      const opties = (sub.veld === 'categorieen' && configCache?.categorieen?.length)
                        ? configCache.categorieen.map(c => c.code).filter(Boolean)
                        : sub.opties;
                      return (
                        <div key={sub.veld} style={{ marginTop: '10px', opacity: dimmed ? 0.45 : 1 }}>
                          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: 0, marginBottom: '8px' }}>{sub.beschrijving}</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {opties.map(opt => {
                              const actief = huidige.includes(opt);
                              return (
                                <button key={opt} disabled={dimmed} onClick={() => toggleInLijst(sleutel, sub.veld, opt)}
                                  style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', cursor: dimmed ? 'not-allowed' : 'pointer', fontSize: 'var(--font-size-sm)', fontWeight: '600', background: actief ? 'rgba(39,174,96,0.2)' : 'var(--bg-primary)', border: '1px solid ' + (actief ? 'var(--success)' : 'var(--border-color)'), color: actief ? 'var(--success)' : 'var(--text-secondary)' }}>
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    if (sub.type === 'groepenLijst') {
                      return (
                        <div key={sub.veld} style={{ marginTop: '10px', opacity: dimmed ? 0.45 : 1 }}>
                          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: 0, marginBottom: '8px' }}>{sub.beschrijving}</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {alleGroepen.map(g => {
                              const actief = huidige.includes(g.id);
                              return (
                                <button key={g.id} disabled={dimmed} onClick={() => toggleInLijst(sleutel, sub.veld, g.id)}
                                  style={{ padding: '8px 14px', borderRadius: 'var(--radius-md)', cursor: dimmed ? 'not-allowed' : 'pointer', fontSize: 'var(--font-size-sm)', fontWeight: '600', background: actief ? 'rgba(41,128,185,0.2)' : 'var(--bg-primary)', border: '1px solid ' + (actief ? '#2980b9' : 'var(--border-color)'), color: actief ? '#2980b9' : 'var(--text-secondary)' }}>
                                  {g.naam}{g.dag && <span style={{ fontSize: '11px', opacity: 0.7, marginLeft: '4px' }}>({g.dag})</span>}
                                </button>
                              );
                            })}
                            {alleGroepen.length === 0 && (
                              <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>Geen groepen gevonden.</span>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              );
            })}
          </section>
          <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
            <button onClick={slaMeldingenOp} disabled={bezig} style={{ ...S.saveBtn, opacity: bezig ? 0.6 : 1 }}>
              {bezig ? 'Bezig...' : '💾 Opslaan'}
            </button>
          </section>
        </div>
      );
    }

    if (activeSection === 'agenda') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: 0, marginBottom: '12px' }}>
              Kies wat je standaard ziet op de agenda.
            </p>
            {[
              { key: 'toonTrainingen', label: 'Trainingen', kleur: '#2980b9' },
              { key: 'toonWedstrijden', label: 'Wedstrijden', kleur: '#e67e22' },
              { key: 'toonExamens', label: 'Examens', kleur: '#27ae60' },
              { key: 'toonEvenementen', label: 'Evenementen', kleur: '#8e44ad' },
            ].map(({ key, label, kleur }) => (
              <div
                key={key}
                onClick={() => setAgendaFilters(prev => ({ ...prev, [key]: !prev[key] }))}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: kleur, flexShrink: 0 }} />
                  <span style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-primary)' }}>{label}</span>
                </div>
                <div style={{ width: '44px', height: '24px', borderRadius: '12px', background: agendaFilters[key] ? kleur : 'var(--border-color)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', top: '3px', left: agendaFilters[key] ? '23px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: 'var(--text-primary)', transition: 'left 0.2s' }} />
                </div>
              </div>
            ))}
            {(profiel?.groepen || []).length > 0 && (
              <div
                onClick={() => setAgendaFilters(prev => ({ ...prev, enkelMijnGroepen: !prev.enkelMijnGroepen }))}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', cursor: 'pointer' }}
              >
                <div style={{ flex: 1, paddingRight: '12px' }}>
                  <span style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-primary)' }}>Enkel mijn groepen</span>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginTop: '2px' }}>Toon enkel trainingen van groepen waar ik bij betrokken ben</div>
                </div>
                <div style={{ width: '44px', height: '24px', borderRadius: '12px', background: agendaFilters.enkelMijnGroepen ? 'var(--accent-red)' : 'var(--border-color)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', top: '3px', left: agendaFilters.enkelMijnGroepen ? '23px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: 'var(--text-primary)', transition: 'left 0.2s' }} />
                </div>
              </div>
            )}
          </section>
          <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
            <button onClick={slaAgendaOp} disabled={bezig} style={{ ...S.saveBtn, opacity: bezig ? 0.6 : 1 }}>
              {bezig ? 'Bezig...' : '💾 Opslaan'}
            </button>
          </section>
        </div>
      );
    }

    if (activeSection === 'gezin') {
      return <GezinSection profiel={profiel} toast={toast} />;
    }

    return null;
  }

  // Detail view (drill-down)
  if (activeSection) {
    const sec = SECTIONS.find(s => s.id === activeSection);
    return (
      <div style={S.page}>
        <button
          onClick={() => setActiveSection(null)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: C.textSec, cursor: 'pointer', fontSize: '14px', fontWeight: '600', padding: '0 0 14px 0' }}
        >
          ← Mijn Profiel
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ width: '44px', height: '44px', background: sec?.accentDim, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>
            {sec?.icon}
          </div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: C.textPrimary, lineHeight: 1.2 }}>
            {sec?.label}
          </h2>
        </div>
        {renderSectionContent()}
      </div>
    );
  }

  // Hoofd tegel-overzicht
  return (
    <div style={S.page}>
      <section style={{ ...cardStyle({ gradient: true }), marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 'clamp(22px,5vw,30px)', fontWeight: 900, color: C.textPrimary }}>
          👤 Mijn Profiel
        </h1>
        <p style={{ margin: '0 0 12px', color: C.textSec, fontSize: '13px' }}>
          {profiel.email}
        </p>
        <span style={S.rolBadge(profiel.rol)}>{profiel.rol || 'lid'}</span>
      </section>
      <TileGrid items={SECTIONS} onSelect={setActiveSection} />
    </div>
  );
}
