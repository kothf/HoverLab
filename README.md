# HoverLab

Professional quadcopter calculator and interactive design optimizer.

HoverLab simulates electric multirotor powerplants (motors, propellers, ESCs, batteries), air density, and battery discharge to predict thrust, hover throttle, current draw, temperatures, efficiency and flight time, targeting ±10% accuracy against bench data. An inverse optimizer picks motor Kv, prop size, cell count and battery capacity from goals such as payload, flight time or thrust-to-weight ratio, backed by a library of real-world components.

## Status

Early planning. No implementation yet.

## Documentation

- [Functional Requirements Specification](docs/FRS.md)

## Planned features

- Live calculator with hover, max and optimum-efficiency results
- Throttle, thermal and payload-vs-endurance charts
- Inverse design optimizer (endurance, payload, Kv/cell matcher modes)
- Component database with custom parts and JSON import/export
- Metric/imperial units, dark/light theme, PDF/CSV/URL export, offline PWA
