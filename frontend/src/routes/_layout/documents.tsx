import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { FileText } from "lucide-react"
import { Suspense, useState } from "react"

import { DocumentsService } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import AddDocument from "@/components/Documents/AddDocument"
import { columns } from "@/components/Documents/columns"
import PendingItems from "@/components/Pending/PendingItems"
import { Input } from "@/components/ui/input"

export const Route = createFileRoute("/_layout/documents")({
  component: Documents,
  head: () => ({
    meta: [{ title: "Documents - DocVault" }],
  }),
})

function DocumentsTableContent({ search }: { search: string }) {
  const query = search.trim()
    ? {
        queryFn: () => DocumentsService.searchDocuments({ q: search }),
        queryKey: ["documents", "search", search],
      }
    : {
        queryFn: () => DocumentsService.readDocuments({ skip: 0, limit: 100 }),
        queryKey: ["documents"],
      }

  const { data: docs } = useSuspenseQuery(query)

  if (docs.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="rounded-full bg-muted p-4 mb-4">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">
          {search ? "No documents matched your search" : "No documents yet"}
        </h3>
        <p className="text-muted-foreground">
          {search ? "Try different keywords" : "Upload a document to get started"}
        </p>
      </div>
    )
  }

  return <DataTable columns={columns} data={docs.data} />
}

function DocumentsTable({ search }: { search: string }) {
  return (
    <Suspense fallback={<PendingItems />}>
      <DocumentsTableContent search={search} />
    </Suspense>
  )
}

function Documents() {
  const [search, setSearch] = useState("")

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
      <Input
        placeholder="Search by title, creator, or subject…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />
      <DocumentsTable search={search} />
    </div>
  )
}