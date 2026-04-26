import { useSuspenseQuery } from "@tanstack/react-query"
import {
  Archive,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Code2,
  FileText,
  Folder,
  FolderOpen,
  ImageIcon,
  Music,
  Receipt,
  Table2,
  User,
  UserCheck,
  Video,
} from "lucide-react"
import { useEffect, useState } from "react"

import { DocumentsService, type DocumentGroup, type DocumentPublic } from "@/client"
import { DownloadIconButton, PreviewIconButton } from "./PreviewDocument"
import { FormatIcon } from "./FormatIcon"

const API_BASE = import.meta.env.VITE_API_URL || ""

const IMAGE_FORMATS = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "heic"])
const VIDEO_FORMATS = new Set(["mp4", "mov", "avi", "mkv", "webm", "m4v", "flv"])

// ── per-format card gradient backgrounds ─────────────────────────────────────
const FORMAT_BG: Record<string, string> = {
  pdf:   "from-red-500 to-rose-700",
  doc:   "from-blue-500 to-blue-700",
  docx:  "from-blue-500 to-blue-700",
  xls:   "from-emerald-500 to-green-700",
  xlsx:  "from-emerald-500 to-green-700",
  csv:   "from-emerald-400 to-teal-600",
  png:   "from-purple-500 to-violet-700",
  jpg:   "from-purple-500 to-violet-700",
  jpeg:  "from-purple-500 to-violet-700",
  gif:   "from-fuchsia-500 to-purple-700",
  webp:  "from-indigo-500 to-purple-700",
  svg:   "from-cyan-500 to-blue-600",
  mp4:   "from-orange-500 to-amber-700",
  mov:   "from-orange-500 to-amber-700",
  avi:   "from-orange-400 to-red-600",
  mkv:   "from-amber-500 to-orange-700",
  webm:  "from-orange-400 to-orange-700",
  mp3:   "from-pink-500 to-rose-600",
  wav:   "from-pink-400 to-pink-700",
  flac:  "from-pink-500 to-fuchsia-700",
  m4a:   "from-pink-400 to-pink-600",
  aac:   "from-rose-400 to-pink-600",
  py:    "from-sky-500 to-blue-700",
  js:    "from-yellow-400 to-amber-600",
  ts:    "from-blue-500 to-cyan-700",
  jsx:   "from-cyan-400 to-sky-600",
  tsx:   "from-cyan-500 to-blue-600",
  sh:    "from-slate-500 to-slate-700",
  go:    "from-cyan-400 to-teal-600",
  rs:    "from-orange-600 to-red-700",
  java:  "from-red-500 to-orange-600",
  ipynb: "from-amber-500 to-orange-600",
  zip:   "from-zinc-500 to-zinc-700",
  tar:   "from-zinc-500 to-zinc-700",
  gz:    "from-zinc-400 to-zinc-600",
  dmg:   "from-slate-400 to-slate-600",
  rar:   "from-zinc-500 to-slate-700",
  txt:   "from-gray-400 to-gray-600",
  md:    "from-gray-500 to-slate-700",
}

function cardBg(format: string) {
  return FORMAT_BG[format.toLowerCase()] ?? "from-slate-400 to-slate-600"
}

// ── group-level icon ──────────────────────────────────────────────────────────
function GroupIcon({ kind, label }: { kind: DocumentGroup["kind"]; label: string }) {
  const cls = "h-5 w-5"
  if (kind === "format") {
    switch (label) {
      case "Images":    return <ImageIcon className={cls} />
      case "Videos":    return <Video className={cls} />
      case "Audio":     return <Music className={cls} />
      case "Code":      return <Code2 className={cls} />
      case "Notebooks": return <BookOpen className={cls} />
      case "Data":      return <Table2 className={cls} />
      case "Archives":  return <Archive className={cls} />
    }
  }
  if (kind === "keyword") {
    switch (label) {
      case "Resume":   return <User className={cls} />
      case "Invoice":  return <Receipt className={cls} />
      case "Contract": return <FileText className={cls} />
    }
  }
  if (kind === "candidate") return <UserCheck className={cls} />
  if (kind === "prefix")    return <Folder className={cls} />
  return <FolderOpen className={cls} />
}

// ── fetch with simple 4-slot concurrency cap ─────────────────────────────────
let _active = 0
const _queue: Array<() => void> = []
function acquireSlot(): Promise<void> {
  return new Promise((resolve) => {
    const go = () => { if (_active < 4) { _active++; resolve() } else _queue.push(go) }
    go()
  })
}
function releaseSlot() { _active--; _queue.shift()?.() }

async function fetchBlob(docId: string): Promise<Blob | null> {
  await acquireSlot()
  try {
    const token = localStorage.getItem("access_token") || ""
    const res = await fetch(`${API_BASE}/api/v1/documents/${docId}/preview`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.ok ? res.blob() : null
  } finally { releaseSlot() }
}

// ── image thumbnail (loads on mount — only rendered for first 8 tiles) ────────
function ImageThumbnail({ docId }: { docId: string }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let url: string | undefined
    fetchBlob(docId)
      .then((b) => { if (!b) return; url = URL.createObjectURL(b); setSrc(url) })
      .catch(() => {})
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [docId])

  return (
    <div className="absolute inset-0">
      {src && <img src={src} alt="" className="w-full h-full object-cover" draggable={false} />}
    </div>
  )
}

// ── video thumbnail: just an icon — never download video for a thumbnail ──────
function VideoThumbnail() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="bg-black/40 rounded-full p-3">
        <Video className="h-8 w-8 text-white" />
      </div>
    </div>
  )
}

// ── thumbnail dispatcher ──────────────────────────────────────────────────────
function TileThumbnail({ doc }: { doc: DocumentPublic }) {
  const ext = doc.format.toLowerCase()

  if (IMAGE_FORMATS.has(ext)) return <ImageThumbnail docId={doc.id} />
  if (VIDEO_FORMATS.has(ext)) return <VideoThumbnail />

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <FormatIcon format={doc.format} className="h-14 w-14 opacity-70" />
    </div>
  )
}

// ── single document tile ──────────────────────────────────────────────────────
function DocTile({ doc }: { doc: DocumentPublic }) {
  const bg = cardBg(doc.format)

  return (
    <div className="group relative flex-shrink-0 w-40 h-48 rounded-2xl overflow-hidden shadow-md cursor-pointer select-none">
      {/* gradient background always underneath */}
      <div className={`absolute inset-0 bg-gradient-to-br ${bg}`} />

      {/* real image or format icon */}
      <TileThumbnail doc={doc} />

      {/* bottom text overlay */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-3 pt-8 pb-3">
        <p className="text-white text-xs font-semibold leading-tight line-clamp-2">{doc.title}</p>
        <p className="text-white/60 text-[10px] uppercase font-mono mt-0.5">{doc.format}</p>
      </div>

      {/* hover actions */}
      <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        <div className="bg-white/90 rounded-full p-1 shadow">
          <PreviewIconButton document={doc} />
        </div>
        <div className="bg-white/90 rounded-full p-1 shadow">
          <DownloadIconButton docId={doc.id} filename={doc.title} />
        </div>
      </div>
    </div>
  )
}

const TILE_LIMIT = 8

// ── group section ─────────────────────────────────────────────────────────────
function GroupSection({ group }: { group: DocumentGroup }) {
  const [open, setOpen] = useState(true)
  const [showAll, setShowAll] = useState(false)

  const visible = showAll ? group.docs : group.docs.slice(0, TILE_LIMIT)
  const hidden = group.count - TILE_LIMIT

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">
            <GroupIcon kind={group.kind} label={group.label} />
          </span>
          <h2 className="text-xl font-bold tracking-tight">{group.label}</h2>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground font-medium tabular-nums">
            {group.count}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
        >
          <ChevronDown
            className={`h-4 w-4 text-primary transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
          />
        </button>
      </div>

      {open && (
        <>
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none -mx-1 px-1">
            {visible.map((doc) => (
              <div key={doc.id} className="snap-start">
                <DocTile doc={doc} />
              </div>
            ))}
            {!showAll && hidden > 0 && (
              <div className="snap-start flex-shrink-0 w-40 h-48 rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setShowAll(true)}>
                <span className="text-2xl font-bold text-muted-foreground">+{hidden}</span>
                <span className="text-xs text-muted-foreground">See all</span>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}

// ── root ──────────────────────────────────────────────────────────────────────
function DocumentGroupContent() {
  const { data } = useSuspenseQuery({
    queryKey: ["documents", "groups"],
    queryFn: () => DocumentsService.getGroups(),
  })

  if (data.total === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16">
        <div className="rounded-full bg-muted p-5 mb-4">
          <FolderOpen className="h-9 w-9 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">No documents found</h3>
        <p className="text-muted-foreground text-sm mt-1">Upload a document to get started</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <p className="text-xs text-muted-foreground">
        {data.groups.length} collections · {data.total} files
      </p>
      {data.groups.map((group) => (
        <GroupSection key={group.key} group={group} />
      ))}
    </div>
  )
}

export function DocumentGroupView() {
  return <DocumentGroupContent />
}