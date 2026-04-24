import type { ColumnDef } from "@tanstack/react-table"

import type { DocumentPublic } from "@/client"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { DocumentActionsMenu } from "./DocumentActionsMenu"
import { FormatIcon } from "./FormatIcon"
import { DownloadIconButton, PreviewIconButton } from "./PreviewDocument"

export const columns: ColumnDef<DocumentPublic>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
        onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(v) => row.toggleSelected(!!v)}
        aria-label="Select row"
        onClick={(e) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
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
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.original.creator}</span>
    ),
  },
  {
    accessorKey: "format",
    header: "Format",
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5">
        <FormatIcon format={row.original.format} />
        <span className="uppercase text-xs font-mono">{row.original.format}</span>
      </div>
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
        <div className="flex flex-wrap gap-1 max-w-[180px]">
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
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => {
      const doc = row.original
      return (
        <div className="flex justify-end items-center gap-1">
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <PreviewIconButton document={doc} />
            <DownloadIconButton docId={doc.id} filename={doc.title} />
          </div>
          <DocumentActionsMenu document={doc} />
        </div>
      )
    },
  },
]
