import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DataTable from './DataTable';

const kolommen = [
  { key: 'naam', label: 'Naam', sorteerbaar: true },
  { key: 'leeftijd', label: 'Leeftijd', sorteerbaar: true },
];

const rijen = [
  { id: 'a', naam: 'Bert', leeftijd: 12 },
  { id: 'b', naam: 'Anna', leeftijd: 9 },
  { id: 'c', naam: 'Carla', leeftijd: 15 },
];

function rijTeksten() {
  // first column cell of each data row (skip header row)
  return screen.getAllByRole('row').slice(1).map(row => within(row).getAllByRole('cell')[0].textContent);
}

describe('DataTable — rendering', () => {
  it('renders one row per item with the configured columns', () => {
    render(<DataTable kolommen={kolommen} rijen={rijen} />);
    expect(screen.getByText('Bert')).toBeInTheDocument();
    expect(screen.getByText('Anna')).toBeInTheDocument();
    expect(screen.getByText('Carla')).toBeInTheDocument();
  });

  it('shows leegTekst when there are no rows', () => {
    render(<DataTable kolommen={kolommen} rijen={[]} leegTekst="Niets gevonden" />);
    expect(screen.getByText('Niets gevonden')).toBeInTheDocument();
  });

  it('falls back to "Geen resultaten" when leegTekst is not given', () => {
    render(<DataTable kolommen={kolommen} rijen={[]} />);
    expect(screen.getByText('Geen resultaten')).toBeInTheDocument();
  });

  it('uses render() for a column when provided', () => {
    const kolommenMetRender = [
      { key: 'naam', label: 'Naam' },
      { key: 'leeftijd', label: 'Leeftijd', render: (v) => `${v} jaar` },
    ];
    render(<DataTable kolommen={kolommenMetRender} rijen={[{ id: 'a', naam: 'Bert', leeftijd: 12 }]} />);
    expect(screen.getByText('12 jaar')).toBeInTheDocument();
  });

  it('shows a dash for missing field values', () => {
    render(<DataTable kolommen={kolommen} rijen={[{ id: 'a', naam: 'Bert' }]} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders an Acties column and calls the render-prop per row', () => {
    const acties = vi.fn(rij => <button>Bewerk {rij.naam}</button>);
    render(<DataTable kolommen={kolommen} rijen={rijen} acties={acties} />);
    expect(screen.getByText('Acties')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bewerk Bert' })).toBeInTheDocument();
    expect(acties).toHaveBeenCalledTimes(rijen.length);
  });
});

describe('DataTable — search', () => {
  it('does not render a search box when zoekVeld is absent', () => {
    render(<DataTable kolommen={kolommen} rijen={rijen} />);
    expect(screen.queryByPlaceholderText('Zoeken...')).not.toBeInTheDocument();
  });

  it('filters rows by a case-insensitive substring match on zoekVeld', async () => {
    render(<DataTable kolommen={kolommen} rijen={rijen} zoekVeld="naam" />);
    await userEvent.type(screen.getByPlaceholderText('Zoeken...'), 'ann');
    expect(screen.getByText('Anna')).toBeInTheDocument();
    expect(screen.queryByText('Bert')).not.toBeInTheDocument();
    expect(screen.queryByText('Carla')).not.toBeInTheDocument();
  });

  it('searches across multiple comma-separated keys', async () => {
    render(<DataTable kolommen={kolommen} rijen={rijen} zoekVeld="naam,leeftijd" />);
    await userEvent.type(screen.getByPlaceholderText('Zoeken...'), '15');
    expect(screen.getByText('Carla')).toBeInTheDocument();
    expect(screen.queryByText('Bert')).not.toBeInTheDocument();
  });

  it('shows a search-specific empty message including the query', async () => {
    render(<DataTable kolommen={kolommen} rijen={rijen} zoekVeld="naam" />);
    await userEvent.type(screen.getByPlaceholderText('Zoeken...'), 'zzz');
    expect(screen.getByText('Geen resultaten voor "zzz"')).toBeInTheDocument();
  });
});

describe('DataTable — sorting', () => {
  it('sorts ascending by standaardSort by default', () => {
    render(<DataTable kolommen={kolommen} rijen={rijen} standaardSort="naam" />);
    expect(rijTeksten()).toEqual(['Anna', 'Bert', 'Carla']);
  });

  it('toggles sort direction on repeated header clicks', async () => {
    render(<DataTable kolommen={kolommen} rijen={rijen} standaardSort="naam" />);
    const header = screen.getByText('Naam');
    await userEvent.click(header); // already sorted asc by standaardSort -> click switches to desc
    expect(rijTeksten()).toEqual(['Carla', 'Bert', 'Anna']);
  });

  it('switches the sort column when a different sortable header is clicked', async () => {
    render(<DataTable kolommen={kolommen} rijen={rijen} standaardSort="naam" />);
    await userEvent.click(screen.getByText('Leeftijd'));
    expect(rijTeksten()).toEqual(['Anna', 'Bert', 'Carla']); // 9, 12, 15 ascending
  });

  it('does not attach a click handler to non-sortable columns', () => {
    const kolommenNietSorteerbaar = [{ key: 'naam', label: 'Naam', sorteerbaar: false }];
    render(<DataTable kolommen={kolommenNietSorteerbaar} rijen={rijen} />);
    expect(screen.getByText('Naam')).not.toHaveAttribute('onclick');
  });
});
