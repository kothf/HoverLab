# Functional Requirements Specification (FRS)
**Project Title:** Professional Quadcopter Calculator & Interactive Optimizer Platform  
**Document Version:** 1.0  
**Target Systems:** Web Application / Desktop GUI (Responsive UI/UX)

---

## 1. Introduction & Overview

### 1.1 Purpose
This document specifies the functional and non-functional requirements for an advanced, web-based/desktop **Professional Quadcopter Calculator & Optimization Engine**. The software simulates electric multirotor powerplants, aerodynamics, battery discharge dynamics, and flight performance metrics with an error tolerance under $\pm 10\%$. It features automated reverse-optimization capabilities and an extensible library of real-world components.

### 1.2 Core Capabilities
* **Interactive Multirotor Flight Simulation:** Real-time physics engine calculating thrust, hover throttle, current draw, temperatures, electrical efficiency, range, climb rate, and max endurance.
* **Inverse Design Optimizer:** Goal-based optimization engine that auto-selects motor $K_v$, propeller diameter/pitch, cell count ($S$), and battery capacity based on target payload, desired flight time, or hover throttle constraints.
* **Standardized Component Library:** Integrated database for frames, motors, propellers, ESCs, batteries, and accessories with parametric filtering and community contribution pipelines.

---

## 2. User Experience & Graphical Interface (UI/UX)

### 2.1 UI Layout Architecture
The interface follows a **dual-pane operational workspace** (Live Configurator on Left/Top, Dynamic Visual Analytics on Right/Bottom).

```
+-----------------------------------------------------------------------------------------+
|                                    TOP NAVIGATION BAR                                   |
| [Presets / Templates] [Load/Save] [Export PDF/CSV] [Unit Switcher: Metric/Imp] [Dark/Light]|
+----------------------------------------------------+------------------------------------+
|  COMPONENT SELECTION & PARAMETERS (Left Pane)      |  DYNAMIC RESULTS & CHARTS (Right)  |
|                                                    |                                    |
|  [>] Atmospheric & Flight Environment              |  +------------------------------+  |
|  [>] Frame & Target Flight Payload                 |  | KPI Metric Cards (Hover/Max) |  |
|  [>] Battery Setup (S/P, C-Rating, Chemistry)      |  +------------------------------+  |
|  [>] ESC Specs (Cont./Burst, Resistance)           |  | Operating Status Indicators  |  |
|  [>] Motor Specs (Kv, Rm, No-load, Weight)         |  | (Thermal, C-Limit, Throttle) |  |
|  [>] Propeller Specs (Dia, Pitch, Blades, PConst)  |  +------------------------------+  |
|                                                    |  | Interactive Performance      |  |
|  +----------------------------------------------+  |  | Curves (Throttle vs Thrust)  |  |
|  |  INVERSE OPTIMIZER PANEL                     |  |  +------------------------------+  |
|  |  Target Payload: [___] g  Endurance: [___] min |  | Detailed Mathematical Tables   |  |
|  |  [ RUN AUTOMATIC DESIGN OPTIMIZER ]          |  |  - Hover / Max / Optimum Eff.  |  |
|  +----------------------------------------------+  +------------------------------------+
+-----------------------------------------------------------------------------------------+
```

### 2.2 UX Principles & Usability Standards
1. **Zero-Latency Reactive Calculations:** Calculations trigger automatically on input change with web-worker asynchronous processing to prevent UI lockup.
2. **Contextual Warnings & Safety Indicators:** Highlighting out-of-spec parameters (e.g., ESC overload, excessive motor temperature, high $C$-rate, insufficient thrust-to-weight ratio).
3. **Smart Search & Autosuggest:** Fuzzy search drop-downs for component selection (e.g., typing `T-Motor 2207` filters relevant $K_v$ variants).
4. **Visual Comparison Mode:** Allows side-by-side overlay of up to 3 distinct drone configurations on performance curves.

---

## 3. Functional Requirements

### 3.1 Input Module & Configuration Specifications

| Module | Field / Parameter | Unit / Type | Description / Constraints |
| :--- | :--- | :--- | :--- |
| **Environment** | Field Elevation | $m$ / $ft$ ASL | Barometric pressure & air density ($\rho$) calculation |
| | Air Temperature | $^\circ C$ / $^\circ F$ | Ambient temperature adjustment for motor cooling & battery |
| **Airframe** | Rotor Configuration | Enum | QuadX, QuadP, Octo Coaxial (Flat vs Coax) |
| | Bare Frame Weight | $g$ / $oz$ | Weight excluding power drive & battery |
| | Payload Weight | $g$ / $oz$ | Additional sensor, gimbal, or camera mass |
| | Max Frame Prop Size | inches | Upper physical limit on prop diameter |
| **Battery** | Cell Chemistry | Enum | LiPo ($3.7V$), LiHV ($3.8V$), LiFePO4 ($3.3V$), Li-ion ($3.6V$) |
| | Serial / Parallel | $S$ / $P$ | Voltage series count ($S$) and capacity parallel count ($P$) |
| | Capacity & C-Rating | $mAh$ / Continuous $C$ | Capacity per cell and continuous/burst discharge rate |
| | Internal Resistance | $m\Omega$ | Resistance per cell |
| **ESC** | Max Current | $A$ | Continuous and burst rating |
| | Internal Resistance | $m\Omega$ | On-resistance ($R_{ds(on)}$) of MOSFETs |
| **Motor** | Motor $K_v$ | $RPM/V$ | No-load speed constant |
| | No-load Current ($I_0$) | $A @ V_0$ | Current draw at specified test voltage |
| | Phase Resistance ($R_m$)| $m\Omega$ | Stator winding resistance |
| | Max Power / Current | $W$ / $A$ | Limit specified by manufacturer (15s rating) |
| **Propeller** | Diameter & Pitch | inches | Geometry specifications |
| | Blade Count | Integer | 2, 3, 4, or multi-blade setups |
| | Power/Thrust Const ($P_p, T_p$)| Float | Empirical propeller constants (e.g., APC, Gemfan, Master Airscrew) |

---

### 3.2 Computational Physics & Calculation Engine

The engine executes simulations based on DC motor electro-mechanical equations, propeller momentum theory, and aerodynamic density variations.

$$\rho = \rho_0 \cdot \frac{P_{alt}}{P_0} \cdot \frac{T_0}{T_{amb}}$$

```
                      +-----------------------------+
                      | Input Configurations & Env  |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      |   Calculated All-Up-Weight  |
                      |   (AUW = Frame+Drive+Bat)   |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      | Required Hover Thrust/Motor |
                      |   T_hover = (AUW * g) / N   |
                      +--------------+--------------+
                                     |
                                     v
        +----------------------------+----------------------------+
        |                                                         |
        v                                                         v
+-------------------------------+                         +-------------------------------+
|    HOVER STATE CALCULATIONS   |                         |  MAXIMUM STATE CALCULATIONS   |
| - Hover RPM (Prop constants)  |                         | - Max Terminal RPM            |
| - Motor Current & Torque      |                         | - Max Thrust & Thrust-to-W    |
| - Voltage Drop (I * R_total)  |                         | - Max Current & Power Draw    |
| - Electrical Power (P_in)     |                         | - Motor Temp & ESC Thermal    |
| - Efficiency (g/W)            |                         | - Max Rate of Climb & Speed   |
+---------------+---------------+                         +---------------+---------------+
                |                                                         |
                +----------------------------+----------------------------+
                                             |
                                             v
                      +-----------------------------+
                      | BATTERY DISCHARGE SIMULATION|
                      | - Flight Time (Hover/Mixed) |
                      | - Usable Capacity & Wh      |
                      +-----------------------------+
```

#### Key Calculation Formulas
1. **Propeller Torque & Power:**
   $$P_{mech} = P_p \cdot \rho \cdot \left(\frac{RPM}{60}\right)^3 \cdot D^5 \cdot Pitch$$
   $$Thrust = T_p \cdot \rho \cdot \left(\frac{RPM}{60}\right)^2 \cdot D^4$$

2. **Motor Electrical Balance:**
   $$V_{m} = V_{bat} - I \cdot (R_{bat} + R_{esc})$$
   $$RPM = (V_{m} - I \cdot R_m) \cdot K_v$$
   $$I = I_0 + \frac{\text{Torque} \cdot K_v}{9.5488}$$

3. **Flight Time Estimation:**
   $$T_{hover} = \frac{\text{Capacity}_{usable} \times 0.80}{I_{hover\_total}} \times 60 \text{ [minutes]}$$

---

### 3.3 System Optimization Engine (Reverse Calculator)

The Inverse Design Optimizer automatically searches the component space to output optimal configurations based on user-defined constraints.

```
                      +-----------------------------+
                      |  USER OPTIMIZATION TARGETS  |
                      | - Required Payload (g)      |
                      | - Target Flight Time (min)  |
                      | - Target Thrust Ratio (>=2) |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      | OPTIMIZATION SEARCH ALGORITHM|
                      | (Multi-Param Iterative Loop)|
                      +--------------+--------------+
                                     |
             +-----------------------+-----------------------+
             |                       |                       |
             v                       v                       v
     [Prop Diameter Sweep]     [Motor Kv Search]     [Battery Cell Count]
             |                       |                       |
             +-----------------------+-----------------------+
                                     |
                                     v
                      +-----------------------------+
                      | VALIDATION & RANKING FILTER |
                      | - Thermal Safety Check      |
                      | - Structural Limits Check   |
                      | - Efficiency Sorting (g/W)  |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      | TOP 5 OPTIMAL CONFIGURATIONS|
                      +-----------------------------+
```

* **Optimization Modes:**
  1. **Maximum Flight Endurance Mode:** Maximizes hover time for a fixed payload by optimizing prop-diameter-to-$K_v$ ratio and battery weight fraction.
  2. **Maximum Payload / Lift Capacity Mode:** Maximizes excess thrust and thermal headroom for commercial/industrial carry limits.
  3. **$K_v$ & Battery Cell Matcher:** Auto-calculates exact motor $K_v$ required when switching battery cell count ($S$) to maintain identical thrust dynamics.

---

### 3.4 Component Database Management

The application features a built-in standard database stored in JSON/SQL format with the following schema and preset component libraries:

```
                  +-----------------------------------+
                  |     COMPONENT DATABASE ENGINE     |
                  +-----------------+-----------------+
                                    |
     +-----------------+------------+------------+-----------------+
     |                 |                         |                 |
     v                 v                         v                 v
+----------+     +-----------+             +-----------+     +-----------+
| MOTORS   |     | PROPELLERS|             | BATTERIES |     | ESCs      |
| T-Motor  |     | HQProp    |             | Tattu     |     | Hobbywing |
| Sunnysky |     | Gemfan    |             | Ovonic    |     | Spedix    |
| BrotherH |     | APC       |             | Sony VTC  |     | Holybro   |
| iFlight  |     | MasterAir |             | Samsung   |     | BetaFPV   |
+----------+     +-----------+             +-----------+     +-----------+
```

* **Database Capabilities:**
  * **Custom User Components:** Allows users to define custom motors ($K_v, R_m, I_0, W_{max}$), batteries, or propellers and save them to local storage.
  * **Data Verification:** Verifies user inputs against physical boundaries (e.g., $R_m > 0$, $K_v > 0$).
  * **Import/Export:** Support for importing and exporting JSON component database files.

---

## 4. UI/UX Output Visualizations & Analytics

### 4.1 Performance Dashboards & Charts
The software generates interactive vector charts:

1. **Throttle Curves ($0\% - 100\%$ Throttle Range):**
   * Throttle vs. Total Thrust ($kg / lbf$)
   * Throttle vs. Current Draw ($A$) & Power ($W$)
   * Throttle vs. Motor & ESC Efficiency ($\%$)
2. **Thermal Dynamics Projection:**
   * Estimated motor stator temperature over time at maximum throttle.
3. **Payload Envelope Graph:**
   * Extra Payload ($g$) vs. Flight Time ($min$) curve.

### 4.2 Tabular Results Output

```
+-----------------------------------------------------------------------------------------+
| SYSTEM METRICS & PERFORMANCE VERDICT                                                    |
+--------------------------+--------------------------+-----------------------------------+
| HOVER METRICS            | MAXIMUM/PEAK METRICS     | SYSTEM SAFETY & VERDICT           |
+--------------------------+--------------------------+-----------------------------------+
| Hover Throttle: 42%      | Max Current: 84.2 A      | Thrust-to-Weight Ratio: 2.38 : 1  |
| Hover Current: 12.4 A    | Peak Power: 1,246 W      | All-Up Weight (AUW): 1,450 g      |
| Hover Power: 183.5 W     | Max Thrust: 3,450 g      | Drive / Frame Ratio: 68% / 32%    |
| Specific Thrust: 7.9 g/W | Motor Temp: 58°C (OK)    | Hover Time: 18.2 min              |
| Motor Eff: 83.2%         | ESC Thermal: OK          | Mixed Flight Time: 12.5 min       |
+--------------------------+--------------------------+-----------------------------------+
```

### 4.3 Conclusions

Under the warnings, a Conclusions card reads the results in plain language (`src/ui/insights.ts`):

* **Verdict:** what the build suits (agile, endurance, general purpose, payload carrier or marginal) and which part has the tightest margin (battery C, motor current, ESC current, motor heat or hover throttle).
* **Payload:** the practical extra payload, which keeps thrust/weight ≥ 2 and hover throttle ≤ 60 %, next to the lift-off maximum at 80 % throttle, and the hover time lost per extra 100 g.
* **Tips:** hover far below the motor's peak efficiency (8+ points), ESCs loaded under 35 %, battery heavier than 65 % of AUW.
* **Cautions:** best-range speed stuck at the model's top-speed cap.

Battery checks behind the C indicator: warning above 90 % of the continuous C rating, and when full throttle with the pack at the end of its usable capacity sags below the chemistry minimum.

---

## 5. Non-Functional Requirements

### 5.1 Performance & Latency
* Initial application load time under 1.5 seconds.
* Live recalculation latency under **50ms** upon modifying any slider or input box.
* Optimizer sweep execution under **1.5 seconds** across 10,000 parameter permutations.

### 5.2 Compatibility & Accessibility
* **Web Deployment:** Full responsiveness across Desktop (Chrome, Firefox, Safari, Edge) and Tablet devices.
* **Offline Functionality:** Progressive Web App (PWA) support allowing full calculation and database access without internet connectivity.
* **Data Exporting:** Single-click export of the complete calculation report to PDF, CSV, or sharable encoded URL query string.

---

## 6. Verification & Acceptance Criteria

| ID | Requirement | Verification Method | Pass Criteria |
| :--- | :--- | :--- | :--- |
| **VR-01** | Mathematical Accuracy | Empirical Test Bench Comparison | Thrust and current predictions match bench test data within $\pm 10\%$. |
| **VR-02** | Optimization Speed | Automated Benchmark Suite | Design optimizer yields results for 10k combinations in $< 1.5\text{s}$. |
| **VR-03** | Custom Components | Functional User Testing | Custom component added by user persists locally and can be evaluated seamlessly. |
| **VR-04** | Thermal Warning | Edge-Case Simulation | System displays visual overload alert when predicted motor temp exceeds $80^\circ C$. |