import React from 'react';

export function getProductVisual(product = {}) {
  const category = product.category;
  const variant = String(product.variant || '').toLowerCase();
  const name = String(product.name || '').toLowerCase();
  const text = `${name} ${variant}`;

  const beltColors = {
    wit: { bg: 'var(--text-primary)fff', color: '#333', border: '1px solid #ccc' },
    geel: { bg: '#f1c40f', color: '#333', border: 'none' },
    oranje: { bg: '#e67e22', color: 'var(--text-primary)', border: 'none' },
    groen: { bg: 'var(--success)', color: 'var(--text-primary)', border: 'none' },
    blauw: { bg: '#3498db', color: 'var(--text-primary)', border: 'none' },
    bruin: { bg: '#8B4513', color: 'var(--text-primary)', border: 'none' },
    zwart: { bg: '#111111', color: 'var(--text-primary)', border: '1px solid var(--text-muted)' },
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
      bg: 'var(--accent-red)',
      color: 'var(--text-primary)',
      border: 'none',
    };
  }

  if (category === 'hoodie') {
    return {
      icon: '🧥',
      label: 'Pull',
      bg: '#111111',
      color: 'var(--text-primary)',
      border: '1px solid var(--text-muted)',
    };
  }

  if (category === 'sportzak') {
    if (text.includes('groot')) {
      return {
        icon: '🧳',
        label: 'Groot',
        bg: 'var(--bg-card)',
        color: 'var(--text-primary)',
        border: '1px solid var(--text-muted)',
      };
    }

    return {
      icon: '🎒',
      label: 'Klein',
      bg: 'var(--bg-card)',
      color: 'var(--text-primary)',
      border: '1px solid var(--text-muted)',
    };
  }

  if (category === 'gordel') {
    const kleur = Object.keys(beltColors).find(k => text.includes(k));
    const meta = beltColors[kleur] || {
      bg: 'var(--bg-card)',
      color: 'var(--text-primary)',
      border: '1px solid var(--text-muted)',
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
    bg: 'var(--bg-card)',
    color: 'var(--text-primary)',
    border: '1px solid var(--text-muted)',
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
