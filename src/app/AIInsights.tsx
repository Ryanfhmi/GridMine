import { useState, useEffect } from 'react';
import { Wallet, ShieldCheck, AlertTriangle, Activity } from 'lucide-react';
import { motion } from 'motion/react';

// Tipe data untuk hasil fetch
interface ForecastData {
  predicted_kwh_per_month: number;
  predicted_cost_idr: number;
}

interface Anomaly {
  timestamp: string;
  power_watt: number;
  status: string;
}

export default function AIInsights() {
  const [isLoading, setIsLoading] = useState(true);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);

  useEffect(() => {
    const fetchAIData = async () => {
      try {
        // Melakukan fetch ke backend FastAPI secara paralel
        const [resForecast, resAnomaly] = await Promise.all([
          fetch('http://localhost:8000/forecast'),
          fetch('http://localhost:8000/anomaly')
        ]);

        const dataForecast = await resForecast.json();
        const dataAnomaly = await resAnomaly.json();

        setForecast(dataForecast);
        // Jika backend mengirimkan array kosong atau tidak ada key anomalies, fallback ke []
        setAnomalies(dataAnomaly.anomalies || []);
      } catch (error) {
        console.error("Gagal menarik data dari AI Backend:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAIData();
    
    // Opsional: refresh data setiap 5 menit
    const interval = setInterval(fetchAIData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-[#1a2942] to-[#0d1f35] p-6 rounded-2xl border border-cyan-500/20 shadow-xl flex items-center justify-center min-h-[150px]">
        <Activity className="w-6 h-6 text-cyan-400 animate-spin mr-3" />
        <span className="text-white/70">Menganalisis data AI...</span>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-[#1a2942] to-[#0d1f35] p-6 rounded-2xl border border-cyan-500/20 shadow-xl">
      <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-white">
        <Activity className="w-6 h-6 text-cyan-400" />
        AI Anomaly Log
        <span className="text-xs px-2 py-1 bg-white/10 rounded-full text-white/70">Real-time</span>
      </h3>

      <div className="space-y-4">
        {anomalies.length === 0 ? (
          <div className="text-center py-8 text-white/60">
            <ShieldCheck className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <div className="text-lg font-semibold text-green-400 mb-2">Sistem Aman</div>
            <div className="text-sm">Tidak ada lonjakan daya mencurigakan dalam 7 hari terakhir.</div>
          </div>
        ) : (
          anomalies.slice(-10).reverse().map((anomaly, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="flex items-center justify-between p-4 bg-[#0a1929]/50 rounded-xl border border-red-500/20"
            >
              <div className="flex items-center gap-4">
                <motion.div
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="p-2 bg-red-500/10 rounded-lg"
                >
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </motion.div>
                <div>
                  <div className="text-sm font-semibold text-white">Anomali Daya Terdeteksi</div>
                  <div className="text-xs text-white/60">
                    {new Date(anomaly.timestamp).toLocaleString('id-ID')}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-red-400">{anomaly.power_watt.toFixed(1)} W</div>
                <div className="text-xs text-white/60">{anomaly.status}</div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}