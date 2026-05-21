import React, { useState, useMemo } from 'react';
import { C, CATEGORIE_COLORS } from './tokens';
import { formatDateShort, isUpcoming } from './SharedUI';

export default function JudokaTab({ inschrijvingen, onOpenTornooi }) {
  const [zoek, setZoek] = useState('');
  const [expandedNamen, setExpandedNamen] = useState(new Set());

  const byJudoka = useMemo(() => {
    const map = {};
    for (const ins of inschrijvingen) {
      const naam = ins.judokaNaam || '—';
      if (!map[naam]) map[naam] = [];
      map[naam].push(ins);
    }
    return map;
  }, [inschrijvingen]);

  const judokaNamen = Object.keys(byJudoka)
    .filter(n => !zoek || n.toLowerCase().includes(zoek.toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'nl'));

  function toggleExpand(naam) {
    setExpandedNamen(prev => {
      const next = new Set(prev);
      if (next.has(naam)) next.delete(naam);
      else next.add(naam);
      return next;
    });
  }

  const inputStyle = {
    width: '100%', background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: '8px', color: C.text, padding: '9px 12px', fontSize: '13px',
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div>
      <input
        autoFocus
        placeholder="🔍 Zoek judoka op naam…"
        value={zoek}
        onChange={e => setZoek(e.target.value)}
        style={{ ...inputStyle, marginBottom: '16px' }}
      />

      {judokaNamen.length === 0 ? (
        <div style={{ color: C.textMut, textAlign: 'center', padding: '60px', fontSize: '14px' }}>
          {zoek ? `Geen judoka gevonden voor "${zoek}".` : 'Nog geen inschrijvingen.'}
        </div>
      ) : judokaNamen.map(naam => {
        const tornooien = byJudoka[naam].sort((a, b) => (a.eventDatum || '').localeCompare(b.eventDatum || ''));
        const komende = tornooien.filter(t => isUpcoming(t.eventDatum));
        const voorbije = tornooien.filter(t => !isUpcoming(t.eventDatum))
          .sort((a, b) => (b.eventDatum || '').localeCompare(a.eventDatum || ''));
        const isOpen = expandedNamen.has(naam);

        return (
          <div key={naam} style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px',
            marginBottom: '8px', overflow: 'hidden',
          }}>
            {/* Judoka header — klikbaar om uit te klappen */}
            <button
              onClick={() => toggleExpand(naam)}
              style={{
                width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                fontFamily: 'inherit', textAlign: 'left',
              }}
            >
              <span style={{
                width: '36px', height: '36px', borderRadius: '50%', background: C.redDim,
                border: `1px solid ${C.redBord}`, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '14px', fontWeight: '800', color: C.red, flexShrink: 0,
              }}>
                {naam.charAt(0).toUpperCase()}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: C.text }}>{naam}</div>
                <div style={{ fontSize: '11px', color: C.textMut, marginTop: '2px' }}>
                  {komende.length > 0
                    ? `${komende.length} komend${komende.length !== 1 ? 'e' : ''}`
                    : 'geen komende tornooien'}
                  {voorbije.length > 0 && ` · ${voorbije.length} voorbije`}
                </div>
              </div>
              <span style={{
                fontSize: '10px', color: C.textMut, transition: 'transform 0.2s',
                transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', flexShrink: 0,
              }}>▶</span>
            </button>

            {/* Uitgeklapte inhoud */}
            {isOpen && (
              <div style={{ padding: '0 16px 14px', borderTop: `1px solid ${C.border}` }}>

                {/* Komende tornooien — klikbaar → opent DetailPanel in Tornooien tab */}
                {komende.length === 0 ? (
                  <div style={{ color: C.textMut, fontSize: '13px', padding: '12px 0 6px' }}>
                    Geen komende tornooien.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', paddingTop: '10px' }}>
                    {komende.map((ins, i) => {
                      const cc = CATEGORIE_COLORS[ins.categorie] || { bg: C.surface, color: C.textSec, border: C.border };
                      return (
                        <button
                          key={i}
                          onClick={() => onOpenTornooi(ins.eventId)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '8px 12px', borderRadius: '8px',
                            background: C.surface, border: `1px solid ${C.border}`,
                            cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%',
                          }}
                        >
                          <span style={{ fontSize: '11px', color: C.textMut, minWidth: '52px', flexShrink: 0 }}>
                            {ins.eventDatum ? formatDateShort(ins.eventDatum) : '—'}
                          </span>
                          <span style={{ fontSize: '13px', color: C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ins.eventNaam}
                          </span>
                          {ins.categorie && ins.categorie !== '—' && (
                            <span style={{ background: cc.bg, color: cc.color, border: `1px solid ${cc.border}`, padding: '1px 7px', borderRadius: '999px', fontSize: '10px', fontWeight: '700', flexShrink: 0 }}>
                              {ins.categorie}
                            </span>
                          )}
                          <span style={{ fontSize: '11px', color: C.textMut, flexShrink: 0 }}>↗</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Voorbije tornooien — native details/summary */}
                {voorbije.length > 0 && (
                  <details style={{ marginTop: '10px' }}>
                    <summary style={{
                      fontSize: '11px', color: C.textMut, cursor: 'pointer',
                      userSelect: 'none', WebkitUserSelect: 'none',
                      paddingBottom: '6px', fontWeight: '600', letterSpacing: '0.3px',
                    }}>
                      Voorbije tornooien ({voorbije.length})
                    </summary>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', paddingTop: '6px' }}>
                      {voorbije.map((ins, i) => {
                        const cc = CATEGORIE_COLORS[ins.categorie] || { bg: C.surface, color: C.textSec, border: C.border };
                        return (
                          <button
                            key={i}
                            onClick={() => onOpenTornooi(ins.eventId)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '10px',
                              padding: '7px 12px', borderRadius: '8px',
                              background: C.surface, border: `1px solid ${C.border}`,
                              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%',
                              opacity: 0.7,
                            }}
                          >
                            <span style={{ fontSize: '11px', color: C.textMut, minWidth: '52px', flexShrink: 0 }}>
                              {ins.eventDatum ? formatDateShort(ins.eventDatum) : '—'}
                            </span>
                            <span style={{ fontSize: '13px', color: C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ins.eventNaam}
                            </span>
                            {ins.categorie && ins.categorie !== '—' && (
                              <span style={{ background: cc.bg, color: cc.color, border: `1px solid ${cc.border}`, padding: '1px 7px', borderRadius: '999px', fontSize: '10px', fontWeight: '700', flexShrink: 0 }}>
                                {ins.categorie}
                              </span>
                            )}
                            <span style={{ fontSize: '11px', color: C.textMut, flexShrink: 0 }}>↗</span>
                          </button>
                        );
                      })}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
