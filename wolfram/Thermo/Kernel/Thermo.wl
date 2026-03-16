(* IMS/Thermo — Peng-Robinson EOS, PT Flash, and Two-Stage PVT Properties
   =========================================================================
   Ports the Python thermo package to Wolfram Language.

   Public API
   ----------
   IMSThermoComponent[key]                         — component properties
   IMSPTFlash[comps, zi, T, P]                    — PT flash (successive substitution)
   IMSCalculatePVT[comps, zi, Psep, Tsep]         — two-stage PVT properties
   IMSCalculatePVT[comps, zi, Psep, Tsep, Pstd, Tstd]

   Units: Pressure in Pa, Temperature in K, Density in kg/m³.
*)

BeginPackage["IMS`Thermo`"]

IMSThermoComponent::usage =
  "IMSThermoComponent[key] returns an Association of critical properties for \
the given component key (e.g. \"C1\", \"nC7\"). \
IMSThermoComponent[key, prop] returns a single property (\"Tc\", \"Pc\", \"omega\", \"Mw\").";

IMSPTFlash::usage =
  "IMSPTFlash[comps, zi, T, P] performs an isothermal-isobaric (PT) flash \
on a mixture with component keys comps and mole fractions zi at temperature T (K) \
and pressure P (Pa). Returns an Association with keys beta, xi, yi, ZL, ZV, \
densL (kg/m³), densV (kg/m³), MwL, MwV (g/mol).";

IMSCalculatePVT::usage =
  "IMSCalculatePVT[comps, zi, Psep, Tsep] or \
IMSCalculatePVT[comps, zi, Psep, Tsep, Pstd, Tstd] computes the oil shrinkage \
factor (Bo⁻¹) and flash factor (solution GOR in scf/stb) via a two-stage PT flash. \
Returns an Association with keys oil_shrinkage, flash_factor, beta_sep, beta_std.";

Begin["`Private`"]

(* ── Physical and EOS constants ───────────────────────────────────────────── *)

$R         = 8.31446261815324;   (* J/(mol·K)  gas constant               *)
$PRSigma   = 1.0 + Sqrt[2.0];   (* σ = 1 + √2 (PR EOS)                   *)
$PREpsilon = 1.0 - Sqrt[2.0];   (* ε = 1 − √2 (PR EOS)                   *)
$PRomegaA  = 0.45724;
$PRomegaB  = 0.07780;
$SCFperSTB = 35.3147 / 6.28981; (* (m³ gas / m³ oil) → scf/stb ≈ 5.6146  *)

(* Standard conditions *)
$PStd = 101325.0;   (* Pa  — 1 atm  *)
$TStd = 288.15;     (* K   — 15 °C  *)

(* ── Component database ───────────────────────────────────────────────────── *)
(* Keys: Tc [K], Pc [Pa], omega [−], Mw [g/mol]                             *)

$ComponentDB = <|
  (* Inorganic gases *)
  "N2"  -> <|"name" -> "Nitrogen",         "Tc" -> 126.20, "Pc" -> 3400000.,  "omega" ->  0.037, "Mw" -> 28.013|>,
  "CO2" -> <|"name" -> "Carbon Dioxide",   "Tc" -> 304.12, "Pc" -> 7374000.,  "omega" ->  0.225, "Mw" -> 44.010|>,
  "H2S" -> <|"name" -> "Hydrogen Sulfide", "Tc" -> 373.20, "Pc" -> 8940000.,  "omega" ->  0.094, "Mw" -> 34.082|>,
  "H2O" -> <|"name" -> "Water",            "Tc" -> 647.10, "Pc" -> 22064000., "omega" ->  0.345, "Mw" -> 18.015|>,
  (* Light alkanes C1–C5 *)
  "C1"    -> <|"name" -> "Methane",                    "Tc" -> 190.56, "Pc" -> 4599000., "omega" -> 0.011, "Mw" ->  16.043|>,
  "C2"    -> <|"name" -> "Ethane",                     "Tc" -> 305.32, "Pc" -> 4872000., "omega" -> 0.099, "Mw" ->  30.070|>,
  "C3"    -> <|"name" -> "Propane",                    "Tc" -> 369.83, "Pc" -> 4248000., "omega" -> 0.152, "Mw" ->  44.097|>,
  "iC4"   -> <|"name" -> "Iso-butane",                 "Tc" -> 407.85, "Pc" -> 3640000., "omega" -> 0.181, "Mw" ->  58.122|>,
  "nC4"   -> <|"name" -> "n-Butane",                   "Tc" -> 425.12, "Pc" -> 3796000., "omega" -> 0.200, "Mw" ->  58.122|>,
  "iC5"   -> <|"name" -> "Isopentane",                 "Tc" -> 460.39, "Pc" -> 3381000., "omega" -> 0.227, "Mw" ->  72.150|>,
  "nC5"   -> <|"name" -> "n-Pentane",                  "Tc" -> 469.70, "Pc" -> 3370000., "omega" -> 0.252, "Mw" ->  72.150|>,
  (* C6 *)
  "nC6"        -> <|"name" -> "n-Hexane",       "Tc" -> 507.60, "Pc" -> 3025000., "omega" -> 0.301, "Mw" ->  86.177|>,
  "Cyclohexane"-> <|"name" -> "Cyclohexane",    "Tc" -> 553.50, "Pc" -> 4070000., "omega" -> 0.210, "Mw" ->  84.162|>,
  "Benzene"    -> <|"name" -> "Benzene",        "Tc" -> 562.10, "Pc" -> 4890000., "omega" -> 0.211, "Mw" ->  78.114|>,
  (* C7 *)
  "nC7"    -> <|"name" -> "n-Heptane",     "Tc" -> 540.20, "Pc" -> 2740000., "omega" -> 0.349, "Mw" -> 100.204|>,
  "MeCycC6"-> <|"name" -> "Methylcyclohexane","Tc" -> 572.19, "Pc" -> 3471000., "omega" -> 0.235, "Mw" ->  98.189|>,
  "Toluene"-> <|"name" -> "Toluene",       "Tc" -> 591.80, "Pc" -> 4100000., "omega" -> 0.264, "Mw" ->  92.141|>,
  (* C8 *)
  "nC8"  -> <|"name" -> "n-Octane",  "Tc" -> 568.70, "Pc" -> 2490000., "omega" -> 0.400, "Mw" -> 114.231|>,
  "nC9"  -> <|"name" -> "n-Nonane",  "Tc" -> 594.60, "Pc" -> 2290000., "omega" -> 0.444, "Mw" -> 128.258|>,
  "nC10" -> <|"name" -> "n-Decane",  "Tc" -> 617.70, "Pc" -> 2110000., "omega" -> 0.492, "Mw" -> 142.285|>,
  "nC11" -> <|"name" -> "n-Undecane","Tc" -> 639.10, "Pc" -> 1950000., "omega" -> 0.533, "Mw" -> 156.312|>,
  "nC12" -> <|"name" -> "n-Dodecane","Tc" -> 658.10, "Pc" -> 1820000., "omega" -> 0.574, "Mw" -> 170.338|>,
  "nC13" -> <|"name" -> "n-Tridecane",  "Tc" -> 675.30, "Pc" -> 1680000., "omega" -> 0.617, "Mw" -> 184.365|>,
  "nC14" -> <|"name" -> "n-Tetradecane","Tc" -> 693.00, "Pc" -> 1570000., "omega" -> 0.659, "Mw" -> 198.392|>,
  "nC15" -> <|"name" -> "n-Pentadecane","Tc" -> 708.00, "Pc" -> 1480000., "omega" -> 0.701, "Mw" -> 212.418|>,
  "nC16" -> <|"name" -> "n-Hexadecane", "Tc" -> 723.00, "Pc" -> 1400000., "omega" -> 0.742, "Mw" -> 226.445|>,
  "nC17" -> <|"name" -> "n-Heptadecane","Tc" -> 736.00, "Pc" -> 1340000., "omega" -> 0.771, "Mw" -> 240.472|>,
  "nC18" -> <|"name" -> "n-Octadecane", "Tc" -> 747.00, "Pc" -> 1290000., "omega" -> 0.811, "Mw" -> 254.498|>,
  "nC20" -> <|"name" -> "n-Eicosane",   "Tc" -> 768.10, "Pc" -> 1200000., "omega" -> 0.907, "Mw" -> 282.552|>,
  "nC25" -> <|"name" -> "n-Pentacosane","Tc" -> 812.00, "Pc" ->  989000., "omega" -> 1.109, "Mw" -> 352.686|>,
  "nC30" -> <|"name" -> "n-Triacontane","Tc" -> 849.00, "Pc" ->  832000., "omega" -> 1.301, "Mw" -> 422.820|>,
  (* Oxygenates *)
  "MeOH" -> <|"name" -> "Methanol", "Tc" -> 512.64, "Pc" -> 8097000., "omega" -> 0.565, "Mw" -> 32.042|>,
  "MEG"  -> <|"name" -> "Mono-ethylene-glycol", "Tc" -> 720.00, "Pc" -> 8090000., "omega" -> 0.507, "Mw" -> 62.068|>,
  "TEG"  -> <|"name" -> "Tri-ethylene-glycol",  "Tc" -> 769.50, "Pc" -> 3320000., "omega" -> 1.111, "Mw" -> 150.174|>
|>;

IMSThermoComponent[key_String]              := $ComponentDB[key]
IMSThermoComponent[key_String, prop_String] := $ComponentDB[key][prop]

(* ── Binary Interaction Parameter (BIP) database ────────────────────────── *)
(* Key format: "A|B" where A and B are sorted alphabetically.               *)

$BIPDatabase = <|
  "C1|CO2" -> 0.103,  "C2|CO2" -> 0.130,  "C3|CO2" -> 0.135,
  "CO2|iC4"-> 0.130,  "CO2|nC4"-> 0.130,  "CO2|iC5"-> 0.130,
  "CO2|nC5"-> 0.130,  "CO2|nC6"-> 0.150,  "CO2|nC7"-> 0.150,
  "CO2|nC8"-> 0.150,  "CO2|nC9"-> 0.150,  "CO2|nC10"-> 0.150,
  "CO2|nC11"->0.150,  "CO2|nC12"->0.150,  "CO2|nC13"->0.150,
  "CO2|nC14"->0.150,  "CO2|nC15"->0.150,  "CO2|nC16"->0.150,
  "CO2|nC17"->0.150,  "CO2|nC18"->0.150,  "CO2|nC20"->0.150,
  "Benzene|CO2"->0.080, "CO2|Toluene"->0.080, "CO2|Cyclohexane"->0.080,
  "C1|N2"  -> 0.031,  "C2|N2"  -> 0.050,  "C3|N2"  -> 0.080,
  "iC4|N2" -> 0.080,  "N2|nC4" -> 0.080,  "iC5|N2" -> 0.100,
  "N2|nC5" -> 0.100,  "N2|nC6" -> 0.149,  "N2|nC7" -> 0.149,
  "N2|nC8" -> 0.149,  "N2|nC9" -> 0.149,  "N2|nC10"-> 0.149,
  "Benzene|N2"->0.160,"N2|Toluene"->0.140,"Cyclohexane|N2"->0.100,
  "C1|H2S" -> 0.081,  "C2|H2S" -> 0.076,  "C3|H2S" -> 0.071,
  "H2S|iC4"-> 0.063,  "H2S|nC4"-> 0.063,  "H2S|iC5"-> 0.063,
  "H2S|nC5"-> 0.063,  "H2S|nC6"-> 0.050,
  "C1|H2O" -> 0.490,  "C2|H2O" -> 0.490,  "C3|H2O" -> 0.530,
  "H2O|nC4"-> 0.530,  "H2O|nC5"-> 0.530,  "H2O|nC6"-> 0.530,
  "CO2|H2O"-> 0.109,  "H2O|N2" -> 0.460,  "H2S|H2O"-> 0.040,
  "CO2|N2" -> -0.017, "CO2|H2S"-> 0.097,  "H2S|N2" -> 0.150,
  "Benzene|C1"->0.050,"C1|Toluene"->0.050,"C1|Cyclohexane"->0.050,
  "Benzene|C2"->0.020,"C2|Toluene"->0.020,
  "C1|C2"  -> 0.005,  "C1|C3"  -> 0.010
|>;

(* Look up kij — returns 0.0 if pair not tabulated *)
GetBIP[c1_String, c2_String] :=
  If[c1 === c2, 0.0,
     Lookup[$BIPDatabase, StringRiffle[Sort[{c1, c2}], "|"], 0.0]]

(* ── Peng-Robinson EOS helpers ───────────────────────────────────────────── *)

(* Pure-component PR parameters at temperature T [K] *)
PRComponentParams[key_String, T_?NumericQ] :=
  Module[{c = $ComponentDB[key], Tr, m, alpha},
    Tr    = T / c["Tc"];
    m     = 0.37464 + 1.54226 * c["omega"] - 0.26992 * c["omega"]^2;
    alpha = (1.0 + m * (1.0 - Sqrt[Tr]))^2;
    <|"ai" -> $PRomegaA * ($R * c["Tc"])^2 / c["Pc"] * alpha,
      "bi" -> $PRomegaB * $R * c["Tc"] / c["Pc"]|>]

(* Mixture PR parameters — call with precomputed ai, bi, kij matrix *)
PRMixtureParams[zi_List, ai_List, bi_List, T_?NumericQ, P_?NumericQ, kijMatrix_List] :=
  Module[{bMix, sqAi, aMatrix, aMix, A, B},
    bMix    = N[zi . bi];
    sqAi    = Sqrt[ai];
    aMatrix = Outer[Times, sqAi, sqAi] * (1.0 - kijMatrix);
    aMix    = N[zi . aMatrix . zi];
    A = aMix * P / ($R * T)^2;
    B = bMix * P / ($R * T);
    <|"aMix" -> aMix, "bMix" -> bMix, "A" -> A, "B" -> B, "aMatrix" -> aMatrix|>]

(* Solve PR cubic Z³ + c₂Z² + c₁Z + c₀ = 0; return sorted real roots *)
PRSolveZ[A_?NumericQ, B_?NumericQ] :=
  Module[{c2 = B - 1.0, c1 = A - 3.0*B^2 - 2.0*B, c0 = B^3 + B^2 - A*B,
          roots, realRoots},
    roots     = z /. NSolve[z^3 + c2*z^2 + c1*z + c0 == 0, z];
    realRoots = Sort[Re[#]& /@ Select[roots, Abs[Im[#]] < 1.0*^-7 &]];
    If[realRoots === {}, realRoots = {Re[First[roots]]}];
    realRoots]

(* Fugacity coefficients for all components — uses precomputed aMatrix *)
PRFugacityCoeffs[zi_List, T_?NumericQ, P_?NumericQ, Z_?NumericQ,
                 ai_List, bi_List, aMix_?NumericQ, bMix_?NumericQ,
                 A_?NumericQ, B_?NumericQ, aMatrix_List] :=
  Module[{nc = Length[zi], sig = $PRSigma, eps = $PREpsilon,
          term2, term5, term3, dAdn, lnPhiVec},
    term2 = Log[Z - B];
    term5 = Log[(Z + sig * B) / (Z + eps * B)];
    term3 = A / (B * (sig - eps));
    (* dA/dn_i = 2 * Σ_j z_j √(aᵢaⱼ)(1−kᵢⱼ) = 2 * (zi . aMatrix[[i]]) *)
    lnPhiVec = Table[
      dAdn = 2.0 * (zi . aMatrix[[i]]);
      (bi[[i]] / bMix) * (Z - 1.0) - term2
        - term3 * (dAdn / aMix - bi[[i]] / bMix) * term5,
      {i, nc}];
    Exp /@ lnPhiVec]

(* ── PT Flash — Successive Substitution ─────────────────────────────────── *)

(* Wilson K-value initialisation *)
WilsonK[c_Association, T_?NumericQ, P_?NumericQ] :=
  (c["Pc"] / P) * Exp[5.37 * (1.0 + c["omega"]) * (1.0 - c["Tc"] / T)]

(* Rachford-Rice — Newton-Raphson solver for vapour fraction β ∈ (0, 1) *)
RachfordRice[Ki_List, zi_List] :=
  Module[{nc = Length[Ki], beta = 0.5, f, df, res, dres},
    f[b_]  :=  Total@MapThread[(#1 * (#2 - 1.0)) / (1.0 + b * (#2 - 1.0)) &, {zi, Ki}];
    df[b_] := -Total@MapThread[(#1 * (#2 - 1.0)^2) / (1.0 + b * (#2 - 1.0))^2 &, {zi, Ki}];
    Do[res = f[beta];
       If[Abs[res] < 1.0*^-12, Break[]];
       dres = df[beta];
       If[Abs[dres] > 0.0, beta = Clip[beta - res/dres, {1.0*^-10, 1.0 - 1.0*^-10}]],
       {50}];
    beta]

(* Main PT flash calculation *)
IMSPTFlash[comps_List, ziRaw_List, T_?NumericQ, P_?NumericQ] :=
  Module[{nc, zi, compData, MwArr, paramsArr, ai, bi, kijMatrix,
          Ki, beta, xi, yi, mixL, mixV, ZL, ZV, phiL, phiV, KiNew,
          error, densL, densV},

    nc      = Length[comps];
    zi      = N[ziRaw / Total[ziRaw]];   (* normalise *)
    compData= $ComponentDB[#]& /@ comps;
    MwArr   = #["Mw"]& /@ compData;

    (* EOS parameters at T (composition-independent) *)
    paramsArr = PRComponentParams[#, T]& /@ comps;
    ai        = #["ai"]& /@ paramsArr;
    bi        = #["bi"]& /@ paramsArr;

    (* Precompute kij matrix — avoids repeated Association lookups *)
    kijMatrix = Table[GetBIP[comps[[i]], comps[[j]]], {i, nc}, {j, nc}];

    (* Initial K-values (Wilson correlation) *)
    Ki   = WilsonK[#, T, P]& /@ compData;
    beta = 0.5;
    xi   = zi;
    yi   = zi;
    ZL   = 0.5;
    ZV   = 0.5;

    Do[
      beta = RachfordRice[Ki, zi];

      (* Phase compositions *)
      xi = Table[zi[[i]] / (1.0 + beta * (Ki[[i]] - 1.0)), {i, nc}];
      yi = Ki * xi;
      xi /= Total[xi];
      yi /= Total[yi];

      (* Liquid phase *)
      mixL = PRMixtureParams[xi, ai, bi, T, P, kijMatrix];
      ZL   = First[PRSolveZ[mixL["A"], mixL["B"]]];
      phiL = PRFugacityCoeffs[xi, T, P, ZL, ai, bi,
               mixL["aMix"], mixL["bMix"], mixL["A"], mixL["B"], mixL["aMatrix"]];

      (* Vapour phase *)
      mixV = PRMixtureParams[yi, ai, bi, T, P, kijMatrix];
      ZV   = Last[PRSolveZ[mixV["A"], mixV["B"]]];
      phiV = PRFugacityCoeffs[yi, T, P, ZV, ai, bi,
               mixV["aMix"], mixV["bMix"], mixV["A"], mixV["B"], mixV["aMatrix"]];

      (* Update K-values and check convergence *)
      KiNew = phiL / phiV;
      error = Total[(KiNew / Ki - 1.0)^2];
      Ki    = KiNew;
      If[error < 1.0*^-8, Break[]],
      {100}];  (* max iterations *)

    densL = P / (ZL * $R * T) * (xi . MwArr) / 1000.0;
    densV = P / (ZV * $R * T) * (yi . MwArr) / 1000.0;

    <|"beta"  -> beta,
      "xi"    -> xi,
      "yi"    -> yi,
      "ZL"    -> ZL,
      "ZV"    -> ZV,
      "densL" -> densL,
      "densV" -> densV,
      "MwL"   -> xi . MwArr,
      "MwV"   -> yi . MwArr|>]

(* ── Two-Stage PVT Properties ───────────────────────────────────────────── *)
(*
   Stage 1: Flash wellstream at (Psep, Tsep) → separator liquid composition
   Stage 2: Flash separator liquid at (Pstd, Tstd) → stock-tank properties

   oil_shrinkage = V_stock_tank_oil / V_separator_liquid  (Bo⁻¹, dimensionless)
   flash_factor  = V_liberated_gas / V_stock_tank_oil     (scf/stb)
*)

IMSCalculatePVT[comps_List, zi_List, Psep_?NumericQ, Tsep_?NumericQ,
                Pstd_: Automatic, Tstd_: Automatic] :=
  Module[{pStd, tStd, s1, betaSep, xiSep, rhoLSep, MwLSep,
          s2, betaStd, rhoLStd, rhoVStd, MwLStd, MwVStd,
          Vsep, VoilStd, VgasStd, oilShrinkage, flashFactor},

    pStd = If[Pstd === Automatic, $PStd, Pstd];
    tStd = If[Tstd === Automatic, $TStd, Tstd];

    (* Stage 1: separator flash *)
    s1       = IMSPTFlash[comps, zi, Tsep, Psep];
    betaSep  = s1["beta"];
    xiSep    = s1["xi"];
    rhoLSep  = s1["densL"];
    MwLSep   = s1["MwL"];

    If[betaSep >= 1.0 - 1.0*^-6,
       Message[IMSCalculatePVT::novapour];
       Return[$Failed]];

    (* Stage 2: stock-tank flash of separator liquid *)
    s2      = IMSPTFlash[comps, xiSep, tStd, pStd];
    betaStd = s2["beta"];
    rhoLStd = s2["densL"];
    rhoVStd = s2["densV"];
    MwLStd  = s2["MwL"];
    MwVStd  = s2["MwV"];

    (* Molar volumes [m³/mol] : V = (Mw [g/mol] / 1000) / ρ [kg/m³] *)
    Vsep    = (MwLSep / 1000.0) / rhoLSep;
    VoilStd = (1.0 - betaStd) * (MwLStd / 1000.0) / rhoLStd;

    oilShrinkage = VoilStd / Vsep;

    flashFactor =
      If[betaStd < 1.0*^-6 || VoilStd < 1.0*^-15,
         0.0,
         VgasStd = betaStd * (MwVStd / 1000.0) / rhoVStd;
         (VgasStd / VoilStd) * $SCFperSTB];

    <|"oil_shrinkage" -> oilShrinkage,
      "flash_factor"  -> flashFactor,
      "beta_sep"      -> betaSep,
      "beta_std"      -> betaStd|>]

IMSCalculatePVT::novapour =
  "The fluid is entirely vapour at the specified separator conditions — \
no liquid phase exists.";

End[]  (* `Private` *)

EndPackage[]
