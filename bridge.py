import os
from dotenv import load_dotenv
import time
from supabase import create_client
from tuya_iot import TuyaOpenAPI

# Muat environment variables dari file .env
load_dotenv()

# Ambil variabel environment
TUYA_CLIENT_ID = os.getenv('TUYA_CLIENT_ID')
TUYA_SECRET = os.getenv('TUYA_SECRET')
TUYA_DEVICE_ID_ZONA1 = os.getenv('TUYA_DEVICE_ID_ZONA1')
TUYA_DEVICE_ID_ZONA2 = os.getenv('TUYA_DEVICE_ID_ZONA2')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

# Inisialisasi koneksi ke Supabase
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Inisialisasi koneksi ke Tuya
tuya = TuyaOpenAPI(TUYA_CLIENT_ID, TUYA_SECRET, endpoint='https://openapi.tuyaus.com')
tuya.connect()

# Loop utama
while True:
    try:
        # Panggil API Tuya untuk status Zona 1
        response1 = tuya.get('/v1.0/iot-03/devices/{}/status'.format(TUYA_DEVICE_ID_ZONA1))
        status_list1 = response1['result']
        
        # Ekstrak nilai dari status list
        cur_power1 = next(item['value'] for item in status_list1 if item['code'] == 'cur_power')
        cur_current1 = next(item['value'] for item in status_list1 if item['code'] == 'cur_current')
        cur_voltage1 = next(item['value'] for item in status_list1 if item['code'] == 'cur_voltage')
        
        # Sesuaikan nilai (power dibagi 10, asumsikan current dan voltage juga perlu penyesuaian)
        power1 = cur_power1 / 10
        current1 = cur_current1 / 1000  # Asumsi dibagi 1000 untuk current
        voltage1 = cur_voltage1 / 10    # Asumsi dibagi 10 untuk voltage
        
        # Panggil API Tuya untuk status Zona 2
        response2 = tuya.get('/v1.0/iot-03/devices/{}/status'.format(TUYA_DEVICE_ID_ZONA2))
        status_list2 = response2['result']
        
        cur_power2 = next(item['value'] for item in status_list2 if item['code'] == 'cur_power')
        cur_current2 = next(item['value'] for item in status_list2 if item['code'] == 'cur_current')
        cur_voltage2 = next(item['value'] for item in status_list2 if item['code'] == 'cur_voltage')
        
        power2 = cur_power2 / 10
        current2 = cur_current2 / 1000
        voltage2 = cur_voltage2 / 10
        
        # Bentuk list dictionary
        data = [
            {"device_name": "Zona_1", "voltage": voltage1, "current": current1, "power": power1},
            {"device_name": "Zona_2", "voltage": voltage2, "current": current2, "power": power2}
        ]
        
        # Insert ke Supabase
        supabase.table('iot_measurements').insert(data).execute()
        
        # Print log
        print("Data berhasil dikirim ke Supabase")
        
    except Exception as e:
        print(f"Error: {e}")
    
    # Tunggu 5 detik
    time.sleep(5)