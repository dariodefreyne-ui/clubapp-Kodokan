// src/components/beheer/InstellingenBeheer.jsx
// Configureerbare club-data via CrudLijstBeheer:
// leeftijdscategorieën, lesgever-types, gordels, communicatie-categorieën, tarieftypes
import React from 'react';
import CrudLijstBeheer from './CrudLijstBeheer';
import { COLLECTIONS } from '../../config/appConfig';
import {
  DEFAULT_LEEFTIJDSCATEGORIEEN,
  DEFAULT_LESGEVER_TYPES,
  DEFAULT_GORDELS,
  DEFAULT_COMMUNICATIE_CATEGORIEEN,
  DEFAULT_TECHNIEK_CATEGORIEEN,
} from '../../config/clubdataDefaults';

// ─── Leeftijdscategorieën ────────────────────────────────────────────────────
const CATEGORIEEN_VELDEN = [
  { key: 'code',        label: 'Code',        breedte: '80px',  required: true, placeholder: 'bijv. U13' },
  { key: 'label',       label: 'Label',       breedte: '120px', required: true, placeholder: 'bijv. Pupillen' },
  { key: 'vanLeeftijd', label: 'Van (jaar)',  breedte: '90px',  type: 'number', min: 0, max: 99 },
  { key: 'totLeeftijd', label: 'Tot (jaar)',  breedte: '90px',  type: 'number', min: 0, max: 99 },
  { key: 'kleur',       label: 'Kleur badge', breedte: '160px', kleurKiezer: true },
  { key: 'gebruikInFiltering', label: 'Gebruik in filters', breedte: '120px', type: 'checkbox', default: true },
];

export function CategorieenBeheer() {
  return (
    <>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 12px' }}>
        Leeftijdscategorieën worden gebruikt bij ledeninschrijving, examens en wedstrijden.
        Volgorde bepaal je via het veld "volgorde" (lager = eerder in lijsten).
        "Gebruik in filters" bepaalt of de categorie als filteroptie verschijnt (bv. in Clubklassement) —
        wedstrijden tonen altijd alle categorieën, ongeacht deze instelling.
      </p>
      <CrudLijstBeheer
        collectie={COLLECTIONS.CATEGORIEEN}
        velden={CATEGORIEEN_VELDEN}
        itemLabel="categorie"
        defaults={DEFAULT_LEEFTIJDSCATEGORIEEN}
      />
    </>
  );
}

// ─── Lesgever-types ───────────────────────────────────────────────────────────
const LESGEVERTYPE_VELDEN = [
  { key: 'code',  label: 'Code',  breedte: '100px', required: true, placeholder: 'bijv. trainer_a' },
  { key: 'label', label: 'Label', required: true,   placeholder: 'bijv. Trainer A' },
];

export function LesgevertypesBeheer() {
  return (
    <>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 12px' }}>
        Lesgever-types worden getoond op lesgeverprofielen en in de trainingsplanning.
      </p>
      <CrudLijstBeheer
        collectie={COLLECTIONS.LESGEVER_TYPES}
        velden={LESGEVERTYPE_VELDEN}
        itemLabel="type"
        defaults={DEFAULT_LESGEVER_TYPES}
      />
    </>
  );
}

// ─── Gordels / KYU-systeem ────────────────────────────────────────────────────
// 'code' is de interne sleutel die op leden-profielen wordt opgeslagen (members.gordel)
// en die de dropdowns vullen. Een nieuwe gordel MOET dus een unieke code krijgen,
// anders verschijnt hij nergens. Hernoemen van de code wordt server-side
// gecascadeerd naar bestaande leden (zie cascadeGordel in functions/index.js).
const GORDEL_VELDEN = [
  { key: 'kyu',   label: 'Kyu',   breedte: '70px',  type: 'number', min: 0, max: 20 },
  { key: 'code',  label: 'Code',  breedte: '90px',  required: true, placeholder: 'bijv. wit' },
  { key: 'label', label: 'Label', required: true,   placeholder: 'bijv. Witte gordel' },
  { key: 'kleur', label: 'Kleur', breedte: '160px', kleurKiezer: true },
];

export function GordelsBeheer() {
  return (
    <>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 12px' }}>
        Gordels worden getoond op leden-profielen, in technieken-overzicht en op examens.
        Hogere kyu-waarde = lagere graad (wit = 0, dan 9, 8, 7... zwart = 1).
        De "Code" is de unieke interne sleutel waarmee een lid aan zijn gordel gekoppeld wordt.
      </p>
      <CrudLijstBeheer
        collectie={COLLECTIONS.GORDELS}
        velden={GORDEL_VELDEN}
        itemLabel="gordel"
        defaults={DEFAULT_GORDELS}
      />
    </>
  );
}

// ─── Communicatie-categorieën ─────────────────────────────────────────────────
const COMM_CAT_VELDEN = [
  { key: 'code',      label: 'Code',      breedte: '120px', required: true, placeholder: 'bijv. training' },
  { key: 'label',     label: 'Label',     required: true,   placeholder: 'bijv. Training' },
  { key: 'kleur',     label: 'Kleur',     breedte: '160px', kleurKiezer: true },
  { key: 'doelgroep', label: 'Doelgroep', breedte: '120px', placeholder: 'bijv. trainer' },
];

export function CommunicatieCategorieenBeheer() {
  return (
    <>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 12px' }}>
        Categorieën voor communicatieberichten. "Doelgroep" is de standaard ontvangersrol
        wanneer er een nieuw bericht aangemaakt wordt in deze categorie (kan overschreven worden).
      </p>
      <CrudLijstBeheer
        collectie={COLLECTIONS.COMMUNICATIE_CATEGORIEEN}
        velden={COMM_CAT_VELDEN}
        itemLabel="categorie"
        defaults={DEFAULT_COMMUNICATIE_CATEGORIEEN}
      />
    </>
  );
}

// ─── Techniekcategorieën ──────────────────────────────────────────────────────
const TECHNIEK_CAT_VELDEN = [
  { key: 'code',  label: 'Code',  breedte: '140px', required: true, placeholder: 'bijv. worpen' },
  { key: 'label', label: 'Label', required: true,   placeholder: 'bijv. Worpen' },
];

export function TechniekCategorieenBeheer() {
  return (
    <>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 12px' }}>
        Categorieën zoals "Val", "Worpen", "Houdgreep" worden gebruikt om technieken
        in te delen en te filteren in de Technieken-pagina.
      </p>
      <CrudLijstBeheer
        collectie={COLLECTIONS.TECHNIEK_CATEGORIEEN}
        velden={TECHNIEK_CAT_VELDEN}
        itemLabel="categorie"
        defaults={DEFAULT_TECHNIEK_CATEGORIEEN}
      />
    </>
  );
}
