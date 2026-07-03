import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Credentialing Demo',
  description: 'Minimal credentialing workflow and webhook inbox'
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
