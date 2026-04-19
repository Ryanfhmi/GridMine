import { useEffect, useState } from 'react';
import { supabase } from './supabase';

interface IoTMeasurement {
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

export function useIoTData(zoneName: string) {
  const [data, setData] = useState<IoTMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch initial data: last 20 rows for the specified zone, ordered by created_at desc, then reverse for oldest first
    const fetchInitialData = async () => {
      try {
        const { data: fetchedData, error } = await supabase
          .from('iot_measurements')
          .select('*')
          .eq('device', zoneName)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) {
          console.error('Error fetching initial data:', error);
          setError(error.message);
          setLoading(false);
          return;
        }

        if (fetchedData) {
          // Reverse to have oldest first
          setData(fetchedData.reverse());
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        setError('Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();

    // Subscribe to real-time inserts
    const channelName = `iot_measurements_changes_${zoneName}`;
    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'iot_measurements',
        },
        (payload) => {
          const newRow = payload.new as IoTMeasurement;
          if (newRow.device === zoneName) {
            setData((prev) => {
              // Keep only the last 20, add new one at the end (since oldest first, new is latest)
              const updated = [...prev, newRow];
              return updated.slice(-20);
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [zoneName]);

  return { data, loading, error };
}

export function useIoTDataForZones(zoneNames: string[]) {
  const [data, setData] = useState<IoTMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (zoneNames.length === 0) {
      setData([]);
      setLoading(false);
      return;
    }

    const fetchInitialData = async () => {
      try {
        const { data: fetchedData, error } = await supabase
          .from('iot_measurements')
          .select('*')
          .in('device', zoneNames)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) {
          console.error('Error fetching initial data:', error);
          setError(error.message);
          setLoading(false);
          return;
        }

        if (fetchedData) {
          setData(fetchedData.reverse());
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        setError('Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();

    const channelName = `iot_measurements_changes_${zoneNames.join('_')}`;
    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'iot_measurements',
        },
        (payload) => {
          const newRow = payload.new as IoTMeasurement;
          if (zoneNames.includes(newRow.device)) {
            setData((prev) => {
              const updated = [...prev, newRow];
              return updated.slice(-20);
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [zoneNames.join(',')]);

  return { data, loading, error };
}
