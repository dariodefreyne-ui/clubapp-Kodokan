import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FormField from './FormField';

// FormField's <label> isn't wired to the input via htmlFor/id, so we query
// by role/value rather than getByLabelText.

describe('FormField — text input', () => {
  it('renders the label text', () => {
    render(<FormField label="Naam" value="" onChange={vi.fn()} />);
    expect(screen.getByText('Naam')).toBeInTheDocument();
  });

  it('calls onChange with the raw string value as the user types', async () => {
    const onChange = vi.fn();
    render(<FormField label="Naam" type="text" value="" onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), 'Jan');
    expect(onChange).toHaveBeenCalledWith('J');
    expect(onChange).toHaveBeenCalledWith('a');
    expect(onChange).toHaveBeenCalledWith('n');
  });

  it('renders a required asterisk next to the label', () => {
    render(<FormField label="Email" type="text" value="" onChange={vi.fn()} required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('shows the fout message and hides the hint when both are set', () => {
    render(<FormField label="Naam" type="text" value="" onChange={vi.fn()} hint="Volledige naam" fout="Verplicht veld" />);
    expect(screen.getByText('Verplicht veld')).toBeInTheDocument();
    expect(screen.queryByText('Volledige naam')).not.toBeInTheDocument();
  });

  it('shows the hint when there is no fout', () => {
    render(<FormField label="Naam" type="text" value="" onChange={vi.fn()} hint="Volledige naam" />);
    expect(screen.getByText('Volledige naam')).toBeInTheDocument();
  });
});

describe('FormField — number input', () => {
  it('calls onChange with a parsed number', async () => {
    const onChange = vi.fn();
    render(<FormField label="Leeftijd" type="number" value={0} onChange={onChange} />);
    await userEvent.type(screen.getByRole('spinbutton'), '7');
    expect(onChange).toHaveBeenCalledWith(7);
  });

  it('calls onChange with an empty string when cleared', async () => {
    const onChange = vi.fn();
    render(<FormField label="Leeftijd" type="number" value={7} onChange={onChange} />);
    await userEvent.clear(screen.getByRole('spinbutton'));
    expect(onChange).toHaveBeenCalledWith('');
  });
});

describe('FormField — select', () => {
  it('renders a select with a placeholder option and the given opties', () => {
    const opties = [{ value: 'lid', label: 'Lid' }, { value: 'trainer', label: 'Trainer' }];
    render(<FormField label="Rol" type="select" value="lid" onChange={vi.fn()} opties={opties} />);
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(screen.getByText('Lid')).toBeInTheDocument();
    expect(screen.getByText('Trainer')).toBeInTheDocument();
    expect(screen.getByText('— Kies —')).toBeInTheDocument();
  });

  it('omits the placeholder option when required', () => {
    const opties = [{ value: 'lid', label: 'Lid' }];
    render(<FormField label="Rol" type="select" value="lid" onChange={vi.fn()} opties={opties} required />);
    expect(screen.queryByText('— Kies —')).not.toBeInTheDocument();
  });
});

describe('FormField — checkbox', () => {
  it('calls onChange with the checked boolean', async () => {
    const onChange = vi.fn();
    render(<FormField label="Actief" type="checkbox" value={false} onChange={onChange} />);
    await userEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('renders the label text inline instead of as a separate <label> element', () => {
    render(<FormField label="Actief" type="checkbox" value={true} onChange={vi.fn()} />);
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.getByText('Actief')).toBeInTheDocument();
  });
});
