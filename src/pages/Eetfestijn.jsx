import React, { useState, useEffect } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
  query, orderBy, serverTimestamp, getDocs
} from 'firebase/firestore';
import { db } from '../firebase';

const S = {
  page: { minHeight:'100vh', background:'#1a1a1a', color:'#fff', padding:'16px' },
  title: { fontSize:'22px', fontWeight:'700', marginBottom:'16px' },
  card: { background:'#2d2d2d', borderRadius:'12px', padding:'16px', marginBottom:'12px' },
  tabs: { display:'flex', gap:'0', marginBottom:'20px', borderBottom:'1px solid #3a3a3a' },
  tab: (a) => ({ background:'none', border:'none', color: a?'#c0392b':'#aaa', padding:'10px 16px', cursor:'pointer', fontSize:'14px', fontWeight: a?'700':'400', borderBottom: a?'2px solid #c0392b':'2px solid transparent' }),
  input: { width:'100%', background:'#1a1a1a', border:'1px solid #3a3a3a', borderRadius:'8px', color:'#fff', padding:'10px', fontSize:'15px', boxSizing:'border-box', marginBottom:'10px' },
  select: { width:'100%', background:'#1a1a1a', border:'1px solid #3a3a3a', borderRadius:'8px', color:'#fff', padding:'10px', fontSize:'15px', boxSizing:'border-box', marginBottom:'10px' },
  label: { color:'#aaa', fontSize:'12px', marginBottom:'4px', display:'block' },
  btn: (v='primary') => ({ background: v==='primary'?'#c0392b':v==='success'?'#27ae60':v==='danger'?'#e74c3c':'#3a3a3a', border:'none', color:'#fff', padding:'10px 16px', borderRadius:'8px', cursor:'pointer', fontSize:'14px', fontWeight:'600' }),
  row: { display:'flex', gap:'10px', flexWrap:'wrap' },
  statusBadge: (s) => ({ background: s==='betaald'?'#27ae60':s==='geleverd'?'#3498db':'#f39c12', color:'#fff', padding:'2px 8px', borderRadius:'10px', fontSize:'11px', fontWeight:'600' }),
  orderCard: { background:'#1a1a1a', borderRadius:'10px', padding:'14px', marginBottom:'8px', border:'1px solid #3a3a3a' },
  statCard: (c) => ({ background:'#2d2d2d', borderRadius:'10px', padding:'14px', borderLeft:`3px solid ${c}` }),
  statNum: { fontSize:'24px', fontWeight:'700' },
  statLabel: { color:'#aaa', fontSize:'12px' },
};

export default function Eetfestijn() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [tab, setTab] = useState('bestellingen');
  const [orders, setOrders] = useState([]);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [eventForm, setEventForm] = useState({ name:'', date:'' });
  const [orderForm, setOrderForm] = useState({ tafel:'', volwassenen:1, kinderen:0, dranken:'', opmerking:'' });
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState('alle');
  const [ticketTypes, setTicketTypes] = useState([{ naam:'Volwassene', prijs:15 }, { naam:'Kind', prijs:8 }]);

  useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => e.type === 'eetfestijn');
      setEvents(all);
      if (!selectedEvent && all.length > 0) setSelectedEvent(all[0]);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!selectedEvent) return;
    const q = query(collection(db, 'events', selectedEvent.id, 'registrations'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [selectedEvent]);

  async function createEvent() {
    setSaving(true);
    const ref = await addDoc(collection(db, 'events'), { ...eventForm, type:'eetfestijn', createdAt: serverTimestamp() });
    setSelectedEvent({ id: ref.id, ...eventForm, type:'eetfestijn' });
    setShowNewEvent(false); setEventForm({ name:'', date:'' });
    setSaving(false);
  }

  async function createOrder() {
    if (!selectedEvent) return;
    setSaving(true);
    const prijs = (orderForm.volwassenen * 15) + (orderForm.kinderen * 8);
    await addDoc(collection(db, 'events', selectedEvent.id, 'registrations'), {
      ...orderForm, status:'open', totaal: prijs, createdAt: serverTimestamp()
    });
    setShowNewOrder(false); setOrderForm({ tafel:'', volwassenen:1, kinderen:0, dranken:'', opmerking:'' });
    setSaving(false);
  }

  async function updateOrderStatus(orderId, status) {
    await updateDoc(doc(db, 'events', selectedEvent.id, 'registrations', orderId), { status });
  }

  async function deleteOrder(orderId) {
    if (!window.confirm('Bestelling verwijderen?')) return;
    await deleteDoc(doc(db, 'events', selectedEvent.id, 'registrations', orderId));
  }

  const filteredOrders = filterStatus === 'alle' ? orders : orders.filter(o => o.status === filterStatus);
  const totalRevenue = orders.reduce((s,o) => s + (o.totaal||0), 0);
  const paidRevenue = orders.filter(o => o.status!=='open').reduce((s,o) => s + (o.totaal||0), 0);
  const totalVolwassenen = orders.reduce((s,o) => s + (o.volwassenen||0), 0);
  const totalKinderen = orders.reduce((s,o) => s + (o.kinderen||0), 0);

  return (
    <div style={S.page}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px', flexWrap:'wrap', gap:'8px' }}>
        <div style={S.title}>🍝 Eetfestijn</div>
        <button style={S.btn('primary')} onClick={() => setShowNewEvent(true)}>+ Nieuw evenement</button>
      </div>

      {/* Event selector */}
      {events.length > 0 && (
        <div style={S.card}>
          <label style={S.label}>Actief evenement</label>
          <select style={S.select} value={selectedEvent?.id||''} onChange={e => setSelectedEvent(events.find(ev => ev.id === e.target.value))}>
            {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name} ({ev.date})</option>)}
          </select>
        </div>
      )}

      {!selectedEvent ? (
        <div style={{ ...S.card, textAlign:'center', color:'#aaa', padding:'40px' }}>
          Geen evenement. Maak een nieuw evenement aan.
        </div>
      ) : (
        <>
          <div style={S.tabs}>
            {['bestellingen','tickets','overzicht'].map(t => (
              <button key={t} style={S.tab(tab===t)} onClick={() => setTab(t)}>
                {t==='bestellingen'?'📋 Bestellingen':t==='tickets'?'🎫 Tickets':'📊 Overzicht'}
              </button>
            ))}
          </div>

          {tab === 'bestellingen' && (
            <>
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'12px', alignItems:'center' }}>
                {['alle','open','betaald','geleverd'].map(s => (
                  <button key={s} style={{ background: filterStatus===s?'#c0392b':'#2d2d2d', border:'none', color:'#fff', padding:'7px 12px', borderRadius:'16px', cursor:'pointer', fontSize:'12px' }}
                    onClick={() => setFilterStatus(s)}>{s}</button>
                ))}
                <button style={{ ...S.btn('primary'), marginLeft:'auto' }} onClick={() => setShowNewOrder(true)}>+ Bestelling</button>
              </div>
              {filteredOrders.length === 0 ? (
                <div style={{ color:'#aaa', textAlign:'center', padding:'30px' }}>Geen bestellingen.</div>
              ) : filteredOrders.map(o => (
                <div key={o.id} style={S.orderCard}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                    <div style={{ fontWeight:'700', fontSize:'16px' }}>Tafel {o.tafel||'—'}</div>
                    <span style={S.statusBadge(o.status||'open')}>{o.status||'open'}</span>
                  </div>
                  <div style={{ color:'#aaa', fontSize:'13px', marginBottom:'8px' }}>
                    {o.volwassenen||0}× volwassene · {o.kinderen||0}× kind
                    {o.dranken && ` · ${o.dranken}`}
                    {o.opmerking && <span style={{ display:'block', color:'#f39c12' }}>📝 {o.opmerking}</span>}
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ fontSize:'18px', fontWeight:'700', color:'#27ae60' }}>€{(o.totaal||0).toFixed(2)}</div>
                    <div style={{ display:'flex', gap:'6px' }}>
                      {o.status === 'open' && <button style={S.btn('success')} onClick={() => updateOrderStatus(o.id,'betaald')}>💰 Betaald</button>}
                      {o.status === 'betaald' && <button style={S.btn()} onClick={() => updateOrderStatus(o.id,'geleverd')}>🍽 Geleverd</button>}
                      <button style={S.btn('danger')} onClick={() => deleteOrder(o.id)}>🗑</button>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {tab === 'tickets' && (
            <div style={S.card}>
              <h3 style={{ marginTop:0 }}>Tickettypes</h3>
              {ticketTypes.map((t,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid #3a3a3a' }}>
                  <div>
                    <div style={{ fontWeight:'600' }}>{t.naam}</div>
                    <div style={{ color:'#aaa', fontSize:'13px' }}>€{t.prijs} / persoon</div>
                  </div>
                  <div style={{ fontSize:'18px', fontWeight:'700', color:'#c0392b' }}>
                    {t.naam === 'Volwassene' ? totalVolwassenen : totalKinderen} verkocht
                  </div>
                </div>
              ))}
              <div style={{ marginTop:'16px', padding:'12px', background:'#1a1a1a', borderRadius:'8px' }}>
                <div style={{ color:'#aaa', fontSize:'13px' }}>Verwachte omzet</div>
                <div style={{ fontSize:'22px', fontWeight:'700', color:'#27ae60' }}>€{totalRevenue.toFixed(2)}</div>
              </div>
            </div>
          )}

          {tab === 'overzicht' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px,1fr))', gap:'10px', marginBottom:'16px' }}>
                <div style={S.statCard('#27ae60')}>
                  <div style={S.statNum}>€{totalRevenue.toFixed(2)}</div>
                  <div style={S.statLabel}>Totale omzet</div>
                </div>
                <div style={S.statCard('#3498db')}>
                  <div style={S.statNum}>€{paidRevenue.toFixed(2)}</div>
                  <div style={S.statLabel}>Ontvangen</div>
                </div>
                <div style={S.statCard('#c0392b')}>
                  <div style={S.statNum}>{orders.length}</div>
                  <div style={S.statLabel}>Bestellingen</div>
                </div>
                <div style={S.statCard('#f39c12')}>
                  <div style={S.statNum}>{orders.filter(o=>o.status==='open').length}</div>
                  <div style={S.statLabel}>Open</div>
                </div>
                <div style={S.statCard('#9b59b6')}>
                  <div style={S.statNum}>{totalVolwassenen + totalKinderen}</div>
                  <div style={S.statLabel}>Personen</div>
                </div>
              </div>
              <div style={S.card}>
                <h3 style={{ marginTop:0 }}>Per status</h3>
                {['open','betaald','geleverd'].map(s => {
                  const n = orders.filter(o => (o.status||'open') === s);
                  return (
                    <div key={s} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #3a3a3a' }}>
                      <span style={S.statusBadge(s)}>{s}</span>
                      <span>{n.length} bestellingen — €{n.reduce((sum,o)=>sum+(o.totaal||0),0).toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* New event modal */}
      {showNewEvent && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:'16px' }}>
          <div style={{ background:'#2d2d2d', borderRadius:'16px', padding:'24px', width:'100%', maxWidth:'380px' }}>
            <h3 style={{ marginTop:0 }}>Nieuw eetfestijn</h3>
            <label style={S.label}>Naam</label>
            <input style={S.input} value={eventForm.name} onChange={e => setEventForm(f=>({...f,name:e.target.value}))} placeholder="bv. Eetfestijn 2025" />
            <label style={S.label}>Datum</label>
            <input style={S.input} type="date" value={eventForm.date} onChange={e => setEventForm(f=>({...f,date:e.target.value}))} />
            <div style={S.row}>
              <button style={{ ...S.btn('primary'), flex:1 }} onClick={createEvent} disabled={saving}>{saving?'Opslaan...':'✓ Aanmaken'}</button>
              <button style={S.btn()} onClick={() => setShowNewEvent(false)}>Annuleren</button>
            </div>
          </div>
        </div>
      )}

      {/* New order modal */}
      {showNewOrder && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:'16px' }}>
          <div style={{ background:'#2d2d2d', borderRadius:'16px', padding:'24px', width:'100%', maxWidth:'380px' }}>
            <h3 style={{ marginTop:0 }}>Nieuwe bestelling</h3>
            <label style={S.label}>Tafelnummer</label>
            <input style={S.input} value={orderForm.tafel} onChange={e => setOrderForm(f=>({...f,tafel:e.target.value}))} placeholder="bv. 5" />
            <label style={S.label}>Aantal volwassenen (€15)</label>
            <input style={S.input} type="number" min="0" value={orderForm.volwassenen} onChange={e => setOrderForm(f=>({...f,volwassenen:parseInt(e.target.value)||0}))} />
            <label style={S.label}>Aantal kinderen (€8)</label>
            <input style={S.input} type="number" min="0" value={orderForm.kinderen} onChange={e => setOrderForm(f=>({...f,kinderen:parseInt(e.target.value)||0}))} />
            <label style={S.label}>Dranken / opmerking</label>
            <input style={S.input} value={orderForm.dranken} onChange={e => setOrderForm(f=>({...f,dranken:e.target.value}))} placeholder="bv. 2 cola, 1 water" />
            <div style={{ background:'#1a1a1a', borderRadius:'8px', padding:'10px', marginBottom:'12px', textAlign:'center' }}>
              <div style={{ color:'#aaa', fontSize:'13px' }}>Totaal</div>
              <div style={{ fontSize:'22px', fontWeight:'700', color:'#27ae60' }}>
                €{((orderForm.volwassenen||0)*15 + (orderForm.kinderen||0)*8).toFixed(2)}
              </div>
            </div>
            <div style={S.row}>
              <button style={{ ...S.btn('primary'), flex:1 }} onClick={createOrder} disabled={saving}>{saving?'Opslaan...':'✓ Bestelling opslaan'}</button>
              <button style={S.btn()} onClick={() => setShowNewOrder(false)}>Annuleren</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
