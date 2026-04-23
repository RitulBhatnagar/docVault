import { FileText, Shield } from "lucide-react"
import type { ReactNode } from "react"

import { Appearance } from "@/components/Common/Appearance"
import { Footer } from "./Footer"

interface AuthLayoutProps {
  children: ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="bg-primary relative hidden lg:flex lg:flex-col lg:items-center lg:justify-center gap-6 p-12">
        <div className="flex items-center gap-3">
          <FileText className="size-12 text-primary-foreground" />
          <span className="text-4xl font-bold text-primary-foreground tracking-tight">DocVault</span>
        </div>
        <div className="flex flex-col gap-4 max-w-sm">
          {[
            { icon: Shield, text: "SHA-256 integrity fingerprint on every file" },
            { icon: FileText, text: "Full version history — nothing ever deleted" },
            { icon: FileText, text: "Full-text search across all your documents" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 text-primary-foreground/80">
              <Icon className="size-4 shrink-0" />
              <span className="text-sm">{text}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-end">
          <Appearance />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">{children}</div>
        </div>
        <Footer />
      </div>
    </div>
  )
}
