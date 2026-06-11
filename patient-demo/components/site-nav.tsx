import Link from 'next/link'
import { cn } from '@/lib/utils'

const links = [
  { href: '/', label: 'Setup' },
  { href: '/patients', label: 'Patients' },
  { href: '/events', label: 'Events' }
]

export function SiteNav({ pathname }: { pathname: string }) {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            While examples
          </p>
          <h1 className="text-lg font-semibold">Patient demo</h1>
        </div>
        <nav className="flex flex-wrap gap-1">
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted',
                pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href))
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
