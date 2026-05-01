# EMPWR: Knowledge Graph Development Platform

> **Hosted version available at [withempwr.com](https://withempwr.com/)**

EMPWR is a knowledge graph (KG) development platform that supports the creation, enrichment, management, and maintenance of large-scale KGs. It utilizes a Neuro-symbolic approach to automate and scale the KG development process. The platform is designed to be domain-agnostic and handle data from unstructured, semi-structured, and structured sources.

**[Wiki Page](https://wiki.aiisc.ai/index.php?title=EMPWR:_Knowledge_Graph_Development_Platform)**

**[Watch the demo on YouTube](https://www.youtube.com/watch?v=PtB09317B_U)**

---

## Features

- **Knowledge Graph Generation**: Extract entities and relationships from text, PDFs, images, URLs, and spreadsheets
- **Interactive Visualization**: 2D and 3D graph rendering with D3.js, React Force Graph, and AFrame
- **Graph Merging**: Combine multiple graphs with automatic entity resolution and deduplication
- **Wikidata Enrichment**: Automatically enrich graph nodes with linked open data from Wikidata
- **Ontology Management**: Create, visualize, and enrich ontologies with AI assistance
- **Multi-model AI**: Choose between OpenAI, Mistral, and Anthropic for graph generation
- **Real-time Progress**: Live extraction and processing updates via Socket.IO
- **User Accounts**: Session-based auth with per-user graph and API key storage
- **Pipeline Lineage (CMF)**: Automatic provenance tracking for every extraction, enrichment, merge, and ontology run

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Tailwind CSS, shadcn/ui, Radix UI |
| Backend | Express.js, TypeScript, Socket.IO |
| Database | PostgreSQL with Drizzle ORM (in-memory fallback for development) |
| Visualization | D3.js, React Force Graph, AFrame (3D) |
| NLP | spaCy (`en_core_web_sm`), Compromise.js |
| AI Models | OpenAI, Mistral, Anthropic |
| Auth | Session-based (express-session, connect-pg-simple) |
| Lineage | CMF-compatible SQLite tracker (`data/cmf-store/mlmd.db`) |

---

## Local Setup

### Prerequisites

- **Node.js v20+**: [nodejs.org](https://nodejs.org/)
- **Python 3.8+**: Required for spaCy NLP processing
- **pip3**: Python package manager (usually bundled with Python)

> PostgreSQL is **not** required: the project includes an embedded PostgreSQL instance that starts automatically with `npm run dev:local`. In-memory storage is also available as a fallback.

---

### 1. Clone the repository

```bash
git clone https://github.com/Joeyipp/EMPWR.git
cd EMPWR
```

### 2. Install Node dependencies

```bash
npm install
```

### 3. Install Python dependencies (spaCy)

spaCy is used for local NLP-based knowledge graph extraction. Install it and download the English language model:

```bash
# Install spaCy
pip3 install spacy

# Download the English model
python3 -m spacy download en_core_web_sm
```

> **Note:** On Ubuntu 22.04+ or Debian systems, if you get a PEP 668 error, add `--break-system-packages`:
> ```bash
> pip3 install spacy --break-system-packages
> python3 -m spacy download en_core_web_sm --break-system-packages
> ```

Verify the installation:

```bash
python3 -c "import spacy; nlp = spacy.load('en_core_web_sm'); print('spaCy OK')"
```

### 4. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Database: set automatically by dev:local; leave as-is for local dev
DATABASE_URL=postgresql://empwr:empwr_dev@localhost:5433/empwr

# AI Services: add at least one key to use AI-powered graph generation
OPENAI_API_KEY=sk-...
MISTRAL_API_KEY=...
ANTHROPIC_API_KEY=...

# Email (optional: only needed for contact form)
SENDGRID_API_KEY=...

# Session secret: change this to a random string in production
SESSION_SECRET=change-me-in-production

NODE_ENV=development
```

> All AI API keys are optional for local development. You can also add them through the app's Settings page after logging in. The spaCy extraction model works without any API keys.

### 5. Start the development server

The `dev:local` script handles everything in one command: it boots an embedded PostgreSQL instance, runs schema migrations, and starts the app:

```bash
npm run dev:local
```

On first run you will see:

```
[dev-start] Starting embedded PostgreSQL...
[dev-start] PostgreSQL running on port 5433
[dev-start] Created database "empwr"
[dev-start] Running schema migrations...
[dev-start] Starting app server...
serving on port 5000
```

Open **[http://localhost:5000](http://localhost:5000)** in your browser.

> **Data persistence:** Graph and user data is stored in `data/pgdata/` and persists between restarts.

### 6. (Alternative) Start without a database

If you just want to run the app without any database setup, use:

```bash
npm run dev
```

The server will automatically fall back to in-memory storage. Data will not persist between restarts.

---

## Database Setup

EMPWR supports three database modes. Choose the one that fits your environment.

---

### Option A: Embedded PostgreSQL (recommended for local development)

No installation required. The `npm run dev:local` command automatically downloads, initialises, and starts a self-contained PostgreSQL 18 instance inside the project directory:

```bash
npm run dev:local
```

- Data is stored in `data/pgdata/` and persists between restarts
- Runs on port **5433** to avoid conflicts with any system PostgreSQL
- Schema migrations are applied automatically on every start
- Completely removed by deleting the `data/pgdata/` folder

---

### Option B: System PostgreSQL (recommended for production)

Install PostgreSQL 14+ using your system package manager.

**macOS (Homebrew)**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Ubuntu / Debian**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Windows**
Download the installer from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/) and run it.

#### Create the database and user

```bash
# Log in as the postgres superuser
sudo -u postgres psql

# Inside psql:
CREATE USER empwr WITH PASSWORD 'your_secure_password';
CREATE DATABASE empwr OWNER empwr;
GRANT ALL PRIVILEGES ON DATABASE empwr TO empwr;
\q
```

#### Set the connection string in `.env`

```env
DATABASE_URL=postgresql://empwr:your_secure_password@localhost:5432/empwr
```

#### Apply the schema

```bash
npm run db:push
```

This uses Drizzle Kit to push the schema defined in `shared/schema.ts` to your database. Re-run this command any time the schema changes.

---

### Option C: Cloud PostgreSQL (Neon, Supabase, Railway, etc.)

Any PostgreSQL-compatible cloud provider works. Copy the connection string provided by your provider into `.env`:

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

Then run:

```bash
npm run db:push
npm run dev
```

---

### Database Schema Overview

The schema is defined in `shared/schema.ts` and managed by [Drizzle ORM](https://orm.drizzle.team/).

| Table | Description |
|---|---|
| `users` | User accounts with hashed passwords and admin flag |
| `graphs` | Stored knowledge graphs with nodes, links, and metadata |
| `api_keys` | Per-user API keys for OpenAI, Mistral, Anthropic, etc. |
| `ontologies` | Saved ontology definitions and configurations |
| `system_settings` | Global application settings (key-value) |
| `scholar_profiles` | Google Scholar profile integrations |
| `session` | Express session storage (created automatically) |

Sessions are stored in the `session` table automatically via `connect-pg-simple`. If no database is available, sessions fall back to in-memory storage and are lost on restart.

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev:local` | Start app with embedded PostgreSQL (recommended) |
| `npm run dev` | Start app with in-memory storage fallback |
| `npm run build` | Build frontend and backend for production |
| `npm run start` | Run the production build |
| `npm run db:push` | Push Drizzle schema changes to the database |
| `npm run check` | Run TypeScript type checking |

---

## Project Structure

```
EMPWR/
├── client/                   # React frontend
│   └── src/
│       ├── components/       # Reusable UI components
│       ├── contexts/         # React context providers
│       ├── hooks/            # Custom React hooks
│       ├── lib/              # API client, utilities
│       └── pages/            # Application pages/routes
├── server/                   # Express backend
│   ├── index.ts              # Server entry point
│   ├── routes.ts             # All API route handlers + CMF endpoints
│   ├── storage.ts            # PostgreSQL + in-memory storage
│   ├── ai-services.ts        # spaCy NLP + AI model integrations
│   ├── wikidata-service.ts   # Wikidata graph enrichment
│   ├── ontology-service.ts   # Ontology generation and management
│   ├── cmf-service.ts        # TypeScript wrapper for CMF lineage logging
│   ├── cmf_tracker.py        # Python bridge: SQLite lineage store (MLMD-compatible)
│   ├── parsers/              # Web, PDF, spreadsheet parsers
│   └── entity-resolution/    # Entity deduplication algorithms
├── shared/                   # Shared types used by client + server
│   ├── schema.ts             # Drizzle DB schema + Zod types
│   └── wikidata-utils.ts     # Wikidata property label mapping
├── scripts/
│   └── dev-start.mjs         # Embedded PostgreSQL dev launcher
├── data/                     # Local runtime files (gitignored)
│   ├── pgdata/               # Embedded PostgreSQL data directory
│   └── cmf-store/
│       └── mlmd.db           # CMF pipeline lineage SQLite database
├── theme.json                # shadcn/ui theme configuration
├── .env.example              # Environment variable template
└── package.json
```

---

## API Reference

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create a new account |
| `POST` | `/api/auth/login` | Log in |
| `GET` | `/api/auth/user` | Get current session user |
| `POST` | `/api/auth/logout` | Log out |

### Knowledge Graphs
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/graphs` | List all graphs for current user |
| `GET` | `/api/graphs/:id` | Get a specific graph |
| `POST` | `/api/graphs` | Save a new graph |
| `PUT` | `/api/graphs/:id` | Update a graph |
| `DELETE` | `/api/graphs/:id` | Delete a graph |
| `POST` | `/api/process-text` | Generate a graph from text |
| `POST` | `/api/enrich-graph` | Enrich a graph with Wikidata |
| `POST` | `/api/merge-graphs` | Merge multiple graphs |

### Ontologies
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/ontologies` | List ontologies |
| `POST` | `/api/ontologies` | Create an ontology |
| `PUT` | `/api/ontologies/:id` | Update an ontology |
| `DELETE` | `/api/ontologies/:id` | Delete an ontology |
| `POST` | `/api/ontologies/:id/enrich` | Enrich ontology with AI |
| `POST` | `/api/ontologies/generate` | Generate ontology from a prompt |
| `POST` | `/api/ontologies/upload` | Upload an ontology file |

### CMF Pipeline Lineage
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/cmf/stats` | Pipeline summary: execution counts, avg durations, totals |
| `GET` | `/api/cmf/executions` | All execution records (`?stage=extraction\|enrichment\|merging\|ontology&limit=N`) |
| `GET` | `/api/cmf/lineage/:graphId` | Full provenance trail for a specific graph |
| `GET` | `/api/cmf/export` | Full JSON dump of all pipeline metadata |

---

## Troubleshooting

### `python: not found` when generating graphs
The app requires `python3`, not `python`. Ensure Python 3 is installed:
```bash
python3 --version
```
If missing, install it via your system package manager (e.g. `sudo apt install python3`).

### spaCy model not found
If you see `Can't find model 'en_core_web_sm'`, re-run:
```bash
python3 -m spacy download en_core_web_sm
```

### Port 5000 already in use
Kill the existing process and restart:
```bash
fuser -k 5000/tcp
npm run dev:local
```

### Database connection errors
If `dev:local` fails to connect to PostgreSQL, the leftover PID file from a previous run may need clearing:
```bash
rm -f data/pgdata/postmaster.pid
npm run dev:local
```

---

## CMF Integration

EMPWR ships with a built-in pipeline lineage tracker modelled on the [Common Metadata Framework (CMF)](https://github.com/HewlettPackard/cmf). Every time you extract, enrich, merge, or generate an ontology, a full audit record is written automatically: no configuration required.

### What is tracked

| Pipeline Stage | Logged automatically |
|---|---|
| **Extraction** (`/api/process-text`) | Model, provider, source type, text length, node count, link count, processing time |
| **Enrichment** (`/api/enrich-graph`) | Graph ID, new nodes/links added, Wikidata API call count, enrichment time |
| **Merging** (`/api/graphs/merge`) | Input graph IDs, algorithm, similarity threshold, unified entities, merged counts |
| **Ontology** (`/api/ontologies/generate`) | Model, provider, class count, property count, generation time |

### Where the data lives

```
data/cmf-store/mlmd.db      ← SQLite database (persists between restarts)
```

Open it with [DB Browser for SQLite](https://sqlitebrowser.org/), TablePlus, DBeaver, or any SQLite GUI. Tables: `pipelines`, `stages`, `executions`, `artifacts`, `events`, `metrics`.

### Inspection endpoints

All endpoints are live at `http://localhost:5000` (no authentication required in development):

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/cmf/stats` | Pipeline-wide summary: execution counts per stage, average durations, total nodes/links extracted across all runs |
| `GET` | `/api/cmf/executions` | All execution records, newest first. Filter by stage with `?stage=extraction\|enrichment\|merging\|ontology`. Limit with `?limit=N` |
| `GET` | `/api/cmf/lineage/:graphId` | Full provenance trail for a single graph: every stage that touched it (extraction → enrichment → merge) with all parameters and metrics |
| `GET` | `/api/cmf/export` | Complete JSON dump of the entire pipeline database: all executions, artifacts, events, and metrics |

**Example responses:**

```bash
# Pipeline-wide summary
curl http://localhost:5000/api/cmf/stats

# Last 10 extractions
curl "http://localhost:5000/api/cmf/executions?stage=extraction&limit=10"

# Lineage for graph ID 42
curl http://localhost:5000/api/cmf/lineage/42

# Full export (save to file)
curl http://localhost:5000/api/cmf/export > cmf-export.json
```

### CLI queries (Python)

```bash
# Stats summary
echo '{"command":"query_stats","params":{}}' | python3 server/cmf_tracker.py

# All extraction runs
echo '{"command":"query_executions","params":{"stage":"extraction"}}' | python3 server/cmf_tracker.py

# Lineage for graph 1
echo '{"command":"query_lineage","params":{"graph_id":1}}' | python3 server/cmf_tracker.py

# Full JSON export
echo '{"command":"export_json","params":{}}' | python3 server/cmf_tracker.py

# Direct SQLite
sqlite3 data/cmf-store/mlmd.db "SELECT stage_name, COUNT(*) FROM executions e JOIN stages s ON e.stage_id=s.id GROUP BY stage_name;"
```

### Implementation notes

- `server/cmf_tracker.py`: Python bridge that writes/queries the SQLite store. Uses the same schema concepts as CMF's MLMD backend.
- `server/cmf-service.ts`: TypeScript wrapper. All logging calls are **fire-and-forget**: CMF never adds latency to API responses.
- The official `cmflib` package requires Python ≤3.11; this system runs Python 3.12. The SQLite schema is forward-compatible: when cmflib adds 3.12 support, swap in the real library by updating `cmf_tracker.py` only: all endpoints and the TypeScript service stay unchanged.

See **[CMF_INTEGRATION.md](CMF_INTEGRATION.md)** for the full design document, pipeline stage mappings, and architecture diagrams.

---

## Related Projects

### KExtractor: Knowledge Enrichment for Biomedical Entities

[**github.com/Joeyipp/KExtractor**](https://github.com/Joeyipp/KExtractor)

KExtractor is a companion knowledge enrichment pipeline for biomedical entities. It takes a text file of extracted entities as input and produces enriched triples and a graph schema by integrating three linked open data sources:

| Source | What it provides |
|---|---|
| [DBpedia](https://www.dbpedia.org/) | Entity linking via spaCy-DBpedia Spotlight; RDF knowledge extraction |
| [Wikidata](https://www.wikidata.org/) | Entity and property identifiers, external cross-references |
| [DrugBank](https://go.drugbank.com/) | Aliases, categories, drug targets, enzymes (licence required) |

The pipeline also uses [HunFlair](https://github.com/flairNLP/flair) for biomedical NER tagging to generate a bottom-up graph schema.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "Add your feature"`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a pull request

---

## License

EMPWR is dual-licensed depending on the nature of your use.

---

### Academic & Research Use: MIT License

Free to use, modify, and distribute for academic, research, educational, and personal non-commercial purposes under the terms of the [MIT License](https://opensource.org/licenses/MIT).

```
MIT License

Copyright (c) 2025 EMPWR

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

### Commercial Use: Creative Commons Attribution 4.0 International (CC BY 4.0)

Any commercial use of EMPWR: including but not limited to SaaS products, commercial APIs, enterprise deployments, or any use in a revenue-generating context: is governed by the [Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/).

**You are free to:**
- Use, share, and adapt the software for commercial purposes

**Under the following terms:**
- **Attribution**: You must give appropriate credit to EMPWR, provide a link to [withempwr.com](https://withempwr.com/), and indicate if changes were made
- **No additional restrictions**: You may not apply legal terms or technological measures that legally restrict others from doing anything the license permits

For commercial licensing enquiries, contact us at [joey@knoesis.org](mailto:joey@knoesis.org).

---

## Citation

If you use EMPWR in academic work, research, or publications, please cite the following paper:

> **Hong Yung Yip and Amit Sheth.**
> "The EMPWR Platform: Data and Knowledge-Driven Processes for the Knowledge Graph Lifecycle."
> *IEEE Internet Computing*, vol. 28, no. 1, pp. 61–69, January/February 2024.
> DOI: [10.1109/MIC.2023.3339858](https://doi.org/10.1109/MIC.2023.3339858)
> IEEE Xplore: [https://ieeexplore.ieee.org/document/10438952](https://ieeexplore.ieee.org/document/10438952)

**BibTeX:**
```bibtex
@article{yip2024empwr,
  author  = {Yip, Hong Yung and Sheth, Amit},
  title   = {The {EMPWR} Platform: Data and Knowledge-Driven Processes for the Knowledge Graph Lifecycle},
  journal = {IEEE Internet Computing},
  volume  = {28},
  number  = {1},
  pages   = {61--69},
  year    = {2024},
  month   = jan,
  doi     = {10.1109/MIC.2023.3339858},
  url     = {https://ieeexplore.ieee.org/document/10438952}
}
```

---

## Acknowledgments

- UI components by [shadcn/ui](https://ui.shadcn.com/) and [Radix UI](https://www.radix-ui.com/)
- Visualizations by [D3.js](https://d3js.org/) and [React Force Graph](https://github.com/vasturiano/react-force-graph)
- NLP by [spaCy](https://spacy.io/)
- AI by [OpenAI](https://openai.com/), [Mistral](https://mistral.ai/), and [Anthropic](https://anthropic.com/)
- Biomedical knowledge enrichment pipeline by [KExtractor](https://github.com/Joeyipp/KExtractor) (Anirudh Sundar)
- Pipeline lineage tracking by [CMF: Common Metadata Framework](https://github.com/HewlettPackard/cmf) (Hewlett Packard)
