import React from 'react';

export function getProductVisual(product = {}) {
  const category = product.category;
  const variant = String(product.variant || '').toLowerCase();
  const name = String(product.name || '').toLowerCase();
  const text = `${name} ${variant}`;

  const beltColors = {
    wit: { bg: '#ffffff', color: '#333', border: '1px solid #ccc' },
    geel: { bg: '#f1c40f', color: '#333', border: 'none' },
    oranje: { bg: '#e67e22', color: '#fff', border: 'none' },
    groen: { bg: '#27ae60', color: '#fff', border: 'none' },
    blauw: { bg: '#3498db', color: '#fff', border: 'none' },
    bruin: { bg: '#8B4513', color: '#fff', border: 'none' },
    zwart: { bg: '#111111', color: '#fff', border: '1px solid #555' },
  };

  if (category === 'judogi') {
    if (text.includes('broek')) {
      return {
        icon: '👖',
        label: 'Broek',
        bg: '#f5f5f5',
        color: '#111',
        border: '1px solid #ddd',
      };
    }

    if (text.includes('vest')) {
      return {
        icon: '🥼',
        label: 'Vest',
        bg: '#f5f5f5',
        color: '#111',
        border: '1px solid #ddd',
      };
    }

    return {
      icon: '🥋',
      label: 'Pak',
      bg: '#f5f5f5',
      color: '#111',
      border: '1px solid #ddd',
    };
  }

  if (category === 'tshirt') {
    return {
      icon: '👕',
      label: 'T-shirt',
      bg: '#c0392b',
      color: '#fff',
      border: 'none',
    };
  }

  if (category === 'hoodie') {
    return {
      icon: '🧥',
      label: 'Pull',
      bg: '#111111',
      color: '#fff',
      border: '1px solid #555',
    };
  }

  if (category === 'sportzak') {
    if (text.includes('groot')) {
      return {
        icon: '🧳',
        label: 'Groot',
        bg: '#2d2d2d',
        color: '#fff',
        border: '1px solid #555',
      };
    }

    return {
      icon: '🎒',
      label: 'Klein',
      bg: '#2d2d2d',
      color: '#fff',
      border: '1px solid #555',
    };
  }

  if (category === 'gordel') {
    const kleur = Object.keys(beltColors).find(k => text.includes(k));
    const meta = beltColors[kleur] || {
      bg: '#2d2d2d',
      color: '#fff',
      border: '1px solid #555',
    };

    return {
      icon: '━',
      label: kleur || 'Gordel',
      ...meta,
    };
  }

  return {
    icon: '•',
    label: 'Product',
    bg: '#2d2d2d',
    color: '#fff',
    border: '1px solid #555',
  };
}

export default function ProductIcon({ product, size = 42, radius = 12 }) {
  const visual = getProductVisual(product);

  return (
    <div
      title={visual.label}
      style={{
        width: size,
        height: size,
        borderRadius: `${radius}px`,
        background: visual.bg,
        color: visual.color,
        border: visual.border,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size >= 42 ? '22px' : '18px',
        fontWeight: '900',
        flexShrink: 0,
        boxSizing: 'border-box',
      }}
    >
      {visual.icon}
    </div>
  );
}
