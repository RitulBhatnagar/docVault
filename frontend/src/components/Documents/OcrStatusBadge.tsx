import { ScanText } from "lucide-react"

interface OcrStatusBadgeProps {
  status: string | null | undefined
  className?: string
}

const CONFIG = {
  pending:    { label: "OCR queued",    classes: "bg-muted text-muted-foreground" },
  processing: { label: "OCR running…",  classes: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  done:       { label: "OCR done",      classes: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  failed:     { label: "OCR failed",    classes: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
} as const

type OcrStatus = keyof typeof CONFIG

export function OcrStatusBadge({ status, className = "" }: OcrStatusBadgeProps) {
  if (!status || !(status in CONFIG)) return null
  const { label, classes } = CONFIG[status as OcrStatus]

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded ${classes} ${className}`}
      title={label}
    >
      <ScanText className="h-3 w-3 shrink-0" />
      {label}
    </span>
  )
}
