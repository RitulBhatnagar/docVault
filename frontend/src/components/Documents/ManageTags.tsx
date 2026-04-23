import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Tag, X } from "lucide-react"
import { useState } from "react"

import { DocumentsService } from "@/client"
import type { DocumentPublic, TagPublic } from "@/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"

interface ManageTagsProps {
  document: DocumentPublic
  onClose: () => void
}

export function ManageTags({ document, onClose }: ManageTagsProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const queryClient = useQueryClient()

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ["document-tags", document.id],
    queryFn: () => DocumentsService.listDocumentTags({ id: document.id }),
    enabled: open,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["document-tags", document.id] })
    queryClient.invalidateQueries({ queryKey: ["documents"] })
    queryClient.invalidateQueries({ queryKey: ["user-tags"] })
  }

  const addTag = useMutation({
    mutationFn: (name: string) =>
      DocumentsService.addTagToDocument({ id: document.id, name }),
    onSuccess: () => {
      setInput("")
      invalidate()
    },
  })

  const removeTag = useMutation({
    mutationFn: (tag_id: string) =>
      DocumentsService.removeTagFromDocument({ id: document.id, tag_id }),
    onSuccess: invalidate,
  })

  const handleAdd = () => {
    const name = input.trim()
    if (!name) return
    addTag.mutate(name)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAdd()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) onClose()
      }}
    >
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <Tag className="mr-2 h-4 w-4" />
          Manage Tags
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tags — {document.title}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mt-2">
          <Input
            placeholder="Add tag…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={50}
          />
          <Button onClick={handleAdd} disabled={!input.trim() || addTag.isPending}>
            Add
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tags yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2 mt-2">
            {tags.map((tag: TagPublic) => (
              <Badge key={tag.id} variant="secondary" className="gap-1 pr-1">
                {tag.name}
                <button
                  onClick={() => removeTag.mutate(tag.id)}
                  className="ml-1 rounded-full hover:bg-muted"
                  disabled={removeTag.isPending}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
