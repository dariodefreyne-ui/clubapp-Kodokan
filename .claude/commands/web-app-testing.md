# Web App Testing — Kodokan Clubapp

This project has no test runner yet. When asked to add or run tests, follow this guide.

## Setup (run once)

```bash
npm install --save-dev vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

Add to `package.json` scripts:
```json
"test": "vitest",
"test:run": "vitest run",
"test:coverage": "vitest run --coverage"
```

Create `vitest.config.js` at the project root:
```js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
  },
});
```

Create `src/test/setup.js`:
```js
import '@testing-library/jest-dom';
```

## File placement

Co-locate tests with source files:
- `src/utils/datumUtils.test.js` alongside `src/utils/datumUtils.js`
- `src/components/ui/FormField.test.jsx` alongside `src/components/ui/FormField.jsx`
- `src/utils/categorieLogica.test.js` alongside `src/utils/categorieLogica.js`

## What to test

### 1. Pure utility functions — highest ROI, zero mocking

`datumUtils.js`, `categorieLogica.js`, `seizoenUtils.js` (pure exports only) — these have no Firebase dependency and dense edge-case logic. Test them first.

```js
// src/utils/datumUtils.test.js
import { describe, it, expect } from 'vitest';
import { formatDatum, datumNaarIso, isoNaarDatum } from './datumUtils';

describe('formatDatum', () => {
  it('formats ISO string to dd/mm/yyyy', () => {
    expect(formatDatum('2024-09-01')).toBe('01/09/2024');
  });
  it('returns empty string for falsy input', () => {
    expect(formatDatum(null)).toBe('');
    expect(formatDatum('')).toBe('');
  });
  it('handles Firestore Timestamp-like object', () => {
    const ts = { toDate: () => new Date('2024-01-15') };
    expect(formatDatum(ts)).toBe('15/01/2024');
  });
});

describe('datumNaarIso / isoNaarDatum', () => {
  it('round-trips correctly', () => {
    expect(isoNaarDatum(datumNaarIso('15/01/2024'))).toBe('15/01/2024');
  });
});
```

```js
// src/utils/categorieLogica.test.js
import { describe, it, expect } from 'vitest';
import { berekenRuweCategorie, berekenCategorie, parseerDoelgroepArray } from './categorieLogica';

describe('berekenRuweCategorie', () => {
  it('classifies U9 correctly', () => {
    expect(berekenRuweCategorie(2017, '2024-01-01')).toBe('U9'); // age 7
  });
  it('returns null for age 6 or below', () => {
    expect(berekenRuweCategorie(2018, '2024-01-01')).toBeNull();
  });
});

describe('berekenCategorie', () => {
  it('returns buiten:true when category outside doelgroep', () => {
    const result = berekenCategorie(2017, '2024-01-01', ['U11', 'U13']);
    expect(result.buiten).toBe(true);
  });
});

describe('parseerDoelgroepArray', () => {
  it('passes arrays through unchanged', () => {
    expect(parseerDoelgroepArray(['U11', 'U13'])).toEqual(['U11', 'U13']);
  });
  it('parses legacy hyphen-string format', () => {
    expect(parseerDoelgroepArray('U11-U13')).toEqual(['U11', 'U13']);
  });
});
```

### 2. Component tests — FormField, DataTable, ConfirmDialog

Mock Firebase at the module level so components that import from `../firebase` don't break.

```jsx
// src/components/ui/FormField.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FormField from './FormField';

// datumUtils is a real dependency — no mock needed (it's pure)

describe('FormField', () => {
  it('renders label and calls onChange with the typed value', async () => {
    const onChange = vi.fn();
    render(<FormField label="Naam" type="text" value="" onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), 'Jan');
    expect(onChange).toHaveBeenCalledWith('Jan');
  });

  it('renders required asterisk', () => {
    render(<FormField label="Email" type="text" value="" onChange={vi.fn()} required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('shows fout message in red', () => {
    render(<FormField label="Naam" type="text" value="" onChange={vi.fn()} fout="Verplicht veld" />);
    expect(screen.getByText('Verplicht veld')).toBeInTheDocument();
  });

  it('renders select with options', async () => {
    const onChange = vi.fn();
    const opties = [{ value: 'lid', label: 'Lid' }, { value: 'trainer', label: 'Trainer' }];
    render(<FormField label="Rol" type="select" value="lid" onChange={onChange} opties={opties} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });
});
```

### 3. Hooks with Firebase dependency — mock Firestore

```js
// src/utils/categorieLogica.test.js (for useCatRangorde hook)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Mock Firebase before importing the hook
vi.mock('../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  query: vi.fn(),
  orderBy: vi.fn(),
}));

import { useCatRangorde, CAT_RANGORDE } from './categorieLogica';

describe('useCatRangorde', () => {
  it('falls back to hardcoded CAT_RANGORDE when Firestore returns empty', async () => {
    const { result } = renderHook(() => useCatRangorde());
    await waitFor(() => expect(result.current).toEqual(CAT_RANGORDE));
  });
});
```

Firebase mock template (reuse across test files):
```js
// Standard Firebase mock — copy into any test file that imports from firebase/firestore
vi.mock('../../firebase', () => ({ db: {}, auth: { currentUser: null } }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  addDoc: vi.fn().mockResolvedValue({ id: 'test-id' }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn().mockReturnValue(() => {}), // returns unsubscribe fn
  serverTimestamp: vi.fn(() => new Date()),
  writeBatch: vi.fn(() => ({ set: vi.fn(), update: vi.fn(), delete: vi.fn(), commit: vi.fn() })),
}));
```

## What NOT to test

| Skip | Why |
|---|---|
| Full page components (Ledenbeheer, Trainingen, etc.) | Too many Firestore dependencies; manual testing is faster |
| `onSnapshot` real-time hooks | Requires Firebase emulator; not worth the setup cost for this app |
| Auth flows (LoginPagina, RequireRole) | Integration-level; test manually with real Firebase |
| `firestoreService.js` write methods | Side-effect heavy; mock cost > test value |

Use the [Firebase Local Emulator Suite](https://firebase.google.com/docs/emulator-suite) only if you need to test write/read flows end-to-end. For this app, manual testing in the browser covers those paths.

## Running tests

```bash
npm test            # watch mode
npm run test:run    # single run (CI)
npm run test:coverage  # coverage report
```

Target: keep unit tests fast (<1s total). Anything needing Firebase emulators belongs in a separate `npm run test:e2e` script.

## Priority order

1. `src/utils/datumUtils.js` — widely used, pure, easy wins
2. `src/utils/categorieLogica.js` — complex branch logic, high bug surface
3. `src/utils/seizoenUtils.js` (pure exports: `seizoenBereikVanJaar`, `bepaalSeizoen`, `maandOptiesVoorSeizoen`)
4. `src/components/ui/FormField.jsx` — shared form primitive
5. `src/components/ui/DataTable.jsx` — shared table primitive

## Live-browser testing (Playwright / impeccable) without real Firebase credentials

`npm run dev` crashes the whole app with `Firebase: Error (auth/invalid-api-key)` if no
`.env.local` exists — `src/firebase.js` calls `initializeApp`/`initializeAuth` unconditionally
at module scope, and an empty `apiKey` makes Auth throw synchronously before React mounts.
There is no error boundary in `src/main.jsx`, so the page renders blank and any
Playwright-based tool (this skill, `impeccable`'s live mode) sees nothing to inspect.

Fix for local/sandbox testing only — create a `.env.local` (already gitignored, never commit
it) with syntactically valid but fake values, just to get past Firebase's client-side format
checks. No real project needed; nothing will actually read/write data, but the React shell
(layout, styling, viewport-overflow bugs, etc.) renders fully:

```bash
cat > .env.local <<'EOF'
VITE_FB_API_KEY=AIzaSyDummyLocalDevKey00000000000000000
VITE_FB_AUTH_DOMAIN=demo-local.firebaseapp.com
VITE_FB_PROJECT_ID=demo-local
VITE_FB_STORAGE_BUCKET=demo-local.appspot.com
VITE_FB_MESSAGING_SENDER_ID=000000000000
VITE_FB_APP_ID=1:000000000000:web:0000000000000000000000
VITE_FB_MEASUREMENT_ID=G-0000000000
EOF
```

Restart `npm run dev` after creating/changing it. Pages requiring real Firestore data (most
authenticated pages) will still error on actual reads/writes — but the login screen and any
static layout/CSS issue (e.g. horizontal overflow, contrast, responsive breakpoints) is fully
testable this way.

If Playwright itself can't launch (`Executable doesn't exist at /opt/pw-browsers/...`) and
`playwright install` fails because the sandbox's network policy blocks
`cdn.playwright.dev`, check for an already-installed system build first:

```bash
ls /opt/pw-browsers/   # look for an existing chromium-<version>/chrome-linux/chrome
```

Pass it explicitly: `p.chromium.launch(executable_path='/opt/pw-browsers/chromium-<version>/chrome-linux/chrome')`.
