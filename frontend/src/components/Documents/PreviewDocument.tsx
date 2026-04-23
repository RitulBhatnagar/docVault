import { Eye, FileX } from "lucide-react"
import { useEffect, useState } from "react"

import type { DocumentPublic } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"

type PreviewType = "pdf" | "image" | "text" | "html" | "unsupported" | "error" | "loading"

interface PreviewState {
  type: PreviewType
  objectUrl?: string
  textContent?: string
  errorMsg?: string
}

function mimeToPreviewType(mime: string): "pdf" | "image" | "text" | "html" | "unsupported" {
  if (mime === "application/pdf") return "pdf"
  if (mime.startsWith("image/")) return "image"
  if (mime === "text/html") return "html"
  if (mime.startsWith("text/")) return "text"
  return "unsupported"
}

interface PreviewContentProps {
  docId: string
  versionId?: string
  label: string
}

function PreviewContent({ docId, versionId, label }: PreviewContentProps) {
  const [state, setState] = useState<PreviewState>({ type: "loading" })

  useEffect(() => {
    let revoke: string | undefined

    const token = localStorage.getItem("access_token") || ""
    const base = import.meta.env.VITE_API_URL || ""
    const url = versionId
      ? `${base}/api/v1/documents/${docId}/versions/${versionId}/preview`
      : `${base}/api/v1/documents/${docId}/preview`

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
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Loading preview…
      </div>
    )
  }

  if (state.type === "error") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2 text-destructive">
        <FileX className="h-8 w-8" />
        <span className="text-sm">{state.errorMsg}</span>
      </div>
    )
  }

  if (state.type === "unsupported") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
        <FileX className="h-8 w-8" />
        <span className="text-sm font-medium">No preview available for this file type.</span>
        <span className="text-xs">Download the file to view it.</span>
      </div>
    )
  }

  if (state.type === "text" && state.textContent !== undefined) {
    return (
      <pre className="text-xs overflow-auto max-h-[65vh] p-4 bg-muted rounded whitespace-pre-wrap break-words">
        {state.textContent}
      </pre>
    )
  }

  if (state.type === "image" && state.objectUrl) {
    return (
      <div className="flex justify-center">
        <img
          src={state.objectUrl}
          alt={label}
          className="max-h-[65vh] max-w-full object-contain rounded"
        />
      </div>
    )
  }

  if (state.type === "pdf" && state.objectUrl) {
    return (
      <iframe
        src={state.objectUrl}
        className="w-full rounded border"
        style={{ height: "65vh" }}
        title={label}
      />
    )
  }

  if (state.type === "html" && state.objectUrl) {
    return (
      <iframe
        src={state.objectUrl}
        className="w-full rounded border bg-white"
        style={{ height: "65vh" }}
        title={label}
        sandbox="allow-same-origin"
      />
    )
  }

  return null
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
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{document.title}</DialogTitle>
        </DialogHeader>
        {open && <PreviewContent docId={document.id} label={document.title} />}
      </DialogContent>
    </Dialog>
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
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{filename}</DialogTitle>
        </DialogHeader>
        {open && <PreviewContent docId={docId} versionId={versionId} label={filename} />}
      </DialogContent>
    </Dialog>
  )
}