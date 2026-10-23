// src/components/rapporten/voorraadFormaat.js
// Afspraken tussen het voorraadrapport (export) en de import: één bron van waarheid,
// zodat export en import nooit uit elkaar kunnen lopen.

export const FORMAAT_VERSIE = 1;

export const SHEET_NIEUW = 'Voorraad nieuw';
export const SHEET_TWEEDEHANDS = 'Voorraad tweedehands';
export const SHEET_META = '_meta';

// Kopteksten (de import zoekt kolommen op naam, niet op positie)
export const KOP = {
  categorie: 'Categorie',
  product: 'Product',
  variant: 'Variant',
  actief: 'Actief',
  stock: 'Stock',
  prijs: 'Verkoopprijs',
  aankoop: 'Aankoopprijs',
  id: 'ID (niet wijzigen)',
};

// Enkel deze velden worden bij import teruggeschreven.
export const VELD_LABELS = {
  stock: 'Stock',
  prijs: 'Verkoopprijs',
  aankoop: 'Aankoopprijs',
  actief: 'Actief',
};

// Veldnaam in het rapport -> veldnaam in Firestore (collectie `products`)
export const FIRESTORE_VELD = {
  stock: 'stock',
  prijs: 'price',
  aankoop: 'costPrice',
  actief: 'active',
};

export const META_LABELS = {
  versie: 'formaatversie',
  exportOp: 'exportOp',
  aantal: 'aantalProducten',
};
export const META_KOP = ['ID', 'Product', 'Variant', 'Stock', 'Verkoopprijs', 'Aankoopprijs', 'Actief', 'Tabblad'];
