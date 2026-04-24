import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, CloudDownload, FolderOpen, Loader2, XCircle } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { DriveService } from "@/client"
import type { DriveImportJobPublic } from "@/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Step = "status" | "pick" | "importing" | "done"

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="w-full rounded-full bg-muted h-2 overflow-hidden">
      <div
        className="h-2 bg-primary transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function JobSummary({ job }: { job: DriveImportJobPublic }) {
  return (
    <div className="rounded-md border divide-y text-sm">
      <div className="flex justify-between px-3 py-2">
        <span className="text-muted-foreground">Imported</span>
        <Badge variant="secondary" className="text-green-600 dark:text-green-400">
          {job.imported_files}
        </Badge>
      </div>
      <div className="flex justify-between px-3 py-2">
        <span className="text-muted-foreground">Skipped (duplicates / unsupported)</span>
        <Badge variant="outline">{job.skipped_files}</Badge>
      </div>
      {job.failed_files > 0 && (
        <div className="flex justify-between px-3 py-2">
          <span className="text-muted-foreground">Failed</span>
          <Badge variant="destructive">{job.failed_files}</Badge>
        </div>
      )}
    </div>
  )
}

const DriveImportModal = () => {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("status")
  const [selectedFolder, setSelectedFolder] = useState<{ id: string; name: string } | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [job, setJob] = useState<DriveImportJobPublic | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const queryClient = useQueryClient()

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["drive-status"],
    queryFn: () => DriveService.getStatus(),
    enabled: open,
  })

  const { data: folders, isLoading: foldersLoading } = useQuery({
    queryKey: ["drive-folders"],
    queryFn: () => DriveService.getFolders(),
    enabled: open && !!status?.connected,
  })

  const connectMutation = useMutation({
    mutationFn: () => DriveService.getAuthUrl(),
    onSuccess: ({ url }) => {
      window.location.href = url
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: () => DriveService.disconnect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drive-status"] })
    },
  })

  const importMutation = useMutation({
    mutationFn: () =>
      DriveService.startImport({
        requestBody: { folder_id: selectedFolder!.id, folder_name: selectedFolder!.name },
      }),
    onSuccess: (data) => {
      setJobId(data.id)
      setJob(data)
      setStep("importing")
    },
  })

  // Poll job status
  useEffect(() => {
    if (step !== "importing" || !jobId) return

    pollRef.current = setInterval(async () => {
      try {
        const updated = await DriveService.getImportStatus({ jobId })
        setJob(updated)
        if (updated.status === "completed" || updated.status === "failed") {
          clearInterval(pollRef.current!)
          setStep("done")
          queryClient.invalidateQueries({ queryKey: ["documents"] })
        }
      } catch {}
    }, 2000)

    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [step, jobId, queryClient])

  // Determine initial step when status loads
  useEffect(() => {
    if (!open || statusLoading) return
    if (status?.connected) {
      setStep("pick")
    } else {
      setStep("status")
    }
  }, [open, status, statusLoading])

  const reset = () => {
    setStep(status?.connected ? "pick" : "status")
    setSelectedFolder(null)
    setJobId(null)
    setJob(null)
    if (pollRef.current) clearInterval(pollRef.current)
  }

  const onOpenChange = (o: boolean) => {
    if (!o && step === "importing") return
    setOpen(o)
    if (!o) reset()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="my-4">
          <CloudDownload className="mr-2 h-4 w-4" />
          Import from Drive
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import from Google Drive</DialogTitle>
          <DialogDescription>
            Connect your Google Drive and import files from a folder into DocVault.
            Google Docs / Sheets / Slides are skipped — only real files are imported.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-4">
          {/* Status / Connect step */}
          {(step === "status" || statusLoading) && (
            <div className="space-y-3">
              {statusLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking Drive connection…
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Google Drive is not connected. Click below to connect your account.
                  </p>
                  <Button
                    onClick={() => connectMutation.mutate()}
                    disabled={connectMutation.isPending}
                    className="w-full"
                  >
                    {connectMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CloudDownload className="mr-2 h-4 w-4" />
                    )}
                    Connect Google Drive
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Folder pick step */}
          {step === "pick" && status?.connected && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  Drive connected
                  {status.connected_at && (
                    <span className="text-muted-foreground font-normal ml-1">
                      since {new Date(status.connected_at).toLocaleDateString()}
                    </span>
                  )}
                </span>
                <button
                  onClick={() => disconnectMutation.mutate()}
                  className="text-xs text-muted-foreground hover:text-destructive underline"
                  disabled={disconnectMutation.isPending}
                >
                  Disconnect
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Select folder</label>
                {foldersLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading folders…
                  </div>
                ) : (
                  <Select
                    value={selectedFolder?.id ?? ""}
                    onValueChange={(id) => {
                      const f = folders?.find((f) => f.id === id)
                      setSelectedFolder(f ? { id: f.id, name: f.name } : null)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a Drive folder…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(folders ?? []).length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          No folders found
                        </div>
                      ) : (
                        (folders ?? []).map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            <span className="flex items-center gap-2">
                              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                              {f.name}
                            </span>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Only top-level files in the selected folder will be imported.
                Duplicates and Google native formats are skipped automatically.
              </p>
            </div>
          )}

          {/* Importing step */}
          {step === "importing" && job && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Loader2 className="h-4 w-4 animate-spin" />
                Importing from &ldquo;{job.folder_name}&rdquo;…
              </div>
              <ProgressBar value={job.imported_files + job.skipped_files + job.failed_files} max={job.total_files} />
              <p className="text-xs text-muted-foreground">
                {job.imported_files + job.skipped_files + job.failed_files} / {job.total_files} files processed
              </p>
            </div>
          )}

          {/* Done step */}
          {step === "done" && job && (
            <div className="space-y-3">
              {job.status === "completed" ? (
                <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Import complete — &ldquo;{job.folder_name}&rdquo;
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                    <XCircle className="h-4 w-4" />
                    Import failed
                  </div>
                  {job.error_message && (
                    <p className="text-xs text-muted-foreground rounded bg-muted px-2 py-1.5">
                      {job.error_message}
                    </p>
                  )}
                </div>
              )}
              <JobSummary job={job} />
              {job.status === "completed" && job.imported_files > 0 && (
                <p className="text-xs text-muted-foreground">
                  All imported files are tagged <strong>from-drive</strong> — use the tag filter to find them.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {step === "done" ? (
            <>
              <Button variant="outline" onClick={reset}>
                Import Another
              </Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </>
          ) : step === "pick" ? (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => importMutation.mutate()}
                disabled={!selectedFolder || importMutation.isPending}
              >
                {importMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CloudDownload className="mr-2 h-4 w-4" />
                )}
                Start Import
              </Button>
            </>
          ) : step === "importing" ? null : (
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DriveImportModal