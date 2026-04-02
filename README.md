# PneumoShield

> **PneumoShield** adalah prototipe aplikasi prediksi risiko **pneumonitis grade ≥2** pasca radioterapi toraks pada pasien **NSCLC**, menggabungkan pendekatan **AI (Radiomics + klinis + DVH)** dan baseline **DVH-only**.

![Status](https://img.shields.io/badge/status-prototype-orange) ![Backend](https://img.shields.io/badge/backend-FastAPI-009688) ![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite-61DAFB) ![License](https://img.shields.io/badge/license-Research-informational)

---

## 📌 Ringkasan

Aplikasi ini terdiri dari:
- **Backend FastAPI** untuk scoring risiko dan simulasi skenario.
- **Frontend React** untuk input parameter klinis, visualisasi hasil prediksi, serta simulasi perubahan parameter.

Model menghasilkan:
- Risiko dari **AI model** (`risk_ai_model`).
- Risiko dari **DVH-only model** (`risk_dvh_only`).
- Selisih keduanya (`delta_risk`) untuk membantu interpretasi dampak fitur klinis/radiomics.

> ⚠️ **Catatan penting:** ini adalah **prototype riset/edukasi**, bukan perangkat keputusan klinis final.

---

## 🧠 Analisis Codebase (Detail & Mendalam)

## 1) Arsitektur Proyek

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

### Alur data end-to-end
1. User mengisi form di frontend.
2. Frontend mengirim payload JSON ke endpoint backend (`/predict` atau `/simulate`).
3. Backend memvalidasi input via Pydantic, menghitung skor risiko, lalu mengembalikan JSON terstruktur.
4. Frontend menampilkan hasil prediksi, faktor pendorong, rencana follow-up, dan tabel skenario.

---

## 2) Backend: FastAPI + Pydantic

File utama: `backend/app/main.py`

### a. Validasi input yang ketat
Backend mendefinisikan `PredictionRequest` dengan batasan numerik (`ge`, `le`) dan pilihan stadium (`Literal["I", "II", "III", "IV"]`).
Ini memastikan input berada pada rentang realistis sebelum diproses model.

### b. Endpoint API
- `GET /health`: health check sederhana (`{"status":"ok"}`).
- `POST /predict`: prediksi satu kasus.
- `POST /simulate`: simulasi beberapa skenario (maks. 5) dibandingkan baseline.

### c. Inti logika model
Model menggunakan pendekatan **logit + sigmoid**:
- `dvh_logit`: berbasis `v20` dan `mld`.
- `ai_logit`: menambahkan `radiomics_score`, `smoking_pack_years`, `copd`, `baseline_fev1`, `age`, dan `stage`.

Risiko akhir:
- `risk_dvh = sigmoid(dvh_logit)`
- `risk_ai = sigmoid(ai_logit)`
- `delta = risk_ai - risk_dvh`

### d. Stratifikasi dan interpretabilitas
- `classify_risk()` memetakan skor ke kategori: **Rendah/Sedang/Tinggi**.
- `build_key_drivers()` menghasilkan penjelasan faktor yang paling berkontribusi.
- `build_follow_up_plan()` memberi rencana monitoring sesuai level risiko.
- `confidence_score()` memberi skor kepercayaan sederhana berbasis penalty rule.

### e. Simulasi klinis cepat
Endpoint `/simulate` menjalankan prediksi untuk baseline + skenario, lalu menghitung:
- `risk_ai_model` per skenario,
- `delta_from_base`,
- `risk_category`.

Ini berguna untuk *what-if analysis* saat mempertimbangkan optimasi rencana RT.

---

## 3) Frontend: React + Vite

File utama: `frontend/src/App.jsx`

### a. Fitur utama UI
- Form input parameter klinis/DVH/radiomics.
- Validasi rentang nilai sisi klien (`validationWarnings`).
- Tombol aksi:
  - **Muat input terakhir** dari `localStorage`.
  - **Simulasi 3 skenario** otomatis.
  - **Ekspor hasil JSON**.
- Panel hasil prediksi dan simulasi.
- Navigasi bawah untuk mobile (`Input`, `Prediksi`, `Simulasi`).

### b. Integrasi API
Frontend memanggil:
- `POST /predict` untuk prediksi utama.
- `POST /simulate` untuk pembandingan skenario.

Error handling ditampilkan langsung ke user (`setError`).

### c. UX dan visual
File `frontend/src/styles.css` memberikan:
- layout responsif,
- card hasil,
- progress/risk bar,
- warning dan empty-state,
- mobile bottom navigation.

---

## ⚙️ Fitur & Fungsi Utama

- ✅ Prediksi risiko pneumonitis grade ≥2 berbasis AI.
- ✅ Perbandingan dengan model DVH-only.
- ✅ Delta risiko untuk menilai tambahan nilai AI.
- ✅ Kategori risiko (Rendah/Sedang/Tinggi).
- ✅ Faktor pendorong utama (explainability sederhana).
- ✅ Rencana follow-up berdasarkan stratifikasi risiko.
- ✅ Simulasi multi-skenario (what-if).
- ✅ Penyimpanan input terakhir di browser.
- ✅ Ekspor laporan JSON.
- ✅ UI responsif desktop/mobile.

---

## 🔌 Spesifikasi API

### 1) `GET /health`
Cek status API.

**Response:**
```json
{ "status": "ok" }
```

### 2) `POST /predict`
Prediksi satu kasus.

**Request body (contoh):**
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

**Response ringkas (contoh):**
```json
{
  "model_name": "PneumoShield v0.2 (enhanced prototype)",
  "risk_ai_model": 0.31,
  "risk_dvh_only": 0.25,
  "delta_risk": 0.06,
  "high_risk_flag": false,
  "risk_category": "Sedang",
  "confidence_score": 0.89,
  "key_drivers": ["..."],
  "follow_up_plan": ["..."],
  "recommendation": "..."
}
```

### 3) `POST /simulate`
Membandingkan baseline terhadap beberapa skenario.

**Request body (struktur):**
```json
{
  "base_case": { "...": "same as predict payload" },
  "scenarios": [
    { "...": "scenario 1" },
    { "...": "scenario 2" }
  ]
}
```

---

## 🚀 Cara Menjalankan Proyek

## Prasyarat
- Python 3.10+
- Node.js 18+
- npm

### A. Jalankan Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Backend aktif di: `http://127.0.0.1:8000`

### B. Jalankan Frontend
```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Frontend aktif di: `http://localhost:5173`

---

## 🧪 Saran Pengembangan Lanjutan

- Integrasi database untuk audit trail prediksi.
- Logging observability (request/latency/error metrics).
- Unit test dan integration test (backend + frontend).
- Kalibrasi model dan validasi eksternal multicenter.
- Role-based access & autentikasi untuk deployment klinis.
- Export PDF laporan klinis terstruktur.

---

## 👤 Author

**Lettu Kes dr. Muhammad Sobri Maulana, S.Kom, CEH, OSCP, OSCE**

- GitHub: https://github.com/sobri3195
- Email: muhammadsobrimaulana31@gmail.com
- Website: https://muhammadsobrimaulana.netlify.app

### Social & Community
- YouTube: https://www.youtube.com/@muhammadsobrimaulana6013
- Telegram: https://t.me/winlin_exploit
- TikTok: https://www.tiktok.com/@dr.sobri
- Grup WhatsApp: https://chat.whatsapp.com/B8nwRZOBMo64GjTwdXV8Bl

### Support & Donation
- Lynk.id: https://lynk.id/muhsobrimaulana
- Trakteer: https://trakteer.id/g9mkave5gauns962u07t
- Gumroad: https://maulanasobri.gumroad.com/
- KaryaKarsa: https://karyakarsa.com/muhammadsobrimaulana
- Nyawer: https://nyawer.co/MuhammadSobriMaulana
- Sevalla Page: https://muhammad-sobri-maulana-kvr6a.sevalla.page/
- Toko Online Sobri: https://pegasus-shop.netlify.app

---

## ⚠️ Disclaimer

Konten dan model dalam repositori ini disediakan untuk tujuan edukasi, penelitian, dan eksplorasi teknis.
Bukan pengganti pertimbangan klinis profesional, pedoman institusi, atau keputusan medis berbasis evaluasi dokter yang berwenang.
