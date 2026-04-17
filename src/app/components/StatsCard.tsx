type StatsCardProps = {
  data: Array<{ power: number }>;
};

const StatsCard = ({ data }: StatsCardProps) => {
  const totalPower = data.reduce((sum, item) => sum + item.power, 0);
  const totalKWh = (totalPower / 1000) * (5 / 3600);
  const tariff = 1444.7;
  const estimatedCost = totalKWh * tariff;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Konsumsi Energi (kWh)</h3>
        <p className="text-3xl font-bold text-blue-600">{totalKWh.toFixed(2)}</p>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Estimasi Biaya (IDR)</h3>
        <p className="text-3xl font-bold text-green-600">{formatCurrency(estimatedCost)}</p>
      </div>
    </div>
  );
};

export default StatsCard;
