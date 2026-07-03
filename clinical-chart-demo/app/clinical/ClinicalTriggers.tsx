'use client'

import { useEffect, useState } from 'react'
import { DEFAULT_HL7_TEMPLATES, FALLBACK_CLINICAL_SCENARIOS } from '@/lib/clinical-scenarios'

type Props = {
  defaultPatientId: string
}

export default function ClinicalTriggers({ defaultPatientId }: Props) {
  const [patientId, setPatientId] = useState(defaultPatientId)
  const [scenarioId, setScenarioId] = useState(FALLBACK_CLINICAL_SCENARIOS[0].id)
  const [templateId, setTemplateId] = useState(DEFAULT_HL7_TEMPLATES[0].id)
  const [scenarios, setScenarios] = useState(FALLBACK_CLINICAL_SCENARIOS)

  useEffect(() => {
    void fetch('/api/hebrah/clinical-scenarios')
      .then(res => res.ok ? res.json() : null)
      .then((data: { scenarios?: typeof scenarios } | null) => {
        if (data?.scenarios?.length) {
          setScenarios(data.scenarios)
          setScenarioId(data.scenarios[0].id)
        }
      })
      .catch(() => {})
  }, [])

  return (
    <main>
      <h2>Clinical triggers</h2>
      <p style={{ color: '#666', fontSize: '0.875rem' }}>
        Run sandbox scenarios or HL7 clinical injects. Delivered webhooks appear on{' '}
        <a href="/events">Webhooks</a> (auto-refreshes every 2s).
      </p>

      <section style={{ marginTop: '1.5rem' }}>
        <h3>Scenario runner</h3>
        <form action="/api/hebrah/scenario" method="POST" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 480 }}>
          <label>
            Patient ID
            <input
              name="patientId"
              value={patientId}
              onChange={e => setPatientId(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: '0.25rem', fontFamily: 'monospace' }}
            />
          </label>
          <label>
            Scenario
            <select
              name="scenarioId"
              value={scenarioId}
              onChange={e => setScenarioId(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: '0.25rem' }}
            >
              {scenarios.map(item => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <button type="submit" style={{ alignSelf: 'flex-start', padding: '0.5rem 1rem', cursor: 'pointer' }}>
            Run scenario → events
          </button>
        </form>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h3>HL7 clinical inject</h3>
        <form action="/api/hebrah/hl7-inject" method="POST" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 480 }}>
          <input type="hidden" name="patientId" value={patientId} />
          <label>
            HL7 template
            <select
              name="templateId"
              value={templateId}
              onChange={e => setTemplateId(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: '0.25rem' }}
            >
              {DEFAULT_HL7_TEMPLATES.map(item => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <button type="submit" style={{ alignSelf: 'flex-start', padding: '0.5rem 1rem', cursor: 'pointer' }}>
            Inject HL7 → events
          </button>
        </form>
      </section>
    </main>
  )
}
