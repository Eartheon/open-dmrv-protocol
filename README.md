# Open dMRV Protocol

> A compact actor-and-action protocol for monitoring, reporting, verification and attestation.

**Status:** Discussion Draft — revised initial specification coming soon  
**Maintainer:** Eartheon / Forum for Urban Informatics

The Open dMRV Protocol coordinates the actors and actions involved in environmental MRV. It deliberately does **not** encode carbon-accounting methodologies, equations or programme-specific eligibility rules.

The protocol defines the exchange. The selected standard defines the science.

## The five-action protocol

```text
register → monitor → report → verify → attest
```

| Action | Purpose | Primary role |
|---|---|---|
| `register` | Establish the project, monitored field, participants, measurement systems, permissions and methodology reference. | Project Implementer |
| `monitor` | Capture field observations using satellite, IoT, laboratory, ground-survey or manual systems. | Measurement System |
| `report` | Package the findings and claimed outcome according to the selected external methodology. | Project Implementer |
| `verify` | Independently check data quality, provenance, completeness, calibration, sampling and reproducibility. | Assurance Provider |
| `attest` | Sign a standards-aligned statement that binds the report, verification result, scope and methodology version. | Authorised Attestor |

## Actors and roles

### Field

The monitored subject: a spatial boundary, land-use or crop system and monitoring period. A field is represented in the protocol but is not an autonomous organisation.

### Farmer

The rights holder or manager of the field. The farmer authorises participation and may provide signed practice declarations or manual observations.

### Project Implementer

Coordinates the project, registers its participants and systems, selects the applicable external standard and methodology, and prepares the report.

### Measurement System

Produces observations. A Measurement System may be a satellite service, IoT device, laboratory, field survey team, ground-truthing application or signed manual reporting process.

### Assurance Provider

Independently verifies the quality and traceability of the monitoring data and reported result. This role may be performed by an accredited third party or by a suitably independent function authorised by the Standards Registry.

### Standards Registry

Publishes or recognises the carbon methodology, controls its identifier and version, authorises attestors and may accept or record the resulting attestation.

## Why the Assurance Provider is explicit

A valid MRV chain needs separation between the party that produces the report and the party that verifies it. Without an independent assurance role, `verify` becomes internal quality control rather than verification.

The Assurance Provider is therefore a required protocol role even when a Standards Registry performs or delegates that function.

## Protocol boundary

The protocol standardises:

- actor and role identifiers;
- projects and monitored subjects;
- the five action messages;
- measurement-system registration;
- evidence and report references;
- methodology identifiers and versions;
- verification results;
- signatures and attestations; and
- message acknowledgements and callbacks.

The protocol does not standardise:

- carbon sequestration equations;
- sampling formulas;
- baseline or additionality rules;
- permanence and leakage rules;
- credit eligibility;
- credit issuance, transfer or retirement; or
- the scientific validity of a methodology.

These remain the responsibility of the selected standard, programme or registry.

## Agriculture carbon example

1. **Register:** The implementer registers field polygons, farmer consent, participating measurement systems and soil-carbon methodology version 3.1.
2. **Monitor:** Satellite observations, soil samples, tree measurements, IoT readings and practice logs are collected with provenance.
3. **Report:** The implementer calculates and reports soil and biomass carbon change according to methodology version 3.1.
4. **Verify:** An independent Assurance Provider checks the evidence, sampling, calculations, uncertainty and reproducibility.
5. **Attest:** An authorised attestor signs a statement linking the verified report to its field, period, evidence, verification result and methodology version.

Attestation does not automatically mean that a carbon credit has been issued. Issuance remains an external registry or programme process.

## Minimum message envelope

Every action should carry, at minimum:

- protocol and message version;
- unique message and transaction identifiers;
- action name;
- project and field identifiers;
- initiating and receiving actor identifiers and roles;
- timestamp;
- referenced input and output resources;
- methodology identifier and version, where applicable; and
- digital signature or equivalent integrity proof.

## Coming soon

The revised discussion draft and initial specification will add:

- normative actor and role definitions;
- schemas for the five actions and their callbacks;
- minimum evidence-manifest requirements;
- verification and attestation result structures;
- conformance rules and test examples; and
- an agriculture carbon reference implementation.

Until the first specification is published, this repository should not be treated as making a normative conformance claim.

## Links

- [Protocol repository](https://github.com/Eartheon/open-dmrv-protocol)
- [Eartheon](https://eartheon.digital/)
- [Eartheon on LinkedIn](https://www.linkedin.com/company/eartheon)
- [Forum for Urban Informatics](https://urbaninformatics.forum/)

## Licence

The licence for the specification and reference implementation will be declared with the initial public release.
