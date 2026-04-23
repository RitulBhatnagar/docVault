import { Link } from "@tanstack/react-router"
import { FileText } from "lucide-react"

import { cn } from "@/lib/utils"

interface LogoProps {
  variant?: "full" | "icon" | "responsive"
  className?: string
  asLink?: boolean
}

export function Logo({ variant = "full", className, asLink = true }: LogoProps) {
  const content =
    variant === "icon" ? (
      <FileText className={cn("size-5 text-primary", className)} />
    ) : variant === "responsive" ? (
      <>
        <div className={cn("flex items-center gap-2 group-data-[collapsible=icon]:hidden", className)}>
          <FileText className="size-5 text-primary" />
          <span className="font-bold text-lg tracking-tight">DocVault</span>
        </div>
        <FileText className="size-5 text-primary hidden group-data-[collapsible=icon]:block" />
      </>
    ) : (
      <div className={cn("flex items-center gap-2", className)}>
        <FileText className="size-6 text-primary" />
        <span className="font-bold text-xl tracking-tight">DocVault</span>
      </div>
    )

  if (!asLink) return content
  return <Link to="/">{content}</Link>
}
