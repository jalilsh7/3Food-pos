# Backend domain boundaries — PHP V3

## Architectural layering
- HTTP: Router/Request/Response/Kernel, middleware and controller input/output mapping.
- Application: use-cases, transaction coordination, business rules orchestration.
- Domain: invariants/value types/state rules; no PDO/HTTP/framework dependencies.
- Infrastructure: PDO repositories, external adapters, filesystem/private storage.
- Composition/bootstrap: wiring only; configuration and dependency construction, not business logic.

## Rules
1. Controllers remain thin; no SQL or substantial business decision trees.
2. Use-cases receive explicit actor, scope, request/correlation context and contracts.
3. Repository interfaces/contracts are application/domain-facing; PDO implementation remains infrastructure.
4. Transactions are initiated/owned by application use-cases for workflows spanning repositories.
5. Domain modules do not import another module's PDO repository directly; communicate via use-case/contract.
6. Error mapping occurs at HTTP boundary; domain/application exceptions carry stable machine codes and safe messages.
7. Scope and permission checks must occur server-side and precede data access/mutation.
8. Provider/file/database operations must be observable with correlation context and redacted diagnostics.
9. Avoid premature generic abstractions; refactor gradually, preserving endpoint contracts.
10. Composition/bootstrap wires modules; avoid controller/service construction in ad-hoc route code.

## migration steps
Inventory dependencies and endpoint coverage; extract contracts; relocate service methods; adapter compatibility; audit imports/cycles; only then remove compatibility code.
This is a contract document, not proof of refactoring or testing.
