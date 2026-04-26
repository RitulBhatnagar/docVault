import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { Download, GitBranch, Upload } from "lucide-react"
import { Suspense, useRef, useState } from "react"

import { DocumentsService, type DocumentPublic } from "@/client"
import { Button } from "@/components/ui/button"
import { OcrStatusBadge } from "./OcrStatusBadge"
import { VersionPreviewButton } from "./PreviewDocument"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import useCustomToast from "@/hooks/useCustomToast"

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

async function uploadVersionApi(documentId: string, file: File) {
  const token = localStorage.getItem("access_token") || ""
  const base = import.meta.env.VITE_API_URL || ""
  const fd = new FormData()
  fd.append("file", file)
  const res = await fetch(`${base}/api/v1/documents/${documentId}/versions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }))
    throw new Error(err.detail || "Upload failed")
  }
  return res.json()
}

function VersionsList({ document: doc }: { document: DocumentPublic }) {
  const { data: versions } = useSuspenseQuery({
    queryFn: () => DocumentsService.listVersions({ id: doc.id }),
    queryKey: ["documents", doc.id, "versions"],
  })

  const base = import.meta.env.VITE_API_URL || ""
  const token = localStorage.getItem("access_token") || ""

  const handleDownload = async (versionId: string, filename: string) => {
    const res = await fetch(
      `${base}/api/v1/documents/${doc.id}/versions/${versionId}/download`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = Object.assign(window.document.createElement("a"), { href: url, download: filename })
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {versions.map((v) => (
        <div key={v.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                v{v.version_number}
              </span>
              <span className="text-sm font-medium truncate max-w-[180px]">{v.original_filename}</span>
              <OcrStatusBadge status={v.ocr_status} />
            </div>
            <span className="text-xs text-muted-foreground font-mono">{v.sha256.slice(0, 16)}…</span>
            <span className="text-xs text-muted-foreground">{formatBytes(v.file_size)}</span>
          </div>
          <div className="flex gap-1">
            <VersionPreviewButton
              docId={doc.id}
              versionId={v.id}
              filename={v.original_filename}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDownload(v.id, v.original_filename)}
              title="Download"
            >
              <Download className="size-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

function UploadNewVersion({ document }: { document: DocumentPublic }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const mutation = useMutation({
    mutationFn: (file: File) => uploadVersionApi(document.id, file),
    onSuccess: () => {
      showSuccessToast("New version uploaded")
      if (fileRef.current) fileRef.current.value = ""
    },
    onError: (err: Error) => showErrorToast(err.message),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", document.id, "versions"] })
    },
  })

  const handleUpload = () => {
    const file = fileRef.current?.files?.[0]
    if (!file) { showErrorToast("Select a file first"); return }
    mutation.mutate(file)
  }

  return (
    <div className="flex gap-2 items-center pt-2 border-t">
      <Input type="file" ref={fileRef} className="flex-1" />
      <LoadingButton
        size="sm"
        loading={mutation.isPending}
        onClick={handleUpload}
        type="button"
      >
        <Upload className="size-3 mr-1" />
        Upload
      </LoadingButton>
    </div>
  )
}

interface DocumentVersionsProps {
  document: DocumentPublic
}

const DocumentVersions = ({ document }: DocumentVersionsProps) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={() => setIsOpen(true)}>
        <GitBranch />
        Versions
      </DropdownMenuItem>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{document.title}</DialogTitle>
          <DialogDescription>
            All versions preserved. Download any version or upload a new one.
          </DialogDescription>
        </DialogHeader>
        <Suspense fallback={<div className="text-sm text-muted-foreground py-4 text-center">Loading versions…</div>}>
          <VersionsList document={document} />
        </Suspense>
        <UploadNewVersion document={document} />
      </DialogContent>
    </Dialog>
  )
}

export default DocumentVersions