import { useQueryClient } from "@tanstack/react-query"
import { Upload } from "lucide-react"
import { useRef, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingButton } from "@/components/ui/loading-button"

const API_BASE = import.meta.env.VITE_API_URL || ""

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem("access_token") || ""}` }
}

type FileStatus =
  | "queued"
  | "scanning"
  | "will-version"
  | "format-mismatch"
  | "uploading"
  | "done"
  | "versioned"
  | "failed"
  | "duplicate"

interface FileEntry {
  file: File
  status: FileStatus
  message?: string
  existingDocId?: string
}

function StatusBadge({ status, message }: { status: FileStatus; message?: string }) {
  const map: Record<FileStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
    queued:          { label: "queued",          variant: "outline" },
    scanning:        { label: "scanning…",       variant: "outline", className: "text-muted-foreground" },
    "will-version":  { label: "new version",     variant: "outline", className: "text-blue-600 dark:text-blue-400 border-blue-400" },
    "format-mismatch": { label: "format mismatch — skip", variant: "outline", className: "text-yellow-600 dark:text-yellow-400 border-yellow-500" },
    uploading:       { label: "uploading…",      variant: "default" },
    done:            { label: "uploaded",        variant: "secondary", className: "text-green-600 dark:text-green-400" },
    versioned:       { label: "versioned",       variant: "secondary", className: "text-blue-600 dark:text-blue-400" },
    failed:          { label: message || "failed", variant: "destructive" },
    duplicate:       { label: "duplicate",       variant: "outline", className: "text-yellow-600 dark:text-yellow-400 border-yellow-500" },
  }
  const { label, variant, className } = map[status]
  return <Badge variant={variant} className={className}>{label}</Badge>
}

async function checkDocumentTitle(title: string): Promise<{ id: string; title: string; format: string } | null> {
  const res = await fetch(
    `${API_BASE}/api/v1/documents/check-title?title=${encodeURIComponent(title)}`,
    { headers: authHeaders() },
  )
  if (!res.ok) return null
  return res.json()
}

async function uploadOne(
  file: File,
  creator: string,
  subject: string,
  existingDocId?: string,
): Promise<{ status: "done" | "versioned" | "failed" | "duplicate"; message?: string }> {
  const ext = file.name.includes(".") ? (file.name.split(".").pop() ?? "unknown") : "unknown"
  const title = file.name.replace(/\.[^/.]+$/, "") || file.name

  if (existingDocId) {
    const fd = new FormData()
    fd.append("file", file)
    const res = await fetch(`${API_BASE}/api/v1/documents/${existingDocId}/versions`, {
      method: "POST",
      headers: authHeaders(),
      body: fd,
    })
    if (res.ok) return { status: "versioned" }
    const body = await res.json().catch(() => null)
    const msg = typeof body?.detail === "string" ? body.detail : "Upload failed"
    return { status: "failed", message: msg }
  }

  const fd = new FormData()
  fd.append("title", title)
  fd.append("creator", creator)
  fd.append("format", ext)
  if (subject) fd.append("subject", subject)
  fd.append("file", file)

  const res = await fetch(`${API_BASE}/api/v1/documents/`, {
    method: "POST",
    headers: authHeaders(),
    body: fd,
  })
  if (res.ok) return { status: "done" }
  const body = await res.json().catch(() => null)
  const msg = typeof body?.detail === "string" ? body.detail : "Upload failed"
  return { status: res.status === 409 ? "duplicate" : "failed", message: msg }
}

const CONCURRENCY = 5

const BulkUpload = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [creator, setCreator] = useState("")
  const [subject, setSubject] = useState("")
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const updateEntry = (index: number, patch: Partial<FileEntry>) =>
    setEntries(prev => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)))

  const onFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const initial: FileEntry[] = files.map(file => ({ file, status: "scanning" }))
    setEntries(initial)
    setIsDone(false)

    if (files.length === 0) return
    setIsScanning(true)

    const checked = await Promise.all(
      files.map(async (file, i) => {
        const title = file.name.replace(/\.[^/.]+$/, "") || file.name
        const newExt = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : ""
        try {
          const match = await checkDocumentTitle(title)
          if (match) {
            if (newExt && newExt !== match.format.toLowerCase()) {
              return {
                ...initial[i],
                status: "format-mismatch" as FileStatus,
                message: `Existing doc is ${match.format.toUpperCase()}`,
              }
            }
            return { ...initial[i], status: "will-version" as FileStatus, existingDocId: match.id }
          }
        } catch {}
        return { ...initial[i], status: "queued" as FileStatus }
      }),
    )

    setEntries(checked)
    setIsScanning(false)
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const uploadable = entries.filter(e => e.status !== "format-mismatch")
    if (!uploadable.length || !creator.trim()) return
    setIsRunning(true)

    let idx = 0
    const all = entries
    const runNext = async (): Promise<void> => {
      const i = idx++
      if (i >= all.length) return
      if (all[i].status === "format-mismatch") {
        await runNext()
        return
      }
      updateEntry(i, { status: "uploading" })
      const result = await uploadOne(all[i].file, creator, subject, all[i].existingDocId)
      updateEntry(i, result)
      await runNext()
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, uploadable.length) }, runNext),
    )

    setIsRunning(false)
    setIsDone(true)
    queryClient.invalidateQueries({ queryKey: ["documents"] })
  }

  const reset = () => {
    setEntries([])
    setIsDone(false)
    setCreator("")
    setSubject("")
    if (fileRef.current) fileRef.current.value = ""
  }

  const onOpenChange = (open: boolean) => {
    if (!open && isRunning) return
    setIsOpen(open)
    if (!open) reset()
  }

  const counts = {
    done:            entries.filter(e => e.status === "done").length,
    versioned:       entries.filter(e => e.status === "versioned").length,
    failed:          entries.filter(e => e.status === "failed").length,
    duplicate:       entries.filter(e => e.status === "duplicate").length,
    formatMismatch:  entries.filter(e => e.status === "format-mismatch").length,
  }

  const scanSummary = !isScanning && !isDone && entries.length > 0 && (() => {
    const willVersion = entries.filter(e => e.status === "will-version").length
    const willSkip = entries.filter(e => e.status === "format-mismatch").length
    const willNew = entries.filter(e => e.status === "queued").length
    const parts = []
    if (willNew > 0) parts.push(`${willNew} new`)
    if (willVersion > 0) parts.push(`${willVersion} new version${willVersion !== 1 ? "s" : ""}`)
    if (willSkip > 0) parts.push(`${willSkip} skipped (format mismatch)`)
    return parts.join(" · ")
  })()

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="my-4">
          <Upload className="mr-2 h-4 w-4" />
          Bulk Upload
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Upload</DialogTitle>
          <DialogDescription>
            Select multiple files. Existing documents will be auto-detected and versioned.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="bulk-creator">
                Creator <span className="text-destructive">*</span>
              </Label>
              <Input
                id="bulk-creator"
                value={creator}
                onChange={e => setCreator(e.target.value)}
                disabled={isRunning || isDone}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bulk-subject">
                Subject{" "}
                <span className="text-muted-foreground text-xs">(shared across all files)</span>
              </Label>
              <Input
                id="bulk-subject"
                placeholder="Keywords for search"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                disabled={isRunning || isDone}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bulk-files">
                Files <span className="text-destructive">*</span>
              </Label>
              <Input
                id="bulk-files"
                type="file"
                multiple
                ref={fileRef}
                onChange={onFilesChange}
                disabled={isRunning || isDone}
              />
            </div>

            {isScanning && (
              <p className="text-xs text-muted-foreground">Checking for existing documents…</p>
            )}

            {scanSummary && (
              <p className="text-xs rounded-md bg-muted px-3 py-2 text-muted-foreground">
                {scanSummary}
              </p>
            )}

            {entries.length > 0 && (
              <div className="rounded-md border">
                <div className="max-h-56 overflow-y-auto divide-y text-sm">
                  {entries.map((entry, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-3 py-2 gap-2"
                    >
                      <span className="truncate flex-1 text-muted-foreground text-xs">
                        {entry.file.name}
                      </span>
                      <StatusBadge status={entry.status} message={entry.message} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isDone && (
              <p className="text-sm text-muted-foreground rounded-md bg-muted px-3 py-2">
                {counts.done} uploaded
                {counts.versioned > 0 ? ` · ${counts.versioned} versioned` : ""}
                {counts.duplicate > 0 ? ` · ${counts.duplicate} duplicate${counts.duplicate !== 1 ? "s" : ""}` : ""}
                {counts.formatMismatch > 0 ? ` · ${counts.formatMismatch} skipped (format mismatch)` : ""}
                {counts.failed > 0 ? ` · ${counts.failed} failed` : ""}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            {isDone ? (
              <>
                <Button type="button" variant="outline" onClick={reset}>
                  Upload Another Batch
                </Button>
                <Button type="button" onClick={() => setIsOpen(false)}>
                  Done
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={isRunning}
                >
                  Cancel
                </Button>
                <LoadingButton
                  type="submit"
                  loading={isRunning}
                  disabled={
                    !entries.length ||
                    !creator.trim() ||
                    isScanning ||
                    entries.filter(e => e.status !== "format-mismatch").length === 0
                  }
                >
                  {isScanning
                    ? "Scanning…"
                    : `Upload ${entries.filter(e => e.status !== "format-mismatch").length} file${entries.filter(e => e.status !== "format-mismatch").length !== 1 ? "s" : ""}`}
                </LoadingButton>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default BulkUpload
