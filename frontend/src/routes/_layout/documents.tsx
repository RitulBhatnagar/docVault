import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { ArrowDownUp, FileText, X } from "lucide-react"
import { Suspense, useState } from "react"

import { DocumentsService } from "@/client"
import type { DocumentsReadDocumentsData, TagPublic } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import AddDocument from "@/components/Documents/AddDocument"
import { columns } from "@/components/Documents/columns"
import PendingItems from "@/components/Pending/PendingItems"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export const Route = createFileRoute("/_layout/documents")({
  component: Documents,
  head: () => ({
    meta: [{ title: "Documents - DocVault" }],
  }),
})

type SortBy = NonNullable<DocumentsReadDocumentsData["sort_by"]>
type SortOrder = NonNullable<DocumentsReadDocumentsData["sort_order"]>

interface Filters {
  search: string
  sortBy: SortBy
  sortOrder: SortOrder
  format: string
  dateFrom: string
  dateTo: string
  tagId: string
}

const defaultFilters: Filters = {
  search: "",
  sortBy: "created_at",
  sortOrder: "desc",
  format: "",
  dateFrom: "",
  dateTo: "",
  tagId: "",
}

function DocumentsTableContent({ filters }: { filters: Filters }) {
  const isSearch = filters.search.trim().length > 0

  const query = isSearch
    ? {
        queryFn: () => DocumentsService.searchDocuments({ q: filters.search }),
        queryKey: ["documents", "search", filters.search],
      }
    : {
        queryFn: () =>
          DocumentsService.readDocuments({
            skip: 0,
            limit: 100,
            sort_by: filters.sortBy,
            sort_order: filters.sortOrder,
            format: filters.format || null,
            date_from: filters.dateFrom || null,
            date_to: filters.dateTo || null,
            tag_id: filters.tagId || null,
          }),
        queryKey: [
          "documents",
          filters.sortBy,
          filters.sortOrder,
          filters.format,
          filters.dateFrom,
          filters.dateTo,
          filters.tagId,
        ],
      }

  const { data: docs } = useSuspenseQuery(query)

  if (docs.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="rounded-full bg-muted p-4 mb-4">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">
          {isSearch ? "No documents matched your search" : "No documents found"}
        </h3>
        <p className="text-muted-foreground">
          {isSearch ? "Try different keywords" : "Upload a document to get started"}
        </p>
      </div>
    )
  }

  return <DataTable columns={columns} data={docs.data} />
}

function DocumentsTable({ filters }: { filters: Filters }) {
  return (
    <Suspense fallback={<PendingItems />}>
      <DocumentsTableContent filters={filters} />
    </Suspense>
  )
}

function Documents() {
  const [filters, setFilters] = useState<Filters>(defaultFilters)

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }))

  const { data: userTags = [] } = useQuery({
    queryKey: ["user-tags"],
    queryFn: () => DocumentsService.listUserTags(),
  })

  const hasActiveFilters =
    filters.format || filters.dateFrom || filters.dateTo || filters.tagId ||
    filters.sortBy !== "created_at" || filters.sortOrder !== "desc"

  const toggleSortOrder = () =>
    set({ sortOrder: filters.sortOrder === "asc" ? "desc" : "asc" })

  const clearFilters = () =>
    setFilters({ ...defaultFilters, search: filters.search })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground">
            Upload, version, and search documents with integrity verification
          </p>
        </div>
        <AddDocument />
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <Input
          placeholder="Search by title, creator, or subject…"
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
          className="max-w-sm"
        />

        <Select
          value={filters.sortBy}
          onValueChange={(v) => set({ sortBy: v as SortBy })}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">Date</SelectItem>
            <SelectItem value="title">Title</SelectItem>
            <SelectItem value="format">Format</SelectItem>
            <SelectItem value="creator">Creator</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="icon"
          onClick={toggleSortOrder}
          title={filters.sortOrder === "asc" ? "Ascending" : "Descending"}
        >
          <ArrowDownUp
            className={`h-4 w-4 transition-transform ${filters.sortOrder === "asc" ? "rotate-180" : ""}`}
          />
        </Button>

        <Input
          placeholder="Filter by format…"
          value={filters.format}
          onChange={(e) => set({ format: e.target.value })}
          className="w-36"
        />

        <div className="flex gap-2 items-center">
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => set({ dateFrom: e.target.value })}
            className="w-36"
            title="From date"
          />
          <span className="text-muted-foreground text-sm">to</span>
          <Input
            type="date"
            value={filters.dateTo}
            onChange={(e) => set({ dateTo: e.target.value })}
            className="w-36"
            title="To date"
          />
        </div>

        {userTags.length > 0 && (
          <Select
            value={filters.tagId || "__all__"}
            onValueChange={(v) => set({ tagId: v === "__all__" ? "" : v })}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Filter by tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All tags</SelectItem>
              {userTags.map((tag: TagPublic) => (
                <SelectItem key={tag.id} value={tag.id}>
                  {tag.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      <DocumentsTable filters={filters} />
    </div>
  )
}