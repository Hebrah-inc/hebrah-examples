import { RESEARCH_PACK_ID } from '@/lib/env'

export default function HomePage() {
  return (
    <main>
      <p>
        Run Medicare-shaped claims research on Hebrah’s synthetic FHIR clinic, grounded in a vendored CMS
        open-data snapshot (<code>{RESEARCH_PACK_ID}</code>).
      </p>

      <h2>Setup checklist</h2>
      <ol>
        <li>Start hebrah-api + hebrah-app (and optional MCP host).</li>
        <li>
          Copy <code>.env.example</code> → <code>.env</code> with <code>hb_test_*</code> and{' '}
          <code>HEBRAH_CONNECTION_ID</code>.
        </li>
        <li>
          Open <a href="/calibration">Calibration</a> → <strong>Apply Research Pack</strong>.
        </li>
        <li>Optionally run <code>medicare_claim_paid_workflow</code> for webhook traffic.</li>
      </ol>

      <h2>Use cases</h2>
      <ul>
        <li>
          <strong>Analytics agent</strong> — compare sandbox DRG mix / denial rate to CMS peers via{' '}
          <code>compare_research_pack</code>.
        </li>
        <li>
          <strong>Coursework</strong> — fixed seed + fixed open-data snapshot for graded claim pipelines.
        </li>
        <li>
          <strong>Cost-outlier prototype</strong> — alert when sandbox denial/DRG deltas leave benchmark bands.
        </li>
      </ul>

      <p style={{ fontSize: '0.9rem', color: '#555' }}>
        Disclaimer: synthetic sandbox calibration only. Not for clinical decision-making. Benchmarks are
        trimmed public CMS aggregates.
      </p>
    </main>
  )
}
