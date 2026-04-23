import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
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

async function uploadDocumentApi(formData: FormData) {
  const token = localStorage.getItem("access_token") || ""
  const base = import.meta.env.VITE_API_URL || ""
  const res = await fetch(`${base}/api/v1/documents/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }))
    throw new Error(err.detail || "Upload failed")
  }
  return res.json()
}

const AddDocument = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [creator, setCreator] = useState("")
  const [format, setFormat] = useState("")
  const [subject, setSubject] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const mutation = useMutation({
    mutationFn: uploadDocumentApi,
    onSuccess: () => {
      showSuccessToast("Document uploaded successfully")
      setTitle("")
      setCreator("")
      setFormat("")
      setSubject("")
      if (fileRef.current) fileRef.current.value = ""
      setIsOpen(false)
    },
    onError: (err: Error) => showErrorToast(err.message),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] })
    },
  })

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) { showErrorToast("Please select a file"); return }
    const fd = new FormData()
    fd.append("title", title)
    fd.append("creator", creator)
    fd.append("format", format || file.name.split(".").pop() || "unknown")
    if (subject) fd.append("subject", subject)
    fd.append("file", file)
    mutation.mutate(fd)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
            <div className="grid gap-2">
              <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
              <Input id="title" value={title} onChange={e => setTitle(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="creator">Creator <span className="text-destructive">*</span></Label>
              <Input id="creator" value={creator} onChange={e => setCreator(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="format">Format <span className="text-muted-foreground text-xs">(auto-detected if blank)</span></Label>
              <Input id="format" placeholder="pdf, docx, png…" value={format} onChange={e => setFormat(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" placeholder="Keywords for search" value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="file">File <span className="text-destructive">*</span></Label>
              <Input id="file" type="file" ref={fileRef} required />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={mutation.isPending}>Cancel</Button>
            </DialogClose>
            <LoadingButton type="submit" loading={mutation.isPending}>Upload</LoadingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default AddDocument