import os
from dotenv import load_dotenv
import time
import random
from supabase import create_client

# Muat environment variables dari file .env
load_dotenv()

# Ambil variabel environment (Hanya Supabase saja)
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

# Inisialisasi koneksi ke Supabase
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Fungsi cerdas penentu status (AI Logic)
def calculate_status_ai(power, power_factor):
    if power > 3520:
        return "OVERLOAD"
    elif 0 < power_factor < 0.85:
        return "BOROS"
    else:
        return "HEMAT"

print("Memulai simulasi data PINTAR untuk Zona_1 dan Zona_2...")
print("-" * 50)

# Loop utama
while True:
    try:
        # ==========================================
        # 1. GENERATE DATA ZONA 1 (Dinamis: Bisa Overload / Boros)
        # ==========================================
        voltage_1 = random.uniform(220.0, 225.0)
        
        # Skenario 1: 15% peluang terjadi lonjakan arus (Overload)
        if random.random() < 0.15:
            current_1 = random.uniform(16.5, 18.5) # Pasti > 3520W
            power_factor_1 = random.uniform(0.86, 0.95)
        
        # Skenario 2: 15% peluang efisiensi buruk (Boros)
        elif random.random() < 0.15:
            current_1 = random.uniform(10.0, 14.0)
            power_factor_1 = random.uniform(0.70, 0.84) # Pasti Boros
            
        # Skenario 3: Pemakaian Normal
        else:
            current_1 = random.uniform(10.0, 15.0)
            power_factor_1 = random.uniform(0.85, 0.95) # Hemat/Normal
            
        apparent_power_1 = voltage_1 * current_1
        power_1 = apparent_power_1 * power_factor_1
        status_ai_1 = calculate_status_ai(power_1, power_factor_1)
        
        zona1_data = {
            "device": "Zona_1",
            "voltage": round(voltage_1, 2),
            "current": round(current_1, 2),
            "power": round(power_1, 2),
            "apparent_power": round(apparent_power_1, 2),
            "power_factor": round(power_factor_1, 3),
            "z_score": 0.0,
            "status_ai": status_ai_1
        }

        # ==========================================
        # 2. GENERATE DATA ZONA 2 (Beban Stabil & Selalu Efisien)
        # ==========================================
        voltage_2 = random.uniform(220.0, 225.0)
        current_2 = random.uniform(2.0, 5.0) # Arus kecil, max ~1100W
        power_factor_2 = random.uniform(0.92, 0.99) # Selalu efisien
            
        apparent_power_2 = voltage_2 * current_2
        power_2 = apparent_power_2 * power_factor_2
        status_ai_2 = calculate_status_ai(power_2, power_factor_2)
        
        zona2_data = {
            "device": "Zona_2",
            "voltage": round(voltage_2, 2),
            "current": round(current_2, 2),
            "power": round(power_2, 2),
            "apparent_power": round(apparent_power_2, 2),
            "power_factor": round(power_factor_2, 3),
            "z_score": 0.0,
            "status_ai": status_ai_2
        }

        # ==========================================
        # 3. INSERT KE SUPABASE (DENGAN JEDA MIKRO 0.5s)
        # ==========================================
        supabase.table('iot_measurements').insert(zona1_data).execute()
        time.sleep(0.5) # Jeda wajib agar React merender dengan benar
        supabase.table('iot_measurements').insert(zona2_data).execute()
        
        # Cetak log elegan di terminal
        print(f"Z1: {power_1:7.1f}W | PF: {power_factor_1:.2f} [{status_ai_1}]  ||  Z2: {power_2:7.1f}W | PF: {power_factor_2:.2f} [{status_ai_2}]")
        
    except Exception as e:
        print(f"Error saat mengirim data: {e}")
        
    # Update setiap 3 detik agar grafik bergerak lincah saat presentasi
    time.sleep(3)