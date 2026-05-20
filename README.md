# AquaTrack (aqua-map-keeper)

AquaTrack is a mobile-first web application for surveying, inventorying, and maintaining drinking-water fixtures across university campuses. Field collectors capture fixture metadata on-site; building coordinators track floor-level progress; exported data supports facilities maintenance workflows.

Built for the University of Washington campus water inventory program, with terminology aligned to field survey slides (company name, model, serial number, product number / filter type, model label).

---

## Features

| Area | Capability |
|------|------------|
| **Survey workflow** | 5-step guided onboarding: location → photos & model label scan → fixture type → condition notes → confirmation |
| **Label scanning** | Supabase Edge Function reads model labels via vision AI (brand, model, serial, filter type) |
| **Campus navigation** | Browse campuses → buildings → floors with progress indicators (no map dependency) |
| **Floor status** | Not started, in progress, complete, **locked** (restricted access) |
| **Maintenance** | 180-day filter cycle tracking with Good / Warning / Urgent status |
| **Import** | Upload **CSV or Excel**; auto-detect columns; skip duplicates, update existing, or insert all |
| **Export** | Template-based CSV export (default, maintenance, asset register, compliance) |
| **Auth** | Supabase email/password and Google OAuth; row-level security on all tables |

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| State | Zustand (`fixtureStore`) |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions) |
| Import | Custom CSV parser + SheetJS (`xlsx`) for Excel |
| Scanning | `scan-fixture-label` Edge Function (Lovable AI Gateway / Gemini vision) |

---

## Project structure

```
src/
├── pages/           # Route screens (Dashboard, Campus, AddAsset, FixtureDetail, Maintenance)
├── components/      # UI + ImportDialog, ExportDialog, FloorPlanView, SimpleRating
├── store/           # fixtureStore — Supabase CRUD + import pipeline
├── lib/             # importCSV, exportCSV, spreadsheet, fieldLabels, uploadPhoto
├── integrations/    # Supabase client + generated types
└── contexts/        # AuthProvider

supabase/
├── migrations/      # Postgres schema (campuses, buildings, fixtures, floor_progress)
└── functions/       # scan-fixture-label Edge Function
```

### Data model (simplified)

```
Campus ──< Building ──< Fixture
              │
              └──< FloorProgress (per floor: status, locked reason)
```

**Fixture fields (survey terminology):** company name (`brand`), model, serial number, product number / filter type, category, photos, condition ratings (Low / OK / Good), maintenance date.

---

## Getting started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project

### 1. Clone and install

```bash
git clone https://github.com/Syantw/aqua-map-keeper.git
cd aqua-map-keeper
npm install
```

### 2. Environment variables

Copy the example file and fill in values from Supabase → **Project Settings → API**:

```bash
cp .env.example .env.local
```

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon / publishable key (client-safe) |
| `VITE_SUPABASE_PROJECT_ID` | Project reference ID |

Never commit `.env`, `.env.local`, or real API keys. A pre-commit hook blocks common secret patterns.

### 3. Database migrations

Apply schema to your Supabase project:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Key migrations include floor progress tracking, fixture audit columns, and **alphanumeric floor labels** (`floor` stored as `TEXT`).

### 4. Edge Function (label scan)

Deploy the scan function and set secrets in Supabase Dashboard → **Edge Functions → Secrets**:

- `LOVABLE_API_KEY` — required for vision-based label extraction (server-side only)

```bash
npx supabase functions deploy scan-fixture-label
```

### 5. Run locally

```bash
npm run dev
```

Open the URL shown in the terminal (typically `http://localhost:5173`).

---

## Importing spreadsheet data

1. Open **Dashboard → Import**
2. Upload `.csv`, `.xlsx`, or `.xls`
3. Review detected columns, duplicate count, and preview rows
4. Choose import mode:
   - **Skip duplicates** — add only new fixtures (default when duplicates detected)
   - **Update existing** — refresh matches by campus + building + floor + room (or by ID if present)
   - **Insert all** — create every row (initial seed imports)
5. Confirm import

The parser recognizes common header aliases (e.g. “Company name”, “Serial Number”, “Filter Type”, “Nearest Room”) and handles:

- Alphanumeric floors (`G`, `2M`, `LL`, `-1`)
- Locked / no-access rows → floor marked **Restricted**
- Placeholder values (`NA`, `label_not_visible`)
- Category normalization (bottle filler, wall fountain, combo unit, etc.)

Re-importing an AquaTrack **Export** CSV with ID column enables update-by-ID.

---

## Exporting data

**Dashboard → Export** supports templates and custom column selection. Default export uses slide-aligned column names (company name, serial number, product number, etc.).

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `npm run prepare` | Install git pre-commit hook (blocks credential commits) |

---

## Security

- **Private repository** recommended; never commit secrets
- Client uses Supabase **anon key** only; service role keys stay out of the frontend
- `LOVABLE_API_KEY` and other provider keys belong in Supabase Edge Function secrets
- Git history was scrubbed of committed `.env` files; rotate any previously exposed tokens
- Pre-commit hook rejects `.env` files and common token patterns

---

## Architecture notes

### Collector-first UX

The app defaults to a single **collector** role in the UI (no facilities toggle). Floor locking and progress tracking support survey workflows without requiring a separate map provider.

### State management

`fixtureStore.loadAll()` hydrates campuses, buildings, fixtures, and floor progress from Supabase on login. Mutations write through to Postgres and update local Zustand state.

### Import pipeline

```
File upload → spreadsheetToCSVText → analyzeCSV → enrichAnalysisWithDuplicates
         → importFromAnalysis (skip | update | insert) → Supabase bulk write
```

### Known limitations / roadmap

- Role layers (collector → building coordinator → central facilities) are modeled in feedback but not yet wired to Supabase `user_roles`
- No `.xlsx` multi-sheet selection (uses first sheet)
- Photo URLs from import are not populated (photos require on-site capture or storage upload)
- Playwright E2E scaffold present; expand coverage as needed

---

## License

Private — University of Washington campus water inventory program. Contact repository owner for usage terms.
