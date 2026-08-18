import CalibrationClient from './CalibrationClient'

export default function CalibrationPage() {
  return (
    <main>
      <h2 style={{ marginTop: 0 }}>Calibration</h2>
      <p>
        Apply <code>medicare_utilization_v1</code>, then compare sandbox claim KPIs to the vendored CMS
        inpatient DRG snapshot.
      </p>
      <CalibrationClient />
    </main>
  )
}
