import { useIoTData } from '../lib/useIoTData';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function App() {
  const { data, loading, error } = useIoTData();

  if (loading) return <div>Loading IoT data...</div>;
  if (error) return <div>Error: {error}</div>;

  // Get the latest row for status_ai
  const latestRow = data[data.length - 1];

  // Prepare data for LineChart (showing power over time)
  const chartData = data.map((item) => ({
    time: new Date(item.created_at).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    power: item.power,
    apparentPower: item.apparent_power,
  }));

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">IoT Dashboard - Zona 1</h1>

      {/* Display status_ai from latest row */}
      {latestRow && (
        <div className="mb-4 p-4 bg-gray-100 rounded">
          <h2 className="text-lg font-semibold">Latest Status</h2>
          <p>Status AI: {latestRow.status_ai}</p>
          <p>Power: {latestRow.power} W</p>
          <p>Voltage: {latestRow.voltage} V</p>
          <p>Current: {latestRow.current} A</p>
        </div>
      )}

      {/* LineChart for power data */}
      <div className="w-full h-96">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="power"
              stroke="#8884d8"
              strokeWidth={2}
              name="Power (W)"
            />
            <Line
              type="monotone"
              dataKey="apparentPower"
              stroke="#82ca9d"
              strokeWidth={2}
              name="Apparent Power (VA)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}