# Smart Grouping — Implementation Plan

## What it does
Third view mode alongside table/cards. Auto-clusters documents into collapsible groups
using a priority-ordered algorithm. No ML, no new DB tables, no pre-computation.
Works for all formats including binary files (dmg, ipynb, images, video).

---

## Cluster Key Algorithm (priority order)

```
Priority 1 — Format category
  Images   : jpg, jpeg, png, gif, webp, svg, bmp, tiff, heic, ico
  Videos   : mp4, mov, avi, mkv, webm, m4v, flv
  Audio    : mp3, wav, flac, ogg, aac, m4a, wma
  Code     : py, js, ts, jsx, tsx, sh, rb, go, java, c, cpp, rs, php, swift
  Notebooks: ipynb
  Data     : csv, xlsx, xls, parquet, sqlite, db
  Archives : zip, tar, gz, bz2, dmg, pkg, iso, rar, 7z, deb, rpm

Priority 2 — Known domain keywords (checked against full title, case-insensitive)
  resume, cv → "Resume"
  invoice    → "Invoice"
  contract   → "Contract"
  report     → "Report"
  budget     → "Budget"
  proposal   → "Proposal"
  certificate→ "Certificate"
  receipt    → "Receipt"
  statement  → "Statement"
  letter     → "Letter"
  note, notes→ "Notes"

Priority 3 — Title prefix (first token after splitting on _ - space, camelCase)
  scrappe_name_001  → "Scrappe"
  client_brief_v2   → "Client"
  data_users.csv    → "Data"
  Stopwords (skip to next token or fallback):
    my, the, a, an, new, old, temp, test, copy, draft, final,
    untitled, misc, file, doc, document

Priority 4 — Email in content_text (same-candidate detection)
  Regex: \b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b
  First email found → cluster key = "candidate:{email}"
  Only runs if content_text exists

Priority 5 — Fallback
  → "Other"
```

---

## Backend

### New endpoint: `GET /api/v1/documents/groups`
File: `backend/app/api/routes/documents.py`

**Response schema:**
```python
class DocumentGroup(SQLModel):
    key: str            # cluster key e.g. "Resume", "Images", "candidate:x@y.com"
    label: str          # display label e.g. "Resume", "Images", "x@y.com"
    kind: str           # "format" | "keyword" | "prefix" | "candidate" | "other"
    count: int
    docs: list[DocumentPublic]

class DocumentGroupsPublic(SQLModel):
    groups: list[DocumentGroup]
    total: int
```

**Logic:**
1. Fetch all user's documents with latest version (for content_text)
2. For each doc, call `derive_cluster_key(doc, latest_version)` → get key
3. Group by key, sort groups by count desc (largest group first)
4. "Other" group always last
5. Within each group, docs sorted by created_at desc

### New service function: `app/services/grouping.py`
```python
def derive_cluster_key(doc: Document, latest_version: DocumentVersion | None) -> tuple[str, str, str]:
    # returns (key, label, kind)
```

Implements the 5-priority algorithm above. Standalone pure function, easy to test.

### Models to add:
```python
class DocumentGroup(SQLModel):
    key: str
    label: str
    kind: str
    count: int
    docs: list[DocumentPublic]

class DocumentGroupsPublic(SQLModel):
    groups: list[DocumentGroup]
    total: int
```

---

## Frontend

### New view mode: "grouped"
Add third button to the view toggle (table | cards | **groups**).
Icon: `FolderOpen` or `Layers` from lucide-react.

### New component: `DocumentGroupView.tsx`
```
components/Documents/DocumentGroupView.tsx
```

**UI structure per group:**
```
┌─────────────────────────────────────────────────────┐
│  📁 Resume  (8)                           ▼ expand  │
├─────────────────────────────────────────────────────┤
│  ritulResume        PDF   2 versions  [preview][dl] │
│  resume_51225       DOCX  1 version   [preview][dl] │
│  resume_71225       DOCX  1 version   [preview][dl] │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│  🖼 Images  (32)                          ▼ expand  │
└─────────────────────────────────────────────────────┘
```

**Behaviour:**
- All groups collapsed by default
- Click header → expand/collapse
- Group header shows: icon + label + count badge + kind chip
- Expanded rows: compact (title, format icon, version count, preview/download actions)
- "Other" group collapsed and shown last

### Kind icons:
```
format/Images    → ImageIcon
format/Videos    → Video
format/Audio     → Music
format/Code      → Code2
format/Notebooks → BookOpen
format/Data      → Table2
format/Archives  → Archive
keyword/Resume   → User
keyword/Invoice  → Receipt
keyword/Contract → FileText
candidate        → UserCheck
prefix           → Folder
other            → FolderOpen
```

### Client types to add (`types.gen.ts`):
```typescript
export type DocumentGroup = {
  key: string
  label: string
  kind: 'format' | 'keyword' | 'prefix' | 'candidate' | 'other'
  count: number
  docs: Array<DocumentPublic>
}
export type DocumentGroupsPublic = {
  groups: Array<DocumentGroup>
  total: number
}
export type DocumentsGetGroupsResponse = DocumentGroupsPublic
```

### SDK method to add (`sdk.gen.ts`):
```typescript
DriveService.getGroups() → GET /api/v1/documents/groups
```

---

## Build Order

1. `app/services/grouping.py` — pure clustering logic (derive_cluster_key)
2. Add `DocumentGroup` + `DocumentGroupsPublic` to `models.py`
3. `GET /documents/groups` endpoint in `documents.py`
4. Add types to `client/types.gen.ts`
5. Add `getGroups()` to `DocumentsService` in `client/sdk.gen.ts`
6. `DocumentGroupView.tsx` — collapsible group UI
7. Wire 3rd view toggle into `documents.tsx`

---

## Out of Scope (this phase)
- Fuzzy name matching across resumes (needs NLP/LLM)
- Custom user-defined cluster rules
- Persisting cluster keys in DB (add later if >10k docs)
- Drag-and-drop between groups
- Rename/merge groups