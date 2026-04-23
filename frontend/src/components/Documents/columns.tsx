import type { ColumnDef } from "@tanstack/react-table"
import { Check, Copy } from "lucide-react"

import type { DocumentPublic } from "@/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard"
import { DocumentActionsMenu } from "./DocumentActionsMenu"

function CopyId({ id }: { id: string }) {
  const [copiedText, copy] = useCopyToClipboard()
  const isCopied = copiedText === id

  return (
    <div className="flex items-center gap-1.5 group">
      <span className="font-mono text-xs text-muted-foreground truncate max-w-[120px]">{id}</span>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => copy(id)}
      >
        {isCopied ? (
          <Check className="size-3 text-green-500" />
        ) : (
          <Copy className="size-3" />
        )}
        <span className="sr-only">Copy ID</span>
      </Button>
    </div>
  )
}

export const columns: ColumnDef<DocumentPublic>[] = [
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.title}</span>
    ),
  },
  {
    accessorKey: "creator",
    header: "Creator",
  },
  {
    accessorKey: "format",
    header: "Format",
    cell: ({ row }) => (
      <span className="uppercase text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
        {row.original.format}
      </span>
    ),
  },
  {
    accessorKey: "subject",
    header: "Subject",
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm truncate max-w-[200px] block">
        {row.original.subject || "—"}
      </span>
    ),
  },
  {
    accessorKey: "tags",
    header: "Tags",
    cell: ({ row }) => {
      const tags = row.original.tags ?? []
      if (tags.length === 0) return <span className="text-muted-foreground text-sm">—</span>
      return (
        <div className="flex flex-wrap gap-1 max-w-[200px]">
          {tags.map((tag) => (
            <Badge key={tag.id} variant="secondary" className="text-xs">
              {tag.name}
            </Badge>
          ))}
        </div>
      )
    },
  },
  {
    accessorKey: "created_at",
    header: "Uploaded",
    cell: ({ row }) => {
      const d = row.original.created_at
      if (!d) return <span className="text-muted-foreground">—</span>
      return (
        <span className="text-sm text-muted-foreground">
          {new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
        </span>
      )
    },
  },
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => <CopyId id={row.original.id} />,
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <DocumentActionsMenu document={row.original} />
      </div>
    ),
  },
]