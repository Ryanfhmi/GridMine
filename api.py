from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from tuya_iot import TuyaOpenAPI
import os
from datetime import datetime, timedelta
import pandas as pd
from scipy.stats import zscore
from dotenv import load_dotenv

# Load environment variables dari .env
load_dotenv()

app = FastAPI()

# CORS middleware untuk React Vite di localhost:5173
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Supabase credentials dari environment variables
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
TUYA_CLIENT_ID = os.environ.get("TUYA_CLIENT_ID")
TUYA_SECRET = os.environ.get("TUYA_SECRET")
TUYA_ENDPOINT = os.environ.get("TUYA_ENDPOINT", "https://openapi.tuyaus.com")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL dan SUPABASE_KEY harus diset di environment variables")

if not TUYA_CLIENT_ID or not TUYA_SECRET:
    raise ValueError("TUYA_CLIENT_ID dan TUYA_SECRET harus diset di environment variables")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

tuya_api = TuyaOpenAPI(TUYA_ENDPOINT, TUYA_CLIENT_ID, TUYA_SECRET)
tuya_api.connect()

# Konstanta untuk perhitungan energi
INTERVAL_SECONDS = 5  # Interval pengukuran dalam detik
DAYS_PER_MONTH = 30
TARIF_PLN = 1444.70  # Tarif PLN per kWh

@app.get("/forecast")
async def get_energy_forecast():
    """
    Endpoint untuk memprediksi biaya listrik bulanan berdasarkan rata-rata konsumsi harian.
    """
    try:
        # UBAH 'timestamp' menjadi 'created_at' di sini
        response = supabase.table('iot_measurements').select('power, created_at').execute()
        data = response.data or []

        if not data:
            return {'predicted_monthly_idr': 0.0}

        df = pd.DataFrame(data)
        if df.empty or 'power' not in df.columns:
            return {'predicted_monthly_idr': 0.0}

        df['power'] = pd.to_numeric(df['power'], errors='coerce')
        df = df.dropna(subset=['power'])
        if df.empty:
            return {'predicted_monthly_idr': 0.0}

        df['daily_kwh'] = df['power'] / 1000 * 24
        avg_daily_kwh = df['daily_kwh'].mean()
        predicted_monthly_kwh = avg_daily_kwh * DAYS_PER_MONTH
        predicted_monthly_idr = predicted_monthly_kwh * TARIF_PLN

        return {
            'predicted_monthly_idr': round(predicted_monthly_idr, 2)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating forecast: {str(e)}")

@app.get("/anomaly")
async def detect_anomalies():
    """
    Endpoint untuk mendeteksi lonjakan daya menggunakan Z-Score pada data 7 hari terakhir.
    """
    try:
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        # UBAH SEMUA 'timestamp' menjadi 'created_at' di sini
        response = supabase.table('iot_measurements').select('power, created_at').gte('created_at', seven_days_ago.isoformat()).order('created_at', {'ascending': True}).execute()
        data = response.data or []

        if len(data) < 2:
            return {'status': 'HEMAT', 'message': 'Konsumsi stabil'}

        df = pd.DataFrame(data)
        if df.empty or 'power' not in df.columns:
            return {'status': 'HEMAT', 'message': 'Konsumsi stabil'}

        df['power'] = pd.to_numeric(df['power'], errors='coerce')
        df = df.dropna(subset=['power'])
        if len(df) < 2:
            return {'status': 'HEMAT', 'message': 'Konsumsi stabil'}

        z_scores = zscore(df['power'])
        latest_z = float(z_scores.iloc[-1] if hasattr(z_scores, 'iloc') else z_scores[-1])
        if pd.isna(latest_z):
            latest_z = 0.0

        if abs(latest_z) > 2.5:
            return {'status': 'BOROS', 'message': 'Lonjakan daya terdeteksi'}

        return {'status': 'HEMAT', 'message': 'Konsumsi stabil'}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error detecting anomalies: {str(e)}")
    
@app.post("/device/{device_id}/turn-off")
async def turn_off_device(device_id: str):
    """
    Endpoint untuk mematikan Tuya Smart Plug secara remote.
    """
    try:
        payload = {
            'commands': [
                {
                    'code': 'switch_1',
                    'value': False,
                }
            ]
        }
        result = tuya_api.post(f'/v1.0/iot-03/devices/{device_id}/commands', payload)

        if not result or result.get('success') is not True:
            detail = result.get('msg') if isinstance(result, dict) else 'Unknown Tuya response'
            raise HTTPException(status_code=500, detail=f'Failed to send turn-off command: {detail}')

        return {
            'status': 'success',
            'message': 'Turn-off command berhasil dikirim ke device',
            'device_id': device_id,
            'tuya_response': result,
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'Error mengirim command ke Tuya: {str(exc)}')

@app.get("/")
async def root():
    """
    Endpoint root untuk health check
    """
    return {"message": "GridMind IoT Analytics API", "status": "running"}