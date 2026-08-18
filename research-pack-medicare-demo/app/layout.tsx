import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Research Pack Medicare Demo — hebrah',
  description: 'Medicare utilization & claims calibration against CMS open-data snapshot'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: '1.5rem', maxWidth: 960 }}>
        <header style={{ marginBottom: '1.5rem', borderBottom: '1px solid #ddd', paddingBottom: '1rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Research Pack 1 — Medicare Calibration</h1>
          <nav style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem' }}>
            <a href="/">Setup</a>
            <a href="/calibration">Calibration</a>
          </nav>
        </header>
        {children}
      </body>
    </html>
  )
}
