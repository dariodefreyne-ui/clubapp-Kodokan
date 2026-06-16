// src/utils/themaUtils.js
import { CLUB_STORAGE_PREFIX } from '../config/appConfig';

const STORAGE_KEY = `${CLUB_STORAGE_PREFIX}_thema`;

export const THEMAS = [
  {
    id: 'navy',
    label: 'Blue Navy',
    sub: 'Standaard',
    bg: '#06101A',
    card: '#1B2A3D',
    accent: '#E63346',
  },
  {
    id: 'kodokan',
    label: 'Kodokan',
    sub: 'Donker goud',
    bg: '#100D07',
    card: '#241C0D',
    accent: '#C9A227',
  },
  {
    id: 'light',
    label: 'Licht',
    sub: 'Helder wit',
    bg: '#F8FAFC',
    card: '#F1F5F9',
    accent: '#DC2626',
  },
];

export function laadThema() {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'navy';
  } catch {
    return 'navy';
  }
}

export function pasThemaToe(themaId) {
  const html = document.documentElement;
  if (themaId === 'navy') {
    html.removeAttribute('data-theme');
  } else {
    html.setAttribute('data-theme', themaId);
  }
  try {
    localStorage.setItem(STORAGE_KEY, themaId);
  } catch {}
}
