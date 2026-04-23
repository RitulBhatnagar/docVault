import { createFileRoute, Link } from "@tanstack/react-router"
import { FileText, Search, Shield, Upload } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import useAuth from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
  head: () => ({
    meta: [{ title: "Dashboard - DocVault" }],
  }),
})

const features = [
  {
    icon: Upload,
    title: "Upload Documents",
    description: "Store any file with metadata. SHA-256 fingerprint calculated automatically.",
    to: "/documents",
  },
  {
    icon: Shield,
    title: "Version History",
    description: "Every version kept forever. Upload a new version without losing the old one.",
    to: "/documents",
  },
  {
    icon: Search,
    title: "Full-text Search",
    description: "Search documents by title, creator, or subject instantly.",
    to: "/documents",
  },
  {
    icon: FileText,
    title: "Integrity Verified",
    description: "SHA-256 fingerprint on every version. Detect any tampering.",
    to: "/documents",
  },
]

function Dashboard() {
  const { user: currentUser } = useAuth()

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back, {currentUser?.full_name || currentUser?.email?.split("@")[0]} 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          Your secure document vault. Store, version, and search with confidence.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {features.map(({ icon: Icon, title, description, to }) => (
          <Link to={to} key={title}>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-primary/10 p-2">
                    <Icon className="size-4 text-primary" />
                  </div>
                  <CardTitle className="text-sm font-semibold">{title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}