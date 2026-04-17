import os
import time
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client
from tuya_iot import TuyaOpenAPI

# Load environment variables from .env
load_dotenv()

TUYA_CLIENT_ID = os.getenv('TUYA_CLIENT_ID')
TUYA_SECRET = os.getenv('TUYA_SECRET')
TUYA_DEVICE_ID = os.getenv('TUYA_DEVICE_ID')
TUYA_ENDPOINT = os.getenv('TUYA_ENDPOINT', 'https://openapi.tuyaus.com')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
IOT_ZONE = os.getenv('IOT_ZONE', 'Zona_1')
SLEEP_SECONDS = int(os.getenv('TUYA_POLL_INTERVAL', '60'))

if not TUYA_CLIENT_ID or not TUYA_SECRET or not TUYA_DEVICE_ID:
    raise ValueError('TUYA_CLIENT_ID, TUYA_SECRET, dan TUYA_DEVICE_ID harus diset di file .env')

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError('SUPABASE_URL dan SUPABASE_KEY harus diset di file .env')

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

tuya = TuyaOpenAPI(TUYA_CLIENT_ID, TUYA_SECRET, endpoint=TUYA_ENDPOINT)
tuya.connect()


def get_tuya_metering(device_id: str) -> dict:
    response = tuya.get(f'/v1.0/iot-03/devices/{device_id}/status')
    if not response or 'result' not in response:
        raise RuntimeError('Response Tuya tidak valid: {}'.format(response))

    status_list = response['result']
    raw = {
        'cur_voltage': None,
        'cur_current': None,
        'cur_power': None,
    }

    for item in status_list:
        code = item.get('code')
        value = item.get('value')
        if code in raw:
            raw[code] = float(value)

    if raw['cur_voltage'] is None or raw['cur_current'] is None or raw['cur_power'] is None:
        raise RuntimeError(f'Nilai sensor tidak lengkap: {raw}')

    return raw


def build_measurement_payload(device_id: str, zone: str, raw: dict) -> dict:
    voltage = raw['cur_voltage'] / 10.0
    current = raw['cur_current'] / 1000.0
    power = raw['cur_power'] / 10.0
    apparent_power = voltage * current
    power_factor = 1.0 if apparent_power == 0 else power / apparent_power
    z_score = 3.0 if current > 25.0 else 1.0
    status_ai = 'BOROS' if z_score > 2.5 else 'HEMAT'

    return {
        'device': device_id,
        'voltage': round(voltage, 2),
        'current': round(current, 3),
        'power': round(power, 2),
        'apparent_power': round(apparent_power, 2),
        'power_factor': round(power_factor, 3),
        'z_score': round(z_score, 2),
        'status_ai': status_ai,
        'created_at': datetime.utcnow().isoformat(),
    }


def insert_measurement(payload: dict):
    result = supabase.table('iot_measurements').insert(payload).execute()
    if result.error:
        raise RuntimeError(f'Supabase insert error: {result.error}')
    return result


if __name__ == '__main__':
    print(f'Mulai loop Tuya -> Supabase setiap {SLEEP_SECONDS} detik')
    while True:
        try:
            raw_measurement = get_tuya_metering(TUYA_DEVICE_ID)
            payload = build_measurement_payload(TUYA_DEVICE_ID, IOT_ZONE, raw_measurement)
            payload['device'] = IOT_ZONE

            insert_measurement(payload)
            print(f"[{datetime.utcnow().isoformat()}] Inserted: {payload}")

        except KeyboardInterrupt:
            print('Dihentikan oleh pengguna.')
            break
        except Exception as exc:
            print(f'Error saat mengambil atau mengirim data: {exc}')

        time.sleep(SLEEP_SECONDS)
