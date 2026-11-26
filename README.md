# PackMY: AI Destination Recommendation & Itinerary for Malaysian Tourism

Workshop 2 (BAXU 3923) · FAIX, UTeM

PackMY is a full-stack web app. A traveller describes a trip (*"3 days in Penang, RM1,500, street food and heritage"*) and PackMY builds a day-by-day itinerary with times, an interactive route map, expense charts, and a PDF download.

It uses a 4-module AI pipeline:

| Step | Module | File | What it does |
|---|---|---|---|
| 1 | NLP | `backend/ai/nlp.py` | Tokenises the text and extracts region, days, budget, travellers, interests, and pace |
| 2 | Fuzzy Logic | `backend/ai/fuzzy.py` | scikit-fuzzy Mamdani inference with centroid defuzzification (suitability score 0–1) |
| 3 | ALNS | `backend/ai/alns.py` | Adaptive Large Neighbourhood Search (4 destroy ops, 3 repair ops, 2-opt polish, adaptive weights, simulated annealing) |
| 4 | Output | `backend/ai/pipeline.py`, `backend/utils/pdf.py` | Computes times, costs, expense logs, summary text, metrics, and PDF export |

**Tech stack:** Next.js · React · Tailwind CSS · Leaflet · Chart.js · Python Flask API · Supabase (PostgreSQL)

---

## 1. Project Structure

```text
packmy/
├── backend/                    # Python Flask AI API + Supabase models
│   ├── app.py                  # Flask API entry point (port 5000)
│   ├── config.py               # Loads .env & configures Supabase PostgreSQL
│   ├── models.py               # 8 SQLAlchemy database tables
│   ├── seed.py                 # Seeds Malaysian sample data & demo accounts
│   ├── benchmark_alns.py       # Greedy vs. ALNS evaluation benchmark script
│   ├── requirements.txt        # Python dependencies
│   ├── ai/
│   │   ├── nlp.py              # Module 1: NLP entity extraction & summary
│   │   ├── fuzzy.py            # Module 2: Fuzzy logic suitability scoring
│   │   ├── alns.py             # Module 3: ALNS route & schedule optimiser
│   │   └── pipeline.py         # Module 4: End-to-end AI pipeline
│   ├── routes/
│   │   └── api.py              # JSON REST API endpoints (/api/*)
│   └── utils/
│       └── pdf.py              # PDF itinerary generator
├── frontend/                   # Next.js + React + Tailwind UI (port 3000)
│   ├── public/img/             # Logo, hero background, region photos
│   ├── src/
│   │   ├── app/                # Next.js App Router pages (Home, Auth, Traveller, Admin)
│   │   ├── components/         # AppShell, ItineraryMap (Leaflet), AssetForm
│   │   ├── context/            # Auth & flash message context
│   │   └── lib/                # Typed /api fetch helper
│   ├── next.config.mjs         # Proxies /api/* to Flask backend (:5000)
│   └── package.json
├── .env.example                # Environment variable template (copy to .env)
├── .gitignore
└── README.md
```

---

## 2. Run Locally (Step by Step)

You need **Python 3.10+**, **Node.js 18+**, and a **Supabase** project (or SQLite for offline testing).

### Step 1: Set up the Python backend
```powershell
python -m venv venv
.\venv\Scripts\activate
pip install -r backend/requirements.txt
```

### Step 2: Configure `.env`
Copy `.env.example` to `.env` in the root `packmy/` folder and paste your Supabase **Session pooler** URI into `DATABASE_URL`.

### Step 3: Seed the database (first time only)
```powershell
python backend/seed.py
```
Creates all 8 tables, 78 sample attractions/hotels across 5 Malaysian regions, and 2 demo accounts:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@packmy.com` | `admin123` |
| Traveller | `demo@packmy.com` | `demo123` |

### Step 4: Install frontend dependencies
```powershell
cd frontend
npm install
```

### Step 5: Start both servers (2 terminals)
- **Terminal 1 (Flask AI API on `:5000`):**
  ```powershell
  .\venv\Scripts\activate
  python backend/app.py
  ```
- **Terminal 2 (Next.js UI on `:3000`):**
  ```powershell
  cd frontend
  npm run dev
  ```

Open **http://localhost:3000** in your browser.

---

## 3. ALNS Benchmark (Chapter 5 Testing)
```powershell
python backend/benchmark_alns.py
```
Compares the Greedy initial baseline against ALNS (100, 400, 800 iterations) across all 5 regions.
