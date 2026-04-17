import { useState, useEffect, useMemo, FormEvent } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Zap, AlertTriangle, LayoutDashboard, BarChart3, Server, Settings, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useIoTData } from '../lib/useIoTData';
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

  // Gunakan hook useIoTData
  const { data: zona1Data, loading } = useIoTData();

  // Transform data IoT menjadi format untuk LineChart
  const energyData = useMemo(() => {
    if (loading || zona1Data.length === 0) return [];

    return zona1Data
      .slice(-50)
      .map((item) => ({
        time: new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        power: item.power,
        apparent_power: item.apparent_power,
      }));
  }, [zona1Data, loading]);

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
  const MAX_CAPACITY_WATT = 7700;
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

  // Calculate predictions for KPIs
  const peakData = energyData.length > 0 ? energyData.reduce((max, current) =>
    (current.power + current.apparent_power) > (max.power + max.apparent_power) ? current : max
  , energyData[0]) : { time: 'N/A', power: 0, apparent_power: 0 };

  const latestEfficiencyPercentage = latestEfficiencyRatio > 0 ? `${(latestEfficiencyRatio * 100).toFixed(1)}%` : 'N/A';
  const systemLoad = maxCapacityWatts > 0 ? (((peakData.power + peakData.apparent_power) / maxCapacityWatts) * 100).toFixed(1) : '0.0';

  if (loading) {
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
      <main className="flex-1 p-8 overflow-auto bg-gradient-to-br from-[#0a1929] to-[#0d1f35]">
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

        {/* Main Section: Chart */}
        <div className="grid grid-cols-1 gap-6 mb-8">
          {/* Real-time Power Chart (Full width) */}
          <div className="bg-gradient-to-br from-[#1a2942] to-[#0d1f35] p-6 rounded-2xl border border-cyan-500/20 shadow-xl">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              Real-time Power vs Apparent Power
            </h3>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={energyData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis
                  dataKey="time"
                  stroke="#ffffff60"
                  tick={{ fill: '#ffffff60', fontSize: 12 }}
                />
                <YAxis
                  stroke="#ffffff60"
                  tick={{ fill: '#ffffff60', fontSize: 12 }}
                  label={{ value: 'W / VA', angle: -90, position: 'insideLeft', fill: '#ffffff60' }}
                  domain={[0, (dataMax: number) => Math.max(dataMax, MAX_CAPACITY_WATT) + 500]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0a1929',
                    border: '1px solid rgba(6, 182, 212, 0.3)',
                    borderRadius: '12px',
                    color: '#ffffff',
                  }}
                  labelStyle={{ color: '#06b6d4', fontWeight: 'bold' }}
                />

                {/* Max Capacity Line */}
                <ReferenceLine
                  key="reference-max-capacity"
                  y={MAX_CAPACITY_WATT}
                  stroke="red"
                  strokeDasharray="3 3"
                  label={{
                    value: 'Max Limit (7700W)',
                    position: 'top',
                    fill: 'red',
                    fontSize: 12
                  }}
                />

                <Line
                  key="line-power"
                  type="monotone"
                  dataKey="power"
                  stroke="#06b6d4"
                  strokeWidth={3}
                  dot={{ fill: '#06b6d4', r: 5 }}
                  name="Actual Power (W)"
                  activeDot={{ r: 7 }}
                />
                <Line
                  key="line-apparent-power"
                  type="monotone"
                  dataKey="apparent_power"
                  stroke="#64748b"
                  strokeWidth={2}
                  dot={false}
                  name="Apparent Power (VA)"
                />
              </LineChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 bg-cyan-400 rounded" />
                <span className="text-xs text-white/70">Actual Power (W)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 bg-slate-400 rounded" />
                <span className="text-xs text-white/70">Apparent Power (VA)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 bg-red-500 rounded" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #ef4444 0, #ef4444 4px, transparent 4px, transparent 8px)' }} />
                <span className="text-xs text-white/70">Max Capacity</span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-white/10">
              <div className="text-sm text-white/60">Realtime Zona_1 power metrics are plotted against the latest timestamp.</div>
            </div>
          </div>
        </div>

        {/* AI Insights Feed */}
        <AIInsights />
          </div>
        )}

        {/* Settings View */}
        {activeMenu === 'Settings' && (
          <div className="bg-gradient-to-br from-[#1a2942] to-[#0d1f35] p-8 rounded-2xl border border-white/10 shadow-xl">
            <h3 className="text-2xl font-semibold mb-4">System Settings</h3>
            <p className="text-white/60">Settings panel coming soon...</p>
          </div>
        )}
      </main>
    </div>
  );
}