# Open dMRV Protocol Specification

**Version:** 0.0.1  
**Status:** Discussion Draft  
**Date:** 8 September 2026  
**Maintainers:** Eartheon and the Forum for Urban Informatics  
**Repository:** <https://github.com/Eartheon/dmrv-protocol>

## Abstract

Open dMRV is an open, domain-neutral protocol for coordinating digital monitoring, reporting, verification and attestation across organisational boundaries. It standardises the actors, actions, messages, evidence references, claims, verification results and cryptographic proofs needed to establish a traceable assurance chain. It does not prescribe a scientific, accounting or regulatory methodology.

The protocol has five actions:

```text
register -> monitor -> report -> verify -> attest
```

Each request has an asynchronous callback in the Beckn style:

```text
register -> on_register
monitor  -> on_monitor
report   -> on_report
verify   -> on_verify
attest   -> on_attest
```

The central Open dMRV process is **claim + assure**, implemented primarily through `report` and `verify`. Registration establishes authority and context; monitoring establishes evidence; attestation records an authoritative endorsement.

## 1. Status and conventions

This document is a non-normative discussion draft intended to support implementation feedback. It is not yet a certification standard.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT** and **MAY** are to be interpreted as requirement levels for this draft.

JSON property names use `camelCase`. Protocol actions and URI path names use `snake_case`. Timestamps use RFC 3339 UTC form. Identifiers SHOULD be globally unique URIs, UUID URNs or identifiers resolvable within a declared trust domain.

### 1.1 Design principles

1. **Actor-and-action focused.** The protocol defines who did what, to which resource, using which evidence, and with what result.
2. **Method-neutral.** A referenced standard defines the science, thresholds, formulas and policy rules.
3. **Federated by default.** Source assets remain with their custodians unless a separate agreement requires replication.
4. **Claims, not files, travel through assurance.** Large rasters, streams and documents are referenced, accessed and integrity-checked; they are not embedded in protocol messages.
5. **Immutable history.** Signed objects are never overwritten. Corrections create revisions linked to prior versions.
6. **Independent verification.** The accountable verifier must be independent of the party responsible for the report.
7. **No mandatory ledger.** Public blockchains, permissioned ledgers and transparency logs are optional deployment choices, not protocol dependencies.
8. **Purpose is explicit.** A high-quality resource can still be unsuitable for a particular function. Function Profiles keep quality and fitness distinct.

> The protocol defines the exchange. The selected standard defines the science.

## 2. Scope

### 2.1 In scope

Open dMRV standardises:

- parties, agents, roles and authorisations;
- monitored subjects, resources and activities;
- the five request actions and five callbacks;
- evidence manifests and immutable asset references;
- signed claim objects;
- independent verification results;
- authoritative attestations;
- methodology and Function Profile references;
- revision, supersession and failure-loop semantics;
- cryptographic integrity, identity and key-status requirements; and
- minimum conformance behaviour.

### 2.2 Out of scope

Open dMRV does not standardise:

- scientific equations, sampling formulae or estimation algorithms;
- legal eligibility, entitlement or programme rules;
- carbon-credit issuance, transfer or retirement;
- payment or procurement;
- ownership of the monitored subject or underlying data;
- access-control policy beyond the exchange of access descriptors;
- long-term preservation architecture;
- Digital Twin visualisation or simulation engines; or
- the correctness of a methodology published by an external authority.

An application MAY layer these functions around Open dMRV.

## 3. Conceptual model

### 3.1 Resource and Claim are different objects

A **Resource** is a dataset, observation collection, sensor feed, document, model, API, Digital Twin service or derived output.

A **Claim** is a signed assertion about a subject or resource, such as:

- “this DEM has a native ground sampling distance of 1 metre in the listed urban coverage parts”;
- “these observations were produced by calibrated sensors during the stated period”;
- “this land-use classification conforms to DEGURBA version X”; or
- “this dataset is suitable for district flood modelling under Function Profile Y.”

A resource MAY have multiple claims issued by different parties. A claim MAY refer to multiple resources. A catalog entry is not, by itself, proof of a claim.

### 3.2 Principal object types

| Object | Purpose | Normally produced by |
|---|---|---|
| `Party` | Accountable person or organisation | Registrar or trust framework |
| `Agent` | Person, device, application or service acting for a Party | Accountable Party |
| `RoleAssignment` | Authorisation to perform protocol actions | Registrar / authorising authority |
| `Activity` | Bounded MRV or assurance undertaking | Implementer |
| `MonitoredSubject` | Thing, place, activity or system under observation | Implementer / Subject Controller |
| `Resource` | Dataset, stream, model, API, document or derived output | Resource Provider |
| `EvidenceManifest` | Immutable inventory of observations and supporting assets | Measurement Provider |
| `Claim` | Signed assertion based on evidence | Reporting Provider |
| `VerificationResult` | Independent assessment of a Claim and its evidence | Assurance Provider |
| `FunctionProfile` | Machine-readable fitness-for-purpose requirements | Function Profile Authority |
| `SuitabilityAssessment` | Claim that a Resource meets, partly meets or fails a Function Profile | Assessor / Reporting Provider |
| `Attestation` | Authoritative signed endorsement | Attesting Authority |
| `StatusRecord` | Current validity, suspension or revocation state | Authorised status issuer |

### 3.3 Roles

| Role | Responsibility |
|---|---|
| `SubjectController` | Controls, manages or is legally responsible for the Monitored Subject and authorises participation. |
| `Implementer` | Establishes the Activity, selects applicable standards and coordinates participants. |
| `ResourceProvider` | Custodies and serves a Resource. |
| `MeasurementProvider` | Produces observations through sensors, remote sensing, laboratories, surveys or administrative systems. |
| `ReportingProvider` | Converts evidence into structured Claims using referenced external rules. |
| `AssuranceProvider` | Independently evaluates authenticity, quality, completeness, methodology application and reproducibility. |
| `StandardsAuthority` | Publishes or recognises methodologies and controls their versions. |
| `FunctionProfileAuthority` | Publishes fitness-for-purpose profiles for specified functions. |
| `AttestingAuthority` | Issues an authoritative endorsement of a Claim and VerificationResult. |
| `Registrar` | Registers network participants, endpoints, keys, roles, authorisations and status. |
| `Requester` | Searches for, retrieves and uses a Resource or assurance object. |

The same Party MAY perform more than one role unless a profile prohibits it. The Party performing `verify` MUST be independent of the Party accountable for the relevant `report`.

### 3.4 Party, Agent and accountability

An Agent acts for a Party. A sensor, satellite-processing pipeline or software service is not legally accountable on its own. Its signed output MUST resolve to an accountable Party and a valid RoleAssignment.

```text
Party --authorises--> Agent --performs--> Action --affects--> Resource
```

## 4. Interaction model

### 4.1 Transport

The baseline binding uses HTTPS and JSON. Deployments MAY define additional bindings such as message queues or CBOR/COSE for constrained devices.

An endpoint that accepts a request MUST return an immediate transport acknowledgement. The business result is delivered asynchronously to the callback URI using the corresponding `on_*` action.

```text
POST /monitor
  -> HTTP 202 + ACK
POST {callbackUri}/on_monitor
  -> HTTP 200 + ACK
```

An ACK means that the message was syntactically accepted for processing. It is not a statement that the requested action succeeded. A NACK identifies an envelope, authentication or schema error that prevents processing.

### 4.2 Common envelope

Every request and callback MUST contain `context` and `message`.

```json
{
  "context": {
    "protocol": "org.open-dmrv",
    "version": "0.0.1",
    "action": "report",
    "messageId": "urn:uuid:1a1d9f7a-f14d-44a6-95e0-5ff8de4d32e2",
    "transactionId": "urn:uuid:22fa4db6-07ac-4b95-8f8c-f9343799ce4c",
    "correlationId": "urn:uuid:e97020fa-4614-4388-8906-7dc6b1b314fe",
    "timestamp": "2026-09-08T10:30:00Z",
    "ttl": "PT10M",
    "sender": {
      "partyId": "https://example.gov/parties/reporting-unit",
      "agentId": "https://example.gov/agents/reporting-api"
    },
    "receiver": {
      "partyId": "https://verifier.example/parties/assurance-provider"
    },
    "callbackUri": "https://reporter.example/dmrv/callbacks",
    "domain": "gov:land-and-water"
  },
  "message": {},
  "proof": {}
}
```

`correlationId` on a callback MUST equal the `messageId` of the request it answers. `transactionId` groups a sequence of related actions.

### 4.3 Acknowledgement

```json
{
  "ack": {
    "status": "ACK"
  },
  "error": null
}
```

For a NACK, `status` is `NACK` and `error` contains a stable code, human-readable message and optional JSON Pointer to the invalid field.

### 4.4 Action summary

| Request | Callback | Intent | Principal output |
|---|---|---|---|
| `register` | `on_register` | Establish identity, authority, subject, activity, resource, standard, profile or key metadata | Registration records and status |
| `monitor` | `on_monitor` | Request or declare an observation run and package its evidence | `EvidenceManifest` |
| `report` | `on_report` | Make a structured assertion based on referenced evidence | `Claim` |
| `verify` | `on_verify` | Independently assess a Claim and its supporting evidence | `VerificationResult` |
| `attest` | `on_attest` | Authoritatively endorse a Claim and accepted VerificationResult | `Attestation` |

## 5. Actions

### 5.1 `register` / `on_register`

`register` establishes objects that other actions need to resolve and trust. It MAY register a Party, Agent, RoleAssignment, Activity, MonitoredSubject, Resource, methodology reference, FunctionProfile, key or endpoint.

Minimum request fields:

```json
{
  "message": {
    "registrations": [
      {
        "kind": "Agent",
        "object": {
          "id": "urn:uuid:sensor-gateway-43",
          "accountableParty": "https://provider.example/parties/measurement-co",
          "agentType": "deviceGateway",
          "capabilities": ["monitor"],
          "verificationMethods": ["https://provider.example/keys/gateway-43#key-1"]
        }
      }
    ]
  }
}
```

`on_register` returns a result for each object: `accepted`, `accepted_with_conditions` or `rejected`, plus a registration identifier, effective period and status endpoint. Registration does not certify the scientific quality of future outputs.

### 5.2 `monitor` / `on_monitor`

`monitor` coordinates an observation activity. It MAY request new observation, register evidence that already exists, or close an observation run. It does not require a continuously connected sensor.

Minimum request fields include the Activity, MonitoredSubject, observation specification, time and spatial bounds, MeasurementProvider, Agent and referenced standard or FunctionProfile when applicable.

`on_monitor` returns an `EvidenceManifest`, or a failure indicating why evidence could not be produced.

```json
{
  "message": {
    "activityId": "urn:uuid:flood-base-data-2026",
    "subjectId": "https://example.gov/areas/district-041",
    "observationRequest": {
      "phenomena": ["terrainElevation"],
      "spatial": {"bbox": [78.0, 10.8, 79.5, 12.1], "crs": "OGC:CRS84"},
      "temporal": {"start": "2025-01-01T00:00:00Z", "end": "2026-08-31T23:59:59Z"}
    }
  }
}
```

### 5.3 `report` / `on_report`

`report` transforms one or more EvidenceManifests into a structured Claim. The request MUST identify the reporter, the rule or method applied, the subject, evidence and intended claim type. Calculations and algorithms run outside the protocol.

`on_report` returns a signed Claim or a failure. A report MUST state material assumptions and limitations. It MUST NOT imply verification or attestation merely because it is signed by its issuer.

### 5.4 `verify` / `on_verify`

`verify` asks an authorised AssuranceProvider to independently evaluate a Claim. Its scope MAY include:

- signature and role validity;
- evidence integrity and availability;
- provenance and chain of custody;
- completeness, calibration, sampling and uncertainty;
- reproduction of transformations or calculations;
- conformance with a referenced methodology; and
- conformance with a FunctionProfile.

`on_verify` returns a separately signed `VerificationResult` with exactly one outcome:

- `verified`;
- `verified_with_qualifications`;
- `changes_requested`;
- `rejected`; or
- `unable_to_verify`.

A verifier MUST NOT modify the Claim. Qualifications and findings belong in the VerificationResult.

### 5.5 `attest` / `on_attest`

`attest` asks an authorised AttestingAuthority to bind a Claim, its accepted VerificationResult, the applicable standard or FunctionProfile and the authority's decision into an `Attestation`.

The baseline protocol permits `verified` and `verified_with_qualifications` results to proceed only if the attestation policy explicitly accepts the outcome. Other outcomes MUST NOT be attested as accepted.

Attestation is not automatically a permit, payment, carbon credit or legal entitlement. A domain profile MAY define such downstream consequences.

### 5.6 Correction and resubmission

Signed resources MUST NOT be overwritten. A correction creates a new object containing:

```json
{
  "revisionOf": "urn:uuid:prior-object-id",
  "supersedes": "sha256:0f4d...",
  "revisionReason": "Corrected vertical datum and recomputed derived elevations"
}
```

The process returns to the action that can remedy the finding:

| Defect | Repeat action |
|---|---|
| Identity, authority, key or subject registration | `register` |
| Missing, stale or defective evidence | `monitor` |
| Calculation, transformation or claim construction | `report` |
| Assurance method, verifier error or incomplete review | `verify` |

The original Claim and VerificationResult remain discoverable with their historical status. A new accepted result may proceed to `attest`.

## 6. Evidence and asset architecture

### 6.1 Control plane and data plane

Open dMRV messages form a **control plane**. They carry identifiers, manifests, claims, proofs, assurance results and access descriptors.

The underlying assets remain in a **data plane** controlled by the ResourceProvider:

| Modality | Typical asset location | Typical delivery |
|---|---|---|
| Satellite or aerial imagery | Provider object storage, earth-observation archive or geospatial data cube | Cloud Optimized GeoTIFF, Zarr, tiles, STAC assets, processing API |
| Sensor observations | Time-series database, edge gateway or data platform | HTTPS API, OGC API - EDR, streaming adapter, downloadable extract |
| Manual study or survey | Government/document repository, research archive or object storage | PDF, CSV, GeoPackage, Parquet, media bundle, form export |
| Administrative record | Departmental system of record | Protected API, signed extract or query service |
| Model or Digital Twin service | Provider compute environment | Job API, container execution, process endpoint or result package |

The protocol MUST NOT require the wholesale transfer of a large asset in an action message.

### 6.2 `AssetReference`

Every evidence asset is represented by a stable descriptor:

```json
{
  "id": "urn:uuid:dem-urban-tile-0092",
  "name": "Urban DEM tile 0092",
  "mediaType": "image/tiff; application=geotiff; profile=cloud-optimized",
  "roles": ["data", "evidence"],
  "location": {
    "catalogUri": "https://geo.example/stac/collections/dem/items/tile-0092",
    "accessService": "https://geo.example/access/resources/dem-urban-tile-0092",
    "protocol": "https",
    "method": "GET",
    "auth": "oauth2-client-credentials"
  },
  "integrity": {
    "algorithm": "sha-256",
    "digest": "a734...f09c",
    "sizeBytes": 483012923
  },
  "license": "https://example.gov/licenses/public-data-v2",
  "accessPolicy": "https://example.gov/policies/geospatial-sensitive-v1"
}
```

An expiring signed URL or bearer token MUST NOT be embedded in a long-lived Claim. The stable `accessService` exchanges an authorised runtime request for a short-lived `AccessGrant`.

### 6.3 `AccessGrant`

An AccessGrant is transient and therefore separate from the immutable Claim:

```json
{
  "resourceId": "urn:uuid:dem-urban-tile-0092",
  "subject": "https://twin.example/agents/flood-model",
  "href": "https://objects.example/temporary/4e3...",
  "method": "GET",
  "expiresAt": "2026-09-08T10:45:00Z",
  "grantedScopes": ["read"],
  "expectedDigest": "sha256:a734...f09c",
  "proof": {}
}
```

## 7. EvidenceManifest

An EvidenceManifest is signed by the accountable MeasurementProvider. It binds observation context to immutable asset references.

```json
{
  "id": "urn:uuid:evidence-8cc356e2",
  "type": "EvidenceManifest",
  "activityId": "urn:uuid:flood-base-data-2026",
  "subject": "https://example.gov/areas/district-041",
  "provider": "https://provider.example/parties/measurement-co",
  "agent": "urn:uuid:sensor-gateway-43",
  "modality": "sensor",
  "observedProperties": ["rainfallDepth", "riverStage"],
  "spatial": {"geometry": {}, "crs": "OGC:CRS84"},
  "temporal": {"start": "2026-07-01T00:00:00Z", "end": "2026-07-31T23:59:59Z"},
  "assets": [],
  "quality": {},
  "lineage": [],
  "limitations": [],
  "createdAt": "2026-08-01T09:00:00Z",
  "proof": {}
}
```

For large collections, `assets` MAY point to a signed inventory whose entries are committed by a Merkle root. The manifest MUST say how an individual asset inclusion proof is obtained.

### 7.1 Sensor evidence profile

A sensor EvidenceManifest adds:

```json
{
  "modalityDetails": {
    "sensorProfile": {
      "sensorIds": ["urn:uuid:gauge-22", "urn:uuid:gauge-23"],
      "model": "Example HydroGauge 4",
      "observedProperties": ["riverStage"],
      "samplingInterval": "PT5M",
      "units": {"riverStage": "m"},
      "calibration": {
        "certificate": "https://lab.example/certificates/cal-8891",
        "validFrom": "2026-01-10T00:00:00Z",
        "validUntil": "2027-01-09T23:59:59Z"
      },
      "firmware": "4.2.1",
      "clockSource": "GNSS",
      "missingDataFraction": 0.012,
      "edgeTransformations": ["median-filter-v2"]
    }
  }
}
```

The profile SHOULD state calibration, unit, sampling cadence, clock synchronisation, firmware/software, missing-data policy, location history and any edge transformation.

### 7.2 Satellite or aerial evidence profile

```json
{
  "modalityDetails": {
    "earthObservationProfile": {
      "platform": "example-satellite-1",
      "instrument": "multispectral-imager",
      "productLevel": "L2A",
      "acquiredAt": "2026-02-04T05:18:10Z",
      "nativeResolution": {"value": 10, "unit": "m"},
      "processingResolution": {"value": 10, "unit": "m"},
      "bands": ["blue", "green", "red", "nir"],
      "cloudCoverFraction": 0.031,
      "geometricAccuracy": {"ce90": 6.5, "unit": "m"},
      "processingBaseline": "05.11",
      "catalogItem": "https://catalog.example/stac/items/scene-774"
    }
  }
}
```

The profile SHOULD distinguish native resolution, processing resolution and output resolution. It SHOULD include acquisition time, platform/instrument, product level, bands, cloud or occlusion metrics, geometric accuracy, processing lineage and spatial footprint.

### 7.3 Manual study or data-collection profile

```json
{
  "modalityDetails": {
    "manualStudyProfile": {
      "studyDesign": "stratified-random-sample",
      "protocolReference": "https://standards.example/field-survey/v3.1",
      "enumeratorOrganisation": "https://survey.example/parties/team-a",
      "instruments": ["field-form-v2", "GNSS-receiver"],
      "sampleFrame": "urn:uuid:sample-frame-2026-03",
      "sampleSize": 184,
      "consentOrAuthority": "urn:uuid:authorisation-771",
      "qualityControl": ["10-percent-back-check", "double-entry-validation"],
      "chainOfCustody": "urn:uuid:coc-manifest-119"
    }
  }
}
```

The profile SHOULD state study design, sampling frame, protocol and version, collector identity, consent or legal authority, instruments, training, quality controls, chain of custody, transformations and known sources of bias.

Hybrid evidence MAY include more than one modality profile.

## 8. Claim object

### 8.1 Core structure

```json
{
  "id": "urn:uuid:claim-54e5d45e",
  "type": ["Claim", "DatasetClaim"],
  "issuer": "https://geo.example/parties/state-mapping-agency",
  "issuedAt": "2026-09-08T09:30:00Z",
  "validFrom": "2026-09-08T09:30:00Z",
  "validUntil": null,
  "subject": {
    "id": "urn:uuid:district-dem-mosaic-v7",
    "type": "Resource"
  },
  "activityId": "urn:uuid:flood-base-data-2026",
  "conformsTo": [
    "https://profiles.example/functions/district-flood-simulation/v1"
  ],
  "statement": {
    "predicate": "hasSpatialQuality",
    "object": {
      "coverageParts": [
        {
          "class": "urban",
          "geometryRef": "urn:uuid:urban-mask-v3",
          "nativeResolution": {"value": 1, "unit": "m"},
          "verticalAccuracy": {"rmse": 0.35, "unit": "m"}
        },
        {
          "class": "rural",
          "geometryRef": "urn:uuid:rural-mask-v3",
          "nativeResolution": {"value": 10, "unit": "m"},
          "verticalAccuracy": {"rmse": 2.8, "unit": "m"}
        }
      ]
    }
  },
  "spatial": {"geometryRef": "urn:uuid:district-boundary-2026", "crs": "OGC:CRS84"},
  "temporal": {"referenceTime": "2026-02-04T05:18:10Z"},
  "evidence": [
    {
      "manifestId": "urn:uuid:evidence-a424",
      "digest": "sha256:ff3a...91b2"
    }
  ],
  "quality": {
    "completeness": 0.997,
    "noDataFraction": 0.003
  },
  "lineage": {
    "derivedFrom": ["urn:uuid:lidar-source-11", "urn:uuid:dem-source-88"],
    "process": "https://geo.example/processes/dem-mosaic/v4.2"
  },
  "limitations": [
    "Rural coverage is not suitable for street-scale pluvial-flow analysis."
  ],
  "status": "active",
  "proof": {}
}
```

### 8.2 Claim types

- `ObservationClaim`: asserts an observed property about a MonitoredSubject.
- `DatasetClaim`: asserts intrinsic properties of a dataset or collection.
- `MethodConformanceClaim`: asserts that a result was produced according to a referenced methodology.
- `SuitabilityAssessment`: asserts fitness for a named FunctionProfile and area of interest.
- Domain profiles MAY add subtypes without changing the five actions.

### 8.3 Minimum claim requirements

A Claim MUST contain:

- globally unique `id`;
- `type`;
- accountable `issuer`;
- `issuedAt`;
- `subject`;
- a machine-readable `statement`;
- evidence manifest identifiers and digests;
- spatial and temporal scope when relevant;
- referenced standard, methodology or FunctionProfile when conformance is asserted;
- material limitations;
- current status or a resolvable status reference; and
- a valid proof.

## 9. Cryptographic security

### 9.1 What the signature proves

A valid signature proves that the holder of a recognised private key signed the exact protected object. Combined with key registration and authorisation, it can establish the object’s integrity, signer identity, signing time and permitted role.

It does **not** prove that the statement is scientifically true. That is the purpose of evidence, verification and attestation.

### 9.2 Baseline proof suite

The v0.0.1 baseline is:

- JSON Canonicalization Scheme (JCS), RFC 8785;
- W3C Data Integrity proof format;
- ECDSA P-256 with SHA-256 using the `ecdsa-jcs-2019` cryptosuite; and
- HTTPS/TLS for transport.

```json
{
  "proof": {
    "type": "DataIntegrityProof",
    "cryptosuite": "ecdsa-jcs-2019",
    "created": "2026-09-08T09:30:00Z",
    "verificationMethod": "https://geo.example/keys/reporting-2026#key-1",
    "proofPurpose": "assertionMethod",
    "domain": "open-dmrv.example.gov",
    "challenge": "urn:uuid:message-or-transaction-challenge",
    "proofValue": "z2V0..."
  }
}
```

The proof processor signs the canonical form defined by the cryptosuite. Implementations MUST NOT invent their own property ordering or string serialisation.

### 9.3 Verification algorithm

A relying party MUST:

1. validate the JSON schema and required identifiers;
2. resolve `verificationMethod` over an authenticated channel or trusted registry;
3. confirm the key was valid, not revoked and authorised for the claimed role and action at signing time;
4. confirm the `domain` and `challenge` bind the proof to the intended trust domain or exchange;
5. canonicalise and verify the signature using the declared cryptosuite;
6. validate object status, validity period and revision lineage;
7. verify every required referenced digest after retrieving the corresponding asset;
8. verify the EvidenceManifest signer before relying on a Claim; and
9. preserve the verification decision and software/profile versions in an audit record.

### 9.4 Layered signatures

The assurance chain consists of separate immutable objects:

```text
EvidenceManifest --supports--> Claim --assessed by--> VerificationResult --endorsed by--> Attestation
```

- The MeasurementProvider signs the EvidenceManifest.
- The ReportingProvider signs the Claim and references evidence digests.
- The AssuranceProvider signs a VerificationResult that references the Claim digest.
- The AttestingAuthority signs an Attestation that references both Claim and VerificationResult digests.

No downstream party re-signs by editing an upstream object.

### 9.5 Alternative implementation profiles

| Profile | Recommended mechanism | Use case |
|---|---|---|
| Core JSON | W3C Data Integrity + ECDSA/JCS | Web APIs and interoperable public networks |
| Government PKI | JWS with X.509 certificate chain | Existing government certificate infrastructure |
| Constrained IoT | CBOR + COSE | Low-bandwidth devices and gateways |
| High assurance | Baseline plus RFC 3161 timestamp and append-only transparency log | Regulated or disputed evidence chains |

These profiles MUST preserve equivalent semantics: protected payload, signer, key status, purpose, domain binding and algorithm agility.

### 9.6 Key and role registration

The Registrar SHOULD hold or resolve:

- Party identifier and legal identity evidence;
- assigned roles and permitted actions;
- Agent identifiers and accountable Party;
- verification methods or certificate chains;
- key effective and expiry times;
- status and revocation endpoints;
- accreditation, jurisdiction and scope; and
- change history.

Key rotation MUST NOT invalidate historical signatures that were valid at signing time. Trust frameworks SHOULD preserve historical key-status evidence.

### 9.7 Security and privacy considerations

- Claims SHOULD reveal no more personal or sensitive information than needed.
- Sensitive source data MAY stay private while a verifier receives controlled access and publishes a redacted VerificationResult.
- A digest commits to data but may leak information when the input space is small; use salted commitments or access controls where necessary.
- Location data for vulnerable people, species or infrastructure SHOULD use graduated disclosure.
- Implementations MUST protect against replay using message IDs, timestamps, TTLs, challenges and idempotency rules.
- Every network MUST publish incident, revocation and compromised-key procedures.

## 10. VerificationResult and Attestation

### 10.1 VerificationResult

```json
{
  "id": "urn:uuid:verification-f33a",
  "type": "VerificationResult",
  "claim": {
    "id": "urn:uuid:claim-54e5d45e",
    "digest": "sha256:41dd...a119"
  },
  "verifier": "https://assurance.example/parties/independent-unit",
  "verificationScope": ["authenticity", "evidenceIntegrity", "methodConformance", "functionConformance"],
  "procedure": "https://assurance.example/procedures/geodata-v2",
  "outcome": "verified_with_qualifications",
  "findings": [
    {
      "severity": "qualification",
      "code": "PARTIAL_COVERAGE_SUITABILITY",
      "message": "Rural DEM does not satisfy the urban pluvial-model resolution requirement.",
      "pointer": "/statement/object/coverageParts/1"
    }
  ],
  "verifiedAt": "2026-09-08T12:00:00Z",
  "proof": {}
}
```

### 10.2 Attestation

```json
{
  "id": "urn:uuid:attestation-9931",
  "type": "Attestation",
  "claim": {"id": "urn:uuid:claim-54e5d45e", "digest": "sha256:41dd...a119"},
  "verificationResult": {"id": "urn:uuid:verification-f33a", "digest": "sha256:19ce...5e7b"},
  "authority": "https://planning.example/parties/state-authority",
  "decision": "endorsed_with_qualifications",
  "scope": "Use for district-scale fluvial modelling; exclusions remain binding.",
  "effectiveFrom": "2026-09-08T12:30:00Z",
  "effectiveUntil": "2027-09-08T12:29:59Z",
  "status": "active",
  "proof": {}
}
```

## 11. Function Profiles

A FunctionProfile expresses minimum data and assurance requirements for a named task. It is a versioned Resource, not a sixth protocol verb.

```json
{
  "id": "https://profiles.example/functions/district-flood-simulation/v1",
  "type": "FunctionProfile",
  "name": "District hydrological flood simulation",
  "authority": "https://water.example/parties/modelling-authority",
  "version": "1.0.0",
  "inputs": [
    {
      "role": "terrain",
      "resourceType": "DEM",
      "requirements": {
        "verticalDatum": ["EPSG:3855"],
        "urban": {"maxNativeResolution": {"value": 2, "unit": "m"}},
        "rural": {"maxNativeResolution": {"value": 10, "unit": "m"}},
        "maxVerticalRmse": {"value": 1.5, "unit": "m"},
        "hydrologicallyConditioned": true,
        "requiredFeatures": ["culverts", "bridges", "breaklines"]
      }
    }
  ],
  "assurance": {
    "minimumOutcome": "verified_with_qualifications",
    "acceptedVerifierAccreditations": ["gov-geospatial-assurance-v1"],
    "maximumClaimAge": "P2Y"
  },
  "proof": {}
}
```

Function conformance has three outcomes:

- `suitable`: all mandatory requirements are met for the stated area and period;
- `partially_suitable`: a defined subset is suitable, or accepted qualifications apply; and
- `unsuitable`: one or more mandatory requirements fail.

The Function Profile MUST define how unknown or unverified values are treated. A suitability assessment MUST identify the exact profile version and area of interest.

### 11.1 Three layers of validity

| Layer | Question | Primary mechanism |
|---|---|---|
| Cryptographic validity | Is this the exact object signed by an authorised identity? | Proof, key registry, status and digest checks |
| Intrinsic quality | Are the data properties and evidence credible? | Dataset/Observation Claim plus independent verification |
| Functional suitability | Are these data good enough for this particular task? | FunctionProfile plus SuitabilityAssessment |

## 12. Agriculture and Open Networks for Carbon Markets

Agricultural carbon is a domain profile of the same generic protocol, not the definition of Open dMRV.

Example mapping:

| Core concept | Agricultural carbon example |
|---|---|
| MonitoredSubject | Field, farm, parcel group or project area |
| SubjectController | Farmer, landholder, cooperative or authorised manager |
| Implementer | Project developer or programme implementer |
| MeasurementProvider | Satellite provider, IoT operator, laboratory or field survey team |
| Standard/method reference | Carbon sequestration methodology and version |
| EvidenceManifest | Imagery, sensor series, soil samples, field forms and provenance |
| Claim | Practice adoption, measured parameter or quantified sequestration result |
| AssuranceProvider | Independent validation and verification body |
| AttestingAuthority | Programme, registry or authorised public body |
| FunctionProfile | Requirements for a carbon estimate, scheme decision or farm advisory simulation |

The same Activity MAY support biodiversity and ecosystem-condition Claims, including habitat extent, condition, fragmentation, species observations, acoustic indices, eDNA results and restoration actions. Biodiversity methodology details stay in external profiles and standards.

For an Open Network for Carbon Markets deployment, Beckn can discover projects, evidence providers, verifiers and services. Open dMRV carries the signed assurance chain. The carbon programme retains control over methodology approval, eligibility, issuance and retirement.

## 13. Other government use cases

| Profile | Example claim | Typical evidence | Possible attestor |
|---|---|---|---|
| Land-use change and DEGURBA | An administrative unit changed class under a stated DEGURBA version | Population grids, boundaries, built-up layers, imagery | Planning or statistics authority |
| Public infrastructure | An asset was completed to approved specification and meets a performance target | BIM/GIS, drone survey, tests, sensors, inspections | Public works authority |
| Environmental compliance | A facility remained within authorised limits during a period | Continuous monitoring, lab samples, permits, manifests | Environmental regulator |
| Agricultural scheme delivery | Enrolled farms adopted required practices and achieved reported outcomes | Boundaries, imagery, IoT, surveys, laboratory tests | Agriculture department |
| Biodiversity accounting | A programme changed habitat extent, condition or species indicators | Habitat maps, plots, cameras, acoustics, eDNA, imagery | Biodiversity or forest authority |

## 14. Error model and idempotency

Error codes use stable upper-snake-case values. Baseline codes include:

- `INVALID_SIGNATURE`
- `UNAUTHORISED_ROLE`
- `EXPIRED_KEY`
- `REVOKED_KEY`
- `SCHEMA_INVALID`
- `OBJECT_NOT_FOUND`
- `EVIDENCE_UNAVAILABLE`
- `DIGEST_MISMATCH`
- `PROFILE_NOT_SUPPORTED`
- `CONFLICTING_REVISION`
- `INDEPENDENCE_REQUIREMENT_FAILED`
- `PROCESSING_TIMEOUT`

Receivers MUST treat an identical `messageId` as idempotent during the declared retention period. A repeated message with the same ID but different bytes MUST be rejected.

## 15. Conformance

### 15.1 Core implementation

A conformant core implementation MUST:

- support all five request paths and callbacks, even if some return a declared `NOT_SUPPORTED` profile error;
- validate the common envelope and action schemas;
- verify baseline proofs;
- preserve immutable revision history;
- expose status and revocation information;
- resolve referenced objects or return a stable error;
- prevent a Party from verifying its own report when independence is required; and
- provide machine-readable version and capability metadata.

### 15.2 Producer conformance

A conformant producer MUST sign the objects for which it is accountable, publish digests for referenced assets and state material limitations.

### 15.3 Verifier conformance

A conformant verifier MUST identify its procedure, scope, outcome, findings, software/profile versions and independence basis. It MUST sign a separate VerificationResult.

### 15.4 Domain profile conformance

A domain profile MUST state required object fields, accepted proof profiles, role constraints, methodologies, Function Profiles, privacy rules and additional status semantics. It MUST NOT silently change the meaning of the five core actions.

## 16. Open issues for v0.1

The following require implementer review before a normative release:

1. final JSON Schemas and registry vocabularies;
2. exact compatibility mapping to Beckn context fields and fulfilment flows;
3. standard discovery projection for STAC, OGC API - Records and DCAT catalogs;
4. verifier accreditation and cross-jurisdiction trust lists;
5. confidential evidence and selective-disclosure patterns;
6. long-term signature validation and preservation;
7. common Function Profile expression language and units vocabulary;
8. Merkle manifest and streaming-data checkpoint rules;
9. conformance test suite and example implementations; and
10. governance, change control and intellectual-property policy.

## 17. References

- Beckn Protocol Specifications: <https://github.com/beckn/protocol-specifications>
- OGC API - Records 1.0: <https://docs.ogc.org/is/20-004r1/20-004r1.html>
- SpatioTemporal Asset Catalog (STAC): <https://stacspec.org/en/about/stac-spec/>
- W3C Data Quality Vocabulary: <https://www.w3.org/TR/vocab-dqv/>
- W3C Verifiable Credentials Data Model 2.0: <https://www.w3.org/TR/vc-data-model-2.0/>
- W3C Data Integrity 1.1: <https://www.w3.org/TR/vc-data-integrity-1.1/>
- W3C ECDSA Cryptosuites v1.0: <https://www.w3.org/TR/vc-di-ecdsa/>
- RFC 8785, JSON Canonicalization Scheme: <https://www.rfc-editor.org/rfc/rfc8785>
- RFC 7515, JSON Web Signature: <https://www.rfc-editor.org/rfc/rfc7515>
- RFC 9052, CBOR Object Signing and Encryption: <https://www.rfc-editor.org/rfc/rfc9052/>
- RFC 3161, Time-Stamp Protocol: <https://www.rfc-editor.org/rfc/rfc3161>

## Appendix A. End-to-end action trace

```text
register       Activity, roles, Agents, Resources, keys, standards, profiles
on_register    Registration decisions and resolvable status

monitor        Observation request or evidence declaration
on_monitor     Signed EvidenceManifest

report         Evidence references + transformation/method request
on_report      Signed Claim

verify         Claim digest + evidence access + verification scope
on_verify      Signed VerificationResult

attest         Claim digest + accepted VerificationResult + policy
on_attest      Signed Attestation
```
