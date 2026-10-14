'use client'

import { Toaster } from '@/components/ui/sonner'
import { SiteNav } from '@/components/site-nav'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        Webhook relay demo — fault-injection + signed webhooks
      </footer>
      <Toaster />
    </>
  )
}
