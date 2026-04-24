import type { DocumentPublic } from "@/client"
import { Badge } from "@/components/ui/badge"
import { DocumentActionsMenu } from "./DocumentActionsMenu"
import { FormatIcon } from "./FormatIcon"
import { DownloadIconButton, PreviewIconButton } from "./PreviewDocument"

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function DocumentCard({ doc }: { doc: DocumentPublic }) {
  const tags = doc.tags ?? []

  return (
    <div className="group relative rounded-lg border bg-card hover:shadow-md transition-shadow flex flex-col gap-3 p-4">
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div className="rounded-md bg-muted p-2.5">
          <FormatIcon format={doc.format} className="h-5 w-5" />
        </div>
        <span className="uppercase text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
          {doc.format}
        </span>
      </div>

      {/* Title + creator */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm leading-snug line-clamp-2">{doc.title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{doc.creator}</p>
        {doc.subject && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{doc.subject}</p>
        )}
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 3).map((tag) => (
            <Badge key={tag.id} variant="secondary" className="text-xs">
              {tag.name}
            </Badge>
          ))}
          {tags.length > 3 && (
            <span className="text-xs text-muted-foreground">+{tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t mt-auto">
        <span className="text-xs text-muted-foreground">{formatDate(doc.created_at)}</span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <PreviewIconButton document={doc} />
          <DownloadIconButton docId={doc.id} filename={doc.title} />
          <DocumentActionsMenu document={doc} />
        </div>
      </div>
    </div>
  )
}
