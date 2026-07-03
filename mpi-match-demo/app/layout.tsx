import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MPI Match Demo',
  description: 'Minimal MPI workflow and webhook queue demo'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <main className="mx-auto max-w-4xl p-6">{children}</main>
      </body>
    </html>
  )
}
