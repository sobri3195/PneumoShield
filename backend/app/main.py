from math import exp
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="PneumoShield API",
    description="Prediksi pneumonitis grade >=2 pasca radioterapi toraks pada pasien NSCLC.",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictionRequest(BaseModel):
    age: int = Field(..., ge=18, le=100, description="Usia pasien")
    smoking_pack_years: float = Field(..., ge=0, le=150)
    copd: bool = Field(False, description="Riwayat COPD")
    baseline_fev1: float = Field(..., ge=20, le=150, description="FEV1 baseline (% prediksi)")
    v20: float = Field(..., ge=0, le=100, description="Persentase volume paru menerima >=20 Gy")
    mld: float = Field(..., ge=0, le=40, description="Mean lung dose (Gy)")
    radiomics_score: float = Field(..., ge=-5, le=5, description="Skor fitur radiomics CT")
    stage: Literal["I", "II", "III", "IV"] = "III"


class PredictionResponse(BaseModel):
    model_name: str
    risk_ai_model: float
    risk_dvh_only: float
    delta_risk: float
    high_risk_flag: bool
    risk_category: Literal["Rendah", "Sedang", "Tinggi"]
    confidence_score: float
    key_drivers: list[str]
    follow_up_plan: list[str]
    recommendation: str


class SimulationRequest(BaseModel):
    base_case: PredictionRequest
    scenarios: list[PredictionRequest] = Field(..., min_length=1, max_length=5)


class SimulationItem(BaseModel):
    scenario_index: int
    label: str
    risk_ai_model: float
    delta_from_base: float
    risk_category: Literal["Rendah", "Sedang", "Tinggi"]


class SimulationResponse(BaseModel):
    base_risk_ai_model: float
    results: list[SimulationItem]


def sigmoid(x: float) -> float:
    return 1.0 / (1.0 + exp(-x))


def classify_risk(risk_ai: float) -> Literal["Rendah", "Sedang", "Tinggi"]:
    if risk_ai < 0.2:
        return "Rendah"
    if risk_ai < 0.35:
        return "Sedang"
    return "Tinggi"


def confidence_score(req: PredictionRequest) -> float:
    penalty = 0.0
    penalty += 0.05 if req.stage == "IV" else 0.0
    penalty += 0.04 if req.radiomics_score > 3 else 0.0
    penalty += 0.03 if req.v20 > 45 else 0.0
    penalty += 0.03 if req.mld > 25 else 0.0
    penalty += 0.03 if req.baseline_fev1 < 40 else 0.0
    return max(0.65, round(0.92 - penalty, 2))


def build_key_drivers(req: PredictionRequest, risk_ai: float) -> list[str]:
    drivers = []
    if req.v20 >= 30:
        drivers.append(f"V20 tinggi ({req.v20:.1f}%) meningkatkan risiko paru iradiasi.")
    if req.mld >= 18:
        drivers.append(f"MLD {req.mld:.1f} Gy berkontribusi pada kenaikan risiko pneumonitis.")
    if req.radiomics_score >= 1.2:
        drivers.append("Skor radiomics tinggi menandakan heterogenitas parenkim paru yang rentan.")
    if req.copd:
        drivers.append("Riwayat COPD menambah kerentanan inflamasi paru pasca RT.")
    if req.baseline_fev1 <= 70:
        drivers.append(f"FEV1 baseline {req.baseline_fev1:.1f}% menunjukkan cadangan fungsi paru terbatas.")

    if not drivers:
        drivers.append("Tidak ada pendorong risiko mayor; profil klinis relatif stabil.")

    if risk_ai >= 0.35:
        drivers.append("Nilai risiko total melewati ambang intervensi intensif (>=35%).")

    return drivers[:4]


def build_follow_up_plan(risk_category: str) -> list[str]:
    if risk_category == "Tinggi":
        return [
            "Kontrol klinis dan saturasi oksigen tiap 1-2 minggu selama 8 minggu pertama.",
            "Pertimbangkan CT thoraks evaluasi dini pada minggu ke-6 sampai ke-8.",
            "Diskusikan regimen suportif paru dan optimasi komorbid respirasi.",
        ]
    if risk_category == "Sedang":
        return [
            "Kontrol klinis tiap 2-3 minggu pada 2 bulan pertama.",
            "Edukasi gejala alarm: batuk progresif, sesak, demam.",
            "Pertimbangkan spirometri ulang bila gejala memburuk.",
        ]
    return [
        "Pemantauan standar sesuai jadwal onkologi radiasi.",
        "Edukasi gejala dini dan kapan harus kembali lebih cepat.",
        "Evaluasi ulang risiko saat ada perubahan klinis bermakna.",
    ]


def run_prediction(req: PredictionRequest) -> PredictionResponse:
    stage_weight = {"I": 0.1, "II": 0.25, "III": 0.45, "IV": 0.55}[req.stage]

    dvh_logit = -3.2 + 0.055 * req.v20 + 0.09 * req.mld
    ai_logit = (
        -3.8
        + 0.05 * req.v20
        + 0.08 * req.mld
        + 0.65 * req.radiomics_score
        + 0.012 * req.smoking_pack_years
        + (0.35 if req.copd else 0.0)
        - 0.01 * (req.baseline_fev1 - 80)
        + 0.006 * (req.age - 60)
        + stage_weight
    )

    risk_dvh = sigmoid(dvh_logit)
    risk_ai = sigmoid(ai_logit)
    delta = risk_ai - risk_dvh
    high_risk = risk_ai >= 0.35
    category = classify_risk(risk_ai)

    recommendation = (
        "Pertimbangkan optimasi ulang rencana RT, monitoring ketat, dan profilaksis suportif."
        if high_risk
        else "Lanjutkan rencana dengan pemantauan standar dan edukasi gejala dini."
    )

    return PredictionResponse(
        model_name="PneumoShield v0.2 (enhanced prototype)",
        risk_ai_model=round(risk_ai, 4),
        risk_dvh_only=round(risk_dvh, 4),
        delta_risk=round(delta, 4),
        high_risk_flag=high_risk,
        risk_category=category,
        confidence_score=confidence_score(req),
        key_drivers=build_key_drivers(req, risk_ai),
        follow_up_plan=build_follow_up_plan(category),
        recommendation=recommendation,
    )


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/predict", response_model=PredictionResponse)
def predict(req: PredictionRequest) -> PredictionResponse:
    return run_prediction(req)


@app.post("/simulate", response_model=SimulationResponse)
def simulate(req: SimulationRequest) -> SimulationResponse:
    base_result = run_prediction(req.base_case)
    scenarios = []

    for idx, scenario in enumerate(req.scenarios, start=1):
        scenario_result = run_prediction(scenario)
        scenarios.append(
            SimulationItem(
                scenario_index=idx,
                label=f"Skenario {idx}",
                risk_ai_model=scenario_result.risk_ai_model,
                delta_from_base=round(scenario_result.risk_ai_model - base_result.risk_ai_model, 4),
                risk_category=scenario_result.risk_category,
            )
        )

    return SimulationResponse(base_risk_ai_model=base_result.risk_ai_model, results=scenarios)
