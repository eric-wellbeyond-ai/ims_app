#!/usr/bin/env wolframscript
(* TestMPFM.wls — Unit tests for the IMS/MPFM analysis pipeline
   Run with:  wolframscript -script Tests/TestMPFM.wls
*)

Print[""];
Print["╔══════════════════════════════════════════════╗"];
Print["║          IMS/MPFM — Test Suite               ║"];
Print["╚══════════════════════════════════════════════╝"];

(* Load kernels *)
Get[FileNameJoin[{DirectoryName[$InputFileName], "..", "Thermo", "Kernel", "Thermo.wl"}]];
Get[FileNameJoin[{DirectoryName[$InputFileName], "..", "MPFM",   "Kernel", "MPFM.wl"}]];

(* ── Assertion helpers ────────────────────────────────────────────────────── *)

$passed = 0; $failed = 0;

AssertNear[label_, got_, expected_, tol_: 0.01] :=
  If[Abs[(got - expected) / Max[Abs[expected], 1*^-10]] < tol,
     $passed++; Print["  \[Checkmark] PASS  ", label],
     $failed++;
     Print["  \[Times] FAIL  ", label,
           "  got=", NumberForm[N[got], 6],
           "  expected≈", NumberForm[N[expected], 6]]];

AssertTrue[label_, cond_] :=
  If[TrueQ[cond],
     $passed++; Print["  \[Checkmark] PASS  ", label],
     $failed++; Print["  \[Times] FAIL  ", label]];

(* ── Synthetic test dataset ─────────────────────────────────────────────── *)
(*
   10 time steps, 2 meters.
   Separator total liquid ≈ 1000 STB/day, gas ≈ 500 MSCF/day.
   Each MPFM meter reads approximately half the separator.
   Gas columns in mmscf/day (×1000 → mscf/day after aggregation).
*)

meterIds = {"mpfm1", "mpfm2"};

SeedRandom[42];
rawRows = Table[
  Module[{sepLiq = 1000. + RandomReal[{-30., 30.}],
          sepGas  =  500. + RandomReal[{-10., 10.}],
          m1oil   =  480. + RandomReal[{-20., 20.}],
          m1water =   55. + RandomReal[{ -5.,  5.}],
          m1gas   = 0.230 + RandomReal[{-0.01, 0.01}],   (* mmscf/day *)
          m2oil   =  480. + RandomReal[{-20., 20.}],
          m2water =   55. + RandomReal[{ -5.,  5.}],
          m2gas   = 0.230 + RandomReal[{-0.01, 0.01}]},
    <|"sep_total_liquid" -> sepLiq,
      "sep_gas"          -> sepGas,
      "mpfm1_oil"        -> m1oil,
      "mpfm1_water"      -> m1water,
      "mpfm1_gas"        -> m1gas,
      "mpfm2_oil"        -> m2oil,
      "mpfm2_water"      -> m2water,
      "mpfm2_gas"        -> m2gas|>],
  {10}];

pvt = <|"bsw" -> 0.10, "oil_shrinkage" -> 0.92, "flash_factor" -> 120.0|>;

unc = <|"r_sep_liquid"    -> 0.01,
        "r_sep_gas"       -> 0.02,
        "r_mpfm_oil"      -> 0.03,
        "r_mpfm_gas"      -> 0.03,
        "r_mpfm_water"    -> 0.05,
        "r_bsw"           -> 0.02,
        "r_oil_shrinkage" -> 0.05,
        "r_flash_factor"  -> 0.10|>;

(* ── Test 1: Meter aggregation ───────────────────────────────────────────── *)

Print["\n── 1. IMSAggregateMPFM ───────────────────────────"];

aggRows = IMSAggregateMPFM[rawRows, meterIds];
Module[{r = First[aggRows]},
  AssertTrue["mpfm_oil key present",    KeyExistsQ[r, "mpfm_oil"]];
  AssertTrue["mpfm_gas key present",    KeyExistsQ[r, "mpfm_gas"]];
  AssertTrue["mpfm_liquid key present", KeyExistsQ[r, "mpfm_liquid"]];
  AssertNear["mpfm_liquid = oil + water",
             r["mpfm_liquid"], r["mpfm_oil"] + r["mpfm_water"], 1*^-10];
  (* Gas converted: raw (mmscf) × 1000 → mscf. Each meter ≈ 0.23 mmscf → 230 mscf *)
  AssertTrue["gas in mscf (>>1 after conversion)", r["mpfm_gas"] > 1.0];
  Print["    mpfm_oil    = ", NumberForm[r["mpfm_oil"],    6], " STB/day"];
  Print["    mpfm_gas    = ", NumberForm[r["mpfm_gas"],    6], " MSCF/day"];
  Print["    mpfm_water  = ", NumberForm[r["mpfm_water"],  6], " STB/day"];
  Print["    mpfm_liquid = ", NumberForm[r["mpfm_liquid"], 6], " STB/day"]];

(* ── Test 2: Single-row Around analysis ──────────────────────────────────── *)

Print["\n── 2. IMSAnalyzeRow — Around error propagation ───"];

Module[{row = First[aggRows], result, sepOil, mpfmOil, bsw = pvt["bsw"]},
  result = IMSAnalyzeRow[row, pvt, unc, meterIds];

  AssertTrue["result is Association",   AssociationQ[result]];
  AssertTrue["sep_oil_std is Around",   Head[result["sep_oil_std"]] === Around];
  AssertTrue["mpfm_oil is Around",      Head[result["mpfm_oil"]] === Around];

  (* Verify nominal value of sep_oil_std:
     sep_oil_std = sep_liq × (1 - bsw) × shrinkage                          *)
  sepOil = First[aggRows]["sep_total_liquid"] * (1 - bsw) * pvt["oil_shrinkage"];
  AssertNear["sep_oil_std nominal value",
             result["sep_oil_std"][[1]], sepOil, 1*^-6];

  (* Verify uncertainty of sep_oil_std via Python formula:
     σ = √[(shrink·(1-bsw)·σ_liq)² + (shrink·liq·σ_bsw)² + ((1-bsw)·liq·σ_shrink)²] *)
  Module[{liq   = First[aggRows]["sep_total_liquid"],
          shrink = pvt["oil_shrinkage"],
          rLiq  = unc["r_sep_liquid"],
          rBsw  = unc["r_bsw"],
          rShr  = unc["r_oil_shrinkage"],
          sigExpected},
    sigExpected = Sqrt[
      (shrink * (1-bsw) * rLiq  * liq)^2 +
      (shrink * liq     * rBsw  * bsw)^2 +
      ((1-bsw) * liq    * rShr  * shrink)^2];
    AssertNear["sep_oil_std uncertainty matches manual formula",
               result["sep_oil_std"][[2]], sigExpected, 0.001]];

  Print["    mpfm_oil    = ", result["mpfm_oil"]];
  Print["    sep_oil_std = ", result["sep_oil_std"]];
  Print["    sep_wc      = ", result["sep_wc"]];
  Print["    mpfm_gor    = ", result["mpfm_gor"]]];

(* ── Test 3: Full timeseries analysis ───────────────────────────────────── *)

Print["\n── 3. IMSAnalyzeMPFM — timeseries ────────────────"];

analyzed = IMSAnalyzeMPFM[aggRows, pvt, unc, meterIds];

AssertTrue["result length = input length", Length[analyzed] == 10];
AssertTrue["all rows have sep_oil_std",
           And @@ (KeyExistsQ[#, "sep_oil_std"]& /@ analyzed)];
AssertTrue["all sep_gas_std are Around",
           And @@ ((Head[#["sep_gas_std"]] === Around)& /@ analyzed)];

(* ── Test 4: Around uncertainty is always non-negative ─────────────────── *)

Print["\n── 4. Uncertainty non-negativity ─────────────────"];

Module[{keys = {"mpfm_oil", "mpfm_gas", "mpfm_water", "mpfm_liquid",
                "sep_free_water", "sep_oil_std", "sep_liquid_std",
                "sep_gas_std", "mpfm_wc", "sep_wc", "mpfm_gor", "sep_gor"},
        getUnc, failures},
  (* Safe uncertainty extraction — works on Around or plain numeric *)
  getUnc[v_] := If[Head[v] === Around, v[[2]], 0.];
  failures = Reap[
    Do[
      Do[
        Module[{u = getUnc[analyzed[[r]][k]]},
          If[!(TrueQ[u >= 0]),
            Sow[{r, k, analyzed[[r]][k]}]]],
        {k, keys}],
      {r, Length[analyzed]}]
  ][[2]];
  If[failures === {} || failures === {{}},
    $passed++; Print["  \[Checkmark] PASS  all uncertainties >= 0"],
    $failed++;  Print["  \[Times] FAIL  all uncertainties >= 0"];
    Scan[Print["    Row ", #[[1]], "  key=", #[[2]], "  val=", #[[3]]]&,
         First[failures]]]];

(* ── Test 5: sep_wc + sep_oil_fraction ≈ 100% check ──────────────────── *)

Print["\n── 5. Separator WC consistency ───────────────────"];

Module[{r = First[analyzed],
        sepFW, sepOil, sepLiq, wcCalc},
  sepFW   = r["sep_free_water"][[1]];
  sepOil  = r["sep_oil_std"][[1]];
  sepLiq  = r["sep_liquid_std"][[1]];
  wcCalc  = sepFW / sepLiq * 100.0;
  AssertNear["sep_wc nominal consistent with sep_free_water / sep_liquid_std",
             r["sep_wc"][[1]], wcCalc, 1*^-5]];

(* ── Test 6: Comparison table structure ─────────────────────────────────── *)

Print["\n── 6. IMSBuildComparisonTable ────────────────────"];

table = IMSBuildComparisonTable[analyzed];

AssertTrue["6 phases in table", Length[table] == 6];
AssertTrue["all records are Associations", And @@ (AssociationQ /@ table)];
AssertTrue["oil phase present",  MemberQ[table[[All, "phase"]], "oil"]];
AssertTrue["gas phase present",  MemberQ[table[[All, "phase"]], "gas"]];
AssertTrue["gor phase present",  MemberQ[table[[All, "phase"]], "gor"]];

Module[{oilRow = SelectFirst[table, #["phase"] === "oil"&]},
  AssertTrue["oil n_samples = 10", oilRow["n_samples"] == 10];
  AssertTrue["oil acceptance_limit = 0.05", oilRow["acceptance_limit"] == 0.05];
  AssertTrue["oil within_acceptance is True or False",
             oilRow["within_acceptance"] === True || oilRow["within_acceptance"] === False];
  AssertTrue["ci95 lower < mean < upper",
             oilRow["ci95_rel_lower"] < oilRow["mean_rel_deviation"] < oilRow["ci95_rel_upper"]];
  AssertTrue["p_value in [0,1]", 0 <= oilRow["p_value"] <= 1];
  AssertTrue["sigma_rel_dev >= 0", oilRow["sigma_rel_dev"] >= 0];
  Print["    Oil — mean rel dev: ",
        NumberForm[oilRow["mean_rel_deviation"] * 100, {5, 2}], "%",
        "  z=", NumberForm[oilRow["z_statistic"], {4,2}],
        "  p=", NumberForm[oilRow["p_value"], {5,4}],
        "  within=", oilRow["within_acceptance"]]];

(* ── Test 7: z-test sanity — perfect agreement → z≈0 ─────────────────── *)

Print["\n── 7. Z-test sanity — perfect MPFM=Sep data ──────"];

Module[{perfectRows, pAnalyzed, pTable, oilRow, noUnc},
  noUnc = <|"r_sep_liquid" -> 0., "r_sep_gas" -> 0.,
             "r_mpfm_oil" -> 0., "r_mpfm_gas" -> 0., "r_mpfm_water" -> 0.,
             "r_bsw" -> 0., "r_oil_shrinkage" -> 0., "r_flash_factor" -> 0.|>;
  (* Construct rows where MPFM exactly matches sep reference *)
  perfectRows = Table[
    Module[{sepLiq = 1000., oilFrac = (1 - pvt["bsw"]) * pvt["oil_shrinkage"],
            oilPerMeter, waterPerMeter, gasPerMeter, sepGas = 500.},
      oilPerMeter   = sepLiq * oilFrac / 2.0;
      waterPerMeter = sepLiq * pvt["bsw"] / 2.0;
      (* Inverse of gas conversion: mscf = (sep_gas + flash) / 2 meters,
         raw gas (mmscf) = mscf / 1000 *)
      gasPerMeter = (sepGas + sepLiq * oilFrac * pvt["flash_factor"] / 1000.) / 2.0 / 1000.0;
      <|"sep_total_liquid" -> sepLiq,
        "sep_gas"          -> sepGas,
        "mpfm1_oil"        -> oilPerMeter,
        "mpfm1_water"      -> waterPerMeter,
        "mpfm1_gas"        -> gasPerMeter,
        "mpfm2_oil"        -> oilPerMeter,
        "mpfm2_water"      -> waterPerMeter,
        "mpfm2_gas"        -> gasPerMeter|>],
    {5}];
  pAnalyzed = IMSAnalyzeMPFM[IMSAggregateMPFM[perfectRows, meterIds], pvt, noUnc, meterIds];
  pTable    = IMSBuildComparisonTable[pAnalyzed];
  oilRow    = SelectFirst[pTable, #["phase"] === "oil"&];
  AssertNear["perfect data: mean_rel_dev ≈ 0",
             oilRow["mean_rel_deviation"], 0.0, 0.001];
  Print["    Perfect oil mean rel dev = ",
        NumberForm[oilRow["mean_rel_deviation"], 8]]];

(* ── Test 8: Around arithmetic vs manual formula ─────────────────────────── *)

Print["\n── 8. Around vs manual partial-derivative formula ─"];

Module[{liq = 1000., bswV = 0.10, shrinkV = 0.92,
        rLiq = 0.01, rBsw = 0.02, rShr = 0.05,
        (* Manual formula for sep_oil_std = liq*(1-bsw)*shrink *)
        sigManual, sigAround,
        liqA, bswA, shrinkA, result},
  sigManual = Sqrt[
    (shrinkV * (1-bswV) * rLiq * liq)^2 +
    (shrinkV * liq      * rBsw * bswV)^2 +
    ((1-bswV) * liq     * rShr * shrinkV)^2];

  liqA    = Around[liq,     rLiq * liq];
  bswA    = Around[bswV,    rBsw * bswV];
  shrinkA = Around[shrinkV, rShr * shrinkV];
  result  = liqA * (1.0 - bswA) * shrinkA;
  sigAround = result[[2]];

  Print["    σ manual = ", NumberForm[sigManual, 7]];
  Print["    σ Around = ", NumberForm[sigAround, 7]];
  AssertNear["Around matches manual Gaussian propagation",
             sigAround, sigManual, 1*^-4]];

(* ── Summary ──────────────────────────────────────────────────────────────── *)

Print[""];
Print["══════════════════════════════════════════════"];
Print["  Passed: ", $passed, "   Failed: ", $failed];
Print["══════════════════════════════════════════════"];
Print[""];

If[$failed > 0, Exit[1], Exit[0]]
