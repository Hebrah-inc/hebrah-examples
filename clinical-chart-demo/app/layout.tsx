import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Clinical Chart Demo — hebrah',
  description: 'Synthetic EHR clinical chart reference integration'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: '1.5rem', maxWidth: 960 }}>
        <header style={{ marginBottom: '1.5rem', borderBottom: '1px solid #ddd', paddingBottom: '1rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Clinical Chart Demo</h1>
          <nav style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem' }}>
            <a href="/">Home</a>
            <a href="/patients">Patients</a>
            <a href="/clinical">Clinical</a>
            <a href="/parity">Parity</a>
            <a href="/events">Webhooks</a>
          </nav>
        </header>
        {children}
      </body>
    </html>
  )
}
