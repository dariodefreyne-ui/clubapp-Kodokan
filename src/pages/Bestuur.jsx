// src/pages/Bestuur.jsx
// Bestuurspagina — enkel toegankelijk voor admin/bestuurslid.
// Drie tabs: Vergaderingen (met live-vergadering-modus, agenda-notulen,
// actiepunten, verslagen), Actiepunten (cross-vergadering overzicht),
// Documenten (gegroepeerd per vergadering + overige).
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useConfirm } from '../contexts/ConfirmContext';
import {
  subscribeBestuursVergaderingen, subscribeBestuursActiepunten, subscribeBestuursDocumenten, getBestuursleden,
} from '../services/firestoreService';
import { C } from '../styles/tokens';
import { S } from '../components/bestuur/shared.jsx';
import VergaderingenTab from '../components/bestuur/VergaderingenTab.jsx';
import ActiepuntenTab from '../components/bestuur/ActiepuntenTab.jsx';
import DocumentenTab from '../components/bestuur/DocumentenTab.jsx';

export default function Bestuur() {
  const { isBeheerder } = useAuth();
  const confirm = useConfirm();

  const [tab, setTab] = useState('vergaderingen');
  const [vergaderingen, setVergaderingen] = useState([]);
  const [actiepunten, setActiepunten] = useState([]);
  const [documenten, setDocumenten] = useState([]);
  const [bestuursleden, setBestuursleden] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fout, setFout] = useState(null);

  useEffect(() => {
    if (!isBeheerder) return;
    setFout(null);
    const onFout = (err) => {
      setLoading(false);
      setFout(`${err.code ?? 'fout'}: ${err.message}`);
    };
    const u1 = subscribeBestuursVergaderingen(lijst => {
      lijst.sort((a, b) => (b.datum || '').localeCompare(a.datum || ''));
      setVergaderingen(lijst);
      setLoading(false);
    }, onFout);
    const u2 = subscribeBestuursActiepunten(setActiepunten, onFout);
    const u3 = subscribeBestuursDocumenten(setDocumenten, onFout);
    getBestuursleden().then(setBestuursleden).catch(() => {});
    return () => { u1(); u2(); u3(); };
  }, [isBeheerder]);

  if (!isBeheerder) {
    return (
      <div style={{ ...S.page, textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔒</div>
        <div style={{ fontSize: '18px', fontWeight: '700' }}>Geen toegang</div>
        <div style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
          Deze pagina is enkel voor bestuursleden en admins.
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={S.title}>🏛️ Bestuur</div>
      </div>

      {fout && (
        <div style={{ background: `${C.red}18`, border: `1px solid ${C.red}`, borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: C.red }}>
          <strong>Firestore-fout</strong> — controleer de browser-console voor details.<br />
          <span style={{ fontFamily: 'monospace', fontSize: '12px', opacity: 0.85 }}>{fout}</span>
        </div>
      )}

      <div style={S.tabBar}>
        <button style={S.tab(tab === 'vergaderingen')} onClick={() => setTab('vergaderingen')}>📅 Vergaderingen</button>
        <button style={S.tab(tab === 'actiepunten')} onClick={() => setTab('actiepunten')}>
          ✅ Actiepunten{actiepunten.filter(a => a.status !== 'afgerond').length > 0 ? ` (${actiepunten.filter(a => a.status !== 'afgerond').length})` : ''}
        </button>
        <button style={S.tab(tab === 'documenten')} onClick={() => setTab('documenten')}>📁 Documenten</button>
      </div>

      {tab === 'vergaderingen' && (
        <VergaderingenTab
          vergaderingen={vergaderingen} loading={loading} actiepunten={actiepunten}
          documenten={documenten} bestuursleden={bestuursleden} confirm={confirm}
        />
      )}
      {tab === 'actiepunten' && (
        <ActiepuntenTab actiepunten={actiepunten} vergaderingen={vergaderingen} confirm={confirm} />
      )}
      {tab === 'documenten' && (
        <DocumentenTab documenten={documenten} vergaderingen={vergaderingen} confirm={confirm} />
      )}
    </div>
  );
}
