import { useState, useEffect, useMemo, FormEvent } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Zap, AlertTriangle, LayoutDashboard, BarChart3, Server, Settings, RefreshCw, DollarSign, Activity, ShieldCheck, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useIoTData, useIoTDataForZones } from '../lib/useIoTData';
import { calculateElectricityCost } from '../lib/calculateElectricityCost';
import AIInsights from './AIInsights';

// Define types
interface SupabaseDeviceRow {
  id: number;
  name: string;
  count: number;
  power_per_unit: number;
  zone: string;
}

interface IoTData {
  id: number;
  created_at: string;
  device: string;
  voltage: number;
  current: number;
  power: number;
  apparent_power: number;
  power_factor: number;
  z_score: number;
  status_ai: string;
}

interface EnergyDataPoint {
  time: string;
  power: number;
  apparent_power: number;
}

// Calculate energy forecast based on device counts
const calculateEnergyForecast = (acCount: number, computerCount: number, serverCount: number) => {
  const baseData = [
    { time: '08:00', hour: 8 },
    { time: '10:00', hour: 10 },
    { time: '12:00', hour: 12 },
    { time: '14:00', hour: 14 },
    { time: '16:00', hour: 16 },
    { time: '18:00', hour: 18 },
    { time: '20:00', hour: 20 },
  ];

  return baseData.map(({ time, hour }) => {
    // Zone 1 (HVAC): AC usage increases with heat
    const tempFactor = hour >= 12 && hour <= 16 ? 1.4 : 1.0;
    const zone1 = acCount * 2.5 * tempFactor;

    // Zone 2 (Lighting/Computers): steady during work hours
    const workFactor = hour >= 8 && hour <= 18 ? 1.2 : 0.6;
    const zone2 = computerCount * 0.3 * workFactor;

    // Zone 3 (Servers): constant load
    const zone3 = serverCount * 8;

    return {
      time,
      zone1: Math.round(zone1),
      zone2: Math.round(zone2),
      zone3: Math.round(zone3),
      total: Math.round(zone1 + zone2 + zone3),
    };
  });
};

export default function App() {
  const [activeMenu, setActiveMenu] = useState('Dashboard');
  const [devices, setDevices] = useState<SupabaseDeviceRow[]>([]);
  const [updateMessage, setUpdateMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState('Zone 1');
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDevicePower, setNewDevicePower] = useState(2.5);
  const zoneOptions = ['Zone 1', 'Zone 2', 'Zone 3'];

  // Gunakan satu hook untuk mengambil data kedua zona sekaligus
  const { data: iotData, loading: loadingData, error: dataError } = useIoTDataForZones(['Zona_1', 'Zona_2']);
  const zona1Data = iotData.filter((item) => item.device === 'Zona_1');
  const zona2Data = iotData.filter((item) => item.device === 'Zona_2');

  // 1. Gabungkan data Zona 1 dan Zona 2 menjadi satu array berdasarkan Waktu (Jam:Menit:Detik)
  const combinedEnergyData = useMemo(() => {
    const dataMap: Record<string, any> = {};

    zona1Data.forEach((item) => {
      const timeStr = new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      if (!dataMap[timeStr]) dataMap[timeStr] = { time: timeStr };
      dataMap[timeStr].power1 = item.power;
      dataMap[timeStr].apparent1 = item.apparent_power;
    });

    zona2Data.forEach((item) => {
      const timeStr = new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      if (!dataMap[timeStr]) dataMap[timeStr] = { time: timeStr };
      dataMap[timeStr].power2 = item.power;
      dataMap[timeStr].apparent2 = item.apparent_power;
    });

    return Object.values(dataMap)
      .sort((a: any, b: any) => a.time.localeCompare(b.time))
      .slice(-50);
  }, [zona1Data, zona2Data]);

  // New real-time calculated metrics
  const latestZona1 = useMemo(() => {
    const result = zona1Data.length > 0 ? zona1Data[zona1Data.length - 1] : {
      power: 0,
      power_factor: 0,
      status_ai: 'N/A',
      voltage: 0,
      current: 0,
      apparent_power: 0,
      z_score: 0
    };
    console.log('latestZona1:', result);
    return result;
  }, [zona1Data]);

  const latestZona2 = useMemo(() => {
    const result = zona2Data.length > 0 ? zona2Data[zona2Data.length - 1] : {
      power: 0,
      power_factor: 0,
      status_ai: 'N/A',
      voltage: 0,
      current: 0,
      apparent_power: 0,
      z_score: 0
    };
    console.log('latestZona2:', result);
    return result;
  }, [zona2Data]);

  const totalPower = useMemo(() => {
    return latestZona1.power + latestZona2.power;
  }, [latestZona1.power, latestZona2.power]);

  const estimatedMonthlyCost = useMemo(() => {
    const totalKw = totalPower / 1000;
    const dailyCost = totalKw * 24 * 1500; // 24 hours * 1500 IDR/kWh
    const monthlyCost = dailyCost * 30; // 30 days
    return `Rp ${Math.floor(monthlyCost).toLocaleString('id-ID')}`;
  }, [totalPower]);

  const avgPowerFactor = useMemo(() => {
    return (latestZona1.power_factor + latestZona2.power_factor) / 2;
  }, [latestZona1.power_factor, latestZona2.power_factor]);

  const systemStatus = useMemo(() => {
    if (latestZona1.status_ai === 'OVERLOAD' || latestZona2.status_ai === 'OVERLOAD') {
      return 'CRITICAL';
    } else if (latestZona1.status_ai === 'BOROS' || latestZona2.status_ai === 'BOROS') {
      return 'WARNING';
    } else {
      return 'HEALTHY';
    }
  }, [latestZona1.status_ai, latestZona2.status_ai]);

  const latestZona1Data = zona1Data[zona1Data.length - 1] ?? null;
  const latestPowerFactor = latestZona1Data?.power_factor ?? 0;
  const latestZScore = latestZona1Data?.z_score ?? 0;
  const latestStatusAI = latestZona1Data?.status_ai ?? 'N/A';
  const latestPower = latestZona1Data?.power ?? 0;
  const latestApparentPower = latestZona1Data?.apparent_power ?? 0;
  const latestEfficiencyRatio = latestApparentPower > 0 ? latestPower / latestApparentPower : 0;
  const latestPowerFactorTextClass = latestPowerFactor >= 0.85 ? 'text-emerald-400' : 'text-amber-400';
  const latestStatusTextClass = latestStatusAI === 'HEMAT' ? 'text-emerald-400' : latestStatusAI === 'BOROS' ? 'text-red-400' : 'text-white/70';

  // Capacity calculation
  const MAX_CAPACITY_WATT = 3520;
  const currentPower = latestZona1Data?.power || 0;
  const capacityPercentage = Math.min((currentPower / MAX_CAPACITY_WATT) * 100, 100);

  const fetchDevices = async () => {
    const { data, error } = await supabase
      .from('devices')
      .select('id,name,count,power_per_unit,zone')
      .order('zone', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Failed to load devices from Supabase:', error);
      return [] as SupabaseDeviceRow[];
    }

    return data ?? [];
  };

  useEffect(() => {
    const loadAppData = async () => {
      setIsLoading(true);

      const devicesData = await fetchDevices();

      setDevices(devicesData);
      setIsLoading(false);
    };

    loadAppData();
  }, []);

  const handleDeviceCountChange = async (deviceId: number, value: number) => {
    const newCount = Number(value);

    try {
      const { data, error } = await supabase
        .from('devices')
        .update({ count: newCount })
        .eq('id', deviceId)
        .select('id,name,count,power_per_unit,zone')
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        setDevices((prev) => prev.map((device) =>
          device.id === deviceId ? data : device
        ));
      }
    } catch (error) {
      console.error('Failed to update device count in Supabase:', error);
    }
  };

  const addDevice = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!newDeviceName.trim()) return;

    const newCount = parseInt('1', 10);
    const newPower = parseFloat(String(newDevicePower));
    console.log('Supabase insert payload:', {
      name: newDeviceName,
      count: newCount,
      power_per_unit: newPower,
      zone: selectedZone,
    });

    try {
      const { data, error } = await supabase
        .from('devices')
        .insert([
          {
            name: newDeviceName,
            count: newCount,
            power_per_unit: newPower,
            zone: selectedZone,
          },
        ])
        .select('id,name,count,power_per_unit,zone')
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        setNewDeviceName('');
        setNewDevicePower(2.5);
        const refreshedDevices = await fetchDevices();
        setDevices(refreshedDevices);
      }
    } catch (caughtError) {
      const err = caughtError as any;
      console.error('Detail Error:', {
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
        status: err?.status,
        error: err?.error,
      });
      console.error('Failed to add device to Supabase:', err);
    }
  };

  const removeDevice = async (id: number) => {
    try {
      const { error } = await supabase
        .from('devices')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      setDevices((prev) => prev.filter((device) => device.id !== id));
    } catch (error) {
      console.error('Failed to remove device from Supabase:', error);
    }
  };

  const groupedDevicesByZone = useMemo(() => {
    return zoneOptions.reduce((acc, zone) => {
      acc[zone] = devices.filter((device) => device.zone === zone);
      return acc;
    }, {} as Record<string, SupabaseDeviceRow[]>);
  }, [devices]);

  const getZoneStats = (zone: string) => {
    const devicesInZone = groupedDevicesByZone[zone] ?? [];
    const totalDevices = devicesInZone.reduce((sum, device) => sum + device.count, 0);
    const totalPower = devicesInZone.reduce((sum, device) => sum + device.count * device.power_per_unit, 0);
    const deviceNames = devicesInZone.map((device) => device.name);
    return { totalDevices, totalPower, deviceNames };
  };

  // Calculate dynamic max capacity based on all devices in Supabase
  const dynamicMaxCapacity = useMemo(() => {
    return devices.reduce((sum, device) => {
      return sum + device.count * device.power_per_unit;
    }, 0);
  }, [devices]);

  const maxCapacityWatts = dynamicMaxCapacity * 1000;

  // 2. Perbaiki peakData agar mengambil data langsung dari zona1Data (mencegah error merah)
  const peakData = zona1Data.length > 0 ? zona1Data.reduce((max: any, current: any) =>
    ((current.power || 0) + (current.apparent_power || 0)) > ((max.power || 0) + (max.apparent_power || 0)) ? current : max
  , zona1Data[0]) : { power: 0, apparent_power: 0 };

  const latestEfficiencyPercentage = latestEfficiencyRatio > 0 ? `${(latestEfficiencyRatio * 100).toFixed(1)}%` : 'N/A';
  const systemLoad = maxCapacityWatts > 0 ? (((peakData.power + peakData.apparent_power) / maxCapacityWatts) * 100).toFixed(1) : '0.0';

  if (isLoading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a1929] text-white">
        <div className="text-xl font-semibold">Loading data...</div>
      </div>
    );
  }

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard },
    { name: 'Zone Analytics', icon: BarChart3 },
    { name: 'Asset & Device Manager', icon: Server },
    { name: 'Settings', icon: Settings },
  ];

  const handleUpdateCapacity = async () => {
    // Data sekarang real-time dari IoT, tidak perlu update manual
    setUpdateMessage('✓ Data IoT real-time aktif');
    setTimeout(() => setUpdateMessage(''), 3000);
  };

  return (
    <div className="min-h-screen bg-[#0a1929] text-white flex">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0d1f35] border-r border-cyan-500/10 p-6 flex flex-col">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-[#00ff88] rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Zap className="w-7 h-7 text-[#0a1929]" />
          </div>
          <div>
            <h1 className="text-xl font-bold">GridMind</h1>
            <p className="text-xs text-cyan-400">Energy AI</p>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-2 flex-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.name}
                onClick={() => setActiveMenu(item.name)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  activeMenu === item.name
                    ? 'bg-gradient-to-r from-cyan-500 to-[#00ff88] text-[#0a1929] font-semibold shadow-lg shadow-cyan-500/30'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm">{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* System Status */}
        <div className="mt-auto pt-6 border-t border-white/10">
          <div className="text-xs text-white/60 mb-3 uppercase tracking-wider">System Status</div>
          <div className="flex items-center gap-2 text-sm">
            <motion.div
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-2 h-2 bg-cyan-400 rounded-full"
            />
            <span className="text-white/80 text-xs">All Systems Online</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`${activeMenu === 'Dashboard' ? 'flex-1' : 'flex-1'} p-8 overflow-auto bg-gradient-to-br from-[#0a1929] to-[#0d1f35]`}>
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">{activeMenu}</h2>
          <p className="text-sm text-white/60">AI-Powered Energy Management & Predictive Analytics</p>
        </div>

        {/* Zone Analytics View */}
        {activeMenu === 'Zone Analytics' && (
          <div className="space-y-6">
            {/* Zone Cards */}
            <div className="grid grid-cols-3 gap-6">
              {zoneOptions.map((zone, index) => {
                const stats = getZoneStats(zone);
                const zoneColor = zone === 'Zone 1' ? 'cyan' : zone === 'Zone 2' ? 'green' : 'purple';

                return (
                  <motion.div
                    key={zone}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    className="bg-gradient-to-br from-[#1a2942] to-[#0d1f35] p-6 rounded-2xl border border-white/10 shadow-xl"
                  >
                    <h3 className="text-lg font-semibold mb-4">{zone}</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-white/60">Total Devices</span>
                        <span className="text-xl font-bold">{stats.totalDevices}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-white/60">Total Power</span>
                        <span className="text-xl font-bold text-cyan-400">{stats.totalPower.toFixed(1)} kW</span>
                      </div>
                      <div className="mt-4 pt-4 border-t border-white/10">
                        <div className="text-xs text-white/60 mb-2">Devices in Zone</div>
                        <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, stats.totalDevices * 10)}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={`h-full bg-gradient-to-r ${
                              zoneColor === 'cyan' ? 'from-cyan-500 to-cyan-400' :
                              zoneColor === 'green' ? 'from-green-500 to-green-400' :
                              'from-purple-500 to-purple-400'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="bg-gradient-to-br from-[#1a2942] to-[#0d1f35] p-6 rounded-2xl border border-white/10 shadow-xl">
              <h3 className="text-xl font-semibold mb-6">All Devices by Zone</h3>
              <div className="space-y-6">
                {zoneOptions.map((zone) => {
                  const devicesInZone = groupedDevicesByZone[zone] ?? [];
                  return (
                    <div key={zone}>
                      <h4 className="text-lg font-semibold mb-3 text-cyan-400">{zone}</h4>
                      <div className="grid gap-3">
                        {devicesInZone.length === 0 ? (
                          <div className="text-sm text-white/60">No devices in this zone.</div>
                        ) : (
                          devicesInZone.map((device) => (
                            <div
                              key={device.id}
                              className="flex items-center justify-between p-4 bg-[#0d1f35] rounded-xl border border-white/10"
                            >
                              <div>
                                <div className="font-semibold">{device.name}</div>
                                <div className="text-xs text-white/60">Count: {device.count} • {device.power_per_unit} kW/unit</div>
                              </div>
                              <div className="text-xs text-white/60">ID: {device.id}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Asset & Device Manager View */}
        {activeMenu === 'Asset & Device Manager' && (
          <div className="space-y-6">
            {/* Add Device Form */}
            <div className="bg-gradient-to-br from-[#1a2942] to-[#0d1f35] p-6 rounded-2xl border border-[#00ff88]/20 shadow-xl">
              <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <Server className="w-5 h-5 text-[#00ff88]" />
                Add New Device
              </h3>
              <form onSubmit={addDevice} className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm text-white/70 mb-2">Device Name</label>
                  <input
                    type="text"
                    value={newDeviceName}
                    onChange={(e) => setNewDeviceName(e.target.value)}
                    placeholder="e.g. AC Unit 2A"
                    className="w-full bg-[#0d1f35] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-2">Select Zone</label>
                  <select
                    value={selectedZone}
                    onChange={(e) => setSelectedZone(e.target.value)}
                    className="w-full bg-[#0d1f35] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-400"
                  >
                    {zoneOptions.map((zone) => (
                      <option key={zone} value={zone}>{zone}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-2">Power per Unit (kW)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newDevicePower}
                    onChange={(e) => setNewDevicePower(Number(e.target.value))}
                    className="w-full bg-[#0d1f35] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div className="flex items-end">
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full bg-gradient-to-r from-cyan-500 to-[#00ff88] text-[#0a1929] font-bold py-2 px-6 rounded-lg shadow-lg shadow-cyan-500/30"
                  >
                    Add Device
                  </motion.button>
                </div>
              </form>
            </div>

            {/* Device List */}
            <div className="bg-gradient-to-br from-[#1a2942] to-[#0d1f35] p-6 rounded-2xl border border-white/10 shadow-xl">
              <h3 className="text-xl font-semibold mb-6">All Devices</h3>
              <div className="space-y-3">
                {devices.map((device) => (
                  <motion.div
                    key={device.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between p-4 bg-[#0d1f35] rounded-xl border border-white/10 hover:border-cyan-500/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-3 h-3 rounded-full bg-cyan-400" />
                      <div>
                        <div className="font-semibold text-lg">{device.name}</div>
                        <div className="text-sm text-white/60">
                          {device.zone} • Count: {device.count} • {device.power_per_unit} kW/unit
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => removeDevice(device.id)}
                        className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg font-semibold hover:bg-red-500/30 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </motion.div>
                ))}
                {devices.length === 0 && (
                  <div className="text-center py-8 text-white/60">
                    No devices yet. Add a device to get started.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Dashboard View */}
        {activeMenu === 'Dashboard' && (
          <div>

        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={`bg-gradient-to-br from-[#1a2942] to-[#0d1f35] p-6 rounded-2xl border shadow-xl ${
              latestPowerFactor < 0.85 ? 'border-amber-500/50' : 'border-emerald-500/20'
            }`}
          >
            <div className="text-sm text-white/60 mb-3">Current Power Factor</div>
            <div className={`text-4xl font-bold mb-2 ${
              latestPowerFactor < 0.85 ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {latestZona1Data ? latestPowerFactor.toFixed(2) : 'N/A'}
            </div>
            <div className="text-xs text-white/60">
              {latestZona1Data ? `Latest device: ${latestZona1Data.device}` : 'Awaiting Zona_1 telemetry'}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className={`bg-gradient-to-br from-[#1a2942] to-[#0d1f35] p-6 rounded-2xl border shadow-xl ${
              latestStatusAI === 'BOROS' ? 'border-red-500/50' : 'border-green-500/20'
            }`}
          >
            <div className="text-sm text-white/60 mb-3">AI Anomaly Status</div>
            <div className="flex items-center gap-3 mb-3">
              {latestStatusAI === 'BOROS' ? (
                <>
                  <AlertTriangle className="w-8 h-8 text-red-400" />
                  <span className="text-4xl font-bold text-red-400">BOROS</span>
                </>
              ) : (
                <>
                  <Zap className="w-8 h-8 text-green-400" />
                  <span className="text-4xl font-bold text-green-400">HEMAT</span>
                </>
              )}
            </div>
            <div className="text-xs text-white/60">Z-Score: {latestZona1Data ? latestZScore.toFixed(2) : 'N/A'}</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="bg-gradient-to-br from-[#1a2942] to-[#0d1f35] p-6 rounded-2xl border border-cyan-500/20 shadow-xl"
          >
            <div className="text-sm text-white/60 mb-3">Active Load Efficiency</div>
            <div className="text-3xl font-bold mb-3 text-cyan-400">{latestZona1Data ? latestPower.toLocaleString() : '0'} W</div>
            <div className="text-xs text-white/60">vs {latestZona1Data ? latestApparentPower.toLocaleString() : '0'} VA</div>
          </motion.div>
        </div>

        {/* Capacity Percentage Gauge */}
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className={`bg-gradient-to-br from-[#1a2942] to-[#0d1f35] p-6 rounded-2xl border shadow-xl ${
              capacityPercentage > 80 ? 'border-red-500/50' : 'border-cyan-500/20'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm text-white/60 mb-2">Capacity Usage</div>
                <div className={`text-3xl font-bold ${
                  capacityPercentage > 80 ? 'text-red-400' : capacityPercentage > 60 ? 'text-amber-400' : 'text-green-400'
                }`}>
                  {capacityPercentage.toFixed(1)}%
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-white/60 mb-2">Max Capacity</div>
                <div className="text-2xl font-bold text-cyan-400">{MAX_CAPACITY_WATT}W</div>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden mt-4">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${capacityPercentage}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className={`h-3 rounded-full ${
                  capacityPercentage > 80 ? 'bg-gradient-to-r from-red-500 to-red-400' :
                  capacityPercentage > 60 ? 'bg-gradient-to-r from-amber-500 to-amber-400' :
                  'bg-gradient-to-r from-green-500 to-green-400'
                }`}
              />
            </div>

            <p className="text-sm mt-3 text-white/60">
              Current load: {currentPower.toLocaleString()}W / {MAX_CAPACITY_WATT}W
            </p>
          </motion.div>
        </div>

        {/* Hero KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Active Power */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-[#1a2942] border border-white/10 rounded-xl p-6 shadow-xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <Zap className={`w-6 h-6 ${totalPower > MAX_CAPACITY_WATT * 0.8 ? 'text-red-400' : 'text-emerald-400'}`} />
              <div className="text-sm text-white/60">Total Active Power</div>
            </div>
            <div className={`text-3xl font-bold ${totalPower > MAX_CAPACITY_WATT * 0.8 ? 'text-red-400' : 'text-emerald-400'}`}>
              {totalPower.toLocaleString()} W
            </div>
          </motion.div>

          {/* Est. Monthly Cost */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="bg-[#1a2942] border border-white/10 rounded-xl p-6 shadow-xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <DollarSign className="w-6 h-6 text-emerald-400" />
              <div className="text-sm text-white/60">Est. Monthly Cost</div>
            </div>
            <div className="text-3xl font-bold text-emerald-400">{estimatedMonthlyCost}</div>
            <div className="text-xs text-white/50 mt-1">Rate: Rp1.500/kWh</div>
          </motion.div>

          {/* System Efficiency */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="bg-[#1a2942] border border-white/10 rounded-xl p-6 shadow-xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <Activity className="w-6 h-6 text-blue-400" />
              <div className="text-sm text-white/60">System Efficiency</div>
            </div>
            <div className="text-3xl font-bold text-blue-400">{(avgPowerFactor * 100).toFixed(1)}%</div>
          </motion.div>

          {/* System Health */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="bg-[#1a2942] border border-white/10 rounded-xl p-6 shadow-xl"
          >
            <div className="flex items-center gap-3 mb-4">
              {systemStatus === 'HEALTHY' ? (
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
              ) : (
                <ShieldAlert className={`w-6 h-6 ${systemStatus === 'WARNING' ? 'text-yellow-400' : 'text-red-500'}`} />
              )}
              <div className="text-sm text-white/60">System Health</div>
            </div>
            <div className={`text-3xl font-bold ${
              systemStatus === 'HEALTHY' ? 'text-emerald-400' :
              systemStatus === 'WARNING' ? 'text-yellow-400' : 'text-red-500'
            }`}>
              {systemStatus}
            </div>
          </motion.div>
        </div>

        {/* Main Section: Combined Chart */}
        <div className="grid grid-cols-1 mb-8">
          <div className="bg-gradient-to-br from-[#1a2942] to-[#0d1f35] p-6 rounded-2xl border border-cyan-500/20 shadow-xl">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              Real-time Power Comparison: Zona 1 (Beban Tinggi) vs Zona 2 (Stabil)
            </h3>
            
            {loadingData ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
              </div>
            ) : dataError ? (
              <div className="text-red-400 text-center">Error memuat data grafik</div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={combinedEnergyData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="time" stroke="#ffffff60" tick={{ fill: '#ffffff60', fontSize: 12 }} />
                  <YAxis 
                    yAxisId="left"
                    stroke="#ffffff60" 
                    opacity={0.5}
                    tick={{ fill: '#ffffff60', fontSize: 12 }} 
                    label={{ value: 'Zona 1 (W)', angle: -90, position: 'insideLeft', fill: '#ffffff60' }} 
                    domain={[0, (dataMax: number) => Math.max(dataMax, MAX_CAPACITY_WATT) + 500]} 
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    stroke="#a855f7" 
                    opacity={0.8}
                    tick={{ fill: '#a855f7', fontSize: 12 }} 
                    label={{ value: 'Zona 2 (W)', angle: 90, position: 'insideRight', fill: '#a855f7' }} 
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0a1929', border: '1px solid rgba(6, 182, 212, 0.3)', borderRadius: '12px', color: '#ffffff' }}
                  />

                  <ReferenceLine
                    yAxisId="left"
                    y={MAX_CAPACITY_WATT}
                    stroke="red"
                    strokeDasharray="3 3"
                    label={{ value: `Max Limit`, position: 'top', fill: 'red', fontSize: 12 }}
                  />

                  {/* Garis Zona 1 (Warna Cyan/Biru Muda) */}
                  <Line yAxisId="left" type="monotone" dataKey="power1" stroke="#06b6d4" strokeWidth={3} dot={{ fill: '#06b6d4', r: 4 }} connectNulls={true} name="Z1 Actual Power (W)" />
                  <Line yAxisId="left" type="monotone" dataKey="apparent1" stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 4" dot={false} connectNulls={true} name="Z1 Apparent (VA)" />
                  
                  {/* Garis Zona 2 (Warna Purple) */}
                  <Line yAxisId="right" type="monotone" dataKey="power2" stroke="#a855f7" strokeWidth={3} dot={{ fill: '#a855f7', r: 4 }} connectNulls={true} name="Z2 Actual Power (W)" />
                  <Line yAxisId="right" type="monotone" dataKey="apparent2" stroke="#9333ea" strokeWidth={2} strokeDasharray="4 4" dot={false} connectNulls={true} name="Z2 Apparent (VA)" />
                </LineChart>
              </ResponsiveContainer>
            )}

            {/* Legend Khusus */}
            <div className="flex flex-wrap items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2"><div className="w-4 h-1 bg-[#06b6d4] rounded" /><span className="text-xs text-white/70">Z1 Actual (W)</span></div>
              <div className="flex items-center gap-2"><div className="w-4 h-1 bg-[#3b82f6] rounded border-t border-dashed" /><span className="text-xs text-white/70">Z1 Apparent (VA)</span></div>
              <div className="flex items-center gap-2"><div className="w-4 h-1 bg-[#a855f7] rounded" /><span className="text-xs text-white/70">Z2 Actual (W)</span></div>
              <div className="flex items-center gap-2"><div className="w-4 h-1 bg-[#9333ea] rounded border-t border-dashed" /><span className="text-xs text-white/70">Z2 Apparent (VA)</span></div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-white/10">
              <div className="text-sm text-white/60">Perbandingan real-time fluktuasi beban listrik antar zona.</div>
            </div>
          </div>
        </div>

        {/* Zone Details Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Zona 1 Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-[#1a2942] border border-white/10 rounded-xl p-6 shadow-xl relative"
          >
            <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-semibold ${
              latestZona1.status_ai === 'OVERLOAD' ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse' :
              latestZona1.status_ai === 'BOROS' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
              'bg-green-500/20 text-green-400 border border-green-500/30'
            }`}>
              {latestZona1.status_ai}
            </div>
            <h3 className="text-lg font-semibold mb-4 text-cyan-400">Zona 1 (Heavy Load)</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <span className="text-xs text-white/60 block mb-1">Voltage</span>
                <span className="text-lg font-bold text-cyan-400">{latestZona1.voltage.toFixed(1)} V</span>
              </div>
              <div className="text-center">
                <span className="text-xs text-white/60 block mb-1">Current</span>
                <span className="text-lg font-bold text-cyan-400">{latestZona1.current.toFixed(2)} A</span>
              </div>
              <div className="text-center">
                <span className="text-xs text-white/60 block mb-1">Apparent</span>
                <span className="text-lg font-bold text-cyan-400">{latestZona1.apparent_power.toFixed(0)} VA</span>
              </div>
            </div>
          </motion.div>

          {/* Zona 2 Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="bg-[#1a2942] border border-white/10 rounded-xl p-6 shadow-xl relative"
          >
            <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-semibold ${
              latestZona2.status_ai === 'OVERLOAD' ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse' :
              latestZona2.status_ai === 'BOROS' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
              'bg-green-500/20 text-green-400 border border-green-500/30'
            }`}>
              {latestZona2.status_ai}
            </div>
            <h3 className="text-lg font-semibold mb-4 text-violet-400">Zona 2 (Stable Load)</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <span className="text-xs text-white/60 block mb-1">Voltage</span>
                <span className="text-lg font-bold text-violet-400">{latestZona2.voltage.toFixed(1)} V</span>
              </div>
              <div className="text-center">
                <span className="text-xs text-white/60 block mb-1">Current</span>
                <span className="text-lg font-bold text-violet-400">{latestZona2.current.toFixed(2)} A</span>
              </div>
              <div className="text-center">
                <span className="text-xs text-white/60 block mb-1">Apparent</span>
                <span className="text-lg font-bold text-violet-400">{latestZona2.apparent_power.toFixed(0)} VA</span>
              </div>
            </div>
          </motion.div>
        </div>

      </div>
    )}
      </main>

      {/* Right Panel - AI Insights (Dashboard only) */}
      {activeMenu === 'Dashboard' && (
        <aside className="w-80 bg-[#0d1f35] border-l border-cyan-500/10 p-6 overflow-auto">
          <AIInsights />
        </aside>
      )}
    </div>
);
}
