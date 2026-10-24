import { describe, it, expect } from 'vitest';
import { berekenWinkelOmzet } from './winkelOmzet';

const producten = [
  { id: 'a', name: 'T-shirt', variant: 'M', price: 20, costPrice: 12, soldCount: 3 },
  { id: 'b', name: 'Gordel', variant: 'Wit', price: 8, costPrice: 4, soldCount: 0 },
];

describe('berekenWinkelOmzet', () => {
  it('gebruikt de prijs op het moment van de verkoop, ook na een prijswijziging', () => {
    const sales = [
      { items: [{ productId: 'a', qty: 2, prijs: 15, aankoopprijs: 9 }] },   // oude prijs
      { items: [{ productId: 'a', qty: 1, prijs: 20, aankoopprijs: 12 }] },  // nieuwe prijs
    ];
    const r = berekenWinkelOmzet(producten, sales);
    const a = r.products.find(p => p.id === 'a');
    expect(a.verkocht).toBe(3);
    expect(a.omzet).toBe(50);          // 2×15 + 1×20, niet 3×20
    expect(a.marge).toBe(20);          // 50 − (2×9 + 1×12)
    expect(r.totalRevenue).toBe(50);
    expect(r.margin).toBe(20);
    expect(r.kostGeschatStuks).toBe(0);
    expect(r.afwijkendeTelling).toBe(0);
  });

  it('negeert geannuleerde verkopen', () => {
    const sales = [
      { geannuleerd: true, items: [{ productId: 'a', qty: 5, prijs: 20, aankoopprijs: 12 }] },
      { items: [{ productId: 'a', qty: 1, prijs: 20, aankoopprijs: 12 }] },
    ];
    expect(berekenWinkelOmzet(producten, sales).products[0].verkocht).toBe(1);
  });

  it('valt voor oude verkopen zonder aankoopprijs terug op de huidige aankoopprijs en telt dat', () => {
    const sales = [{ items: [{ productId: 'a', qty: 2, prijs: 15 }] }];
    const r = berekenWinkelOmzet(producten, sales);
    const a = r.products[0];
    expect(a.omzet).toBe(30);
    expect(a.marge).toBe(6);            // 30 − 2×12
    expect(a.kostGeschat).toBe(2);
    expect(r.kostGeschatStuks).toBe(2);
  });

  it('neemt verkopen van verwijderde producten mee in het totaal', () => {
    const sales = [{ items: [{ productId: 'weg', qty: 1, prijs: 10, aankoopprijs: 6 }] }];
    const r = berekenWinkelOmzet(producten, sales);
    expect(r.totalRevenue).toBe(10);
    expect(r.margin).toBe(4);
    expect(r.products.every(p => p.omzet === 0)).toBe(true);
  });

  it('signaleert afwijking tussen soldCount en de verkopen', () => {
    const r = berekenWinkelOmzet([{ id: 'a', price: 1, costPrice: 1, soldCount: 5 }], [{ items: [{ productId: 'a', qty: 2, prijs: 1 }] }]);
    expect(r.products[0].telAfwijking).toBe(true);
    expect(r.afwijkendeTelling).toBe(1);
  });

  it('werkt zonder verkopen', () => {
    const r = berekenWinkelOmzet(producten, []);
    expect(r.totalRevenue).toBe(0);
    expect(r.products[0].marge).toBe(0);
  });
});
