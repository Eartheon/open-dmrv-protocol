# Open dMRV: protocol in practice

A guided, Postgres-backed Carbon Markets demonstration of registration, monitoring, reporting, verification and attestation. Eight fictional actor profiles share **one Next.js application at http://localhost:3000**. Digital Twins is intentionally disabled for now.

The home page introduces the protocol and offers two ways to explore Carbon Markets: **Start the soil-carbon journey** or **Or browse existing projects**. The walkthrough explains the current role and task; the archive keeps projects, signed resource versions and protocol exchanges available outside that flow.

## Setup and run

Requires **Node.js 24 or newer**, **pnpm 11.1.2** (the version in `packageManager`) and a reachable PostgreSQL database named `open_dmrv`. Create the database before starting; the configured database user needs permission to create the `dmrv` schema and its tables.

From `example-app/`:

```powershell
pnpm install
Copy-Item .env.example .env.local
```

If `.env.local` already exists, edit it instead of replacing it. Configure:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/open_dmrv
APP_ORIGIN=http://localhost:3000
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_public_browser_token
NEXT_PUBLIC_MAPBOX_STYLE=mapbox://styles/mapbox/standard
```

Then run:

```powershell
pnpm dev
```

The launcher applies the idempotent database migration, registers eight demo parties and their public keys, imports earlier demo history when present, and starts Next.js plus the durable worker. The web server listens on `127.0.0.1:3000`; callbacks and evidence services use `APP_ORIGIN`. All role interfaces use that same port.

Useful commands:

```powershell
pnpm db:check
pnpm db:migrate
pnpm typecheck
pnpm test
```

`pnpm dev` already includes the worker. `pnpm worker` is available when running the worker separately; it does not start a web server.

For a local production-mode run, stop the development server first:

```powershell
pnpm build
pnpm start
```

`pnpm start` applies migrations and starts both the built web application and worker. Running a production build against an active development output directory is not recommended.

## Guided project journey

1. **Fieldkeeper — Choose land.** Name the project, select a mapped field and authorise use of its synthetic evidence. The land steward signs a `SubjectAuthorisation`.
2. **Project Studio — Register.** Review the land, permission, methodology and assigned parties. Choose **Review & sign /register**, inspect the signed request in the console, then **Send POST /register**. Wait for `/on_register` before continuing.
3. **Observatory — Monitor.** **Choose manual field study, satellite image capture, or both.** Review the selected soil samples and/or simulated cloud cover. `/monitor` produces a signed `EvidenceManifest` and signed references only to the selected evidence: soil CSV/practice record for manual study, a synthetic PNG/capture record for satellite capture, plus the common field boundary. Monitoring revisions restore the latest selected modalities, samples and cloud cover, including values from a failed monitoring submission. Background polling preserves edits in progress. Unsigned edits are not saved across a page reload.
4. **Carbon Ledger — Report.** Retrieve the evidence and methodology. With manual study selected, leave the claim quantity blank to calculate from soil measurements, or enter a quantity to test the independent check. Satellite-only monitoring produces a clear-scene-coverage observation claim; entering a carbon quantity is rejected. `/report` produces a signed `Claim`.
5. **Assurance Desk — Verify.** Retrieve original evidence, validate signatures and hashes, reproduce the calculation and assess the educational quality profile. `/verify` produces a separate signed `VerificationResult`. Manual-only review applies soil-sample checks without a satellite cloud requirement. Satellite review verifies the PNG fixture, product/source/snapshot links and cloud cover; satellite-only review reproduces the coverage percentage. The normal outcome is `verified_with_qualifications` because all observations and calculations are educational.
6. **Attestation Office — Attest.** Bind the exact claim and accepted independent verification in a signed `Attestation`. The fictional authority retains all qualifications; it does not issue Gold Standard certification or carbon credits.

Each protocol step uses a request, immediate HTTP **202 ACK**, later signed `/on_*` callback and HTTP **200 callback ACK**. An ACK accepts the transport message; it does not mean the business action succeeded. Continue only after the callback is received and acknowledged.

## Browse projects and revisions

**Browse projects** opens the portfolio. **Applications** opens the eight role entry points:

| Application | Role | Path on localhost:3000 |
|---|---|---|
| Fieldkeeper | Land steward / Subject Controller | `/apps/controller` |
| Project Studio | Project implementer | `/apps/implementer` |
| Observatory | Measurement provider / evidence custodian | `/apps/measurement` |
| Carbon Ledger | Reporting provider | `/apps/reporter` |
| Assurance Desk | Independent assurance provider | `/apps/verifier` |
| Standards Library | Standards reference and ontology mappings | `/apps/standards` |
| Attestation Office | Fictional attesting authority | `/apps/attester` |
| Trust Registry | Registered parties, agents and public keys | `/apps/registrar` |

Open a project to use **Overview**, **Attestations**, **Versions**, **Protocol** or **Ontologies**. Switch **Browse as profile** to inspect another role's view. **Resume guided journey** returns to the current task; completed projects offer **Review the journey**.

From Overview, choose **Start a new revision**, select its starting step, explain the reason and choose **Create a revision journey**. New signed objects retain `revisionOf`, `supersedes` and `revisionReason`. Earlier versions remain in Postgres; replacing an upstream resource suspends downstream current results until assurance is renewed.

Imported legacy objects preserve their original signed bytes as withdrawn history. Those projects start a new authorisation and registration before participating in the new workflow.

The protocol console displays the latest request, response ACK, callback and callback ACK for a selected action. **Asset APIs** lets you inspect stored catalog, grant and retrieval exchanges. **Attempts** lists previous requests and outcomes; selecting full historical request/callback JSON by attempt is not yet implemented. The asset exchange list currently shows the latest 150 exchanges.

## Failures and deliberate tampering

During **Review & sign**, expand **Try changing earlier data before signing**. Select an earlier signed object or asset and edit it. The outer request is signed by the current actor; upstream proofs and content hashes must still validate independently.

A failed action shows **Your /... request failed**, its error code, explanation and the step that needs correction. Its step indicator uses **! / Request failed**, not a completion checkmark. A pending retry and a newly requested revision do not inherit a previous completion checkmark. Historical failure results remain inspectable in Versions.

| Exercise | Expected result | Correction |
|---|---|---|
| Change an earlier claim while keeping its proof | `INVALID_SIGNATURE` callback | Return to report and issue a corrected signed claim |
| Substitute CSV contents while signing | `DIGEST_MISMATCH` callback | Return to monitor and publish corrected evidence |
| Sign an inflated report quantity | `CALCULATION_MISMATCH` at verification | Re-report using the source calculation, then re-verify |
| Publish cloud cover above 20% | `QUALITY_INSUFFICIENT` at verification | Correct monitoring and repeat downstream steps |
| Change the bytes of a stored evidence file | `DIGEST_MISMATCH` on controlled retrieval | Restore the original file or publish a new evidence revision |

The correction panel persists after reload. Original signed history is retained. These controls belong to the demonstration signing flow; there is no separate Trust Lab.

## Asset contents, paths and signatures

**The exact file bytes are hashed with SHA-256.** Each `AssetReference` includes the digest, byte length, media type, custodian and locations, and the custodian signs that reference. Evidence manifests and downstream resources bind their upstream signed objects by digest.

Changing a file's contents at the **same path** makes the retrieved bytes differ from the signed digest. Controlled retrieval or subsequent processing fails with `DIGEST_MISMATCH`. The unchanged AssetReference still has a valid signature: the separate byte-hash check detects that the file no longer matches it. Changing the digest or location inside the reference without re-signing instead invalidates the reference's signature. Even a whitespace-only file edit changes the byte digest.

The application does not continuously watch files for edits. Checks run when retrieving or processing evidence. Direct public-file requests do not run the controlled evidence API's integrity check.

Synthetic files are stored under `public/assets/{projectId}/{uniqueFolder}/`. They include:

- `soil-samples.csv` (when manual field study is selected)
- `field-boundary.geojson`
- `practice-record.json` (when manual field study is selected)
- `satellite-image.png` and `satellite-capture.json` (when satellite capture is selected)
- `methodology-profile.json`

Reporter, verifier and attester can use **Evidence & methodology** to follow a catalog descriptor, request a signed grant and retrieve hash-verified content. Requests, grants and responses are recorded in Postgres. Grants bind a requester, resource, purpose and expiry; they last two minutes. Public asset copies are intentionally accessible for this synthetic demo and are not private evidence storage.

PNG payloads travel through the same grant/retrieval APIs with `encoding: base64`. The requesting backend service decodes them and checks the original byte hash before returning the verified image for browser display; text assets retain UTF-8 encoding. The preview explicitly identifies the image as synthetic.

## Routes and persistence

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Check database connectivity and callback origin |
| `POST /api/session` | Select a fictional profile; set a four-hour HttpOnly, SameSite cookie |
| `GET /api/projects` | List projects assigned to the selected party |
| `POST /api/projects` | Create a project and mapped subject |
| `GET /api/projects/{id}` | Read project, current objects, history, messages and exchanges |
| `POST /api/projects/{id}/consent` | Sign subject authorisation; synchronous HTTP 201 |
| `POST /api/projects/{id}/sign` | Prepare a signed protocol envelope for review |
| `POST /register`, `/monitor`, `/report`, `/verify`, `/attest` | Accept signed action envelopes; HTTP 202 ACK |
| `POST /on_register`, `/on_monitor`, `/on_report`, `/on_verify`, `/on_attest` | Receive correlated, signed callbacks; HTTP 200 ACK |
| `POST /api/projects/{id}/revise` | Begin a revision with a reason |
| `POST /api/projects/{id}/retry-callback` | Queue another callback delivery attempt |
| `POST /api/projects/{id}/asset` | UI adapter for controlled evidence retrieval |
| `GET /catalog/resources/{encodedId}` | Resolve a signed resource and its current status |
| `GET /catalog/assets/{encodedId}` | Resolve a signed AssetReference |
| `POST /evidence/access-grants` | Exchange a signed access request for a signed grant; HTTP 201 |
| `GET /evidence/assets/{encodedId}?grantId={encodedGrantId}` | Retrieve verified content using the requester-bound grant |
| `GET /api/status/{encodedId}` | Get a signed resource-status record |
| `GET /api/registry` | Read parties, agents and public verification methods |

Browser action requests use the demo session cookie, `Content-Type: application/vnd.open-dmrv+json;version=0.0.1` and `Idempotency-Key` equal to `context.messageId`. Internal custodian calls use a service credential plus the acting profile. Callback delivery additionally requires the service credential. No secret belongs in a durable claim or manifest.

The `dmrv` database schema stores parties, agents, verification methods, projects, memberships, subjects, immutable signed resources, resource references and status events, immutable protocol envelopes, callback deliveries, outbox jobs, access requests/grants, API exchanges, sessions and audit events. Assets remain files; their signed descriptors and hashes are stored in Postgres.

The worker leases jobs from the durable outbox, processes accepted actions and delivers callbacks. Retries preserve callback identity and signed bytes, use increasing delays, and stop after ten failed attempts. **Retry pending callback delivery** queues another delivery attempt. A stored transport ACK is idempotent; reusing the same message ID with changed signed content is rejected.

`runtime/keys.private.json` and `runtime/service.secret` are generated locally and must be preserved with the database. Registered public keys must match the existing private keys. Do not delete or replace keys to repair a connection error. Keep `.env.local` and runtime secrets out of source control.

## Mapbox and geographic scope

The map uses Mapbox GL JS v3 with `mapbox://styles/mapbox/standard`, real WGS84 / OGC:CRS84 coordinates, GeoJSON polygons and derived hectares near **79.08 E, 10.77 N**, Thanjavur, Tamil Nadu. Use a public `pk.` browser token. **Mapbox settings** can store a public token in local storage for the current origin. Restart after changing environment configuration; rebuild a production bundle after changing public build-time variables.

Without a token, the map displays a labelled coordinate/boundary preview. Locations are real; demonstration boundaries are not surveyed or cadastral records. Names, parties, ownership, observations and satellite context are fictional. A deterministic synthetic PNG is generated for the selected satellite capture; no live satellite imagery is downloaded and no satellite is tasked. Its RGB pixels are a demonstration fixture, not physical reflectance. Soil carbon is never inferred from that image.

## Methodology and ontology scope

**Gold Standard SOC Framework v1.0** is a pinned historical reference. The actual calculation is an educational fixed-depth soil-stock difference:

`(current SOC% - baseline SOC%) × density × depth × (1 - rock fraction)`

The result in tC/ha is multiplied by area and 44/12, then reduced by illustrative emissions, leakage and a 20% buffer. The verifier independently reproduces it. This is not an approved activity module, an additionality assessment, full uncertainty or permanence treatment, programme certification, or credit issuance. Standards Library links to the framework and programme-alignment sources for review.

New `/monitor` observation payloads carry an inline JSON-LD 1.1 context, selected modalities and the versioned `urn:open-dmrv:demo:monitoring:v1` profile. Manual requests include AgrO equipment/practice context and ENVO soil context. Satellite requests specify RESEO `Sentinel2Product`, `Sentinel2` and `RasterImage` as requested types; they do not assert that capture has already occurred.

Published manifests identify the resulting synthetic product, source, PNG and snapshot. Claims preserve those same semantic fields. Verification and attestation bind the exact claim and preserve the observation semantics. The application checks this profile, selected-asset requirements, term mappings and cross-object consistency; it does not provide general OWL or SHACL validation. Older signed records remain readable without being rewritten.

Mappings in produced evidence and claims include:

| Ontology | Term | Claim use |
|---|---|---|
| AgrO | `http://purl.obolibrary.org/obo/AGRO_00000416` | Agricultural implement; demonstration drill |
| ENVO | `http://purl.obolibrary.org/obo/ENVO_00001998` | Sampled soil material |
| RESEO | `https://w3id.org/reseo#Sentinel2Product` | Synthetic satellite product |
| RESEO | `https://w3id.org/reseo#hasDataSource`, `DataSource` and `Sentinel2` | Product-to-source relationship |
| RESEO | `https://w3id.org/reseo#RasterImage` | Captured synthetic PNG representation |
| RESEO | `https://w3id.org/reseo#Snapshot`, `hasProduct` and `cloudcoverpercentage` | Snapshot/product binding and cloud-cover observation |

AgrO does not define the demo no-till practice class: that and other protocol/carbon-specific fields use the explicit demo vocabulary. Full OWL reasoning and SHACL validation are not implemented. See **Ontologies** in a project archive for IRIs and field paths.

Sources: [AgrO](https://github.com/AgriculturalSemantics/agro) (CC BY 4.0), [ENVO](https://github.com/EnvironmentOntology/envo) (CC BY 4.0), [RESEO](https://github.com/KhaosResearch/REmoteSEnsingOntology) (MIT), and the [SOC Framework](https://globalgoals.goldstandard.org/402-luf-agr-fm-soil-organic-carbon-framework-methodolgy/).

## Validation and limitations

```powershell
pnpm typecheck
pnpm test
```

Tests cover JCS/P-256 proofs, altered inner claims, exact asset bytes changed at an unchanged path, calculation reproduction, malformed samples, geographic coordinates, ontology mappings, protocol context, failure indicators and restoration of monitoring observations without overwriting edits during polling.

The database integration test requires a **separate test database whose name contains `test`**. Set it in the shell before running:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://USER:PASSWORD@localhost:5432/open_dmrv_test'
pnpm test:integration
```

It exercises registration, persisted callbacks, idempotency and database immutability. Without `TEST_DATABASE_URL`, it is skipped. Unit tests and a successful build do not establish complete browser, restart or distributed-worker validation.

This remains a local educational application. All eight profiles are openly selectable; every project includes the same fixed parties. The backend holds all signing keys, and evidence resolution is restricted to the configured local origin. Real account authentication, independent organisational key custody, external custodians, private evidence storage and production HTTPS/OAuth policy are outside this demo. Cryptographic signatures establish protected content and signer identity, not scientific truth; independent cryptosuite interoperability has not been certified.

## Source layout

- `app/`: Next.js pages, protocol/API route handlers and styles.
- `components/application.tsx`: home, project creation, role portfolios, journey, archive and protocol console.
- `components/field-map.tsx`: Mapbox parcel view.
- `lib/journey-state.ts`: monitoring draft restoration and step outcome presentation.
- `lib/monitoring.ts`, `server/monitoring.ts`: typed observation requests, modality-specific evidence and profile checks.
- `server/synthetic-capture.ts`: deterministic, hash-bound PNG evidence fixture.
- `lib/model.ts`, `lib/journey.ts`, `lib/semantics.ts`: demo actors, steps, geography and ontology mappings.
- `server/workflow.ts`: protocol acceptance, processing and callbacks.
- `server/repository.ts`, `server/db.ts`, `db/migrations/`: Postgres persistence and immutable resource history.
- `server/assets.ts`, `server/crypto.ts`, `server/http.ts`: custody, integrity, signatures and HTTP adapters.
- `scripts/`: migration, worker, launcher and database checks.
- `tests/`: unit/regression and opt-in database integration checks.

The implementation follows the five actions and separately signed assurance resources in the repository's discussion draft. It does not claim normative Open dMRV conformance.

Satellite ontology terms were checked against the [RESEO 1.0 reference](https://khaosresearch.github.io/REmoteSEnsingOntology/). Synthetic scene coverage is `100 - cloud cover`; it is an educational image-quality observation and cannot substitute for a soil-carbon study.
