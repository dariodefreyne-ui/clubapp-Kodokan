// src/components/beheer/MeldingenBeheer.jsx
import React, { useState, useEffect } from 'react';
import {
  getMeldingInstellingen, setMeldingInstellingen,
  addTrainerReminderTrigger, getAllProducts,
  getAllUsers, sendMail,
  getNotificationTokens, deactiveerNotificationToken,
} from '../../services/firestoreService';
import { CLUB_NAAM_KORT } from '../../config/appConfig';
import { stuurPushTrigger, PUSH_TYPES } from '../../services/pushService';

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

  if (laden) return <div style={{ color: '#aaa', padding: '12px' }}>Laden...</div>;

  return (
    <div>
      <div style={{ fontSize: '13px', color: '#aaa', marginBottom: '16px' }}>
        De Cloud Function controleert dagelijks om 9u. Hieronder bepaal je op welke dagen hij actief is en hoeveel dagen vooruit hij kijkt.
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
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
                  background: actief ? 'rgba(192,57,43,0.2)' : '#1a1a1a',
                  border: actief ? '1px solid #c0392b' : '1px solid #3a3a3a',
                  color: actief ? '#e74c3c' : '#aaa',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
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
        <div style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
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
              background: '#1a1a1a',
              border: '1px solid #3a3a3a',
              borderRadius: '8px',
              color: '#fff',
              padding: '9px 12px',
              fontSize: '14px',
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
                  background: '#1a1a1a',
                  border: '1px solid #3a3a3a',
                  borderRadius: '8px',
                  color: '#fff',
                  padding: '9px 12px',
                  fontSize: '14px',
                  width: '80px',
                }}
              />
              <span style={{ color: '#aaa', fontSize: '13px' }}>dagen (1-30)</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
          Melding blokkeren als opmerking bevat
        </div>
        <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px' }}>
          Als de opmerking van een training deze tekst bevat, wordt geen herinnering gestuurd. Hoofdletters worden genegeerd.
        </div>
        <input
          type="text"
          value={config.uitsluitZin}
          onChange={e => setConfig(prev => ({ ...prev, uitsluitZin: e.target.value }))}
          placeholder="bv. sporthal gesloten"
          style={{
            background: '#1a1a1a',
            border: '1px solid #3a3a3a',
            borderRadius: '8px',
            color: '#fff',
            padding: '10px 12px',
            fontSize: '14px',
            width: '100%',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <button
        onClick={slaOp}
        disabled={opslaan}
        style={{
          background: '#c0392b',
          border: 'none',
          color: '#fff',
          padding: '11px 20px',
          borderRadius: '8px',
          cursor: opslaan ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: '700',
          opacity: opslaan ? 0.7 : 1,
        }}
      >
        {opslaan ? 'Opslaan...' : 'Instellingen opslaan'}
      </button>

      {bericht && (
        <div style={{
          marginTop: '12px',
          color: bericht.startsWith('Fout') || bericht.startsWith('Selecteer') ? '#e74c3c' : '#2ecc71',
          fontSize: '13px',
        }}>
          {bericht.startsWith('Fout') || bericht.startsWith('Selecteer') ? '' : '✓ '}{bericht}
        </div>
      )}

      <div style={{ marginTop: '28px', borderTop: '1px solid #2a2a2a', paddingTop: '20px' }}>
        <div style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
          Manuele controle
        </div>
        <div style={{ fontSize: '13px', color: '#aaa', marginBottom: '12px' }}>
          Voer de trainer-check nu onmiddellijk uit zonder te wachten op de dagelijkse scheduler. Push meldingen en mails worden verstuurd voor trainingen zonder lesgever.
        </div>
        <button
          onClick={handleManueleCheck}
          disabled={triggerLaden}
          style={{
            background: triggerLaden ? '#2a2a2a' : '#1a1a1a',
            border: '1px solid #c0392b',
            color: '#c0392b',
            padding: '11px 20px',
            borderRadius: '8px',
            cursor: triggerLaden ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '700',
            opacity: triggerLaden ? 0.6 : 1,
          }}
        >
          {triggerLaden ? 'Bezig...' : '▶ Controleer nu & stuur meldingen'}
        </button>
        {triggerStatus === 'ok' && (
          <div style={{ marginTop: '10px', color: '#2ecc71', fontSize: '13px' }}>
            ✓ Controle gestart. Meldingen worden binnen enkele seconden verstuurd.
          </div>
        )}
        {triggerStatus === 'fout' && (
          <div style={{ marginTop: '10px', color: '#e74c3c', fontSize: '13px' }}>
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

  if (laden) return <div style={{ color: '#aaa', padding: '12px' }}>Laden...</div>;

  const toggleStyle = () => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#1a1a1a',
    border: '1px solid #3a3a3a',
    borderRadius: '10px',
    padding: '12px 14px',
    marginBottom: '10px',
    cursor: 'pointer',
  });

  const knopStyle = (actief) => ({
    background: actief ? '#27ae60' : '#555',
    border: 'none',
    color: '#fff',
    padding: '6px 14px',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '700',
    minWidth: '60px',
  });

  return (
    <div>
      <div style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
        Meldingen aan/uit
      </div>

      <div style={toggleStyle(config.stockNulActief)}>
        <div>
          <div style={{ fontSize: '14px', color: '#fff', fontWeight: '600' }}>Stock = 0 melding</div>
          <div style={{ fontSize: '12px', color: '#aaa', marginTop: '3px' }}>Push + mail bij uitverkocht</div>
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
          <div style={{ fontSize: '14px', color: '#fff', fontWeight: '600' }}>Lage stock melding</div>
          <div style={{ fontSize: '12px', color: '#aaa', marginTop: '3px' }}>Mail bij daling onder drempel</div>
        </div>
        <button
          onClick={() => setConfig(prev => ({ ...prev, laagStockActief: !prev.laagStockActief }))}
          style={knopStyle(config.laagStockActief)}
        >
          {config.laagStockActief ? 'Aan' : 'Uit'}
        </button>
      </div>

      <div style={{ marginTop: '20px', marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
          Drempelwaarde lage stock
        </div>
        <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px' }}>
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
              background: '#1a1a1a',
              border: '1px solid #3a3a3a',
              borderRadius: '8px',
              color: '#fff',
              padding: '10px 12px',
              fontSize: '16px',
              width: '80px',
              textAlign: 'center',
            }}
          />
          <span style={{ color: '#aaa', fontSize: '13px' }}>stuks of minder = lage stock melding</span>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
          Vaste mailadressen voor stockmeldingen
        </div>
        <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px' }}>
          Deze adressen ontvangen altijd een mail bij stock = 0 of lage stock, los van individuele profielinstellingen. Een adres per regel of kommagescheiden.
        </div>
        <textarea
          value={mailinvoer}
          onChange={e => setMailinvoer(e.target.value)}
          placeholder={'admin@kodokan.be\nbeheer@kodokan.be'}
          rows={4}
          style={{
            background: '#1a1a1a',
            border: '1px solid #3a3a3a',
            borderRadius: '8px',
            color: '#fff',
            padding: '10px 12px',
            fontSize: '14px',
            width: '100%',
            boxSizing: 'border-box',
            resize: 'vertical',
            fontFamily: 'monospace',
          }}
        />
        {mailinvoer && (
          <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
            {mailinvoer.split(/[\n,]+/).filter(m => m.trim().includes('@')).length} geldig(e) adres(sen) herkend
          </div>
        )}
      </div>

      <button
        onClick={slaOp}
        disabled={opslaan}
        style={{
          background: '#c0392b',
          border: 'none',
          color: '#fff',
          padding: '11px 20px',
          borderRadius: '8px',
          cursor: opslaan ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: '700',
          opacity: opslaan ? 0.7 : 1,
        }}
      >
        {opslaan ? 'Opslaan...' : 'Instellingen opslaan'}
      </button>

      {bericht && (
        <div style={{
          marginTop: '12px',
          color: bericht.startsWith('Fout') ? '#e74c3c' : '#2ecc71',
          fontSize: '13px',
        }}>
          {bericht.startsWith('Fout') ? '' : '✓ '}{bericht}
        </div>
      )}
    </div>
  );
}


export function StockOverzichtMail() {
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

      // Haal users op met stockAlerts
      const usersData = await getAllUsers();
      const adressenSet = new Set(vasteMails.filter(m => m.includes('@')));

      usersData.forEach(u => {
        if (u.notificaties?.stockAlerts) {
          const mail = u.notificaties?.emailVoorkeur || u.email;
          if (mail) adressenSet.add(mail);
        }
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
    <h1 style="color: #ffffff; margin: 0; font-size: 20px;">${CLUB_NAAM_KORT}</h1>
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
      Beheer de voorraad via de Kodokan Clubapp onder Winkel.
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
          subject: `Stockoverzicht ${datum} - Kodokan`,
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
      <div style={{ fontSize: '13px', color: '#aaa', marginBottom: '16px' }}>
        Stuur een volledig stockoverzicht per mail naar alle geconfigureerde adressen. Producten met lage stock of stock 0 worden duidelijk gemarkeerd.
      </div>
      <button
        onClick={stuurOverzicht}
        disabled={bezig}
        style={{
          background: bezig ? '#555' : '#2980b9',
          border: 'none',
          color: '#fff',
          padding: '11px 20px',
          borderRadius: '8px',
          cursor: bezig ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: '700',
          opacity: bezig ? 0.7 : 1,
        }}
      >
        {bezig ? 'Bezig...' : 'Stuur stockoverzicht per mail'}
      </button>
      {bericht && (
        <div style={{
          marginTop: '12px',
          color: bericht.startsWith('Fout') ? '#e74c3c' : '#2ecc71',
          fontSize: '13px',
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

  if (laden) return <div style={{ color: '#aaa', fontSize: '13px', padding: '8px 0' }}>Tokens laden...</div>;
  if (fout) return <div style={{ color: '#e74c3c', fontSize: '13px' }}>{fout}</div>;

  const actief = tokens.filter(t => t.active);
  const perRol = ['beheerder', 'trainer', 'lid', 'onbekend'].map(rol => ({
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
        <div style={{ fontSize: '13px', color: '#aaa' }}>
          {actief.length} actieve token{actief.length !== 1 ? 's' : ''} - {tokens.length - actief.length} inactief
        </div>
        <button
          onClick={laadTokens}
          style={{ background: 'none', border: '1px solid #3a3a3a', color: '#aaa', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}
        >
          ↻ Vernieuwen
        </button>
      </div>

      {perRol.length > 0 && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {perRol.map(({ rol, aantal }) => (
            <div key={rol} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '10px', padding: '10px 16px', textAlign: 'center', minWidth: '80px' }}>
              <div style={{ fontSize: '22px', fontWeight: '700', color: '#c0392b' }}>{aantal}</div>
              <div style={{ fontSize: '11px', color: '#888', marginTop: '2px', textTransform: 'capitalize' }}>{rol}</div>
            </div>
          ))}
        </div>
      )}

      {tokens.length === 0 ? (
        <div style={{ color: '#555', fontSize: '13px' }}>Geen tokens gevonden. Activeer push meldingen via Device Instellingen op een toestel.</div>
      ) : (
        <div style={{ display: 'grid', gap: '8px' }}>
          {tokens.map(t => (
            <div
              key={t.id}
              style={{
                background: t.active ? '#1a1a1a' : '#111',
                border: `1px solid ${t.active ? '#2a2a2a' : '#1e1e1e'}`,
                borderRadius: '10px',
                padding: '12px 14px',
                opacity: t.active ? 1 : 0.5,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: t.active ? '#fff' : '#666' }}>
                      {t.naam || t.uid || '-'}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      padding: '2px 8px',
                      borderRadius: '8px',
                      background: t.rol === 'beheerder' ? 'rgba(192,57,43,0.2)' : t.rol === 'trainer' ? 'rgba(52,152,219,0.2)' : 'rgba(255,255,255,0.05)',
                      color: t.rol === 'beheerder' ? '#c0392b' : t.rol === 'trainer' ? '#3498db' : '#aaa',
                    }}>
                      {t.rol || 'onbekend'}
                    </span>
                    {t.active ? (
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(39,174,96,0.15)', color: '#27ae60', fontWeight: '600' }}>Actief</span>
                    ) : (
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: '#555', fontWeight: '600' }}>Inactief</span>
                    )}
                    {t.active && t.stockAlerts && (
                      <span style={{ fontSize: '11px', color: '#f39c12' }}>📦 Stock</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: '#666' }}>📱 {kortDevice(t.device)}</span>
                    <span style={{ fontSize: '12px', color: '#555' }}>↻ {formatDatum(t.updatedAt)}</span>
                  </div>
                </div>
                {t.active && (
                  <button
                    onClick={() => deactiveerToken(t.id)}
                    style={{ background: 'none', border: '1px solid #3a3a3a', color: '#666', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', flexShrink: 0 }}
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

export function ClubBerichtBeheer() {
  const [titel, setTitel]       = useState('');
  const [bericht, setBericht]   = useState('');
  const [doelRol, setDoelRol]   = useState('alle');
  const [bezig, setBezig]       = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'ok'|'fout', tekst }

  const ROL_OPTIES = [
    { value: 'alle',      label: 'Iedereen' },
    { value: 'beheerder', label: 'Beheerders' },
    { value: 'trainer',   label: 'Trainers' },
    { value: 'lid',       label: 'Leden' },
  ];

  async function verstuur() {
    if (!titel.trim() || !bericht.trim()) {
      setFeedback({ type: 'fout', tekst: 'Vul titel en bericht in.' });
      return;
    }
    if (!window.confirm(`Clubbericht versturen naar: ${ROL_OPTIES.find(r => r.value === doelRol)?.label}?`)) return;

    setBezig(true);
    setFeedback(null);

    try {
      stuurPushTrigger(PUSH_TYPES.CLUBBERICHT, {
        titel:   titel.trim(),
        bericht: bericht.trim(),
        doelRol,
      });
      setFeedback({ type: 'ok', tekst: 'Bericht verzonden.' });
      setTitel('');
      setBericht('');
      setDoelRol('alle');
    } catch (e) {
      setFeedback({ type: 'fout', tekst: 'Verzenden mislukt: ' + e.message });
    }

    setBezig(false);
  }

  const inputStyle = {
    width: '100%',
    background: '#1a1a1a',
    border: '1px solid #3a3a3a',
    borderRadius: '8px',
    color: '#fff',
    padding: '10px',
    fontSize: '14px',
    boxSizing: 'border-box',
    marginBottom: '10px',
    fontFamily: 'inherit',
  };

  const labelStyle = {
    color: '#aaa',
    fontSize: '12px',
    marginBottom: '4px',
    display: 'block',
  };

  return (
    <div>
      <div style={{ color: '#aaa', fontSize: '13px', marginBottom: '14px', lineHeight: '1.5' }}>
        Stuur een push-melding naar alle toestellen met clubberichten ingeschakeld.
        Gebruik dit spaarzaam — maximaal 1 keer per week.
      </div>

      <label style={labelStyle}>Doelgroep</label>
      <select
        style={inputStyle}
        value={doelRol}
        onChange={e => setDoelRol(e.target.value)}
      >
        {ROL_OPTIES.map(r => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>

      <label style={labelStyle}>Titel</label>
      <input
        style={inputStyle}
        type="text"
        placeholder="Korte titel (max 50 tekens)"
        maxLength={50}
        value={titel}
        onChange={e => setTitel(e.target.value)}
      />

      <label style={labelStyle}>Bericht</label>
      <textarea
        style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
        placeholder="Inhoud van het bericht..."
        maxLength={200}
        value={bericht}
        onChange={e => setBericht(e.target.value)}
      />
      <div style={{ color: '#555', fontSize: '11px', marginTop: '-8px', marginBottom: '12px' }}>
        {bericht.length}/200 tekens
      </div>

      {feedback && (
        <div style={{
          background: feedback.type === 'ok' ? 'rgba(39,174,96,0.15)' : 'rgba(231,76,60,0.15)',
          color:      feedback.type === 'ok' ? '#27ae60' : '#e74c3c',
          border:     `1px solid ${feedback.type === 'ok' ? 'rgba(39,174,96,0.3)' : 'rgba(231,76,60,0.3)'}`,
          borderRadius: '8px',
          padding: '10px 14px',
          fontSize: '13px',
          marginBottom: '12px',
        }}>
          {feedback.tekst}
        </div>
      )}

      <button
        onClick={verstuur}
        disabled={bezig || !titel.trim() || !bericht.trim()}
        style={{
          background: bezig || !titel.trim() || !bericht.trim() ? '#3a3a3a' : '#c0392b',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          padding: '10px 20px',
          fontSize: '14px',
          fontWeight: '600',
          cursor: bezig || !titel.trim() || !bericht.trim() ? 'default' : 'pointer',
          opacity: bezig ? 0.7 : 1,
        }}
      >
        {bezig ? 'Verzenden...' : '📢 Verstuur clubbericht'}
      </button>
    </div>
  );
}
