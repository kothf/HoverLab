# Physics validation against literature

This note checks each model in `src/engine` against textbooks, papers and public test data. It lists what was confirmed, what was fixed, and what is still an engineering estimate. Tests that pin these checks live in `src/engine/engine.test.ts` under "literature checks".

## Summary

| Area | Model in HoverLab | Verdict |
|---|---|---|
| Atmosphere | ISA barometric formula, ideal gas density, a ∝ √T | Correct. Within about 0.05 % of the 1976 Standard Atmosphere tables up to 5 km. |
| Prop thrust and power | T = C_T·ρ·n²·D⁴, P = C_P·ρ·n³·D⁵ | Correct; the same convention as the UIUC Propeller Data Site. |
| Prop coefficient estimate | Fit of C_T, C_P to P/D and blade count | Plausible. Figure of merit stays about 0.53–0.71 over P/D 0.3–1.1 and 2–6 blades, inside the 0.5–0.7 range reported for small props. |
| Motor | Drela first-order DC model: V = ω/Kv + I·R, Q = (I − I₀)·Kt | Correct. Kt constant fixed from 9.5488 to the exact 60/2π = 9.5493 (0.005 %, cosmetic). |
| No-load current vs speed | I₀ scaled by √(rpm / rpm_test) | Engineering estimate. Drela's second-order model uses I₀ = I₀₀ + I₀₁·Ω + I₀₂·Ω²; the square root sits between hysteresis (constant) and eddy-current (linear) behaviour. Kept. |
| ESC | Averaged PWM buck: τ·V_bat = V_m + I·R_esc, I_bat = τ·I | Correct; same as Shi, Quan et al. Switching losses are not modelled. |
| Battery | Thevenin source V = V_oc − I·R, V_oc = S × nominal cell voltage, t = C·usable / I | Standard first-order model (eCalc, Quan). Using nominal voltage as the average is fine for flight time; Peukert effect for Li-polymer is close to 1 and ignored. |
| Kv / cell matcher | Rewind at equal mass: R ∝ 1/Kv², I₀ ∝ Kv | Correct (turns ∝ 1/Kv, same copper volume). |
| Coaxial X8 | Lower prop C_T × 0.8 (average 0.9) | Plausible. Gives ~17 % more power at equal thrust; Harrington's NACA coaxial tests and Leishman's analysis give 16–28 % induced-power penalty. |
| Tip Mach | π·D·n / a | Correct. |
| **Forward flight and climb** | **Was: static hover power at the tilted thrust. Now: momentum theory (Glauert).** | **Fixed. See below.** |
| Motor thermal | First-order RC, R_th ∝ m^−0.6, c = 700 J/(kg·K) | Engineering estimate, not validated. See open items. |

## Fixed: forward-flight and climb power

**What was wrong.** Range, top speed and climb rate used the static prop map at the thrust needed to hold the craft up against drag. That map knows nothing about airspeed, so two effects from momentum theory were missing:

1. *Translational lift.* In forward flight a rotor moves through fresh air, the induced velocity falls (v_i → v_h²/V) and induced power drops. A multicopter cruising slowly needs less power than in hover.
2. *Parasite and climb work.* The power to push the body through the air (D·V) and to climb (W·V_c) was never added. Power only grew because thrust grew with drag, which is a second-order effect.

The result was a power curve that stayed almost flat with speed, so the "best range" speed always landed at the top of the sweep (the pitch-speed cap), and range was overestimated at high speed.

**What it does now** (`opInFlight` and `inducedVelocity` in `solver.ts`):

- Induced velocity from Glauert's formula for a disk in oblique flow: v_i = v_h² / √(V_p² + (V_n + v_i)²), where V_n = V·sinθ is the flow through the forward-tilted disk and V_p = V·cosθ the flow along it. This reduces exactly to hover, to the axial-climb solution v_i = −V_c/2 + √((V_c/2)² + v_h²), and to v_i ≈ v_h²/V at high speed.
- The static map still gives rpm and hover shaft power P_s. P_s is split into ideal induced power T·v_h and the rest (profile drag and induced losses, set by the prop's figure of merit). In flight the ideal part becomes T·(v_i + V_n), which includes parasite and climb work, and the profile part grows by (1 + 4.65 μ²) with advance ratio μ.
- Climb rate and top speed are the speeds where full throttle can no longer supply that power. The existing caps at 0.6 and 0.85 × pitch speed stay, because the static map overestimates thrust when the prop unloads.

**Check against the literature.** Bauersfeld and Scaramuzza (2022) use a blade-element momentum model validated against flight data and give, for multicopters in general, best-endurance power P_e/P_h ≈ 0.91 and best-range power P_r/P_h ≈ 1.09. HoverLab now gives a dip below hover power at low speed, and battery current at the best-range speed of 0.88–1.18 × hover across the presets.

**Effect on the presets** (before → after):

| Preset | Best-range speed | Range | Time at best range | Top speed | Climb |
|---|---|---|---|---|---|
| 5" freestyle 6S | 13.6 → 12.0 m/s | 10.2 → 8.9 km | 12.5 → 12.4 min | 46.7 → 43.8 m/s | 32.9 (cap) |
| 3" cinewhoop 4S | 11.9 → 10.2 m/s | 4.6 → 4.2 km | 6.4 → 6.8 min | 31.8 → 29.2 m/s | 30.0 → 27.3 m/s |
| 7" long range 6S3P Li-ion | 16.0 → 13.7 m/s | 29.7 → 26.9 km | 31.0 → 32.7 min | 27.4 (cap) | 19.3 (cap) |
| 450 camera quad 3S | 13.6 → 11.5 m/s | 13.4 → 12.2 km | 16.5 → 17.6 min | 13.6 (cap) | 9.6 (cap) |
| 650 endurance 6S | 12.8 (cap) | 19.7 → 20.1 km | 25.7 → 26.1 min | 12.8 (cap) | 9.0 (cap) |
| X8 heavy lift 12S | 9.6 (cap) | 14.6 → 16.6 km | 25.3 → 28.8 min | 9.6 (cap) | 6.8 (cap) |

Hover time, hover throttle, max thrust and currents are unchanged.

## Open items (not changed, worth measuring)

- **Motor thermal model.** R_th = 15/m^0.6 °C/W and c = 700 J/(kg·K) are not from a source. A materials-weighted heat capacity (steel stator ~460, copper 385, aluminium bell ~900, NdFeB ~440 J/(kg·K)) gives about 550, and forced-convection cooling should grow with prop-wash speed (Nu ∝ Re^0.6–0.8), which the model ignores. Until then, treat the full-throttle temperature as a rough indicator. A bench run with a thermocouple would let us calibrate both constants.
- **Default cell resistance.** k/Ah gives 0.9 mΩ for a 5000 mAh LiPo cell, while charger readings for such cells are usually 2–4 mΩ. This only matters when the user leaves resistance at the default; a k/Ah^0.6 law fits hobby data better but needs a better source.
- **Prop map at speed.** Thrust at full throttle is taken from static data. The UIUC data show C_T falling roughly linearly with advance ratio J, so top speed and climb above ~0.5 × pitch speed are still optimistic. Using measured C_T(J), C_P(J) tables would remove the caps.

## Sources

- U.S. Standard Atmosphere, 1976 (NOAA/NASA/USAF), NASA-TM-X-74335. ISA tables used for the atmosphere test.
- J. Brandt, M. Selig, "Propeller Performance Data at Low Reynolds Numbers", AIAA 2011-1255. https://m-selig.web.engr.illinois.edu/pubs/BrandtSelig-2011-AIAA-2011-1255-LRN-Propellers.pdf
- UIUC Propeller Data Site, vols. 1–4. https://m-selig.ae.illinois.edu/props/propDB.html
- M. Drela, "First-Order DC Electric Motor Model" and "Second-Order DC Electric Motor Model" (QPROP documentation), MIT. https://web.mit.edu/drela/Public/web/qprop/motorprop.pdf
- J. G. Leishman, *Principles of Helicopter Aerodynamics*, 2nd ed., Cambridge University Press, 2006. Ch. 2 (momentum theory, hover, climb, figure of merit), Ch. 5 (forward-flight power, profile factor 1 + 4.65 μ²), coaxial rotor analysis.
- R. C. Harrington, "Full-Scale-Tunnel Investigation of the Static-Thrust Performance of a Coaxial Helicopter Rotor", NACA TN-2318, 1951.
- L. Bauersfeld, D. Scaramuzza, "Range, Endurance, and Optimal Speed Estimates for Multicopters", IEEE Robotics and Automation Letters, 2022. https://arxiv.org/abs/2109.04741
- D. Shi, X. Dai, X. Zhang, Q. Quan, "A Practical Performance Evaluation Method for Electric Multicopters", IEEE/ASME Transactions on Mechatronics 22(3), 2017; and Q. Quan, *Introduction to Multicopter Design and Control*, Springer, 2017 (ESC and battery models).
- B. Theys, G. Dimitriadis, P. Hendrick, J. De Schutter, "Influence of propeller configuration on propulsion system efficiency of multi-rotor UAVs", ICUAS 2016 (coaxial and overlap losses; full text not openly available).
- F. P. Incropera et al., *Fundamentals of Heat and Mass Transfer* (forced-convection correlations, specific heats).
