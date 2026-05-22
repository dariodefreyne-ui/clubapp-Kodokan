// src/components/beheer/InstellingenBeheer.jsx
// Configureerbare club-data via CrudLijstBeheer:
// leeftijdscategorieën, lesgever-types, gordels, communicatie-categorieën, tarieftypes
import React from 'react';
import CrudLijstBeheer from './CrudLijstBeheer';
import { COLLECTIONS } from '../../config/appConfig';

// ─── Leeftijdscategorieën ────────────────────────────────────────────────────
const CATEGORIEEN_VELDEN = [
  { key: 'code',       label: 'Code',         breedte: '80px',  required: true, placeholder: 'bijv. U13' },
  { key: 'label',      label: 'Label',        breedte: '120px', required: true, placeholder: 'bijv. Pupillen' },
  { key: 'vanLeeftijd',label: 'Van (jaar)',   breedte: '90px',  type: 'number', min: 0, max: 99 },
  { key: 'totLeeftijd',label: 'Tot (jaar)',   breedte: '90px',  type: 'number', min: 0, max: 99 },
];

export function CategorieenBeheer() {
  return (
    <>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 12px' }}>
        Leeftijdscategorieën worden gebruikt bij ledeninschrijving, examens en wedstrijden.
        Volgorde bepaal je via het veld "volgorde" (lager = eerder in lijsten).
      </p>
      <CrudLijstBeheer
        collectie={COLLECTIONS.CATEGORIEEN}
        velden={CATEGORIEEN_VELDEN}
        itemLabel="categorie"
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
      />
    </>
  );
}

// ─── Gordels / KYU-systeem ────────────────────────────────────────────────────
const GORDEL_VELDEN = [
  { key: 'kyu',   label: 'Kyu',   breedte: '70px', type: 'number', min: 0, max: 20 },
  { key: 'label', label: 'Label', required: true,  placeholder: 'bijv. Witte gordel' },
  { key: 'kleur', label: 'Kleur', breedte: '160px', kleurKiezer: true },
];

export function GordelsBeheer() {
  return (
    <>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 12px' }}>
        Gordels worden getoond op leden-profielen, in technieken-overzicht en op examens.
        Hogere kyu-waarde = lagere graad (wit = 0, dan 9, 8, 7... zwart = 1).
      </p>
      <CrudLijstBeheer
        collectie={COLLECTIONS.GORDELS}
        velden={GORDEL_VELDEN}
        itemLabel="gordel"
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
      />
    </>
  );
}

// ─── Tarieftypes ──────────────────────────────────────────────────────────────
const TARIEF_VELDEN = [
  { key: 'code',    label: 'Code',    breedte: '130px', required: true, placeholder: 'bijv. aansluiting' },
  { key: 'label',   label: 'Label',   required: true,   placeholder: 'bijv. Aansluiting VJF' },
  { key: 'bedrag',  label: 'Bedrag',  breedte: '90px',  type: 'number', min: 0, placeholder: '0' },
  { key: 'eenheid', label: 'Eenheid', breedte: '100px', placeholder: 'bijv. euro' },
];

export function TarieftypesBeheer() {
  return (
    <>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 12px' }}>
        Tarieftypes worden gebruikt voor uitbetalingen en lidmaatschapsbeheer.
      </p>
      <CrudLijstBeheer
        collectie={COLLECTIONS.TARIEFTYPES}
        velden={TARIEF_VELDEN}
        itemLabel="tarief"
      />
    </>
  );
}
