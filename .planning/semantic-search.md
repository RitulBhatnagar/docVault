# Semantic Search — Implementation Plan

## Decision
Embedding provider: **sentence-transformers** (local, free)
Model: `all-MiniLM-L6-v2` — 384 dims, fast, no API key needed
Alt (if quality upgrade needed): OpenAI `text-embedding-3-small` — 1536 dims, $0.02/1M tokens

## Stack Changes

### Backend
- Add deps: `pgvector`, `sentence-transformers`, `torch` (or `torch-cpu`)
- Enable `pgvector` Postgres extension
- Add `embedding vector(384)` column to `DocumentVersion`
- New Alembic migration
- New service: `app/services/embeddings.py`
  - Load model once at startup (singleton)
  - `generate_embedding(text: str) -> list[float]`
  - Embed `content_text` if available, else `title + subject + creator`
- Hook into document upload flow — generate + store embedding after text extraction
- New endpoint: `POST /documents/search/semantic`
  - Body: `{ "query": str, "limit": int = 10 }`
  - Embed query → cosine similarity via pgvector `<=>` → return ranked docs
  - Scoped to current user's documents

### Database
- Migration: `CREATE EXTENSION IF NOT EXISTS vector`
- Migration: `ALTER TABLE documentversion ADD COLUMN embedding vector(384)`
- Index: `CREATE INDEX ON documentversion USING ivfflat (embedding vector_cosine_ops)`

### Frontend
- Search bar toggle: **Keyword** | **Semantic**
- Semantic mode hits `/documents/search/semantic`
- Results show similarity score badge

## Embedding Text Strategy
1. If `content_text` exists → embed first 512 tokens of content
2. Else → embed `title + " " + subject + " " + creator`

## Model Loading
- Load at app startup via FastAPI lifespan event
- Cache in module-level singleton (no reload per request)
- First run downloads model (~80MB, cached in `~/.cache/huggingface`)

## Out of Scope (this phase)
- Async background embedding (separate roadmap item)
- Re-embedding on version update (future)
- Hybrid search (keyword + semantic combined)
