# PackMY: AI Destination Recommendation & Itinerary for Malaysian Tourism

Workshop 2 (BAXU 3923) · FAIX, UTeM

PackMY is a web app. A traveller describes a trip ("3 days in Penang, RM1,500, street food and heritage") and PackMY builds a day-by-day itinerary with times, a route map, an expense breakdown and a PDF download.

It uses a 3-part AI pipeline (Chapter 4 of the report):

| Step | Module | File | What it does |
|---|---|---|---|
| 1 | NLP | `ai/nlp.py` | Tokenises the text and pulls out region, days, budget, number of people, interests and pace, then outputs JSON |
| 2 | Fuzzy Logic | `ai/fuzzy.py` | scikit-fuzzy, Mamdani inference with centroid defuzzification. Inputs are budget, interest and distance. Output is a suitability score from 0 to 1 |
| 3 | ALNS | `ai/alns.py` | Adaptive Large Neighbourhood Search: 4 destroy operators, 3 repair operators, adaptive weights, simulated annealing. Checks opening hours, daily time, budget and duplicates |
| 4 | Output | `ai/pipeline.py`, `utils/pdf.py` | Works out times, costs, expense log, summary text, algorithm metrics and the PDF |

**Tech stack:** Python Flask · MySQL · Tailwind CSS · Leaflet (map) · Chart.js (charts)

---

## 1. Run it on your laptop (step by step)

You need **Python 3.10 or newer** and **MySQL**. XAMPP is the easiest way to get MySQL.

### Step 1: Install the libraries
Open a terminal (Command Prompt on Windows) inside the `packmy` folder:

```bash
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Mac / Linux
pip install -r requirements.txt
```

### Step 2: Create the MySQL database
1. Start **MySQL** in the XAMPP Control Panel.
2. Open phpMyAdmin (http://localhost/phpmyadmin), go to the **SQL** tab and run what is in `schema.sql`. This creates an empty database called `packmy`.
3. Open `config.py` and change `root:password` in `DEFAULT_DB` to your MySQL username and password.
   With a default XAMPP install the password is empty, so use: `mysql+pymysql://root:@localhost/packmy`

> **No MySQL yet?** You can test with SQLite (no install needed):
> Windows: `set DATABASE_URL=sqlite:///packmy.db` · Mac/Linux: `export DATABASE_URL=sqlite:///packmy.db`

### Step 3: Create the tables and sample data
```bash
python seed.py
```
This creates the **8 tables** and adds 63 sample attractions and 15 hotels across Kuala Lumpur, Penang, Melaka, Langkawi and Kota Kinabalu. It also creates two accounts:

| Role | Email | Password |
|---|---|---|
| Admin | admin@packmy.com | admin123 |
| Traveller | demo@packmy.com | demo123 |

To start again from an empty database: `python seed.py --reset`

### Step 4: Start the website
```bash
python app.py
```
Then open **http://127.0.0.1:5000** in your browser.

---

## 2. What is in each folder

```
packmy/
├── app.py              Starts the website (Flask app, login, CSRF protection)
├── config.py           Database connection and settings
├── models.py           The 8 database tables
├── seed.py             Sample Malaysian data and demo accounts
├── ai/
│   ├── nlp.py          Module 1: NLP and summary text
│   ├── fuzzy.py        Module 2: Fuzzy logic scoring and ranking
│   ├── alns.py         Module 3: ALNS optimiser
│   └── pipeline.py     Module 4: connects everything and saves results
├── routes/
│   ├── auth.py         Register, login, logout
│   ├── traveller.py    Profile, trip form, itinerary page, PDF
│   └── admin.py        Admin dashboard, assets, users, ALNS settings
├── templates/          HTML pages (Tailwind CSS)
└── utils/pdf.py        PDF export
```

## 3. Features vs. the report's functional requirements

| Requirement | Where |
|---|---|
| Authorisation | Register and login with hashed passwords, roles (admin / traveller), CSRF tokens on forms |
| Profile | Travel style, pace, usual budget, interests |
| Asset | Admin can add, edit, delete or hide attractions and hotels, and add new regions |
| Request | Trip form with free text and structured fields |
| NLP | Live "PackMY understood…" preview that fills in the form as you type |
| Fuzzy | Score for each attraction, shown as "Match 0.85" |
| ALNS | Route order, opening hours, daily time window, budget |
| Display | Day cards, day tabs, interactive Leaflet route map |
| Expense | Doughnut chart by category, bar chart by day, itemised list, PDF |
| Admin | Usage report, ALNS convergence and operator charts, algorithm metrics, user activation |

---

## 4. Suggested team split

| Member | Role | Main files | Report and demo |
|---|---|---|---|
| **Pravin** | Project lead + **ALNS optimiser** + integration | `ai/alns.py`, `ai/pipeline.py`, `app.py` | Chapter 4 Module 3, ALNS testing (parameter tuning, convergence charts) |
| **Nur Afif** | **NLP + Fuzzy Logic** | `ai/nlp.py`, `ai/fuzzy.py` | Module 1 and 2, membership function and rule tables, fuzzy test cases |
| **Nik Izz** | **Backend + database + admin module** | `models.py`, `seed.py`, `routes/auth.py`, `routes/admin.py`, `config.py` | ERD / 8-table schema, verifying the real Malaysian data, security testing |
| **Amal Ellisa** | **Frontend UI/UX + output** | `templates/`, `routes/traveller.py`, `utils/pdf.py` | UI mockups, poster, video walkthrough, user testing (usability survey) |

Everyone: end-to-end testing in Weeks 9–10.

## 5. Working together with GitHub (recommended)

1. Pravin creates a **private GitHub repo**, uploads this folder and invites the other 3 members.
2. Everyone: `git clone <repo-url>`
3. Each member works on their **own branch**, for example `git checkout -b afif-fuzzy`
4. Save work: `git add .` → `git commit -m "Add fuzzy rules for beach"` → `git push`
5. Open a **Pull Request** on GitHub. Another member checks it before merging into `main`.
6. Pull the latest code before you start each day: `git checkout main` → `git pull`

Never commit your own MySQL password. Use the `DATABASE_URL` environment variable if you want to keep it out of `config.py`.

## 6. Ideas for improvement (good for the "Future Work" section)
- Replace the rule-based NLP with spaCy, or a generative model API, for better entity extraction
- Use real road distances (OpenRouteService / Google Distance Matrix) instead of straight-line × 1.3
- Respect the days each attraction is open (for example Sunday-only markets)
- Compare ALNS against a Genetic Algorithm baseline in the testing chapter

**Note:** prices, opening hours and coordinates in `seed.py` are approximate sample values. Check them before the final demo.
