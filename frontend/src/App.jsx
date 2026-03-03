import { useMemo, useState } from 'react'

const API_BASE_URL = 'http://127.0.0.1:8000'
const PREDICT_URL = `${API_BASE_URL}/predict`
const SIMULATE_URL = `${API_BASE_URL}/simulate`

const defaultPayload = {
  age: 62,
  smoking_pack_years: 30,
  copd: false,
  baseline_fev1: 78,
  v20: 28,
  mld: 16,
  radiomics_score: 0.9,
  stage: 'III'
}

const ranges = {
  age: [18, 100],
  smoking_pack_years: [0, 150],
  baseline_fev1: [20, 150],
  v20: [0, 100],
  mld: [0, 40],
  radiomics_score: [-5, 5]
}

function App() {
  const [form, setForm] = useState(defaultPayload)
  const [result, setResult] = useState(null)
  const [simulationResult, setSimulationResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [simLoading, setSimLoading] = useState(false)
  const [error, setError] = useState('')

  const onChange = (key, value, isNumber = true) => {
    setForm((prev) => ({ ...prev, [key]: isNumber ? Number(value) : value }))
  }

  const validationWarnings = useMemo(() => {
    return Object.entries(ranges)
      .filter(([key, [min, max]]) => form[key] < min || form[key] > max)
      .map(([key, [min, max]]) => `${key} harus di antara ${min}-${max}`)
  }, [form])

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch(PREDICT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })

      if (!response.ok) {
        throw new Error('Gagal memproses prediksi. Pastikan backend aktif.')
      }

      const data = await response.json()
      setResult(data)
      localStorage.setItem('pneumoshield:lastForm', JSON.stringify(form))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const runSimulation = async () => {
    setSimLoading(true)
    setError('')

    const scenarios = [
      { ...form, v20: Math.max(0, form.v20 - 5), mld: Math.max(0, form.mld - 2) },
      { ...form, radiomics_score: form.radiomics_score + 0.8 },
      { ...form, copd: true, baseline_fev1: Math.max(20, form.baseline_fev1 - 10) }
    ]

    try {
      const response = await fetch(SIMULATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_case: form, scenarios })
      })

      if (!response.ok) {
        throw new Error('Gagal menjalankan simulasi skenario.')
      }

      const data = await response.json()
      setSimulationResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setSimLoading(false)
    }
  }

  const loadLastInput = () => {
    const saved = localStorage.getItem('pneumoshield:lastForm')
    if (saved) {
      setForm(JSON.parse(saved))
    }
  }

  const exportResult = () => {
    if (!result) return
    const payload = { input: form, output: result, simulation: simulationResult }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'pneumoshield-report.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="container">
      <h1>PneumoShield</h1>
      <p className="subtitle">Model AI Radiomics CT + DVH untuk prediksi pneumonitis pasca RT toraks (NSCLC).</p>

      <div className="actions">
        <button type="button" onClick={loadLastInput}>Muat input terakhir</button>
        <button type="button" onClick={runSimulation} disabled={simLoading}>{simLoading ? 'Simulasi...' : 'Simulasi 3 skenario'}</button>
        <button type="button" onClick={exportResult} disabled={!result}>Ekspor hasil JSON</button>
      </div>

      <form onSubmit={submit} className="grid">
        {[
          ['age', 'Usia (tahun)'],
          ['smoking_pack_years', 'Smoking pack-years'],
          ['baseline_fev1', 'Baseline FEV1 (%)'],
          ['v20', 'V20 (%)'],
          ['mld', 'MLD (Gy)'],
          ['radiomics_score', 'Radiomics score']
        ].map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              type="number"
              value={form[key]}
              step="0.1"
              onChange={(e) => onChange(key, e.target.value)}
              required
            />
          </label>
        ))}

        <label>
          Stadium
          <select value={form.stage} onChange={(e) => onChange('stage', e.target.value, false)}>
            <option>I</option>
            <option>II</option>
            <option>III</option>
            <option>IV</option>
          </select>
        </label>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.copd}
            onChange={(e) => setForm((prev) => ({ ...prev, copd: e.target.checked }))}
          />
          Riwayat COPD
        </label>

        <button type="submit" disabled={loading || validationWarnings.length > 0}>{loading ? 'Menghitung...' : 'Prediksi Risiko'}</button>
      </form>

      {validationWarnings.length > 0 && (
        <ul className="warning">
          {validationWarnings.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )}

      {error && <p className="error">{error}</p>}

      {result && (
        <section className="card">
          <h2>Hasil Prediksi</h2>
          <div className="risk-bar">
            <div className="risk-fill" style={{ width: `${(result.risk_ai_model * 100).toFixed(0)}%` }} />
          </div>
          <p><strong>AI model:</strong> {(result.risk_ai_model * 100).toFixed(1)}%</p>
          <p><strong>DVH konvensional:</strong> {(result.risk_dvh_only * 100).toFixed(1)}%</p>
          <p><strong>Delta:</strong> {(result.delta_risk * 100).toFixed(1)}%</p>
          <p><strong>Kategori risiko:</strong> {result.risk_category}</p>
          <p><strong>Confidence score:</strong> {(result.confidence_score * 100).toFixed(0)}%</p>
          <p><strong>Status risiko:</strong> {result.high_risk_flag ? 'Tinggi' : 'Tidak tinggi'}</p>
          <p><strong>Rekomendasi:</strong> {result.recommendation}</p>

          <h3>Faktor pendorong utama</h3>
          <ul>
            {result.key_drivers.map((driver) => <li key={driver}>{driver}</li>)}
          </ul>

          <h3>Rencana follow-up</h3>
          <ol>
            {result.follow_up_plan.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </section>
      )}

      {simulationResult && (
        <section className="card">
          <h2>Hasil Simulasi Skenario</h2>
          <p><strong>Risiko baseline:</strong> {(simulationResult.base_risk_ai_model * 100).toFixed(1)}%</p>
          <table>
            <thead>
              <tr>
                <th>Skenario</th>
                <th>Risiko AI</th>
                <th>Delta vs baseline</th>
                <th>Kategori</th>
              </tr>
            </thead>
            <tbody>
              {simulationResult.results.map((item) => (
                <tr key={item.scenario_index}>
                  <td>{item.label}</td>
                  <td>{(item.risk_ai_model * 100).toFixed(1)}%</td>
                  <td>{(item.delta_from_base * 100).toFixed(1)}%</td>
                  <td>{item.risk_category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  )
}

export default App
