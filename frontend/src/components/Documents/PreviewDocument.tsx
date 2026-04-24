import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, Download, Eye, FileX } from "lucide-react"
import { useEffect, useState } from "react"

import { DocumentsService, type DocumentPublic, type DocumentVersionPublic } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"

const API_BASE = import.meta.env.VITE_API_URL || ""

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

type PreviewType = "pdf" | "image" | "video" | "audio" | "text" | "html" | "unsupported" | "error" | "loading"

interface PreviewState {
  type: PreviewType
  objectUrl?: string
  textContent?: string
  errorMsg?: string
}

function mimeToPreviewType(mime: string): "pdf" | "image" | "video" | "audio" | "text" | "html" | "unsupported" {
  if (mime === "application/pdf") return "pdf"
  if (mime.startsWith("image/")) return "image"
  if (mime.startsWith("video/")) return "video"
  if (mime.startsWith("audio/")) return "audio"
  if (mime === "text/html") return "html"
  if (mime.startsWith("text/")) return "text"
  return "unsupported"
}

function PreviewContent({
  docId,
  versionId,
  label,
}: {
  docId: string
  versionId?: string
  label: string
}) {
  const [state, setState] = useState<PreviewState>({ type: "loading" })

  useEffect(() => {
    let revoke: string | undefined
    setState({ type: "loading" })

    const token = localStorage.getItem("access_token") || ""
    const url = versionId
      ? `${API_BASE}/api/v1/documents/${docId}/versions/${versionId}/preview`
      : `${API_BASE}/api/v1/documents/${docId}/preview`

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setState({ type: "error", errorMsg: data.detail || "Failed to load preview" })
          return
        }
        const contentType = res.headers.get("content-type") || ""
        const mime = contentType.split(";")[0].trim()
        const previewType = mimeToPreviewType(mime)

        if (previewType === "unsupported") {
          setState({ type: "unsupported" })
          return
        }

        const blob = await res.blob()
        if (previewType === "text") {
          setState({ type: "text", textContent: await blob.text() })
        } else if (previewType === "html") {
          const objectUrl = URL.createObjectURL(new Blob([await blob.text()], { type: "text/html" }))
          revoke = objectUrl
          setState({ type: "html", objectUrl })
        } else {
          const objectUrl = URL.createObjectURL(blob)
          revoke = objectUrl
          setState({ type: previewType, objectUrl })
        }
      })
      .catch((e) => setState({ type: "error", errorMsg: e.message }))

    return () => { if (revoke) URL.revokeObjectURL(revoke) }
  }, [docId, versionId])

  if (state.type === "loading") {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Loading preview…
      </div>
    )
  }

  if (state.type === "error") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-destructive">
        <FileX className="h-8 w-8" />
        <span className="text-sm">{state.errorMsg}</span>
      </div>
    )
  }

  if (state.type === "unsupported") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
        <FileX className="h-8 w-8" />
        <span className="text-sm font-medium">No preview available for this file type.</span>
        <span className="text-xs">Download the file to view it.</span>
      </div>
    )
  }

  if (state.type === "text" && state.textContent !== undefined) {
    return (
      <pre className="text-xs overflow-auto h-full p-4 bg-muted rounded whitespace-pre-wrap break-words">
        {state.textContent}
      </pre>
    )
  }

  if (state.type === "image" && state.objectUrl) {
    return (
      <div className="flex justify-center items-center h-full">
        <img
          src={state.objectUrl}
          alt={label}
          className="max-h-full max-w-full object-contain rounded"
        />
      </div>
    )
  }

  if (state.type === "video" && state.objectUrl) {
    return (
      <div className="flex items-center justify-center h-full bg-black rounded">
        <video
          src={state.objectUrl}
          controls
          className="max-h-full max-w-full rounded"
        >
          Your browser does not support video playback.
        </video>
      </div>
    )
  }

  if (state.type === "audio" && state.objectUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="rounded-full bg-muted p-8">
          <svg className="h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <audio src={state.objectUrl} controls className="w-full max-w-md">
          Your browser does not support audio playback.
        </audio>
      </div>
    )
  }

  if ((state.type === "pdf" || state.type === "html") && state.objectUrl) {
    return (
      <iframe
        src={state.objectUrl}
        className="w-full h-full rounded border-0 bg-white"
        title={label}
        sandbox={state.type === "html" ? "allow-same-origin" : undefined}
      />
    )
  }

  return null
}

function MetadataStrip({ version }: { version: DocumentVersionPublic }) {
  return (
    <div className="flex items-center gap-4 px-6 py-2.5 border-b bg-muted/30 text-xs text-muted-foreground shrink-0 overflow-x-auto">
      <span className="font-mono truncate max-w-[200px] shrink-0">{version.original_filename}</span>
      <span className="shrink-0">{formatBytes(version.file_size)}</span>
      <span className="shrink-0">{formatDate(version.created_at)}</span>
      <span className="font-mono shrink-0" title={version.sha256}>
        SHA256: {version.sha256.slice(0, 12)}…
      </span>
    </div>
  )
}

function VersionSwitcher({
  versions,
  activeId,
  onSelect,
}: {
  versions: DocumentVersionPublic[]
  activeId: string
  onSelect: (id: string) => void
}) {
  if (versions.length <= 1) return null

  const activeIdx = versions.findIndex((v) => v.id === activeId)

  return (
    <div className="flex items-center gap-2 px-6 py-2 border-b shrink-0">
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        disabled={activeIdx <= 0}
        onClick={() => onSelect(versions[activeIdx - 1].id)}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </Button>

      <div className="flex gap-1 overflow-x-auto">
        {versions.map((v) => (
          <button
            key={v.id}
            onClick={() => onSelect(v.id)}
            className={`px-2.5 py-0.5 rounded text-xs font-medium transition-colors shrink-0 ${
              v.id === activeId
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            v{v.version_number}
          </button>
        ))}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        disabled={activeIdx >= versions.length - 1}
        onClick={() => onSelect(versions[activeIdx + 1].id)}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>

      <span className="text-xs text-muted-foreground ml-1 shrink-0">
        v{versions[activeIdx]?.version_number} of {versions.length}
      </span>
    </div>
  )
}

function VersionedPreview({ document: doc }: { document: DocumentPublic }) {
  const { data: versions = [], isLoading } = useQuery({
    queryKey: ["documents", doc.id, "versions"],
    queryFn: () => DocumentsService.listVersions({ id: doc.id }),
  })

  const latest = versions.length > 0 ? versions[versions.length - 1] : null
  const [activeId, setActiveId] = useState<string | null>(null)

  const effectiveId = activeId ?? latest?.id ?? null
  const activeVersion = versions.find((v) => v.id === effectiveId) ?? latest

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    )
  }

  return (
    <>
      {versions.length > 1 && effectiveId && (
        <VersionSwitcher
          versions={versions}
          activeId={effectiveId}
          onSelect={setActiveId}
        />
      )}
      {activeVersion && <MetadataStrip version={activeVersion} />}
      <div className="flex-1 overflow-hidden p-4">
        <PreviewContent
          docId={doc.id}
          versionId={effectiveId ?? undefined}
          label={doc.title}
        />
      </div>
    </>
  )
}

interface PreviewDocumentProps {
  document: DocumentPublic
  onClose: () => void
}

export function PreviewDocument({ document, onClose }: PreviewDocumentProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) onClose() }}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <Eye className="mr-2 h-4 w-4" />
          Preview
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="w-[92vw] max-w-6xl h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>{document.title}</DialogTitle>
        </DialogHeader>
        {open && <VersionedPreview document={document} />}
      </DialogContent>
    </Dialog>
  )
}

export function PreviewIconButton({ document: doc }: { document: DocumentPublic }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Preview">
          <Eye className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[92vw] max-w-6xl h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>{doc.title}</DialogTitle>
        </DialogHeader>
        {open && <VersionedPreview document={doc} />}
      </DialogContent>
    </Dialog>
  )
}

export function DownloadIconButton({ docId, filename }: { docId: string; filename: string }) {
  const handleDownload = async () => {
    const token = localStorage.getItem("access_token") || ""
    const res = await fetch(`${API_BASE}/api/v1/documents/${docId}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = Object.assign(window.document.createElement("a"), { href: url, download: filename })
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <Button variant="ghost" size="icon" title="Download" onClick={handleDownload}>
      <Download className="size-4" />
    </Button>
  )
}

export function VersionPreviewButton({
  docId,
  versionId,
  filename,
}: {
  docId: string
  versionId: string
  filename: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Preview">
          <Eye className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[92vw] max-w-6xl h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>{filename}</DialogTitle>
        </DialogHeader>
        {open && (
          <div className="flex-1 overflow-hidden p-4">
            <PreviewContent docId={docId} versionId={versionId} label={filename} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
