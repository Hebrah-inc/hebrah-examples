import Link from 'next/link'

export function SiteNav() {
  return (
    <header className="border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="font-semibold">Webhook Relay Demo</Link>
        <span className="text-muted-foreground text-sm">:3004 · hebrah-examples</span>
      </div>
    </header>
  )
}
