# AI Study Assistant: Full-Stack Web & Mobile Architecture

A modern, high-performance, modular Full-Stack Retrieval-Augmented Generation (RAG) platform designed for students and researchers. Features token-aware chunking, dense vector indexing, tenant/session isolation, dynamic token-budget management, an academic tutor persona, interactive quiz generation, and two cleanly separated frontends:
1. **Web Frontend (`frontend/`)**: React 18 SPA built with Vite, Tailwind-styled dark glassmorphism, and Lucide SVG icons.
2. **Mobile App (`mobile/`)**: React Native & Expo app supporting **Expo Go** and **Mobile Dev Builds (EAS)** with Dashboard, Brief/Granular Summaries, Vocabulary Bank with AI Translation, and Citation-grounded RAG Chat.
3. **Unified Backend (`backend/`)**: FastAPI, ChromaDB, and Google Gemini with compatibility routing for both Web and Mobile clients.

---

## 1. Directory Structure

```
pdf_app/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes_health.py        # GET /health (API diagnostics & Chroma collection stats)
│   │   │   ├── routes_upload.py        # POST /upload, GET /documents, DELETE /documents/{doc_id}
│   │   │   ├── routes_chat.py          # POST /chat (RAG retrieval, history pruning, citation mapping)
│   │   │   ├── routes_quiz.py          # POST /quiz/generate (schema-enforced MCQs with temp 0.0 retry)
│   │   │   └── routes_mobile_compat.py # /api/v1/pdf/* & /api/v1/ai/* (Mobile screens compatibility)
│   │   ├── core/
│   │   │   ├── chunking.py             # ~500-token chunks with 50 overlap (tiktoken / word fallback)
│   │   │   ├── context_manager.py      # Reverse-chronological token budget enforcement (8000 tokens)
│   │   │   ├── embeddings.py           # SentenceTransformers lazy loader (all-MiniLM-L6-v2) & fallback
│   │   │   ├── llm_client.py           # Unified async Gemini & Claude client with 429 quota fallback
│   │   │   ├── prompt_builder.py       # Academic tutor system prompts, context blocks & quiz schemas
│   │   │   └── rag_pipeline.py         # End-to-end RAG workflow coordinator
│   │   ├── db/
│   │   │   ├── models.py               # Strict Pydantic models for all requests, responses, and citations
│   │   │   └── vector_store.py         # ChromaDB PersistentClient wrapper with session-isolated metadata
│   │   ├── middleware/
│   │   │   ├── error_handler.py        # Global exception handlers (504, 503, 500, 422, 400)
│   │   │   └── rate_limiter.py         # In-memory sliding-window rate limiter per client IP (20 req/min)
│   │   ├── utils/
│   │   │   └── file_parser.py          # Text extraction for .pdf (pypdf), .txt, and .md
│   │   ├── static/                     # Pre-built React SPA served directly from FastAPI
│   │   ├── config.py                   # Pydantic BaseSettings singleton
│   │   ├── dependencies.py             # Session resolver (X-Session-ID) & mock JWT Bearer auth
│   │   └── main.py                     # FastAPI application entry point
│   ├── test_rag_system.py              # Integration test harness (Web + Mobile routes)
│   ├── requirements.txt                # Python backend dependencies
│   └── Dockerfile                      # Python 3.11+ container image
├── frontend/                           # Web SPA (React 18, Vite 5, Lucide)
│   ├── src/
│   │   ├── api/client.js               # Centralized Web API client
│   │   ├── hooks/useChat.js            # Dialogue history and optimistic state hook
│   │   ├── components/Icons.jsx        # Glassmorphic UI SVG icons
│   │   ├── App.jsx                     # Chat, Ingest, and Quizzes tabs
│   │   ├── main.jsx                    # DOM mount
│   │   └── index.css                   # Glassmorphic dark design tokens
│   ├── vite.config.js                  # Vite dev/build configuration
│   ├── package.json
│   └── Dockerfile
├── mobile/                             # Mobile App (Expo SDK 54, React Native 0.81)
│   ├── src/
│   │   ├── core/
│   │   │   ├── auth/authService.ts     # Dual-mode auth: Native Firebase (Dev Build) & Local Session (Expo Go)
│   │   │   ├── firebase/firebaseConfig.ts # Safe Firebase wrapper preventing Expo Go crashes
│   │   │   └── network/apiClient.ts    # Auto-discovering host IP via Metro scriptURL / LAN IP
│   │   └── features/
│   │       ├── auth/                   # AuthScreen (Firebase Auth + Guest One-Tap)
│   │       ├── pdf-list/               # DashboardScreen (Document list, status & upload)
│   │       ├── summary/                # SummaryScreen (Brief & Granular analysis)
│   │       ├── vocabulary/             # VocabularyScreen (Term bank & AI translation)
│   │       └── rag-chat/               # ChatScreen (Interactive grounded RAG chat)
│   ├── App.tsx                         # NavigationContainer & Stack Navigator
│   ├── app.json                        # Expo configuration
│   ├── eas.json                        # EAS Dev Build & Production profiles
│   ├── google-services.json            # Android Firebase configuration
│   └── package.json
├── docker-compose.yml                  # Backend + Web frontend container mesh
└── README.md
```

---

## 2. Quickstart: Running Web and Mobile

### A. Start the Backend (Required for both Web & Mobile)

The backend listens on `0.0.0.0:8000` to serve both the web application on localhost and mobile devices on your local Wi-Fi:

```bash
cd backend
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- **Web Application**: [http://localhost:8000/](http://localhost:8000/)
- **Swagger API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### B. Running the Web Frontend

#### Option 1: Direct in Browser
Navigating to [http://localhost:8000/](http://localhost:8000/) loads the production glassmorphic SPA built and served directly by FastAPI.

#### Option 2: Vite Dev Server
```bash
cd frontend
yarn dev
# Opens Vite hot-reloading dev server at http://localhost:5173
```

#### Option 3: Docker Compose
```bash
docker compose up --build
# Web SPA on http://localhost:3000, Backend on http://localhost:8000
```

---

### C. Running the Mobile App (Expo Go or Dev Build)

The mobile project is located in `mobile/`. It is pre-configured with a dual-mode authentication and dynamic host resolver so it runs smoothly in both standard **Expo Go** and **Mobile Dev Builds (EAS)**:

```bash
cd mobile
```

#### Mode 1: Run with Expo Go (Easiest)
```bash
npx expo start --go
```
- Open the **Expo Go** app on your iOS or Android phone.
- Scan the QR code displayed in the terminal.
- Tap **"⚡ Continue as Guest"** on the Auth screen for instant access to the Dashboard, or sign in with any email.
- The app automatically connects to your machine's IP address (`apiClient.ts` reads Metro's host address).

#### Mode 2: Run with Mobile Dev Build (Native Firebase)
```bash
# To run local Android development build
npx expo run:android

# Or trigger an EAS cloud development build
eas build --profile development --platform android
```
In Dev Build mode, the app automatically switches to full native `@react-native-firebase/auth` using `google-services.json`.

---

## 3. Automated Test Suite

Run the full end-to-end integration test suite verifying health, text/PDF uploads, ChromaDB persistence, RAG chat citations, quiz generation, rate limiting, and mobile compatibility routes:

```bash
cd backend
python3 test_rag_system.py
```
