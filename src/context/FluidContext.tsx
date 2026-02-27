import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { FluidConfig, ShrinkageSource } from "../types/analysis";
import { defaultFluidConfig } from "../types/analysis";

interface FluidContextType {
  fluidConfig: FluidConfig;
  setFluidConfig: (cfg: FluidConfig) => void;
  calculatedShrinkage: number | null;
  shrinkageSource: ShrinkageSource;
  /** Called when ThermoPage successfully calculates a value. */
  applyCalculated: (value: number) => void;
  /** Reverts to manual entry mode. */
  clearCalculated: () => void;
  /** Used by ConfigurePage when loading a saved case. */
  restoreFromCase: (
    cfg: FluidConfig | undefined,
    source: ShrinkageSource | undefined,
    shrinkage: number | null | undefined,
  ) => void;
  /** Used by ConfigurePage for "New Case". */
  resetToDefaults: () => void;
}

const FluidContext = createContext<FluidContextType | null>(null);

export function FluidProvider({ children }: { children: ReactNode }) {
  const [fluidConfig, setFluidConfig] = useState<FluidConfig>(defaultFluidConfig());
  const [calculatedShrinkage, setCalculatedShrinkage] = useState<number | null>(null);
  const [shrinkageSource, setShrinkageSource] = useState<ShrinkageSource>("manual");

  const applyCalculated = useCallback((value: number) => {
    setCalculatedShrinkage(value);
    setShrinkageSource("calculated");
  }, []);

  const clearCalculated = useCallback(() => {
    setCalculatedShrinkage(null);
    setShrinkageSource("manual");
  }, []);

  const restoreFromCase = useCallback(
    (
      cfg: FluidConfig | undefined,
      source: ShrinkageSource | undefined,
      shrinkage: number | null | undefined,
    ) => {
      setFluidConfig(cfg ?? defaultFluidConfig());
      setShrinkageSource(source ?? "manual");
      setCalculatedShrinkage(shrinkage ?? null);
    },
    [],
  );

  const resetToDefaults = useCallback(() => {
    setFluidConfig(defaultFluidConfig());
    setCalculatedShrinkage(null);
    setShrinkageSource("manual");
  }, []);

  return (
    <FluidContext.Provider
      value={{
        fluidConfig,
        setFluidConfig,
        calculatedShrinkage,
        shrinkageSource,
        applyCalculated,
        clearCalculated,
        restoreFromCase,
        resetToDefaults,
      }}
    >
      {children}
    </FluidContext.Provider>
  );
}

export function useFluidContext(): FluidContextType {
  const ctx = useContext(FluidContext);
  if (!ctx) throw new Error("useFluidContext must be used within FluidProvider");
  return ctx;
}
