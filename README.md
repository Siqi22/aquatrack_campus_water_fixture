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
| Import | Custom CSV parser + lazy-loaded `read-excel-file` for Excel |
| Scanning | `scan-fixture-label` Edge Function (Claude Haiku vision OCR on model plates) |

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

**Vercel:** import `env/vercel.import.env.example` (filled) via Dashboard → Environment Variables → Import `.env`, then **Redeploy**. `vercel.json` handles SPA routing; the build uses `base: /` on Vercel automatically.

### 3. Database migrations

Apply schema to your Supabase project:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Key migrations include floor progress tracking, fixture audit columns, and **alphanumeric floor labels** (`floor` stored as `TEXT`).

### 4. Edge Function (AI label scan — Claude Haiku)

Add to `.env` (see `.env.example`):

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude API key from [Anthropic Console](https://console.anthropic.com/) |
| `ANTHROPIC_MODEL` | Optional; default `claude-3-5-haiku-20241022` |

Push the same values to Supabase (never commit real keys):

```bash
npx supabase secrets set ANTHROPIC_API_KEY="your-key" --project-ref <your-project-ref>
npx supabase secrets set ANTHROPIC_MODEL="claude-3-5-haiku-20241022" --project-ref <your-project-ref>
npx supabase functions deploy scan-fixture-label
```

The app calls this function when you tap **AI scan label** on the model-plate photo step. Keys stay on the server; the browser only sends the image.

Legacy fallback: set `LOVABLE_API_KEY` instead of Anthropic if needed.

### 5. Run locally

```bash
npm run dev
```

Open the URL shown in the terminal (typically `http://localhost:8080`).

---

## iOS app (Capacitor)

Requires **macOS**, **Xcode** (from App Store), and **CocoaPods** (`brew install cocoapods`).

### One-time setup

```bash
npm install
npm run build
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8   # add to ~/.zshrc if pod install fails
cd ios/App && pod install && cd ../..
```

### Run on iPhone (physical device)

1. Connect iPhone with USB, trust the computer, enable **Developer Mode** on the phone (Settings → Privacy & Security).
2. Open the Xcode workspace:

   ```bash
   npm run cap:open:ios
   ```

   (Opens `ios/App/App.xcworkspace` — use the `.xcworkspace`, not `.xcodeproj`.)

3. In Xcode: select your **iPhone** as the run destination (top toolbar).
4. **Signing & Capabilities** → Team: your Apple ID (free account works for personal testing).
5. Press **Run** (▶). First launch: Settings → General → VPN & Device Management → trust the developer app.

### After web code changes

```bash
npm run build:ios    # rebuild dist + sync to ios/App
```

Then run again from Xcode (or `npm run cap:run:ios` if Xcode CLI is healthy).

**Note:** `.env` values are baked in at `npm run build` time. Rebuild before syncing when you change Supabase keys.

---

## Importing spreadsheet data

There is **no bundled sample CSV** in the app. Inventory comes from your Supabase workspace after you upload and confirm an import, or after on-site surveys.

1. Open **Dashboard → Import spreadsheet** (or **Assets → Import spreadsheet**)
2. Upload `.csv` or `.xlsx` from your computer (legacy `.xls` is not supported — re-save as `.xlsx`)
3. If the workbook has multiple worksheets, pick the sheet to import
4. Review detected columns, duplicate count, and preview rows
5. Choose import mode:
   - **Skip duplicates** — add only new fixtures (default when duplicates detected)
   - **Update existing** — refresh matches by campus + building + floor + room (or by ID if present)
   - **Insert all** — create every row (initial seed imports)
6. Confirm import

**Photos:** Typical exports do not include images. Imported fixtures need on-site fixture and model-label photos unless the spreadsheet includes **Photo URL** / **Model label photo** columns with valid links.

The parser recognizes common header aliases (e.g. “Company name”, “Serial Number”, “Filter Type”, “Nearest Room”) and handles:

- Alphanumeric floors (`G`, `2M`, `LL`, `-1`)
- Locked / no-access rows → floor marked **Restricted**
- Placeholder values (`NA`, `label_not_visible`)
- Category normalization (bottle filler, wall fountain, combo unit, etc.)

Re-importing an AquaTrack **Export** CSV with ID column enables update-by-ID.

---

## Exporting data

**Dashboard → Export** (Building coordinator and above) supports templates and custom column selection. Default export uses slide-aligned column names (company name, serial number, product number, etc.).

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

### Roles (Supabase `user_roles`)

| DB role | UI label | Capabilities |
|---------|----------|--------------|
| `Surveyor` | Collector | Survey fixtures, import spreadsheets, mark floors locked when no access |
| `Facilities` | Building coordinator | Above + mark floors complete/unlock |
| `Admin` | UW Facilities | Same as coordinator + admin delete policies in Supabase |

Roles load from Supabase on login (`user_roles` table). Users with multiple rows get the highest tier. Assign roles in Supabase SQL or dashboard — new signups default to `Surveyor`.

### Collector-first UX

The UI adapts to the signed-in user’s role (no localStorage toggle). Collectors focus on survey workflows; coordinators manage floor progress; central facilities handle bulk import.

### State management

`fixtureStore.loadAll()` hydrates campuses, buildings, fixtures, floor progress, and the user’s `user_roles` from Supabase on login. Mutations write through to Postgres and update local Zustand state.

### Import pipeline

```
File upload → parseSpreadsheetFile (lazy Excel) → analyzeCSV → enrichAnalysisWithDuplicates
         → importFromAnalysis (skip | update | insert) → Supabase bulk write
```

### Known limitations

- Playwright E2E scaffold present; expand coverage as needed
- Remaining npm audit items are dev-only (`esbuild` via Vite dev server) — upgrade Vite major when ready

---

## License

Private — University of Washington campus water inventory program. Contact repository owner for usage terms.
