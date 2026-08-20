# Open dMRV Protocol

> A modular, open and verifiable digital infrastructure for environmental and climate claims.

**Status:** Discussion Draft v0.1 — white paper and initial protocol release coming soon  
**Maintainer:** Eartheon / Forum for Urban Informatics

The Open dMRV Protocol is an industry-agnostic interoperability and evidence-exchange protocol for digital Monitoring, Reporting and Verification (dMRV).

It provides a common technical layer through which independent systems can discover capabilities, exchange evidence manifests, assemble claims, communicate assurance outcomes and connect to programmes or registries—without requiring one organisation to control the data, methodology, verifier or registry.

## What it is

- An open message and resource model for environmental claims
- A federated network architecture with signed identity and traceable provenance
- An action model with asynchronous `on_*` callbacks
- A modular core that can be extended through domain and conformance profiles
- A way to keep evidence versioned, challengeable, correctable and revocable

## What it is not

The protocol is not:

- a carbon registry;
- a scientific methodology;
- a crediting or certification standard;
- an ESG reporting framework; or
- a system that turns cryptographic integrity into scientific truth.

Registries, methodologies, assurance providers and programmes remain independent participants. The protocol helps them interoperate.

## Design principles

1. **Open by default** — specifications and schemas should be inspectable and implementable.
2. **Modular by design** — domain-specific science belongs in profiles, not in the transport core.
3. **Evidence before assertion** — every claim should point to observations, transformations and controls.
4. **Verifiable by third parties** — assurance is independent and scoped, not a Boolean promise.
5. **Spatially and temporally explicit** — boundaries, periods and versions are first-class data.
6. **Interoperable and API-first** — messages connect existing tools instead of replacing them.
7. **Privacy-aware and sovereignty-respecting** — evidence may remain with its rightful custodian.
8. **Designed for iteration** — claims and evidence can be updated, challenged, superseded or revoked.

## Network roles

- **Activity Node** — represents a project, facility, farm, jurisdiction or other monitored activity.
- **Evidence Provider Node** — provides satellite, sensor, laboratory, field or documentary evidence.
- **Reporting Node** — normalises evidence, applies a referenced methodology and assembles claims.
- **Verification Node** — issues an independent, scoped assurance opinion.
- **Program / Registry Node** — makes an eligibility decision and may optionally issue an asset.
- **Discovery Service** — helps participants find capabilities, profiles and endpoints.
- **Trust Registry** — resolves identities, signing keys and credentials.

Bulk imagery and high-volume sensor data are not placed directly in protocol messages. They remain in fit-for-purpose stores and are referenced through signed evidence manifests.

## Core action lifecycle

Each request has a paired `on_*` callback:

```text
discover → register → plan → observe → report → attest → verify → decide → issue (optional)
```

Cross-lifecycle actions include `status`, `update`, `challenge`, `resolve`, `subscribe`, `notify` and `revoke`.

The initial specification will distinguish actions from claim states. Actions describe what participants do; states describe where a claim currently sits. A claim may move forward or backward as evidence changes.

## Initial profiles

The core protocol is domain-neutral. Early work will concentrate on:

- **Agriculture** — satellite and STAC assets, IoT sensors, field observations, laboratory results and signed text reports.
- **Biodiversity** — multidimensional accounting across extent, condition, composition, structure, function, connectivity, species significance, pressures, uncertainty, rights and safeguards.
- **Carbon** — evidence and assurance exchange that can bridge to independent standards and registries without becoming one.

Biodiversity is intentionally not reduced to a universal carbon-like unit. If a programme publishes a composite index, the underlying metrics, normalisation, weights, uncertainty and sensitivity should remain available.

## Repository status

This repository is being prepared as the public home of the protocol. The following are coming soon:

- the initial white paper / discussion draft;
- versioned protocol and profile specifications;
- JSON schemas and example messages;
- conformance requirements and test vectors;
- reference agriculture and biodiversity workflows; and
- a process for issues, proposals and working-group discussion.

Until the first specification is published, nothing in this repository should be read as a normative conformance claim.

## Get involved

Watch the repository, open an issue once issue templates are available, or connect with the maintainers:

- [Protocol repository](https://github.com/Eartheon/dmrv-protocol)
- [Eartheon](https://eartheon.digital/)
- [Eartheon on LinkedIn](https://www.linkedin.com/company/eartheon)
- [Forum for Urban Informatics](https://urbaninformatics.forum/)

## Licence

The licence for the specification and reference implementation will be declared with the initial public release.
