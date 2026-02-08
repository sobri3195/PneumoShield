import { useState } from 'react'

const API_URL = 'http://127.0.0.1:8000/predict'

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

function App() {
  const [form, setForm] = useState(defaultPayload)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onChange = (key, value, isNumber = true) => {
    setForm((prev) => ({ ...prev, [key]: isNumber ? Number(value) : value }))
  }

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })

      if (!response.ok) {
        throw new Error('Gagal memproses prediksi. Pastikan backend aktif.')
      }

      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="container">
      <h1>PneumoShield</h1>
      <p className="subtitle">Model AI Radiomics CT + DVH untuk prediksi pneumonitis pasca RT toraks (NSCLC).</p>

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

        <button type="submit" disabled={loading}>{loading ? 'Menghitung...' : 'Prediksi Risiko'}</button>
      </form>

      {error && <p className="error">{error}</p>}

      {result && (
        <section className="card">
          <h2>Hasil Prediksi</h2>
          <p><strong>AI model:</strong> {(result.risk_ai_model * 100).toFixed(1)}%</p>
          <p><strong>DVH konvensional:</strong> {(result.risk_dvh_only * 100).toFixed(1)}%</p>
          <p><strong>Delta:</strong> {(result.delta_risk * 100).toFixed(1)}%</p>
          <p><strong>Status risiko:</strong> {result.high_risk_flag ? 'Tinggi' : 'Tidak tinggi'}</p>
          <p><strong>Rekomendasi:</strong> {result.recommendation}</p>
        </section>
      )}
    </main>
  )
}

export default App
