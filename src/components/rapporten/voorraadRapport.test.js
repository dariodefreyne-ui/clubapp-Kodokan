import { describe, it, expect } from 'vitest';
import { berekenVoorraadRapport, bepaalStatus, LAGE_STOCK_DREMPEL } from './voorraadRapport';

const P = (o) => ({ id: Math.random().toString(36).slice(2), category: 'tshirt', name: 'T-shirt', variant: 'M', stock: 0, price: 0, costPrice: 0, ...o });

describe('bepaalStatus', () => {
  it('gebruikt drempel 3', () => {
    expect(LAGE_STOCK_DREMPEL).toBe(3);
    expect(bepaalStatus(0, true)).toBe('UITVERKOCHT');
    expect(bepaalStatus(-1, true)).toBe('UITVERKOCHT');
    expect(bepaalStatus(1, true)).toBe('LAAG');
    expect(bepaalStatus(2, true)).toBe('LAAG');
    expect(bepaalStatus(3, true)).toBe('OK');
    expect(bepaalStatus(10, false)).toBe('INACTIEF');
  });
});

describe('berekenVoorraadRapport', () => {
  const producten = [
    P({ variant: 'S', stock: 5, price: 15, costPrice: 8 }),
    P({ variant: 'M', stock: 2, price: 15, costPrice: 8 }),
    P({ variant: 'L', stock: 0, price: 15, costPrice: 8 }),
    P({ variant: 'XL', stock: 4, price: 15, costPrice: 8, active: false }),
    P({ variant: 'M', tweedehands: true, stock: 1, price: 10, costPrice: 0, herkomst: 'Lid', staat: 'goed' }),
  ];
  const r = berekenVoorraadRapport(producten);

  it('telt inactieve producten niet mee in totalen maar behoudt de rij', () => {
    expect(r.rijen).toHaveLength(5);
    expect(r.actief.producten).toBe(4);
    expect(r.inactief).toEqual({ producten: 1, stuks: 4 });
    expect(r.rijen.filter(x => x.status === 'INACTIEF')).toHaveLength(1);
  });

  it('berekent waarden correct', () => {
    // nieuw: (5+2+0) stuks
    expect(r.nieuw.stuks).toBe(7);
    expect(r.nieuw.voorraadwaarde).toBe(56);
    expect(r.nieuw.verkoopwaarde).toBe(105);
    expect(r.nieuw.marge).toBe(49);
    expect(r.tweedehands.verkoopwaarde).toBe(10);
    expect(r.actief.voorraadwaarde).toBe(56);
  });

  it('telt uitverkocht en laag enkel bij actieve producten', () => {
    expect(r.actief.uitverkocht).toBe(1);
    expect(r.actief.laag).toBe(2); // nieuw M (2) + tweedehands M (1)
  });

  it('berekent marge % op verkoopprijs en geeft null bij prijs 0', () => {
    const rij = r.rijen.find(x => x.variant === 'S');
    expect(rij.margePct).toBeCloseTo(7 / 15);
    expect(berekenVoorraadRapport([P({ stock: 1 })]).rijen[0].margePct).toBeNull();
  });

  it('leest tweedehandsvelden uit beide veldnamen (laatste ontvangst wint)', () => {
    const rapport = berekenVoorraadRapport([
      P({ tweedehands: true, stock: 1, herkomst: 'Oud', laatsteOntvangstHerkomst: 'Nieuw lid', laatsteOntvangstStaat: 'redelijk' }),
    ]);
    expect(rapport.tweedehandsRijen[0].herkomst).toBe('Nieuw lid');
    expect(rapport.tweedehandsRijen[0].staat).toBe('Redelijk');
  });

  it('signaleert ontbrekende prijzen, maar niet voor gratis tweedehands', () => {
    const c = berekenVoorraadRapport([
      P({ stock: 3, price: 10, costPrice: 0 }),          // nieuw zonder aankoop -> melding
      P({ tweedehands: true, stock: 1, price: 5 }),      // tweedehands gratis -> geen melding
      P({ stock: 2, price: 0, costPrice: 4 }),           // zonder verkoopprijs -> melding
      P({ stock: -1, price: 1, costPrice: 1 }),          // negatief
      P({ stock: 0 }),                                   // uitverkocht, geen melding
    ]).controle;
    expect(c).toEqual({ zonderAankoopprijs: 1, zonderVerkoopprijs: 1, negatieveStock: 1 });
  });

  it('groepeert opvolging per categorie', () => {
    expect(r.opvolging.uitverkocht[0].items).toEqual(['L']);
    expect(r.opvolging.laag[0].items).toContain('M: 2');
  });

  it('werkt met lege lijst', () => {
    const leeg = berekenVoorraadRapport([]);
    expect(leeg.actief.producten).toBe(0);
    expect(leeg.perCategorie).toEqual([]);
  });
});
