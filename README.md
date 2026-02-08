# PneumoShield

**Judul:** *PneumoShield: Model AI Radiomics CT dan Parameter DVH untuk Prediksi Pneumonitis Pasca RT Toraks*  
**Author:** dr. Muhammad Sobri Maulana

## Ringkasan Studi (PICO)
- **P (Population):** Pasien NSCLC yang menjalani radioterapi (RT) toraks.
- **I (Intervention):** Model AI berbasis radiomics CT + parameter DVH (V20, MLD) + faktor klinis.
- **C (Comparator):** Pendekatan konvensional berbasis constraint DVH (V20/MLD saja).
- **O (Outcomes):**
  - Primer: Pneumonitis grade ≥2.
  - Sekunder: AUC/kalibrasi model, hospitalisasi, dan perubahan rencana terapi.

**Desain:** Pengembangan model + validasi eksternal.

---

## Struktur Proyek
```text
PneumoShield/
├── backend/
│   ├── app/main.py
│   └── requirements.txt
├── frontend/
│   ├── src/App.jsx
│   ├── src/main.jsx
│   ├── src/styles.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## Backend (Python + FastAPI)
API menyediakan endpoint:
- `GET /health` → cek status layanan.
- `POST /predict` → prediksi risiko pneumonitis grade ≥2.

Fitur model prototype:
- **AI model**: menggabungkan `radiomics_score`, `V20`, `MLD`, dan variabel klinis.
- **DVH-only model**: baseline konvensional dari `V20` + `MLD`.
- Output meliputi perbandingan risiko dan rekomendasi klinis awal.

### Menjalankan Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Frontend (React + Vite)
Frontend menyediakan form input klinis/DVH/radiomics dan menampilkan:
- Risiko model AI.
- Risiko model DVH konvensional.
- Delta risiko.
- Status high-risk dan rekomendasi.

### Menjalankan Frontend
```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Akses aplikasi di `http://localhost:5173`.

## Contoh Payload API
```json
{
  "age": 62,
  "smoking_pack_years": 30,
  "copd": false,
  "baseline_fev1": 78,
  "v20": 28,
  "mld": 16,
  "radiomics_score": 0.9,
  "stage": "III"
}
```

## Catatan
- Implementasi ini adalah **prototype riset** dan bukan keputusan klinis final.
- Untuk penggunaan klinis, diperlukan data multicenter, validasi prospektif, dan audit bias model.
