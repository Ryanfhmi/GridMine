/**
 * Fungsi untuk menghitung total kWh dan tagihan Rupiah
 * @param dataArray Array dari data IoT Supabase (harus memiliki properti 'power')
 * @returns object berisi string kWh dan Rupiah yang sudah diformat
 */
export type ElectricityCostResult = {
  kwh: string;
  rupiah: string;
};

export type PowerMeasurement = {
  power?: number;
};

export const calculateElectricityCost = (dataArray: PowerMeasurement[]): ElectricityCostResult => {
  if (!dataArray || dataArray.length === 0) {
    return { kwh: '0.000', rupiah: 'Rp 0' };
  }

  const totalWatt = dataArray.reduce((sum, item) => sum + (item.power ?? 0), 0);
  const totalKwh = (totalWatt / 1000) * (5 / 3600);
  const tarifPLN = 1444.7;
  const totalCost = totalKwh * tarifPLN;

  const formattedRupiah = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(totalCost);

  return {
    kwh: totalKwh.toFixed(3),
    rupiah: formattedRupiah,
  };
};
