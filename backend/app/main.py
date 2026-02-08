from math import exp
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="PneumoShield API",
    description="Prediksi pneumonitis grade >=2 pasca radioterapi toraks pada pasien NSCLC.",
    version="0.1.0",
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
    recommendation: str


def sigmoid(x: float) -> float:
    return 1.0 / (1.0 + exp(-x))


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/predict", response_model=PredictionResponse)
def predict(req: PredictionRequest) -> PredictionResponse:
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
    recommendation = (
        "Pertimbangkan optimasi ulang rencana RT, monitoring ketat, dan profilaksis suportif."
        if high_risk
        else "Lanjutkan rencana dengan pemantauan standar dan edukasi gejala dini."
    )

    return PredictionResponse(
        model_name="PneumoShield v0.1 (development prototype)",
        risk_ai_model=round(risk_ai, 4),
        risk_dvh_only=round(risk_dvh, 4),
        delta_risk=round(delta, 4),
        high_risk_flag=high_risk,
        recommendation=recommendation,
    )
