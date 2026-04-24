import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, GitBranch, Plus } from "lucide-react"
import { useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
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
import useCustomToast from "@/hooks/useCustomToast"

const API_BASE = import.meta.env.VITE_API_URL || ""

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem("access_token") || ""}` }
}

async function checkDocumentTitle(title: string): Promise<{ id: string; title: string; format: string } | null> {
  const res = await fetch(
    `${API_BASE}/api/v1/documents/check-title?title=${encodeURIComponent(title)}`,
    { headers: authHeaders() },
  )
  if (!res.ok) return null
  return res.json()
}

async function uploadDocumentApi(formData: FormData): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/documents/`, {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(typeof body?.detail === "string" ? body.detail : "Upload failed")
  }
}

async function uploadVersionApi(docId: string, file: File): Promise<void> {
  const fd = new FormData()
  fd.append("file", file)
  const res = await fetch(`${API_BASE}/api/v1/documents/${docId}/versions`, {
    method: "POST",
    headers: authHeaders(),
    body: fd,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(typeof body?.detail === "string" ? body.detail : "Upload failed")
  }
}

type MatchState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "no-match" }
  | { kind: "match"; docId: string; docTitle: string; docFormat: string }
  | { kind: "format-mismatch"; docTitle: string; existingFormat: string; newFormat: string }

const AddDocument = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [creator, setCreator] = useState("")
  const [format, setFormat] = useState("")
  const [subject, setSubject] = useState("")
  const [matchState, setMatchState] = useState<MatchState>({ kind: "idle" })
  const [versionIntent, setVersionIntent] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const mutation = useMutation({
    mutationFn: async () => {
      const file = fileRef.current?.files?.[0]
      if (!file) throw new Error("No file selected")

      if (versionIntent && matchState.kind === "match") {
        await uploadVersionApi(matchState.docId, file)
      } else {
        const fd = new FormData()
        fd.append("title", title)
        fd.append("creator", creator)
        fd.append("format", format || file.name.split(".").pop() || "unknown")
        if (subject) fd.append("subject", subject)
        fd.append("file", file)
        await uploadDocumentApi(fd)
      }
    },
    onSuccess: () => {
      showSuccessToast(
        versionIntent ? "New version uploaded successfully" : "Document uploaded successfully",
      )
      resetForm()
      setIsOpen(false)
    },
    onError: (err: Error) => showErrorToast(err.message),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  })

  const resetForm = () => {
    setTitle("")
    setCreator("")
    setFormat("")
    setSubject("")
    setMatchState({ kind: "idle" })
    setVersionIntent(false)
    if (fileRef.current) fileRef.current.value = ""
  }

  const onFileChange = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) return

    setVersionIntent(false)
    const derivedTitle = file.name.replace(/\.[^/.]+$/, "") || file.name
    if (!title) setTitle(derivedTitle)

    const checkTitle = title || derivedTitle
    setMatchState({ kind: "checking" })

    try {
      const match = await checkDocumentTitle(checkTitle)
      if (!match) {
        setMatchState({ kind: "no-match" })
        return
      }

      const newExt = file.name.includes(".")
        ? file.name.split(".").pop()!.toLowerCase()
        : ""

      if (newExt && newExt !== match.format.toLowerCase()) {
        setMatchState({
          kind: "format-mismatch",
          docTitle: match.title,
          existingFormat: match.format,
          newFormat: newExt,
        })
      } else {
        setMatchState({ kind: "match", docId: match.id, docTitle: match.title, docFormat: match.format })
      }
    } catch {
      setMatchState({ kind: "idle" })
    }
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!fileRef.current?.files?.[0]) { showErrorToast("Please select a file"); return }
    if (!versionIntent && !title.trim()) { showErrorToast("Title is required"); return }
    if (!versionIntent && !creator.trim()) { showErrorToast("Creator is required"); return }
    mutation.mutate()
  }

  const isVersionMode = versionIntent && matchState.kind === "match"

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm() }}>
      <DialogTrigger asChild>
        <Button className="my-4">
          <Plus className="mr-2" />
          Upload Document
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Upload a file with metadata. A SHA-256 fingerprint is calculated automatically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div className="grid gap-4 py-4">
            {/* File input always first so we can derive title */}
            <div className="grid gap-2">
              <Label htmlFor="file">File <span className="text-destructive">*</span></Label>
              <Input id="file" type="file" ref={fileRef} onChange={onFileChange} required />
            </div>

            {/* Match banner */}
            {matchState.kind === "checking" && (
              <p className="text-xs text-muted-foreground">Checking for existing document…</p>
            )}
            {matchState.kind === "match" && !versionIntent && (
              <div className="rounded-md border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 px-3 py-2.5 text-sm">
                <div className="flex items-start gap-2 mb-2">
                  <GitBranch className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <span className="text-blue-800 dark:text-blue-200">
                    <strong>"{matchState.docTitle}"</strong> already exists ({matchState.docFormat.toUpperCase()}).
                    Upload as a new version?
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setVersionIntent(true)}
                  >
                    Add as version
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setMatchState({ kind: "no-match" })}
                  >
                    Upload as new
                  </Button>
                </div>
              </div>
            )}
            {matchState.kind === "format-mismatch" && (
              <div className="rounded-md border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950 px-3 py-2.5 text-sm flex gap-2 items-start">
                <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
                <span className="text-yellow-800 dark:text-yellow-200">
                  <strong>"{matchState.docTitle}"</strong> exists as {matchState.existingFormat.toUpperCase()}.
                  Cannot add {matchState.newFormat.toUpperCase()} as a version — uploading as new document.
                </span>
              </div>
            )}
            {isVersionMode && (
              <div className="rounded-md border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950 px-3 py-2.5 text-sm flex gap-2 items-center">
                <GitBranch className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                <span className="text-green-800 dark:text-green-200">
                  Will upload as new version of <strong>"{matchState.docTitle}"</strong>.{" "}
                  <button
                    type="button"
                    className="underline text-xs"
                    onClick={() => setVersionIntent(false)}
                  >
                    Change
                  </button>
                </span>
              </div>
            )}

            {/* Metadata fields — hidden when in version mode */}
            {!isVersionMode && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="creator">Creator <span className="text-destructive">*</span></Label>
                  <Input id="creator" value={creator} onChange={e => setCreator(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="format">
                    Format <span className="text-muted-foreground text-xs">(auto-detected if blank)</span>
                  </Label>
                  <Input
                    id="format"
                    placeholder="pdf, docx, png…"
                    value={format}
                    onChange={e => setFormat(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    placeholder="Keywords for search"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={mutation.isPending}>Cancel</Button>
            </DialogClose>
            <LoadingButton type="submit" loading={mutation.isPending}>
              {isVersionMode ? "Upload Version" : "Upload"}
            </LoadingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default AddDocument
