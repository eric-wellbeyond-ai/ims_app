#!/usr/bin/env wolframscript
(* TestThermo.wls — Unit tests for the IMS/Thermo paclet
   Run with:  wolframscript -script Tests/TestThermo.wls
*)

Print[""];
Print["╔══════════════════════════════════════════════╗"];
Print["║          IMS/Thermo — Test Suite             ║"];
Print["╚══════════════════════════════════════════════╝"];

(* Load the Thermo kernel directly (no paclet install required) *)
Get[FileNameJoin[{DirectoryName[$InputFileName], "..", "Thermo", "Kernel", "Thermo.wl"}]];

(* ── Simple assertion helpers ─────────────────────────────────────────────── *)

$passed = 0; $failed = 0;

AssertNear[label_, got_, expected_, tol_: 0.01] :=
  If[Abs[(got - expected) / Max[Abs[expected], 1*^-10]] < tol,
     $passed++;
     Print["  \[Checkmark] PASS  ", label],
     $failed++;
     Print["  \[Times] FAIL  ", label,
           "  got=", NumberForm[N[got], 6],
           "  expected≈", NumberForm[N[expected], 6]]];

AssertTrue[label_, cond_] :=
  If[TrueQ[cond],
     $passed++; Print["  \[Checkmark] PASS  ", label],
     $failed++; Print["  \[Times] FAIL  ", label]];

(* ── Test 1: Component database ──────────────────────────────────────────── *)

Print["\n── 1. Component Database ─────────────────────────"];

AssertNear["C1  Tc",    IMSThermoComponent["C1",  "Tc"],  190.56, 1*^-4];
AssertNear["C1  Pc",    IMSThermoComponent["C1",  "Pc"],  4599000., 1*^-4];
AssertNear["C1  omega", IMSThermoComponent["C1",  "omega"], 0.011, 1*^-4];
AssertNear["C1  Mw",    IMSThermoComponent["C1",  "Mw"],   16.043, 1*^-4];
AssertNear["nC7 Tc",    IMSThermoComponent["nC7", "Tc"],  540.20, 1*^-4];
AssertNear["CO2 Pc",    IMSThermoComponent["CO2", "Pc"],  7374000., 1*^-4];

(* ── Test 2: BIP database ────────────────────────────────────────────────── *)

Print["\n── 2. Binary Interaction Parameters ──────────────"];

AssertNear["BIP C1-CO2",  IMS`Thermo`Private`GetBIP["C1",  "CO2"],  0.103, 1*^-4];
AssertNear["BIP CO2-C1 (symmetric)", IMS`Thermo`Private`GetBIP["CO2", "C1"], 0.103, 1*^-4];
AssertNear["BIP C1-C1 (self)",       IMS`Thermo`Private`GetBIP["C1",  "C1"], 0.0,   1*^-10];
AssertNear["BIP missing pair → 0",   IMS`Thermo`Private`GetBIP["nC7", "nC8"], 0.0,  1*^-10];

(* ── Test 3: PR EOS cubic solver ─────────────────────────────────────────── *)

Print["\n── 3. PR Cubic Z Solver ───────────────────────────"];
(* Verify roots satisfy the cubic *)
Module[{A = 0.8, B = 0.2, roots, residuals},
  roots = IMS`Thermo`Private`PRSolveZ[A, B];
  residuals = Abs[#^3 + (B-1)*#^2 + (A - 3B^2 - 2B)*# + (B^3 + B^2 - A*B)]& /@ roots;
  AssertTrue["cubic roots satisfy equation", Max[residuals] < 1*^-8];
  AssertTrue["roots sorted ascending",       OrderedQ[roots]];
  Print["    roots = ", NumberForm[#, 6]& /@ roots]];

(* ── Test 4: PT Flash — pure methane (should be all vapour at low P) ──────── *)

Print["\n── 4. PT Flash — C1 (pure) ────────────────────────"];

Module[{res, T = 300.0, P = 1*^5},  (* 1 bar, 300 K — supercritical for C1 *)
  res = IMSPTFlash[{"C1"}, {1.0}, T, P];
  AssertTrue["beta ∈ [0,1]",        0.0 <= res["beta"] <= 1.0];
  AssertNear["xi sums to 1",        Total[res["xi"]], 1.0, 1*^-6];
  AssertNear["yi sums to 1",        Total[res["yi"]], 1.0, 1*^-6];
  AssertTrue["densL > 0",           res["densL"] > 0];
  AssertTrue["densV > 0",           res["densV"] > 0];
  (* For a pure supercritical fluid, successive substitution reaches the trivial
     solution (Ki→1) — both phases collapse to the same composition.
     The algorithm returns beta=0.5 (any β satisfies Rachford-Rice here). *)
  AssertNear["trivial solution: xi ≈ yi (pure supercritical)",
             Total[Abs[res["xi"] - res["yi"]]], 0.0, 1*^-5];
  Print["    beta = ", NumberForm[res["beta"], 6]]];

(* ── Test 5: PT Flash — C1/nC7 binary at separator conditions ─────────────── *)

Print["\n── 5. PT Flash — C1/nC7 binary (Psep=50 bar, Tsep=80°C) ──"];

Module[{res, comps = {"C1", "nC7"}, zi = {0.5, 0.5},
        T = 353.15, P = 5*^6},
  res = IMSPTFlash[comps, zi, T, P];

  Print["    beta  = ", NumberForm[res["beta"],  6]];
  Print["    xi    = ", NumberForm[#, 5]& /@ res["xi"]];
  Print["    yi    = ", NumberForm[#, 5]& /@ res["yi"]];
  Print["    densL = ", NumberForm[res["densL"], 6], " kg/m³"];
  Print["    densV = ", NumberForm[res["densV"], 6], " kg/m³"];

  AssertTrue["beta ∈ (0,1) — two-phase",    0.001 < res["beta"] < 0.999];
  AssertNear["xi sums to 1",                Total[res["xi"]], 1.0, 1*^-5];
  AssertNear["yi sums to 1",                Total[res["yi"]], 1.0, 1*^-5];
  (* Liquid should be heptane-rich *)
  AssertTrue["xi[nC7] > xi[C1] (liquid heptane-rich)", res["xi"][[2]] > res["xi"][[1]]];
  (* Vapour should be methane-rich *)
  AssertTrue["yi[C1] > yi[nC7] (vapour methane-rich)", res["yi"][[1]] > res["yi"][[2]]];
  AssertTrue["liquid denser than vapour",   res["densL"] > res["densV"]];
  (* Rough density range for liquid heptane at these conditions *)
  AssertTrue["liquid density plausible (300–700 kg/m³)", 300 < res["densL"] < 700]];

(* ── Test 6: PT Flash — mass-balance check ──────────────────────────────── *)

Print["\n── 6. PT Flash mass-balance (Σ z_i = β y_i + (1-β) x_i) ─"];

Module[{res, zi = {0.5, 0.5}, beta, xi, yi, lhs, rhs, err},
  res  = IMSPTFlash[{"C1", "nC7"}, zi, 353.15, 5*^6];
  beta = res["beta"]; xi = res["xi"]; yi = res["yi"];
  lhs  = zi;
  rhs  = beta * yi + (1 - beta) * xi;
  err  = Max[Abs[lhs - rhs]];
  Print["    max |z - β·y - (1-β)·x| = ", NumberForm[err, 3]];
  AssertTrue["mass balance error < 1e-6", err < 1*^-6]];

(* ── Test 7: Two-stage PVT for a typical oil composition ─────────────────── *)

Print["\n── 7. Two-Stage PVT — C1(30%)/nC4(20%)/nC10(50%) ─"];

Module[{pvt, comps = {"C1", "nC4", "nC10"}, zi = {0.30, 0.20, 0.50},
        Psep = 5*^6, Tsep = 353.15},
  pvt = IMSCalculatePVT[comps, zi, Psep, Tsep];

  If[pvt === $Failed,
    $failed++; Print["  \[Times] FAIL  PVT returned $Failed"],
    Print["    oil_shrinkage = ", NumberForm[pvt["oil_shrinkage"], 6]];
    Print["    flash_factor  = ", NumberForm[pvt["flash_factor"],  6], " scf/stb"];
    Print["    beta_sep      = ", NumberForm[pvt["beta_sep"],      6]];
    Print["    beta_std      = ", NumberForm[pvt["beta_std"],      6]];
    AssertTrue["oil_shrinkage ∈ (0,1)",   0 < pvt["oil_shrinkage"] < 1];
    AssertTrue["flash_factor ≥ 0",        pvt["flash_factor"] >= 0];
    AssertTrue["beta_sep ∈ [0,1)",        0 <= pvt["beta_sep"] < 1];
    AssertTrue["beta_std ∈ [0,1]",        0 <= pvt["beta_std"] <= 1];
    (* Physical expectation: shrinkage for a medium-GOR oil should be 0.7–0.99 *)
    AssertTrue["oil_shrinkage in plausible range (0.7–0.99)",
               0.70 < pvt["oil_shrinkage"] < 0.99]]];

(* ── Test 8: Wellstream with CO2 and N2 (BIPs should be non-zero) ─────────── *)

Print["\n── 8. PT Flash — C1/CO2/nC7 with non-zero BIPs ──"];

Module[{res, comps = {"C1", "CO2", "nC7"}, zi = {0.5, 0.1, 0.4},
        T = 353.15, P = 5*^6},
  res = IMSPTFlash[comps, zi, T, P];
  AssertTrue["converges with BIPs",      res["beta"] >= 0];
  AssertNear["xi sums to 1",             Total[res["xi"]], 1.0, 1*^-5];
  Print["    beta  = ", NumberForm[res["beta"],  5]];
  Print["    densL = ", NumberForm[res["densL"], 5], " kg/m³"]];

(* ── Summary ─────────────────────────────────────────────────────────────── *)

Print[""];
Print["══════════════════════════════════════════════"];
Print["  Passed: ", $passed, "   Failed: ", $failed];
Print["══════════════════════════════════════════════"];
Print[""];

If[$failed > 0, Exit[1], Exit[0]]
