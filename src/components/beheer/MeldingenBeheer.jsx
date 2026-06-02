// src/components/beheer/MeldingenBeheer.jsx
import React, { useState, useEffect } from 'react';
import {
  getMeldingInstellingen, setMeldingInstellingen,
  addTrainerReminderTrigger, getAllProducts,
  getAllUsers, sendMail,
  getNotificationTokens, deactiveerNotificationToken,
} from '../../services/firestoreService';
import { CLUB_NAAM_KORT as CLUB_NAAM_KORT_FALLBACK } from '../../config/appConfig';
import { useAuth } from '../../contexts/AuthContext';
import { stuurPushTrigger, PUSH_TYPES } from '../../services/pushService';
import { useConfirm } from '../../contexts/ConfirmContext';

const WEEKDAGEN = [
  { nr: 1, label: 'Ma' },
  { nr: 2, label: 'Di' },
  { nr: 3, label: 'Woe' },
  { nr: 4, label: 'Do' },
  { nr: 5, label: 'Vr' },
  { nr: 6, label: 'Za' },
  { nr: 0, label: 'Zo' },
];

const DAGEN_OPTIES = [1, 2, 3, 4, 5, 6, 7, 10, 14];

export function TrainerMeldingenBeheer() {
  const [config, setConfig] = useState({
    actiefOpDagen: [3, 6],
    aantalDagen: 5,
    uitsluitZin: 'sporthal gesloten',
  });
  const [laden, setLaden] = useState(true);
  const [opslaan, setOpslaan] = useState(false);
  const [bericht, setBericht] = useState('');
  const [vrijInvoer, setVrijInvoer] = useState(false);
  const [vrijDagen, setVrijDagen] = useState('');
  const [triggerStatus, setTriggerStatus] = useState(null);
  const [triggerLaden, setTriggerLaden] = useState(false);

  async function handleManueleCheck() {
    setTriggerLaden(true);
    setTriggerStatus(null);
    try {
      await addTrainerReminderTrigger({ bron: 'manueel' });
      setTriggerStatus('ok');
      setTimeout(() => setTriggerStatus(null), 5000);
    } catch (e) {
      setTriggerStatus('fout');
    }
    setTriggerLaden(false);
  }

  useEffect(() => {
    getMeldingInstellingen().then(data => {
      if (data) {
        const cfg = data?.trainerReminder || {};
        const dagen = cfg.aantalDagen ?? 5;
        const isVrij = !DAGEN_OPTIES.includes(dagen);

        setConfig({
          actiefOpDagen: cfg.actiefOpDagen ?? [3, 6],
          aantalDagen: dagen,
          uitsluitZin: cfg.uitsluitZin ?? 'sporthal gesloten',
        });

        if (isVrij) {
          setVrijInvoer(true);
          setVrijDagen(String(dagen));
        }
      }

      setLaden(false);
    }).catch(e => {
      setBericht('Fout bij laden: ' + e.message);
      setLaden(false);
    });
  }, []);

  function toggleDag(nr) {
    setConfig(prev => {
      const huidige = prev.actiefOpDagen;
      return {
        ...prev,
        actiefOpDagen: huidige.includes(nr)
          ? huidige.filter(d => d !== nr)
          : [...huidige, nr],
      };
    });
  }

  async function slaOp() {
    const aantalDagen = vrijInvoer
      ? Math.max(1, Math.min(30, parseInt(vrijDagen) || 5))
      : config.aantalDagen;

    if (config.actiefOpDagen.length === 0) {
      setBericht('Selecteer minstens 1 weekdag.');
      return;
    }

    setOpslaan(true);
    setBericht('');

    try {
      await setMeldingInstellingen({
        trainerReminder: {
          actiefOpDagen: config.actiefOpDagen,
          aantalDagen,
          uitsluitZin: config.uitsluitZin.trim().toLowerCase(),
        },
      });

      setConfig(prev => ({ ...prev, aantalDagen }));
      setBericht('Instellingen opgeslagen.');
      setTimeout(() => setBericht(''), 3000);
    } catch (e) {
      setBericht('Fout bij opslaan: ' + e.message);
    }

    setOpslaan(false);
  }

  if (laden) return <div style={{ color: 'var(--text-secondary)', padding: '12px' }}>Laden...</div>;

  return (
    <div>
      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: '16px' }}>
        De Cloud Function controleert dagelijks om 9u. Hieronder bepaal je op welke dagen hij actief is en hoeveel dagen vooruit hij kijkt.
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
          Controleer op deze weekdagen
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {WEEKDAGEN.map(dag => {
            const actief = config.actiefOpDagen.includes(dag.nr);
            return (
              <button
                key={dag.nr}
                onClick={() => toggleDag(dag.nr)}
                style={{
                  background: actief ? 'rgba(192,57,43,0.2)' : 'var(--bg-primary)',
                  border: actief ? '1px solid var(--accent-red)' : '1px solid var(--border-color)',
                  color: actief ? 'var(--danger)' : 'var(--text-secondary)',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: actief ? '700' : '400',
                }}
              >
                {dag.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
          Aantal dagen vooruit controleren
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={vrijInvoer ? 'vrij' : String(config.aantalDagen)}
            onChange={e => {
              if (e.target.value === 'vrij') {
                setVrijInvoer(true);
                setVrijDagen(String(config.aantalDagen));
              } else {
                setVrijInvoer(false);
                setConfig(prev => ({ ...prev, aantalDagen: parseInt(e.target.value) }));
              }
            }}
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              padding: '9px 12px',
              fontSize: 'var(--font-size-md)',
            }}
          >
            {DAGEN_OPTIES.map(d => (
              <option key={d} value={String(d)}>{d} dagen</option>
            ))}
            <option value="vrij">Vrij invoeren...</option>
          </select>

          {vrijInvoer && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="number"
                min="1"
                max="30"
                value={vrijDagen}
                onChange={e => setVrijDagen(e.target.value)}
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  padding: '9px 12px',
                  fontSize: 'var(--font-size-md)',
                  width: '80px',
                }}
              />
              <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>dagen (1-30)</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '20px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
          Uitsluiting via centrale detectielijst
        </div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Trainerherinneringen gebruiken dezelfde lijst als Training detectie in Clubinstellingen.
          Beheer die teksten onder Beheer &gt; Club &gt; Training detectie en trainerherinneringen.
          <br /><br />
          Het veld 'uitsluitZin' wordt technisch bewaard als extra fallback, maar kan de centrale lijst
          nooit overschrijven. Zolang de centrale lijst geldig is, is die altijd leidend.
        </div>
        <div style={{
          marginTop: '8px',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--text-secondary)',
          fontStyle: 'italic',
        }}>
          Tip: ga naar het tabblad Club in Beheer om de detectielijst te beheren.
        </div>
      </div>

      <button
        onClick={slaOp}
        disabled={opslaan}
        style={{
          background: 'var(--accent-red)',
          border: 'none',
          color: 'var(--text-primary)',
          padding: '11px 20px',
          borderRadius: 'var(--radius-md)',
          cursor: opslaan ? 'not-allowed' : 'pointer',
          fontSize: 'var(--font-size-md)',
          fontWeight: '700',
          opacity: opslaan ? 0.7 : 1,
        }}
      >
        {opslaan ? 'Opslaan...' : 'Instellingen opslaan'}
      </button>

      {bericht && (
        <div style={{
          marginTop: '12px',
          color: bericht.startsWith('Fout') || bericht.startsWith('Selecteer') ? 'var(--danger)' : 'var(--success)',
          fontSize: 'var(--font-size-sm)',
        }}>
          {bericht.startsWith('Fout') || bericht.startsWith('Selecteer') ? '' : '✓ '}{bericht}
        </div>
      )}

      <div style={{ marginTop: '28px', borderTop: '1px solid var(--bg-secondary)', paddingTop: '20px' }}>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
          Manuele controle
        </div>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: '12px' }}>
          Voer de trainer-check nu onmiddellijk uit zonder te wachten op de dagelijkse scheduler. Push meldingen en mails worden verstuurd voor trainingen zonder lesgever.
        </div>
        <button
          onClick={handleManueleCheck}
          disabled={triggerLaden}
          style={{
            background: triggerLaden ? 'var(--bg-secondary)' : 'var(--bg-primary)',
            border: '1px solid var(--accent-red)',
            color: 'var(--accent-red)',
            padding: '11px 20px',
            borderRadius: 'var(--radius-md)',
            cursor: triggerLaden ? 'not-allowed' : 'pointer',
            fontSize: 'var(--font-size-md)',
            fontWeight: '700',
            opacity: triggerLaden ? 0.6 : 1,
          }}
        >
          {triggerLaden ? 'Bezig...' : '▶ Controleer nu & stuur meldingen'}
        </button>
        {triggerStatus === 'ok' && (
          <div style={{ marginTop: '10px', color: 'var(--success)', fontSize: 'var(--font-size-sm)' }}>
            ✓ Controle gestart. Meldingen worden binnen enkele seconden verstuurd.
          </div>
        )}
        {triggerStatus === 'fout' && (
          <div style={{ marginTop: '10px', color: 'var(--danger)', fontSize: 'var(--font-size-sm)' }}>
            Fout bij starten van de controle. Probeer opnieuw.
          </div>
        )}
      </div>
    </div>
  );
}


export function StockMeldingenBeheer() {
  const [config, setConfig] = useState({
    drempelLaagStock: 3,
    vasteMails: [],
    stockNulActief: true,
    laagStockActief: true,
  });
  const [mailinvoer, setMailinvoer] = useState('');
  const [laden, setLaden] = useState(true);
  const [opslaan, setOpslaan] = useState(false);
  const [bericht, setBericht] = useState('');

  useEffect(() => {
    getMeldingInstellingen().then(data => {
      if (data) {
        const cfg = data?.stockMeldingen || {};
        const mails = Array.isArray(cfg.vasteMails) ? cfg.vasteMails : [];

        setConfig({
          drempelLaagStock: cfg.drempelLaagStock ?? 3,
          vasteMails: mails,
          stockNulActief: cfg.stockNulActief ?? true,
          laagStockActief: cfg.laagStockActief ?? true,
        });
        setMailinvoer(mails.join('\n'));
      }

      setLaden(false);
    }).catch(e => {
      setBericht('Fout bij laden: ' + e.message);
      setLaden(false);
    });
  }, []);

  async function slaOp() {
    const mails = mailinvoer
      .split(/[\n,]+/)
      .map(m => m.trim().toLowerCase())
      .filter(m => m.includes('@'));

    setOpslaan(true);
    setBericht('');

    try {
      await setMeldingInstellingen({
        stockMeldingen: {
          drempelLaagStock: Math.max(0, parseInt(config.drempelLaagStock) || 0),
          vasteMails: mails,
          stockNulActief: config.stockNulActief,
          laagStockActief: config.laagStockActief,
        },
      });

      setConfig(prev => ({ ...prev, vasteMails: mails }));
      setMailinvoer(mails.join('\n'));
      setBericht('Instellingen opgeslagen.');
      setTimeout(() => setBericht(''), 3000);
    } catch (e) {
      setBericht('Fout bij opslaan: ' + e.message);
    }

    setOpslaan(false);
  }

  if (laden) return <div style={{ color: 'var(--text-secondary)', padding: '12px' }}>Laden...</div>;

  const toggleStyle = () => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    padding: '12px 14px',
    marginBottom: '10px',
    cursor: 'pointer',
  });

  const knopStyle = (actief) => ({
    background: actief ? 'var(--success)' : 'var(--border-color)',
    border: 'none',
    color: 'var(--text-primary)',
    padding: '6px 14px',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: 'var(--font-size-sm)',
    fontWeight: '700',
    minWidth: '60px',
  });

  return (
    <div>
      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
        Meldingen aan/uit
      </div>

      <div style={toggleStyle(config.stockNulActief)}>
        <div>
          <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-primary)', fontWeight: '600' }}>Stock = 0 melding</div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginTop: '3px' }}>Push + mail bij uitverkocht</div>
        </div>
        <button
          onClick={() => setConfig(prev => ({ ...prev, stockNulActief: !prev.stockNulActief }))}
          style={knopStyle(config.stockNulActief)}
        >
          {config.stockNulActief ? 'Aan' : 'Uit'}
        </button>
      </div>

      <div style={toggleStyle(config.laagStockActief)}>
        <div>
          <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-primary)', fontWeight: '600' }}>Lage stock melding</div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginTop: '3px' }}>Mail bij daling onder drempel</div>
        </div>
        <button
          onClick={() => setConfig(prev => ({ ...prev, laagStockActief: !prev.laagStockActief }))}
          style={knopStyle(config.laagStockActief)}
        >
          {config.laagStockActief ? 'Aan' : 'Uit'}
        </button>
      </div>

      <div style={{ marginTop: '20px', marginBottom: '20px' }}>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
          Drempelwaarde lage stock
        </div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginBottom: '8px' }}>
          Melding wordt gestuurd als stock daalt naar dit getal of lager, maar niet 0. Zet op 0 om uit te schakelen.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input
            type="number"
            min="0"
            max="50"
            value={config.drempelLaagStock}
            onChange={e => setConfig(prev => ({ ...prev, drempelLaagStock: e.target.value }))}
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              padding: '10px 12px',
              fontSize: '16px',
              width: '80px',
              textAlign: 'center',
            }}
          />
          <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>stuks of minder = lage stock melding</span>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
          Vaste mailadressen voor stockmeldingen
        </div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginBottom: '8px' }}>
          Deze adressen ontvangen altijd een mail bij stock = 0 of lage stock, los van individuele profielinstellingen. Een adres per regel of kommagescheiden.
        </div>
        <textarea
          value={mailinvoer}
          onChange={e => setMailinvoer(e.target.value)}
          placeholder={'admin@kodokan.be\nbeheer@kodokan.be'}
          rows={4}
          style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            padding: '10px 12px',
            fontSize: 'var(--font-size-md)',
            width: '100%',
            boxSizing: 'border-box',
            resize: 'vertical',
            fontFamily: 'monospace',
          }}
        />
        {mailinvoer && (
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {mailinvoer.split(/[\n,]+/).filter(m => m.trim().includes('@')).length} geldig(e) adres(sen) herkend
          </div>
        )}
      </div>

      <button
        onClick={slaOp}
        disabled={opslaan}
        style={{
          background: 'var(--accent-red)',
          border: 'none',
          color: 'var(--text-primary)',
          padding: '11px 20px',
          borderRadius: 'var(--radius-md)',
          cursor: opslaan ? 'not-allowed' : 'pointer',
          fontSize: 'var(--font-size-md)',
          fontWeight: '700',
          opacity: opslaan ? 0.7 : 1,
        }}
      >
        {opslaan ? 'Opslaan...' : 'Instellingen opslaan'}
      </button>

      {bericht && (
        <div style={{
          marginTop: '12px',
          color: bericht.startsWith('Fout') ? 'var(--danger)' : 'var(--success)',
          fontSize: 'var(--font-size-sm)',
        }}>
          {bericht.startsWith('Fout') ? '' : '✓ '}{bericht}
        </div>
      )}
    </div>
  );
}


export function StockOverzichtMail() {
  const { configCache } = useAuth();
  const clubNaamKort = configCache?.clubSettings?.naamKort || configCache?.clubSettings?.clubname || CLUB_NAAM_KORT_FALLBACK;
  const [bezig, setBezig] = useState(false);
  const [bericht, setBericht] = useState('');

  async function stuurOverzicht() {
    setBezig(true);
    setBericht('');

    try {
      // Haal producten op
      const producten = await getAllProducts();

      if (producten.length === 0) {
        setBericht('Geen producten gevonden in de database.');
        setBezig(false);
        return;
      }

      // Haal stock configuratie op
      const configData = await getMeldingInstellingen();
      const stockCfg = configData?.stockMeldingen || {};
      const drempel = typeof stockCfg.drempelLaagStock === 'number' ? stockCfg.drempelLaagStock : 3;
      const vasteMails = Array.isArray(stockCfg.vasteMails) ? stockCfg.vasteMails : [];

      // Haal users op met stock-voorkeur aan (nieuw model + legacy fallback)
      const usersData = await getAllUsers();
      const adressenSet = new Set(vasteMails.filter(m => m.includes('@')));

      usersData.forEach(u => {
        // Nieuw model: notificatieVoorkeuren.stock.actief
        const nieuwModel = u.notificatieVoorkeuren?.stock;
        const heeftVoorkeur = nieuwModel
          ? nieuwModel.actief === true
          : (u.notificaties?.stockMeldingenActief !== false && u.notificaties?.stockAlerts === true);
        if (!heeftVoorkeur) return;
        const mail = u.notificatieEmail || u.notificaties?.emailVoorkeur || u.email;
        if (mail) adressenSet.add(mail);
      });

      const adressen = Array.from(adressenSet);

      if (adressen.length === 0) {
        setBericht('Geen mailadressen geconfigureerd. Voeg vaste adressen toe in de stockinstellingen.');
        setBezig(false);
        return;
      }

      // Sorteer: stock 0 eerst, dan lage stock, dan normaal
      const gesorteerd = [...producten].sort((a, b) => {
        const sA = a.stock || 0;
        const sB = b.stock || 0;

        if (sA === 0 && sB !== 0) return -1;
        if (sB === 0 && sA !== 0) return 1;
        if (drempel > 0 && sA > 0 && sA < drempel && (sB === 0 || sB >= drempel)) return -1;
        if (drempel > 0 && sB > 0 && sB < drempel && (sA === 0 || sA >= drempel)) return 1;

        return (a.category || '').localeCompare(b.category || '');
      });

      const rijen = gesorteerd.map(p => {
        const stock = p.stock || 0;
        let kleur = '#333';
        let label = '';

        if (stock === 0) {
          kleur = '#c0392b';
          label = ' UITVERKOCHT';
        } else if (drempel > 0 && stock < drempel) {
          kleur = '#e67e22';
          label = ' LAAG';
        }

        return `<tr>
<td style="padding:7px 10px; border-bottom:1px solid #eee;">${p.category || ''}</td>
<td style="padding:7px 10px; border-bottom:1px solid #eee;">${p.name || p.naam || ''} ${p.variant || ''}</td>
<td style="padding:7px 10px; border-bottom:1px solid #eee; font-weight:bold; color:${kleur};">${stock}${label}</td>
</tr>`;
      }).join('');

      const aantalNul = gesorteerd.filter(p => (p.stock || 0) === 0).length;
      const aantalLaag = gesorteerd.filter(p => {
        const s = p.stock || 0;
        return drempel > 0 && s > 0 && s < drempel;
      }).length;
      const aantalNormaal = gesorteerd.length - aantalNul - aantalLaag;

      const samenvatting = `
<div style="display:flex; gap:20px; margin-bottom:16px; flex-wrap:wrap;">
  <div style="background:#fdf0ed; border:1px solid #e74c3c; border-radius:8px; padding:10px 16px; min-width:100px;">
    <div style="font-size:22px; font-weight:bold; color:#c0392b;">${aantalNul}</div>
    <div style="font-size:12px; color:#888;">Uitverkocht</div>
  </div>
  ${drempel > 0 ? `<div style="background:#fef9f0; border:1px solid #e67e22; border-radius:8px; padding:10px 16px; min-width:100px;">
    <div style="font-size:22px; font-weight:bold; color:#e67e22;">${aantalLaag}</div>
    <div style="font-size:12px; color:#888;">Lage stock (&lt;${drempel})</div>
  </div>` : ''}
  <div style="background:#f0fdf4; border:1px solid #27ae60; border-radius:8px; padding:10px 16px; min-width:100px;">
    <div style="font-size:22px; font-weight:bold; color:#27ae60;">${aantalNormaal}</div>
    <div style="font-size:12px; color:#888;">Normaal</div>
  </div>
</div>
`;

      const datum = new Date().toLocaleDateString('nl-BE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      const html = `
<div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; background: #ffffff;">
  <div style="background: #c0392b; padding: 20px 24px;">
    <h1 style="color: #ffffff; margin: 0; font-size: 20px;">${clubNaamKort}</h1>
  </div>
  <div style="padding: 24px;">
    <h2 style="color: #1a1a1a; margin-top: 0;">Stockoverzicht - ${datum}</h2>
    ${samenvatting}
    <table style="width:100%; border-collapse:collapse; margin-top:12px; font-size:13px;">
      <tr style="background:#f5f5f5;">
        <th style="padding:8px 10px; text-align:left; font-size:12px; color:#888;">Categorie</th>
        <th style="padding:8px 10px; text-align:left; font-size:12px; color:#888;">Product</th>
        <th style="padding:8px 10px; text-align:left; font-size:12px; color:#888;">Stock</th>
      </tr>
      ${rijen}
    </table>
    <p style="margin-top:20px; color:#888; font-size:12px;">
      Beheer de voorraad via de ${configCache?.clubSettings?.clubname || 'Clubapp'} onder Winkel.
    </p>
  </div>
  <div style="background: #f5f5f5; padding: 16px 24px; font-size: 12px; color: #888;">
    Dit is een manueel aangevraagd stockoverzicht via Beheer.
  </div>
</div>
`;

      await sendMail({
        to: adressen,
        message: {
          subject: `Stockoverzicht ${datum} - ${configCache?.clubSettings?.naamKort || configCache?.clubSettings?.clubname || 'Club'}`,
          html,
        },
        type: 'stock_overzicht',
      });

      setBericht(`Stockoverzicht verstuurd naar ${adressen.length} adres(sen).`);
      setTimeout(() => setBericht(''), 6000);
    } catch (e) {
      setBericht('Fout: ' + e.message);
    }

    setBezig(false);
  }

  return (
    <div>
      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: '16px' }}>
        Stuur een volledig stockoverzicht per mail naar alle geconfigureerde adressen. Producten met lage stock of stock 0 worden duidelijk gemarkeerd.
      </div>
      <button
        onClick={stuurOverzicht}
        disabled={bezig}
        style={{
          background: bezig ? 'var(--border-color)' : '#2980b9',
          border: 'none',
          color: 'var(--text-primary)',
          padding: '11px 20px',
          borderRadius: 'var(--radius-md)',
          cursor: bezig ? 'not-allowed' : 'pointer',
          fontSize: 'var(--font-size-md)',
          fontWeight: '700',
          opacity: bezig ? 0.7 : 1,
        }}
      >
        {bezig ? 'Bezig...' : 'Stuur stockoverzicht per mail'}
      </button>
      {bericht && (
        <div style={{
          marginTop: '12px',
          color: bericht.startsWith('Fout') ? 'var(--danger)' : 'var(--success)',
          fontSize: 'var(--font-size-sm)',
        }}>
          {bericht.startsWith('Fout') ? '' : '✓ '}{bericht}
        </div>
      )}
    </div>
  );
}


export function PushStatusDashboard() {
  const [tokens, setTokens] = useState([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState(null);

  async function laadTokens() {
    setLaden(true);
    setFout(null);
    try {
      const lijst = await getNotificationTokens();
      setTokens(lijst);
    } catch (e) {
      setFout('Fout bij laden: ' + e.message);
    }
    setLaden(false);
  }

  useEffect(() => { laadTokens(); }, []);

  async function deactiveerToken(tokenId) {
    try {
      await deactiveerNotificationToken(tokenId);
      setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, active: false } : t));
    } catch (e) {
      alert('Fout bij deactiveren: ' + e.message);
    }
  }

  if (laden) return <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', padding: '8px 0' }}>Tokens laden...</div>;
  if (fout) return <div style={{ color: 'var(--danger)', fontSize: 'var(--font-size-sm)' }}>{fout}</div>;

  const actief = tokens.filter(t => t.active);
  const perRol = ['admin', 'bestuurslid', 'trainer', 'lid', 'beheerder', 'onbekend'].map(rol => ({
    rol,
    aantal: actief.filter(t => (t.rol || 'onbekend') === rol).length,
  })).filter(r => r.aantal > 0);

  function formatDatum(iso) {
    if (!iso) return '-';
    try {
      return new Date(iso).toLocaleDateString('nl-BE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return iso; }
  }

  function kortDevice(ua) {
    if (!ua) return '-';
    if (ua.includes('iPhone')) return 'iPhone';
    if (ua.includes('iPad')) return 'iPad';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('Macintosh')) return 'Mac';
    if (ua.includes('Windows')) return 'Windows';
    return ua.substring(0, 30);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
          {actief.length} actieve token{actief.length !== 1 ? 's' : ''} - {tokens.length - actief.length} inactief
        </div>
        <button
          onClick={laadTokens}
          style={{ background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '6px 12px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}
        >
          ↻ Vernieuwen
        </button>
      </div>

      {perRol.length > 0 && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {perRol.map(({ rol, aantal }) => (
            <div key={rol} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px 16px', textAlign: 'center', minWidth: '80px' }}>
              <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--accent-red)' }}>{aantal}</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginTop: '2px', textTransform: 'capitalize' }}>{rol}</div>
            </div>
          ))}
        </div>
      )}

      {tokens.length === 0 ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>Geen tokens gevonden. Activeer push meldingen via Device Instellingen op een toestel.</div>
      ) : (
        <div style={{ display: 'grid', gap: '8px' }}>
          {tokens.map(t => (
            <div
              key={t.id}
              style={{
                background: t.active ? 'var(--bg-primary)' : '#111',
                border: `1px solid ${t.active ? 'var(--bg-secondary)' : 'var(--bg-primary)'}`,
                borderRadius: '10px',
                padding: '12px 14px',
                opacity: t.active ? 1 : 0.5,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <span style={{ fontSize: 'var(--font-size-md)', fontWeight: '600', color: t.active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      {t.naam || t.uid || '-'}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      padding: '2px 8px',
                      borderRadius: '8px',
                      background: (t.rol === 'admin' || t.rol === 'bestuurslid' || t.rol === 'beheerder') ? 'rgba(192,57,43,0.2)' : t.rol === 'trainer' ? 'rgba(52,152,219,0.2)' : 'rgba(255,255,255,0.05)',
                      color: (t.rol === 'admin' || t.rol === 'bestuurslid' || t.rol === 'beheerder') ? 'var(--accent-red)' : t.rol === 'trainer' ? '#3498db' : 'var(--text-secondary)',
                    }}>
                      {t.rol || 'onbekend'}
                    </span>
                    {t.active ? (
                      <span style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: '8px', background: 'rgba(39,174,96,0.15)', color: 'var(--success)', fontWeight: '600' }}>Actief</span>
                    ) : (
                      <span style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', fontWeight: '600' }}>Inactief</span>
                    )}
                    {t.active && t.stockAlerts && (
                      <span style={{ fontSize: '11px', color: '#f39c12' }}>📦 Stock</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>📱 {kortDevice(t.device)}</span>
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>↻ {formatDatum(t.updatedAt)}</span>
                  </div>
                </div>
                {t.active && (
                  <button
                    onClick={() => deactiveerToken(t.id)}
                    style={{ background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: 'var(--font-size-sm)', flexShrink: 0 }}
                  >
                    Deactiveer
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ─── C3: Clubbericht broadcast ───────────────────────────────────────────────

const ROL_OPTIES_BERICHT = [
  { value: 'alle',        label: 'Iedereen' },
  { value: 'admin',       label: 'Admin' },
  { value: 'bestuurslid', label: 'Bestuursleden' },
  { value: 'trainer',     label: 'Trainers' },
  { value: 'lid',         label: 'Leden' },
];

export function ClubBerichtBeheer() {
  return (
    <div>
      <div style={{
        background: 'rgba(230,51,70,0.08)',
        border: '1px solid rgba(230,51,70,0.25)',
        borderRadius: '10px',
        padding: '16px 20px',
        marginBottom: '16px',
      }}>
        <div style={{ fontWeight: '700', color: 'var(--accent-red)', marginBottom: '6px' }}>
          📣 Clubberichten verzenden via de Communicatie-pagina
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6' }}>
          Clubberichten (inclusief push-notificatie en e-mail) worden nu beheerd via de
          Communicatie-pagina. Gebruik de knop "Nieuw bericht" daar om een bericht te
          sturen, optioneel als push en/of e-mail.
        </div>
      </div>
      <a
        href="/communicatie"
        style={{
          display: 'inline-block',
          background: 'var(--accent-red)',
          color: 'var(--text-primary)',
          padding: '10px 20px',
          borderRadius: '8px',
          textDecoration: 'none',
          fontWeight: '600',
          fontSize: '14px',
        }}
      >
        Ga naar Communicatie →
      </a>
    </div>
  );
}


export function NieuwLidMeldingenBeheer() {
  const [config, setConfig] = useState({
    vasteMails: [],
    pushActief: true,
  });
  const [mailinvoer, setMailinvoer] = useState('');
  const [laden, setLaden] = useState(true);
  const [opslaan, setOpslaan] = useState(false);
  const [bericht, setBericht] = useState('');

  useEffect(() => {
    getMeldingInstellingen().then(data => {
      if (data) {
        const cfg = data?.nieuwLidMeldingen || {};
        const mails = Array.isArray(cfg.vasteMails) ? cfg.vasteMails : [];
        setConfig({
          vasteMails: mails,
          pushActief: cfg.pushActief ?? true,
        });
        setMailinvoer(mails.join('\n'));
      }
      setLaden(false);
    }).catch(e => {
      setBericht('Fout bij laden: ' + e.message);
      setLaden(false);
    });
  }, []);

  async function slaOp() {
    const mails = mailinvoer
      .split(/[\n,]+/)
      .map(m => m.trim().toLowerCase())
      .filter(m => m.includes('@'));

    setOpslaan(true);
    setBericht('');
    try {
      await setMeldingInstellingen({
        nieuwLidMeldingen: {
          vasteMails: mails,
          pushActief: config.pushActief,
        },
      });
      setConfig(prev => ({ ...prev, vasteMails: mails }));
      setMailinvoer(mails.join('\n'));
      setBericht('Instellingen opgeslagen.');
      setTimeout(() => setBericht(''), 3000);
    } catch (e) {
      setBericht('Fout bij opslaan: ' + e.message);
    }
    setOpslaan(false);
  }

  if (laden) return <div style={{ color: 'var(--text-secondary)', padding: '12px' }}>Laden...</div>;

  const toggleStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    padding: '12px 14px',
    marginBottom: '10px',
    cursor: 'pointer',
  };

  const knopStyle = (actief) => ({
    background: actief ? 'var(--success)' : 'var(--border-color)',
    border: 'none',
    color: 'var(--text-primary)',
    padding: '6px 14px',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: 'var(--font-size-sm)',
    fontWeight: '700',
    minWidth: '60px',
  });

  return (
    <div>
      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
        Push melding
      </div>
      <div style={toggleStyle}>
        <div>
          <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-primary)', fontWeight: '600' }}>Push bij nieuw lid</div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginTop: '3px' }}>Admins ontvangen een push bij elke nieuwe registratie</div>
        </div>
        <button
          onClick={() => setConfig(prev => ({ ...prev, pushActief: !prev.pushActief }))}
          style={knopStyle(config.pushActief)}
        >
          {config.pushActief ? 'Aan' : 'Uit'}
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
          Vaste mailadressen voor nieuw lid melding
        </div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginBottom: '8px' }}>
          Deze adressen ontvangen een mail wanneer iemand een account aanmaakt. Een adres per regel of kommagescheiden.
        </div>
        <textarea
          value={mailinvoer}
          onChange={e => setMailinvoer(e.target.value)}
          placeholder={'admin@kodokan.be\nbeheer@kodokan.be'}
          rows={4}
          style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            padding: '10px 12px',
            fontSize: 'var(--font-size-md)',
            width: '100%',
            boxSizing: 'border-box',
            resize: 'vertical',
            fontFamily: 'monospace',
          }}
        />
        {mailinvoer && (
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {mailinvoer.split(/[\n,]+/).filter(m => m.trim().includes('@')).length} geldig(e) adres(sen) herkend
          </div>
        )}
      </div>

      <button
        onClick={slaOp}
        disabled={opslaan}
        style={{
          background: 'var(--accent-red)',
          border: 'none',
          color: 'var(--text-primary)',
          padding: '11px 20px',
          borderRadius: 'var(--radius-md)',
          cursor: opslaan ? 'not-allowed' : 'pointer',
          fontSize: 'var(--font-size-md)',
          fontWeight: '700',
          opacity: opslaan ? 0.7 : 1,
        }}
      >
        {opslaan ? 'Opslaan...' : 'Instellingen opslaan'}
      </button>
      {bericht && (
        <div style={{
          marginTop: '12px',
          color: bericht.startsWith('Fout') ? 'var(--danger)' : 'var(--success)',
          fontSize: 'var(--font-size-sm)',
        }}>
          {bericht.startsWith('Fout') ? '' : '✓ '}{bericht}
        </div>
      )}
    </div>
  );
}

// ─── WedstrijdMeldingenBeheer ─────────────────────────────────────────────────
// Instellingen voor wedstrijd-/tornooimeldingen:
//   - Vaste mailadressen voor kalenderoverzicht-mails (onafhankelijk van push-ontvangers).
//   - Toggle: mail bij nieuw tornooi aan/uit.
// Gebruikt door InstellingenBeheer naast StockMeldingenBeheer en NieuwLidMeldingenBeheer.
export function WedstrijdMeldingenBeheer() {
  const [config, setConfig] = useState({
    vasteMails: [],
    mailActief: true,
  });
  const [mailinvoer, setMailinvoer] = useState('');
  const [laden, setLaden] = useState(true);
  const [opslaan, setOpslaan] = useState(false);
  const [bericht, setBericht] = useState('');

  useEffect(() => {
    getMeldingInstellingen().then(data => {
      if (data) {
        const cfg = data?.wedstrijdMeldingen || {};
        const mails = Array.isArray(cfg.vasteMails) ? cfg.vasteMails : [];
        setConfig({
          vasteMails: mails,
          mailActief: cfg.mailActief ?? true,
        });
        setMailinvoer(mails.join('\n'));
      }
      setLaden(false);
    }).catch(e => {
      setBericht('Fout bij laden: ' + e.message);
      setLaden(false);
    });
  }, []);

  async function slaOp() {
    const mails = mailinvoer
      .split(/[\n,]+/)
      .map(m => m.trim().toLowerCase())
      .filter(m => m.includes('@'));

    setOpslaan(true);
    setBericht('');
    try {
      await setMeldingInstellingen({
        wedstrijdMeldingen: {
          vasteMails: mails,
          mailActief: config.mailActief,
        },
      });
      setConfig(prev => ({ ...prev, vasteMails: mails }));
      setMailinvoer(mails.join('\n'));
      setBericht('Instellingen opgeslagen.');
      setTimeout(() => setBericht(''), 3000);
    } catch (e) {
      setBericht('Fout bij opslaan: ' + e.message);
    }
    setOpslaan(false);
  }

  if (laden) return <div style={{ color: 'var(--text-secondary)', padding: '12px' }}>Laden...</div>;

  const toggleStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'var(--bg-primary)',
    padding: '12px 14px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    marginBottom: '10px',
    cursor: 'pointer',
  };

  return (
    <div>
      {/* Toggle: mail bij nieuw tornooi */}
      <div
        style={toggleStyle}
        onClick={() => setConfig(prev => ({ ...prev, mailActief: !prev.mailActief }))}
      >
        <div>
          <div style={{ fontWeight: '600', fontSize: 'var(--font-size-md)' }}>
            Mail bij nieuw tornooi
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Stuur een mail naar onderstaande adressen wanneer een tornooi wordt aangemaakt.
          </div>
        </div>
        <div style={{
          width: '44px', height: '24px', borderRadius: '12px',
          background: config.mailActief ? 'var(--accent-red)' : 'var(--border)',
          position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        }}>
          <div style={{
            width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
            position: 'absolute', top: '3px',
            left: config.mailActief ? '23px' : '3px',
            transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }} />
        </div>
      </div>

      {/* Vaste mailadressen */}
      <div style={{ marginBottom: '10px' }}>
        <label style={{
          display: 'block', fontSize: 'var(--font-size-sm)',
          color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '600',
        }}>
          Vaste mailadressen (één per lijn of kommagescheiden)
        </label>
        <textarea
          value={mailinvoer}
          onChange={e => setMailinvoer(e.target.value)}
          placeholder={'bestuur@club.be\ntrainer@club.be'}
          rows={4}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '10px 12px',
            borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
            background: 'var(--bg-primary)', color: 'var(--text)',
            fontSize: 'var(--font-size-sm)', fontFamily: 'inherit', resize: 'vertical',
          }}
        />
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Deze adressen ontvangen ook het kalenderoverzicht wanneer je na een Excel-import op
          "Stuur kalenderoverzicht" klikt.
        </div>
      </div>

      <button
        onClick={slaOp}
        disabled={opslaan}
        style={{
          background: 'var(--accent-red)',
          border: 'none',
          color: 'var(--text-primary)',
          padding: '11px 20px',
          borderRadius: 'var(--radius-md)',
          cursor: opslaan ? 'not-allowed' : 'pointer',
          fontSize: 'var(--font-size-md)',
          fontWeight: '700',
          opacity: opslaan ? 0.7 : 1,
        }}
      >
        {opslaan ? 'Opslaan...' : 'Instellingen opslaan'}
      </button>
      {bericht && (
        <div style={{
          marginTop: '12px',
          color: bericht.startsWith('Fout') ? 'var(--danger)' : 'var(--success)',
          fontSize: 'var(--font-size-sm)',
        }}>
          {bericht.startsWith('Fout') ? '' : '✓ '}{bericht}
        </div>
      )}
    </div>
  );
}
