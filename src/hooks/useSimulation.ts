import { useEffect } from "react";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useTradingStore } from "../stores/useTradingStore";

export const useSimulation = () => {
  const initialTotalPnlSol = useSettingsStore((store) => store.saved.initialTotalPnlSol);
  const simulationVersion = useSettingsStore((store) => store.simulationVersion);
  const state = useTradingStore((store) => store.state);
  const reset = useTradingStore((store) => store.reset);
  const tick = useTradingStore((store) => store.tick);

  useEffect(() => {
    reset(initialTotalPnlSol);
  }, [initialTotalPnlSol, reset, simulationVersion]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      tick();
    }, 1200);

    return () => window.clearInterval(timer);
  }, [tick]);

  return state;
};
