(* IMS/MPFM — MPFM Validation Analysis Pipeline
   ===============================================
   Ports the Python mpfm_analysis.py module to Wolfram Language.

   The key simplification over the Python version is the use of Wolfram's
   built-in Around[value, uncertainty] type for automatic first-order
   Gaussian error propagation.  Instead of manually computing partial
   derivatives and combining them, every uncertain quantity is wrapped in
   Around and arithmetic automatically tracks the combined uncertainty.

   Public API
   ----------
   IMSAggregateMPFM[rows, meterIds]                 — sum per-meter columns
   IMSAnalyzeRow[row, pvt, unc, meterIds]           — derive quantities with Around
   IMSAnalyzeMPFM[rows, pvt, unc, meterIds]         — map AnalyzeRow over timeseries
   IMSBuildComparisonTable[analyzedRows]             — summary statistics + z-test

   Data format
   -----------
   rows      : List of Associations, one per timestamp.
                 Required keys (per meter m in meterIds):
                   "{m}_oil"   [STB/day]
                   "{m}_gas"   [mmscf/day]   → converted to mscf/day internally
                   "{m}_water" [STB/day]
                 Separator keys:
                   "sep_total_liquid" [STB/day]
                   "sep_gas"          [MSCF/day]

   pvt       : Association — "bsw", "oil_shrinkage", "flash_factor"
   unc       : Association — relative (fractional) 1-sigma uncertainties:
                 "r_sep_liquid", "r_sep_gas",
                 "r_mpfm_oil", "r_mpfm_gas", "r_mpfm_water",
                 "r_bsw", "r_oil_shrinkage", "r_flash_factor"
*)

BeginPackage["IMS`MPFM`"]

IMSAggregateMPFM::usage =
  "IMSAggregateMPFM[rows, meterIds] sums individual meter columns into \
mpfm_oil, mpfm_gas (mscf/day), mpfm_water, mpfm_liquid and appends them \
to each row Association.";

IMSAnalyzeRow::usage =
  "IMSAnalyzeRow[row, pvt, unc, meterIds] computes all derived quantities \
for a single timestamp row, wrapping each value in Around[value, 1-sigma] \
for automatic error propagation.  Returns an Association of Around-valued \
derived quantities.";

IMSAnalyzeMPFM::usage =
  "IMSAnalyzeMPFM[rows, pvt, unc, meterIds] applies IMSAnalyzeRow to every \
row in rows and returns a list of result Associations.";

IMSBuildComparisonTable::usage =
  "IMSBuildComparisonTable[analyzedRows] computes summary statistics \
(mean, std, SE, 95% CI, propagated uncertainty, paired z-test) for each \
phase (oil, gas, water, liquid, wc, gor) and returns a list of Associations.";

Begin["`Private`"]

(* ── Meter aggregation ───────────────────────────────────────────────────── *)

IMSAggregateMPFM[rows_List, meterIds_List] :=
  Map[Function[row,
    Module[{oilVals, gasVals, waterVals, mpfmOil, mpfmGas, mpfmWater},
      oilVals   = row[# <> "_oil"]&   /@ meterIds;
      gasVals   = row[# <> "_gas"]&   /@ meterIds;
      waterVals = row[# <> "_water"]& /@ meterIds;
      mpfmOil   = Total[oilVals];
      mpfmGas   = Total[gasVals] * 1000.0;  (* mmscf/day → mscf/day *)
      mpfmWater = Total[waterVals];
      Append[row, <|
        "mpfm_oil"    -> mpfmOil,
        "mpfm_gas"    -> mpfmGas,
        "mpfm_water"  -> mpfmWater,
        "mpfm_liquid" -> mpfmOil + mpfmWater|>]]], rows]

(* ── Per-row analysis with Around error propagation ─────────────────────── *)
(*
   Around[x, δ] represents a quantity with value x and 1-sigma uncertainty δ.
   Wolfram automatically propagates uncertainties through arithmetic using
   first-order Gaussian rules — exactly what the Python code computes manually
   via partial derivatives.

   Example for sep_free_water = sep_liq × bsw:
     Python: σ = √[(bsw·σ_liq)² + (liq·σ_bsw)²]
     Here:   Around[liq, σ_liq] × Around[bsw, σ_bsw]  ← same result, zero boilerplate
*)

IMSAnalyzeRow[row_Association, pvt_Association, unc_Association, meterIds_List] :=
  Module[
    {rOil, rGas, rWater, rLiq, rGasSep, rBsw, rShrink, rFlash,
     bswV, shrinkV, flashV,
     (* MPFM Around quantities *)
     mpfmOil, mpfmGas, mpfmWater, mpfmLiq,
     (* Separator Around quantities *)
     sepLiq, sepGas, bsw, shrink, flash,
     (* Derived separator quantities — Around propagates automatically *)
     sepFreeWater, sepOilStd, sepLiqStd, sepFlashGas, sepGasStd,
     (* Ratios *)
     mpfmWC, sepWC, mpfmGOR, sepGOR},

    (* Relative uncertainties *)
    rOil    = unc["r_mpfm_oil"];
    rGas    = unc["r_mpfm_gas"];
    rWater  = unc["r_mpfm_water"];
    rLiq    = unc["r_sep_liquid"];
    rGasSep = unc["r_sep_gas"];
    rBsw    = unc["r_bsw"];
    rShrink = unc["r_oil_shrinkage"];
    rFlash  = unc["r_flash_factor"];

    (* PVT scalar values *)
    bswV    = pvt["bsw"];
    shrinkV = pvt["oil_shrinkage"];
    flashV  = pvt["flash_factor"];

    (* ── MPFM totals: sum of independent meters
         σ_sum = r × √(Σ xᵢ²)  — reproduced automatically by Around addition *)
    mpfmOil   = Total[Around[row[# <> "_oil"],   rOil   * row[# <> "_oil"  ]]& /@ meterIds];
    mpfmGas   = Total[Around[row[# <> "_gas"],   rGas   * row[# <> "_gas"  ]]& /@ meterIds] * 1000.0;
    mpfmWater = Total[Around[row[# <> "_water"], rWater * row[# <> "_water"]]& /@ meterIds];
    mpfmLiq   = mpfmOil + mpfmWater;

    (* ── Separator inputs with uncertainty *)
    sepLiq  = Around[row["sep_total_liquid"], rLiq    * row["sep_total_liquid"]];
    sepGas  = Around[row["sep_gas"],          rGasSep * row["sep_gas"]];
    bsw     = Around[bswV,    rBsw    * bswV];
    shrink  = Around[shrinkV, rShrink * shrinkV];
    flash   = Around[flashV,  rFlash  * flashV];

    (* ── Separator derived quantities — all uncertainties propagated by Around *)
    sepFreeWater = sepLiq * bsw;                        (* liq × bsw                  *)
    sepOilStd    = sepLiq * (1.0 - bsw) * shrink;      (* liq × (1-bsw) × shrinkage  *)
    sepLiqStd    = sepFreeWater + sepOilStd;
    sepFlashGas  = sepOilStd * flash / 1000.0;          (* mscf/day                   *)
    sepGasStd    = sepGas + sepFlashGas;

    (* ── Water cut [%] and GOR [scf/stb] *)
    mpfmWC  = mpfmWater  / mpfmLiq    * 100.0;
    sepWC   = sepFreeWater / sepLiqStd * 100.0;
    mpfmGOR = mpfmGas    * 1000.0 / mpfmOil;
    sepGOR  = sepGasStd  * 1000.0 / sepOilStd;

    <|"mpfm_oil"       -> mpfmOil,
      "mpfm_gas"       -> mpfmGas,
      "mpfm_water"     -> mpfmWater,
      "mpfm_liquid"    -> mpfmLiq,
      "sep_free_water" -> sepFreeWater,
      "sep_oil_std"    -> sepOilStd,
      "sep_liquid_std" -> sepLiqStd,
      "sep_gas_std"    -> sepGasStd,
      "mpfm_wc"        -> mpfmWC,
      "sep_wc"         -> sepWC,
      "mpfm_gor"       -> mpfmGOR,
      "sep_gor"        -> sepGOR|>]

IMSAnalyzeMPFM[rows_List, pvt_Association, unc_Association, meterIds_List] :=
  IMSAnalyzeRow[#, pvt, unc, meterIds]& /@ rows

(* ── Comparison table ────────────────────────────────────────────────────── *)
(* Helper: extract nominal value / uncertainty from an Around or plain number *)

AroundVal[Around[v_, _]] := N[v]
AroundVal[v_?NumericQ]   := N[v]
AroundUnc[Around[_, u_]] := N[u]
AroundUnc[v_?NumericQ]   := 0.0

IMSBuildComparisonTable[analyzedRows_List] :=
  Module[
    {n = Length[analyzedRows],
     phases  = {"oil", "gas", "water", "liquid", "wc", "gor"},
     mpfmKey = <|"oil" -> "mpfm_oil",    "gas" -> "mpfm_gas",
                 "water" -> "mpfm_water", "liquid" -> "mpfm_liquid",
                 "wc" -> "mpfm_wc",      "gor" -> "mpfm_gor"|>,
     sepKey  = <|"oil" -> "sep_oil_std",    "gas" -> "sep_gas_std",
                 "water" -> "sep_free_water","liquid" -> "sep_liquid_std",
                 "wc" -> "sep_wc",          "gor" -> "sep_gor"|>,
     units   = <|"oil" -> "STB/day", "gas" -> "MSCF/day", "water" -> "STB/day",
                 "liquid" -> "STB/day", "wc" -> "%", "gor" -> "SCF/STB"|>,
     accept  = <|"oil" -> 0.05, "gas" -> 0.05, "water" -> 0.05,
                 "liquid" -> None, "wc" -> None, "gor" -> None|>},

    Map[Function[phase,
      Module[
        {mpfmVals, sepVals, mpfmSig, sepSig,
         mpfmMean, sepMean, relDevs, absDevs,
         meanRel, stdRel, seRel, meanAbs, stdAbs, seAbs,
         mpfmSigMean, sepSigMean, sigRelDev,
         zStat, pVal, lim, within},

        (* Extract nominal values and uncertainties from Around timeseries *)
        mpfmVals = AroundVal[#[mpfmKey[phase]]]& /@ analyzedRows;
        sepVals  = AroundVal[#[sepKey[phase]]]&  /@ analyzedRows;
        mpfmSig  = AroundUnc[#[mpfmKey[phase]]]& /@ analyzedRows;
        sepSig   = AroundUnc[#[sepKey[phase]]]&  /@ analyzedRows;

        mpfmMean = Mean[mpfmVals];
        sepMean  = Mean[sepVals];

        (* Per-timestep deviations *)
        relDevs = MapThread[#1 / #2 - 1.0&, {mpfmVals, sepVals}];
        absDevs = MapThread[#1 - #2&,        {mpfmVals, sepVals}];

        meanRel = Mean[relDevs];
        stdRel  = StandardDeviation[relDevs];
        seRel   = stdRel / Sqrt[n];
        meanAbs = Mean[absDevs];
        stdAbs  = StandardDeviation[absDevs];
        seAbs   = stdAbs / Sqrt[n];

        (* Propagated uncertainty on the mean relative deviation
             σ_rel = √[(σ_mpfm / sep)² + (mpfm·σ_sep / sep²)²]     *)
        mpfmSigMean = Mean[mpfmSig];
        sepSigMean  = Mean[sepSig];
        sigRelDev   = If[sepMean != 0.0,
          Sqrt[(mpfmSigMean / sepMean)^2 +
               (mpfmMean * sepSigMean / sepMean^2)^2],
          Missing["Indeterminate"]];

        (* Paired z-test: H₀: mean(MPFM − Sep) = 0 *)
        {zStat, pVal} = If[seAbs > 0.0,
          Module[{z = meanAbs / seAbs},
            {z, 2.0 * (1.0 - CDF[NormalDistribution[0, 1], Abs[z]])}],
          {0.0, 1.0}];

        lim   = accept[phase];
        within = If[lim === None, None, Abs[meanRel] <= lim];

        <|"phase"               -> phase,
          "unit"                -> units[phase],
          "mpfm_mean"           -> mpfmMean,
          "sep_ref_mean"        -> sepMean,
          "mean_abs_deviation"  -> meanAbs,
          "mean_rel_deviation"  -> meanRel,
          "std_rel_deviation"   -> stdRel,
          "se_rel_deviation"    -> seRel,
          "ci95_rel_lower"      -> meanRel - 1.96 * seRel,
          "ci95_rel_upper"      -> meanRel + 1.96 * seRel,
          "z_statistic"         -> zStat,
          "p_value"             -> pVal,
          "sigma_mpfm_mean"     -> mpfmSigMean,
          "sigma_sep_mean"      -> sepSigMean,
          "sigma_rel_dev"       -> sigRelDev,
          "n_samples"           -> n,
          "acceptance_limit"    -> lim,
          "within_acceptance"   -> within|>]],
    phases]]

End[]  (* `Private` *)

EndPackage[]
