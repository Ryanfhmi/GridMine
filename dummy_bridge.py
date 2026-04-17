import os
from dotenv import load_dotenv
import time
import random
from supabase import create_client

# Muat environment variables dari file .env
load_dotenv()

# Ambil variabel environment
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

# Inisialisasi koneksi ke Supabase
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Loop utama
while True:
    # Set stable voltage around 220-225V
    voltage = random.uniform(220.0, 225.0)
    
    # Base current around 15-20A
    current = random.uniform(15.0, 20.0)
    
    # 10% chance for power spike (+10A)
    is_spike = random.random() < 0.1
    if is_spike:
        current += 10.0
    
    # Calculate apparent_power = Voltage * Current
    apparent_power = voltage * current
    
    # Generate power_factor: 0.80-0.98, drop below 0.85 if spike
    if is_spike:
        power_factor = random.uniform(0.75, 0.84)
    else:
        power_factor = random.uniform(0.85, 0.98)
    
    # Calculate power (Actual W) = apparent_power * power_factor
    power = apparent_power * power_factor
    
    # Calculate mock z_score: normal 0.5-1.5, spike 2.6-3.5
    if is_spike:
        z_score = random.uniform(2.6, 3.5)
    else:
        z_score = random.uniform(0.5, 1.5)
    
    # status_ai = 'BOROS' if z_score > 2.5, else 'HEMAT'
    status_ai = 'BOROS' if z_score > 2.5 else 'HEMAT'
    
    # Data dict for Zona_1
    zona1_data = {
        "device": "Zona_1",      # UBAH MENJADI 'device'
        "voltage": round(voltage, 2),
        "current": round(current, 2),
        "power": round(power, 2),
        "apparent_power": round(apparent_power, 2),
        "power_factor": round(power_factor, 3),
        "z_score": round(z_score, 2),
        "status_ai": status_ai
    }
    
    # Insert ke Supabase
    supabase.table('iot_measurements').insert(zona1_data).execute()
    
    # Print pesan berhasil
    print(f"Data Zona_1 berhasil dikirim: Voltage={voltage:.2f}V, Current={current:.2f}A, Power={power:.2f}W, PF={power_factor:.3f}, Z-Score={z_score:.2f}, Status={status_ai}")
    
    # Tunggu 5 detik
    time.sleep(5)