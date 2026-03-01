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

  calculatedFlashFactor: number | null;
  flashFactorSource: ShrinkageSource;

  /** Called when ThermoPage or ConfigurePage successfully calculates both PVT values. */
  applyCalculated: (shrinkage: number, flashFactor: number) => void;
  /** Reverts shrinkage to manual entry mode only. */
  clearCalculatedShrinkage: () => void;
  /** Reverts flash factor to manual entry mode only. */
  clearCalculatedFlashFactor: () => void;

  /** Used by ConfigurePage when loading a saved case. */
  restoreFromCase: (
    cfg: FluidConfig | undefined,
    shrinkageSource: ShrinkageSource | undefined,
    shrinkage: number | null | undefined,
    flashFactorSource: ShrinkageSource | undefined,
    flashFactor: number | null | undefined,
  ) => void;
  /** Used by ConfigurePage for "New Case". */
  resetToDefaults: () => void;
}

const FluidContext = createContext<FluidContextType | null>(null);

export function FluidProvider({ children }: { children: ReactNode }) {
  const [fluidConfig, setFluidConfig] = useState<FluidConfig>(defaultFluidConfig());

  const [calculatedShrinkage, setCalculatedShrinkage] = useState<number | null>(null);
  const [shrinkageSource, setShrinkageSource] = useState<ShrinkageSource>("manual");

  const [calculatedFlashFactor, setCalculatedFlashFactor] = useState<number | null>(null);
  const [flashFactorSource, setFlashFactorSource] = useState<ShrinkageSource>("manual");

  const applyCalculated = useCallback((shrinkage: number, flashFactor: number) => {
    setCalculatedShrinkage(shrinkage);
    setShrinkageSource("calculated");
    setCalculatedFlashFactor(flashFactor);
    setFlashFactorSource("calculated");
  }, []);

  const clearCalculatedShrinkage = useCallback(() => {
    setCalculatedShrinkage(null);
    setShrinkageSource("manual");
  }, []);

  const clearCalculatedFlashFactor = useCallback(() => {
    setCalculatedFlashFactor(null);
    setFlashFactorSource("manual");
  }, []);

  const restoreFromCase = useCallback(
    (
      cfg: FluidConfig | undefined,
      shrinkSrc: ShrinkageSource | undefined,
      shrinkage: number | null | undefined,
      ffSrc: ShrinkageSource | undefined,
      flashFactor: number | null | undefined,
    ) => {
      setFluidConfig(cfg ?? defaultFluidConfig());
      setShrinkageSource(shrinkSrc ?? "manual");
      setCalculatedShrinkage(shrinkage ?? null);
      setFlashFactorSource(ffSrc ?? "manual");
      setCalculatedFlashFactor(flashFactor ?? null);
    },
    [],
  );

  const resetToDefaults = useCallback(() => {
    setFluidConfig(defaultFluidConfig());
    setCalculatedShrinkage(null);
    setShrinkageSource("manual");
    setCalculatedFlashFactor(null);
    setFlashFactorSource("manual");
  }, []);

  return (
    <FluidContext.Provider
      value={{
        fluidConfig,
        setFluidConfig,
        calculatedShrinkage,
        shrinkageSource,
        calculatedFlashFactor,
        flashFactorSource,
        applyCalculated,
        clearCalculatedShrinkage,
        clearCalculatedFlashFactor,
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
