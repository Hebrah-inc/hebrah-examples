import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SMART App Demo',
  description: 'Minimal SMART launch and FHIR read demo'
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
