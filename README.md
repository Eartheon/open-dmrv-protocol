# Open dMRV Protocol

> A compact actor-and-action protocol for monitoring, reporting, verification and attestation.

**Status:** Discussion Draft â€” revised initial specification coming soon  
**Maintainer:** Eartheon / Forum for Urban Informatics

The Open dMRV Protocol coordinates the actors and actions involved in environmental MRV. It deliberately does **not** encode carbon-accounting methodologies, equations or programme-specific eligibility rules.

The protocol defines the exchange. The selected standard defines the science.

## The five-action protocol

```text
register â†’ monitor â†’ report â†’ verify â†’ attest
```

| Action | Purpose | Primary role |
|---|---|---|
| `register` | Establish the MRV activity, Monitored Subject, participants, measurement providers, permissions and methodology reference. | Implementer |
| `monitor` | Capture observations through devices, applications, laboratories, surveys or administrative systems. | Measurement Provider |
| `report` | Convert the monitoring evidence into a structured result using the selected external methodology. | Reporting Provider |
| `verify` | Independently check data quality, provenance, completeness, calibration, sampling and reproducibility. | Assurance Provider |
| `attest` | Sign an authoritative statement that binds the subject, report, verification result and methodology version. | Attesting Authority |

## Actors and roles

### Monitored Subject

The thing, place, activity or system being measuredâ€”for example a land parcel, administrative unit, facility, ecosystem, supply chain or programme. It is a protocol entity, not an actor.

### Subject Controller

Controls, manages or has legal responsibility for the Monitored Subject and authorises its participation.

### Implementer

Establishes the MRV activity, selects the applicable standard and methodology, and coordinates the participating roles.

### Measurement Provider

Produces observations through devices, applications, laboratories, surveys or administrative systems.

### Reporting Provider

Converts monitoring evidence into a structured result using the referenced external methodology.

### Assurance Provider

Independently checks evidence quality, provenance, calculations, methodology application and reproducibility.

### Standards Authority

Publishes or recognises the methodology, controls its versions and defines conformance requirements.

### Attesting Authority

Issues the signed authoritative statement binding the Monitored Subject, report, verification result and methodology version.

The Standards Authority and Attesting Authority may be different organisations. For example, an international body may maintain a classification methodology while a government department attests and publishes an official State-level result.

## Party, role and agent

The protocol distinguishes accountability from execution:

- **Party:** the legally or institutionally accountable person or organisation;
- **Role:** the function the Party performs in the MRV activity;
- **Agent:** the person, device, application or service acting for the Party; and
- **Resource:** the subject, evidence, report, verification result or attestation affected by the action.

A device or software service does not carry legal accountability on its own. It operates as an Agent of an accountable Party.

## Why the Assurance Provider is explicit

A valid MRV chain needs separation between the party that produces the report and the party that verifies it. Without an independent assurance role, `verify` becomes internal quality control rather than verification.

The Assurance Provider is therefore a required protocol role even when a Standards Authority or Attesting Authority delegates that function.

## Protocol boundary

The protocol standardises:

- actor and role identifiers;
- MRV activities and Monitored Subjects;
- the five action messages;
- Measurement Provider registration;
- evidence and report references;
- methodology identifiers and versions;
- verification results;
- signatures and attestations; and
- actor authorisations, versions and revision lineage.

The protocol does not standardise:

- carbon sequestration equations;
- sampling formulas;
- baseline or additionality rules;
- permanence and leakage rules;
- credit eligibility;
- credit issuance, transfer or retirement; or
- the scientific validity of a methodology.

These remain the responsibility of the selected standard, programme or registry.

## Revision and resubmission

A failed verification does not overwrite the earlier report. The process returns to the action responsible for the finding:

- a registration defect returns to `register`;
- missing or defective evidence returns to `monitor`;
- a calculation or reporting defect returns to `report`; and
- a verification-procedure defect repeats `verify`.

Every corrected resource receives a new version and references the version it revises or supersedes. Only an accepted verification result may proceed to `attest`.

## Government land-use example: DEGURBA

A State Digital Twin can use the protocol to produce repeatable Degree of Urbanisation classifications:

1. **Register:** Register the 1 kmÂ² grid, administrative boundaries, coordinate reference system, population sources, satellite products, responsible departments and DEGURBA method version.
2. **Monitor:** Ingest population-grid updates, built-up change, land-cover observations and revised administrative boundaries with their dates, resolution and provenance.
3. **Report:** Apply the referenced DEGURBA rules externally and publish grid-cell, settlement and administrative-unit classifications with change statistics.
4. **Verify:** Independently test thresholds, contiguity, grid alignment, boundary versions, input completeness and reproducibility.
5. **Attest:** An authorised government body signs the official release, including its reference year, method version, inputs, limitations and superseded release.

DEGURBA depends on population as well as spatial contiguity and density. Satellite observations of built-up expansion can support interim monitoring, but they cannot by themselves produce an official DEGURBA classification. Each release should therefore be labelled as census-anchored or modelled/interim.

## Minimum message envelope

Every action should carry, at minimum:

- protocol and message version;
- unique message and transaction identifiers;
- action name;
- MRV activity and Monitored Subject identifiers;
- initiating and receiving Party, role and Agent identifiers;
- timestamp;
- referenced input and output resources;
- methodology identifier and version, where applicable; and
- digital signature or equivalent integrity proof.

## Coming soon

The revised discussion draft and initial specification will add:

- normative actor and role definitions;
- schemas for the five actions and their revision semantics;
- minimum evidence-manifest requirements;
- verification and attestation result structures;
- conformance rules and test examples; and
- agriculture and government land-use reference implementations.

Until the first specification is published, this repository should not be treated as making a normative conformance claim.

## Links

- [Protocol repository](https://github.com/Eartheon/open-dmrv-protocol)
- [Eartheon](https://eartheon.digital/)
- [Eartheon on LinkedIn](https://www.linkedin.com/company/eartheon)
- [Forum for Urban Informatics](https://urbaninformatics.forum/)

## Licence

The licence for the specification and reference implementation will be declared with the initial public release.
