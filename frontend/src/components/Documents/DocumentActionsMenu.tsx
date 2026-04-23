import { MoreHorizontal } from "lucide-react"
import { useState } from "react"

import type { DocumentPublic } from "@/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import DeleteDocument from "./DeleteDocument"
import DocumentVersions from "./DocumentVersions"
import { ManageTags } from "./ManageTags"
import { PreviewDocument } from "./PreviewDocument"

interface DocumentActionsMenuProps {
  document: DocumentPublic
}

export function DocumentActionsMenu({ document }: DocumentActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8">
          <MoreHorizontal className="size-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <PreviewDocument document={document} onClose={() => setIsOpen(false)} />
        <ManageTags document={document} onClose={() => setIsOpen(false)} />
        <DocumentVersions document={document} />
        <DeleteDocument id={document.id} onSuccess={() => setIsOpen(false)} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}