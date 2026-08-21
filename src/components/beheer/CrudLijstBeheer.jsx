// src/components/beheer/CrudLijstBeheer.jsx
// Generiek CRUD-component voor configureerbare lijsten (categorieen, gordels, ...).
// Elke rij heeft inline-editing; nieuw item via "Toevoegen" onderaan.
import React, { useState, useEffect } from 'react';
import { subscribeConfigLijst, setConfigItem, deleteConfigItem, seedConfigLijst } from '../../services/firestoreService';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../ui/Toast.jsx';
import { useAuth } from '../../contexts/AuthContext';

// Collecties die ook in AuthContext.configCache zitten — na een wijziging
// hier moet die cache expliciet ververst worden, anders zien andere pagina's
// (dropdowns, filters, ...) de wijziging pas na de cache-TTL of een nieuwe tab.
const CACHE_COLLECTIES = new Set([
  'categorieen', 'gordels', 'lesgeverTypes', 'techniekCategorieen', 'agendaCategorieen',
]);

const S = {
  tabel: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  th: { textAlign: 'left', padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: '600', borderBottom: '1px solid var(--border-color)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  td: { padding: '8px 10px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)', verticalAlign: 'middle' },
  input: { padding: '6px 10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', width: '100%', boxSizing: 'border-box' },
  btnPrimary: { padding: '7px 14px', background: 'var(--accent-red)', border: 'none', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
  btnSecondary: { padding: '7px 14px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' },
  btnDanger: { padding: '7px 12px', background: 'transparent', border: '1px solid var(--danger)', borderRadius: '6px', color: 'var(--danger)', fontSize: '13px', cursor: 'pointer' },
};

function leegItem(velden, index) {
  const item = { volgorde: index * 10 };
  velden.forEach(v => { item[v.key] = v.default ?? ''; });
  return item;
}

/**
 * CrudLijstBeheer
 * @param {string}   collectie   - Firestore collectienaam
 * @param {Array}    velden      - [{ key, label, type?, breedte?, required?, kleurKiezer? }]
 * @param {string}   itemLabel   - Enkelvoud label voor een item (bijv. "categorie")
 */
export default function CrudLijstBeheer({ collectie, velden, itemLabel = 'item', defaults }) {
  const [items, setItems] = useState(null);
  const [bezig, setBezig] = useState({});
  const [bewerkId, setBewerkId] = useState(null);
  const [bewerkData, setBewerkData] = useState({});
  const [nieuw, setNieuw] = useState(null);
  const [fout, setFout] = useState('');
  const [seeding, setSeeding] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();
  const { refreshConfigCache } = useAuth();
  const verversIndienGecached = () => {
    if (CACHE_COLLECTIES.has(collectie)) refreshConfigCache();
  };

  useEffect(() => {
    return subscribeConfigLijst(collectie, setItems);
  }, [collectie]);

  function startBewerk(item) {
    setBewerkId(item.id);
    setBewerkData({ ...item });
    setNieuw(null);
  }

  function cancelBewerk() {
    setBewerkId(null);
    setBewerkData({});
  }

  async function slaBewerk() {
    const verplicht = velden.filter(v => v.required).find(v => !String(bewerkData[v.key] ?? '').trim());
    if (verplicht) { setFout(`"${verplicht.label}" is verplicht`); return; }
    setFout('');
    setBezig(b => ({ ...b, [bewerkId]: true }));
    try {
      await setConfigItem(collectie, bewerkId, bewerkData);
      toast({ bericht: `${itemLabel.charAt(0).toUpperCase() + itemLabel.slice(1)} opgeslagen`, type: 'success' });
      setBewerkId(null);
      setBewerkData({});
      verversIndienGecached();
    } catch (e) {
      toast({ bericht: `Fout bij opslaan: ${e.message}`, type: 'error' });
    }
    setBezig(b => ({ ...b, [bewerkId]: false }));
  }

  function startNieuw() {
    setNieuw(leegItem(velden, (items?.length ?? 0) + 1));
    setBewerkId(null);
  }

  async function slaNieuwOp() {
    const verplicht = velden.filter(v => v.required).find(v => !String(nieuw[v.key] ?? '').trim());
    if (verplicht) { setFout(`"${verplicht.label}" is verplicht`); return; }
    setFout('');
    setBezig(b => ({ ...b, nieuw: true }));
    const huidigeItems = items || [];
    const volgendeVolgorde = huidigeItems.length > 0
      ? Math.max(...huidigeItems.map(i => i.volgorde ?? 0)) + 10
      : 10;
    try {
      await setConfigItem(collectie, null, { ...nieuw, volgorde: volgendeVolgorde });
      toast({ bericht: `${itemLabel.charAt(0).toUpperCase() + itemLabel.slice(1)} toegevoegd`, type: 'success' });
      setNieuw(null);
      verversIndienGecached();
    } catch (e) {
      toast({ bericht: `Fout bij toevoegen: ${e.message}`, type: 'error' });
    }
    setBezig(b => ({ ...b, nieuw: false }));
  }

  async function verwijder(item) {
    const ok = await confirm({
      titel: `${itemLabel.charAt(0).toUpperCase() + itemLabel.slice(1)} verwijderen`,
      beschrijving: `"${item[velden[0]?.key] || item.id}" permanent verwijderen?`,
      bevestigLabel: 'Verwijderen',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await deleteConfigItem(collectie, item.id);
      toast({ bericht: `${itemLabel.charAt(0).toUpperCase() + itemLabel.slice(1)} verwijderd`, type: 'success' });
      verversIndienGecached();
    } catch (e) {
      toast({ bericht: `Fout bij verwijderen: ${e.message}`, type: 'error' });
    }
  }

  function renderVeld(veld, waarde, onChange) {
    if (veld.kleurKiezer) {
      return (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input type="color" value={waarde || '#888888'} onChange={e => onChange(e.target.value)}
            style={{ width: '36px', height: '30px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer' }} />
          <input value={waarde || ''} onChange={e => onChange(e.target.value)}
            placeholder="#rrggbb" style={{ ...S.input, width: '90px' }} />
        </div>
      );
    }
    if (veld.type === 'number') {
      return <input type="number" value={waarde ?? ''} onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        style={S.input} min={veld.min} max={veld.max} />;
    }
    if (veld.type === 'checkbox') {
      return <input type="checkbox" checked={!!waarde} onChange={e => onChange(e.target.checked)}
        style={{ width: '18px', height: '18px', cursor: 'pointer' }} />;
    }
    return <input value={waarde ?? ''} onChange={e => onChange(e.target.value)}
      placeholder={veld.placeholder || veld.label} style={S.input} />;
  }

  async function importeerStandaard() {
    if (!defaults?.length) return;
    setSeeding(true);
    try {
      const aantal = await seedConfigLijst(collectie, defaults);
      toast({
        bericht: aantal > 0 ? `${aantal} standaardwaarden geïmporteerd` : 'Er stond al data — niets gewijzigd',
        type: aantal > 0 ? 'success' : 'info',
      });
      if (aantal > 0) verversIndienGecached();
    } catch (e) {
      toast({ bericht: `Fout bij importeren: ${e.message}`, type: 'error' });
    }
    setSeeding(false);
  }

  const lijstLeeg = items !== null && items.length === 0;
  const heeftDefaults = defaults && defaults.length > 0;

  return (
    <div>
      {fout && (
        <div style={{ background: 'rgba(192,57,43,0.1)', border: '1px solid var(--danger)', borderRadius: '6px', padding: '8px 12px', color: 'var(--danger)', marginBottom: '12px', fontSize: '13px' }}>
          {fout}
        </div>
      )}

      {lijstLeeg && heeftDefaults && (
        <div style={{
          background: 'rgba(52,152,219,0.08)', border: '1px solid rgba(52,152,219,0.3)',
          borderRadius: '8px', padding: '14px 16px', marginBottom: '14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: '200px', color: 'var(--text-primary)', fontSize: '13px' }}>
            Deze lijst is nog leeg. Wil je de {defaults.length} standaardwaarden importeren?
          </div>
          <button style={S.btnPrimary} onClick={importeerStandaard} disabled={seeding}>
            {seeding ? 'Importeren...' : 'Standaardwaarden importeren'}
          </button>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={S.tabel}>
          <thead>
            <tr>
              {velden.map(v => (
                <th key={v.key} style={{ ...S.th, width: v.breedte }}>{v.label}</th>
              ))}
              <th style={{ ...S.th, width: '120px' }}>Acties</th>
            </tr>
          </thead>
          <tbody>
            {(items || []).map(item => {
              const isBewerk = bewerkId === item.id;
              return (
                <tr key={item.id}>
                  {velden.map(v => (
                    <td key={v.key} style={S.td}>
                      {isBewerk
                        ? renderVeld(v, bewerkData[v.key], val => setBewerkData(d => ({ ...d, [v.key]: val })))
                        : (v.kleurKiezer
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ width: '14px', height: '14px', borderRadius: '3px', background: item[v.key] || '#888', display: 'inline-block', border: '1px solid var(--border-color)' }} />
                              {item[v.key]}
                            </span>
                          : v.type === 'checkbox'
                          ? <span style={{ color: item[v.key] ? 'var(--success)' : 'var(--text-secondary)', fontWeight: '700' }}>{item[v.key] ? '✓' : '—'}</span>
                          : item[v.key])
                      }
                    </td>
                  ))}
                  <td style={S.td}>
                    {isBewerk ? (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button style={S.btnPrimary} onClick={slaBewerk} disabled={bezig[item.id]}>Opslaan</button>
                        <button style={S.btnSecondary} onClick={cancelBewerk}>Annuleer</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button style={S.btnSecondary} onClick={() => startBewerk(item)}>Bewerk</button>
                        <button style={S.btnDanger} onClick={() => verwijder(item)}>Wis</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}

            {/* Nieuwe rij */}
            {nieuw && (
              <tr>
                {velden.map(v => (
                  <td key={v.key} style={S.td}>
                    {renderVeld(v, nieuw[v.key], val => setNieuw(n => ({ ...n, [v.key]: val })))}
                  </td>
                ))}
                <td style={S.td}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button style={S.btnPrimary} onClick={slaNieuwOp} disabled={bezig.nieuw}>Toevoegen</button>
                    <button style={S.btnSecondary} onClick={() => { setNieuw(null); setFout(''); }}>Annuleer</button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!nieuw && (
        <button style={{ ...S.btnSecondary, marginTop: '12px' }} onClick={startNieuw}>
          + {itemLabel.charAt(0).toUpperCase() + itemLabel.slice(1)} toevoegen
        </button>
      )}
    </div>
  );
}
