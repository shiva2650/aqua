import { useState, useEffect, useCallback, useRef } from 'react';
import { Sensors, DeviceStates, AquariumConfig } from '../types';
import { rtdb } from '../lib/firebase';
import { ref, onValue, set, update, push } from 'firebase/database';

export function useSensors(config: AquariumConfig, autoControl: boolean, userId?: string) {
  const [sensors, setSensors] = useState<Sensors>({
    ph: 7.2,
    temperature: 25.5,
    turbidity: 2.1,
    waterLevel: 95,
    distance: 10,
    timestamp: Date.now()
  });

  const [devices, setDevices] = useState<DeviceStates>({
    pump: false,
    heater: true,
    lights: true,
    filter: true,
    autoMode: autoControl
  });

  const [history, setHistory] = useState<Sensors[]>([]);
  const isInitialMount = useRef(true);

  // Sync with RTDB
  useEffect(() => {
    if (!userId) return;

    const sensorsRef = ref(rtdb, `aquariums/${userId}/sensors`);
    const devicesRef = ref(rtdb, `aquariums/${userId}/devices`);

    const unsubSensors = onValue(sensorsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setSensors(data);
      }
    });

    const unsubDevices = onValue(devicesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setDevices(data);
      }
    });

    return () => {
      unsubSensors();
      unsubDevices();
    };
  }, [userId]);

  // Update RTDB when devices change
  useEffect(() => {
    if (!userId || isInitialMount.current) return;
    const devicesRef = ref(rtdb, `aquariums/${userId}/devices`);
    update(devicesRef, devices);
  }, [devices, userId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSensors(prev => {
        // Simulate minor fluctuations
        const newPh = prev.ph + (Math.random() - 0.5) * 0.05;
        const newTemp = prev.temperature + (Math.random() - 0.5) * 0.1;
        const newTurb = Math.max(0, prev.turbidity + (Math.random() - 0.4) * 0.2); // Slights drift upwards
        const newLevel = prev.waterLevel - (Math.random() * 0.01); // Evaporation simulation

        const newReading = {
          ph: Number(newPh.toFixed(2)),
          temperature: Number(newTemp.toFixed(1)),
          turbidity: Number(newTurb.toFixed(2)),
          waterLevel: Number(newLevel.toFixed(1)),
          distance: 10,
          timestamp: Date.now()
        };

        // Automatic logic check
        if (devices.autoMode) {
          const phOut = newPh < config.thresholds.ph.min || newPh > config.thresholds.ph.max;
          const turbOut = newTurb > config.thresholds.turbidity.max;
          const tempOut = newTemp < config.thresholds.temperature.min || newTemp > config.thresholds.temperature.max;
          const waterLow = newLevel < config.thresholds.waterLevel.min;

          if (phOut || turbOut || tempOut || waterLow) {
            if (!devices.pump) {
                   setDevices(d => ({ ...d, pump: true }));
            }
          } else if (devices.pump) {
            setDevices(d => ({ ...d, pump: false }));
          }
        }

        // Push sensors to RTDB if logged in
        if (userId) {
          const sensorsRef = ref(rtdb, `aquariums/${userId}/sensors`);
          set(sensorsRef, newReading);
        }

        setHistory(h => [newReading, ...h].slice(0, 50));
        return newReading;
      });
    }, 5000);

    isInitialMount.current = false;
    return () => clearInterval(interval);
  }, [config.thresholds, devices.autoMode, devices.pump, userId]);

  const toggleDevice = (device: keyof DeviceStates) => {
    setDevices(prev => {
      const newValue = !prev[device];
      const newState = { ...prev, [device]: newValue };
      
      // Log manual override if user is logged in
      if (userId) {
        const logRef = ref(rtdb, `aquariums/${userId}/manual_overrides`);
        push(logRef, {
          device,
          newState: newValue,
          timestamp: Date.now()
        });
      }
      
      return newState;
    });
  };

  return { sensors, devices, history, toggleDevice };
}
