# Core foundations

Shared, low-level application contracts live here. Core must not import business modules or UI features.

- `errors/`: structured application errors.
- `observability/`: diagnostic types and replaceable logger.

Secrets must never be logged. Modules should use public contracts and keep domain rules outside this folder.