# Open dMRV: protocol in practice

A local reference application for the Open dMRV discussion draft. The launcher opens **Carbon Markets**; **Digital Twins** is disabled with a Coming Soon label. Eight role applications share a backend and an educational soil-carbon activity near Thanjavur, Tamil Nadu.

The design uses the local Forum for Urban Informatics `dmrv.html` reference: sage `#6d8865`, deep green `#243c2a`, pale green, cream, Helvetica/Arial, grid textures and square bordered cards. Each role adds its own accent, information layout and task.

## Run

Requires Node.js 24 or newer and npm. In this directory:

```powershell
npm install
npm run dev
```

Open **http://localhost:3000**. This starts Next.js, the API and eight role application gateways. All servers bind to loopback only.

For a production build on your local machine:

```powershell
npm run build
npm start
```

The development launcher uses the installed dependencies directly, so npm `.bin` shims are not required. Dependencies may already be available in the prepared workspace; a clean checkout uses `npm install`. No existing external project or its dependencies are modified by the sample.

| Application | Profile | URL |
|---|---|---|
| Fieldkeeper | Subject Controller | http://localhost:3101 |
| Project Studio | Implementer | http://localhost:3102 |
| Observatory | Measurement Provider / evidence custodian | http://localhost:3103 |
| Carbon Ledger | Reporting Provider | http://localhost:3104 |
| Assurance Desk | Independent Assurance Provider | http://localhost:3105 |
| Standards Library | Gold Standard reference view | http://localhost:3106 |
| Attestation Office | Fictional Attesting Authority | http://localhost:3107 |
| Trust Registry | Registrar | http://localhost:3108 |

The same screens are available under `/apps/{profile}` on port 3000. The role gateways serve separate entry points and browser origins from one Next.js codebase. They are not separately deployed organisations or repositories.

## Add Mapbox later

Copy `.env.example` to `.env.local` and enter a **public browser token**:

```dotenv
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_public_token
NEXT_PUBLIC_MAPBOX_STYLE=mapbox://styles/mapbox/satellite-streets-v12
```

Restart the development server after changing environment variables; rebuild for a production run. Alternatively, use **Mapbox settings** inside a map. That token is stored only in the browser's local storage for the current origin. Use a URL-restricted public token and allow the local app URLs you use. Never use a secret `sk.` token.

The map uses Mapbox GL JS with real WGS84 / OGC:CRS84 coordinates near **79.08° E, 10.77° N**, GeoJSON polygons, derived polygon areas, satellite imagery, parcel labels, selection and navigation controls. Without a token it shows a labelled coordinate/boundary preview. It does not pretend to display satellite imagery.

**The demonstration boundaries are drawn at real geographic locations. They are not surveyed or cadastral boundaries, and names, land tenure, ownership and observations are fictional.** Land stewardship does not claim consent from any real owner. The same registered geometry and subject identifier are carried through monitoring, reporting and attestation.

## Walk through the application

1. Open Carbon Markets and choose **Fieldkeeper**. Select a field, check the demonstration authorisation box, and authorise it. The controller signs a separate authorisation.
2. Switch to **Project Studio** and register. The Registrar signs the registration result binding the selected subject, authorisation, methodology reference and participants.
3. Switch to **Observatory** and publish evidence. The measurement party signs an `EvidenceManifest` containing stable asset references, file digests, study provenance and synthetic satellite metadata. The CSV stays in the custodian folder.
4. Switch to **Carbon Ledger** and issue the claim. The reporter signs a `Claim` containing the illustrative calculation, spatial/temporal scope, evidence digest and limitations.
5. Switch to **Assurance Desk** and verify. A short-lived, requester-bound evidence grant is issued; file hashes, signatures, keys, independence, calculation reproduction and the demo Function Profile are checked. The verifier signs a separate `VerificationResult`.
6. Switch to **Attestation Office** and attest. Only accepted outcomes may proceed. The authority rechecks the current chain and signs an `Attestation` binding both the claim and verification digests. All qualifications remain explicit.
7. Inspect **Objects & handoffs** in any profile: full object, request, immediate ACK, asynchronous callback and revision history. Export the audit or download individual signed objects.

All eight profiles are openly selectable. This is an educational role switcher, not an account system or identity-verification service. Role-scoped opaque tokens last one hour. Signing keys stay in the backend. The browser receives public keys only.

The successful example is **verified_with_qualifications**, because its evidence and scientific calculation are explicitly educational. Attestation policy accepts that outcome while retaining the qualifications.

For a pre-completed chain, stop the API before running `npm run demo:seed` in a fresh runtime. It preserves an existing activity and does not overwrite it. The interactive walkthrough generates full transport exchanges; direct seeding generates the resource objects only.

## Tamper exercises

Issue at least one claim to create the matching fixtures. In PowerShell, from this directory:

```powershell
# Change the claimed quantity without changing its original proof:
Copy-Item runtime/fixtures/claim.tampered.json runtime/inbox/claim.json
npm run demo:check

# Remove that override; then change laboratory evidence bytes:
Remove-Item -LiteralPath runtime/inbox/claim.json
Copy-Item runtime/fixtures/soil-samples.tampered.csv runtime/inbox/soil-samples.csv
npm run demo:check

# Restore the original input:
Remove-Item -LiteralPath runtime/inbox/soil-samples.csv
```

The UI polls every two seconds and performs a live integrity inspection. A manually placed override triggers a red chain-of-trust warning without needing a scenario flag. The CLI exits with code 1 on failed inspection. The **Trust lab** provides the same exercises with buttons and explains how to recover.

| Exercise | Detection | Correction |
|---|---|---|
| Changed claim JSON | `INVALID_SIGNATURE` | Remove override; issue a corrected report when needed |
| Changed CSV bytes | `DIGEST_MISMATCH` | Restore original, or publish new evidence and report |
| Missing evidence | `EVIDENCE_UNAVAILABLE` | Restore custody/access and repeat verification |
| Revoked measurement key | `REVOKED_KEY` | Repair registration/key assignment and re-monitor |
| Expired reporting key | `EXPIRED_KEY` | Repair registration/key assignment and re-report |
| Reporter also verifies | `INDEPENDENCE_REQUIREMENT_FAILED` | Assign an independent accountable party |
| Correctly signed, inflated estimate | `CALCULATION_MISMATCH` | Apply exercise, then issue a new claim; clear and re-report to repair |
| 64% cloud cover | `QUALITY_INSUFFICIENT` | Apply, then re-monitor and re-report; clear and repeat those steps to repair |
| Custodian denies evidence access | `ACCESS_DENIED` | Correct access authority/policy |
| Expired signed grant | `ACCESS_GRANT_EXPIRED` | Request a fresh grant and repeat review |
| Callback delivery interrupted | `CALLBACK_DELIVERY_FAILED` | Retry original callback bytes; durable output is retained |
| Reuse ID with changed signed bytes | `CONFLICTING_MESSAGE`, HTTP 409 | Use a new message ID; identical bytes remain idempotent |

Failure exercises are local operator controls available in every demo profile. Real deployments must restrict them. **Clear exercise** removes the two known inbox overrides and clears the injected policy condition. It does not rewrite historical signed resources. Some exercises require republishing the affected resource before repeating verification.

## Object integrity and history

The baseline implementation uses recursive JCS canonicalization (RFC 8785), SHA-256 and ECDSA P-256, with the discussion draft's `ecdsa-jcs-2019` Data Integrity proof structure. Invalid JSON values such as lone surrogates and non-finite numbers are rejected. Verification binds the expected actor key, purpose, domain and request challenge, then checks key validity and revocation at signing time.

Separate actors sign the EvidenceManifest, Claim, VerificationResult and Attestation. Each downstream object commits to full upstream-object digests. CSV digests commit to exact file bytes. Whitespace/key ordering in JSON can change without invalidating its canonical signature; changing a protected value invalidates it. A signature establishes protected content and signer identity, not scientific truth.

Corrections create UUID-named immutable resource files with `revisionOf`, `supersedes` (previous full-object digest) and `revisionReason`. Superseding an upstream resource suspends downstream current results until repeated. Status records are separate from signed resource content. New activity closes current objects while retaining history.

`runtime/keys.private.json` is generated per installation and is ignored by git. All actors' keys are hosted by one demo process; this demonstrates cryptographic mechanics but does not provide organisational separation or protection against a malicious machine administrator. Independent organisations must retain their own keys in production. No private keys, bearer tokens or transient evidence grants are embedded in exported durable resource objects.

Interoperability with other Data Integrity implementations has not been independently certified. No normative Open dMRV conformance is claimed against a discussion draft.

## REST implementation

The UI convenience endpoints create signed protocol envelopes on behalf of the selected demo actor. The API also exposes the versioned protocol action routes for already-signed requests. It validates session role, envelope identity, recipient, registered callback, protocol version, signature, timestamp/TTL and idempotency. The envelope message carries activity, subject and current resource references; this sample processes only the currently selected local activity, not arbitrary external resources.

| Endpoint | Behaviour |
|---|---|
| `POST /session` | Open a fictional demo profile; returns one-hour opaque bearer token |
| `POST /consent` | Subject Controller signs demonstration authorisation |
| `POST /actions/{action}` | UI adapter constructs and signs an action envelope |
| `POST /dmrv/v0.0.1/{register,monitor,report,verify,attest}` | Accept signed envelope; return HTTP 202 ACK; process asynchronously |
| `POST /callbacks/{role}` | Actual loopback callback delivery; separate service credential; signed envelope; correlation and replay checks; HTTP 200 ACK |
| `POST /evidence/access-grants` | Issue signed resource-, requester- and purpose-bound grant; HTTP 201 |
| `POST /evidence/retrieve` | Retrieve CSV using a verified grant and authenticated requester; reject expired grants |
| `GET /state` | Public registry, current objects, live inspection and history; no private keys |
| `POST /inspect` | Live chain inspection without creating a signed assurance result |
| `GET /objects/{encodedUrn}` | Export an immutable resource |
| `GET /status/{encodedUrn}` | Signed current resource status |
| `GET /export` | Export the public audit snapshot |
| `POST /demo/scenario` | Apply/clear an educational failure condition |
| `POST /demo/retry-callbacks` | Retry pending delivery with original callback ID and signed bytes |
| `POST /demo/replay` | Demonstrate stored ACK and conflicting reuse rejection |
| `POST /demo/reset` | New activity; retain history |

The `AccessGrant.href` points to the controlled `POST /evidence/retrieve` service; its `method` is `POST`. Send the grant plus the requesting profile bearer token. Source-file access itself is not public. Production bindings may use capability URLs, signed object URLs or proof-of-possession delivery instead.

Protocol requests use `Content-Type: application/vnd.open-dmrv+json;version=0.0.1`, `Authorization: Bearer …`, and `Idempotency-Key` equal to `context.messageId`. A transport ACK is not an assurance decision. Callback `correlationId` matches the original request `messageId`, and `transactionId` stays unchanged. Requests and completed outputs persist; pending requests and callback delivery resume after API restart.

This local profile intentionally uses HTTP loopback and generated opaque tokens. It does **not** implement OAuth, TLS, `private_key_jwt`, mTLS, an external identity provider, distributed signing, accreditation, production key custody or durable multi-worker queues. Implement those under the draft's production HTTPS/OAuth profile before deployment.

## Gold Standard and the calculation boundary

Standards Authority: **Gold Standard**. Attesting Authority: **Demo Programme Authority**, a fictional entity, not Gold Standard. The pinned reference is the SOC Framework Methodology v1.0 (PDF published January 2020), with the 2025 SOC model guidelines linked for context.

The stock example computes `(current SOC% − baseline SOC%) × bulk density (g/cm³) × depth (cm) × (1 − rock fraction)` to obtain tC/ha, multiplies by area and 44/12, subtracts illustrative emissions/leakage and applies an illustrative 20% buffer. Inputs, assumptions and outputs are included in the signed claim and reproduced by the verifier.

**This is not a complete Gold Standard quantification or an approved activity module.** Before/after samples alone do not establish an additional project benefit relative to a counterfactual baseline. The example does not implement project eligibility, additionality, full baseline modelling, stratified sampling, equivalent soil mass, uncertainty treatment, permanence, risk-based buffer determination, leakage accounting, external validation, programme approval or credit issuance. Fixed deductions and equal sample weights are teaching assumptions, not Gold Standard default parameters. Paddy systems may require broader GHG accounting, including methane, which this example does not assess.

The Standards Library and every assurance object state these limits. The correct architecture is to replace the demo calculation/profile with an applicable validated scientific module while retaining the protocol exchange.

Sources checked on 12 November 2026:

- [SOC Framework Methodology v1.0](https://globalgoals.goldstandard.org/402-luf-agr-fm-soil-organic-carbon-framework-methodolgy/)
- [SOC model requirements and guidelines](https://globalgoals.goldstandard.org/402-7_soil-organic-carbon-model-requirements-and-guidelines/)
- [Paris Agreement alignment schedule](https://globalgoals.goldstandard.org/gs4gg-paris-agreement-alignment/) — the published schedule, last updated April 2026, lists SOC Framework v1.0 as Internal revision. It requires checking current programme eligibility rather than treating the historical reference as automatically valid for issuance.
- [Zero tillage activity module](https://globalgoals.goldstandard.org/402-4-luf-agr-am-soc-module-zero-tillage/) — relevant activity-specific reference to assess when replacing the toy calculation; not implemented here.

## Ontology mapping

Claims and evidence carry an inline JSON-LD context and annotations from the three requested ontologies. Protocol-specific properties use a separate demo vocabulary. AgrO's agricultural implement is a broad type for the example drill, not a claim that that term means no-tillage.

| Ontology | Term | Use |
|---|---|---|
| AgrO | `http://purl.obolibrary.org/obo/AGRO_00000416` | Agricultural implement associated with the practice |
| ENVO | `http://purl.obolibrary.org/obo/ENVO_00001998` | Soil material sampled by the laboratory |
| RESEO | `https://w3id.org/reseo#Sentinel2Product` | Supporting satellite product metadata |
| RESEO | `https://w3id.org/reseo#hasDataSource` / `DataSource` | Product-to-source relationship |

Sources and attribution:

- Aubert C., Buttigieg P.L., Laporte M.A., Devare M., Arnaud E. (2017), [CGIAR Agronomy Ontology](https://github.com/AgriculturalSemantics/agro), CC BY 4.0. Term reference release: 2022-11-02.
- [Environment Ontology](https://github.com/EnvironmentOntology/envo), CC BY 4.0; soil term reference.
- Aldana-Martín et al., [RESEO](https://github.com/KhaosResearch/REmoteSEnsingOntology), version 1.0, MIT; [research publication](https://doi.org/10.1016/j.eswa.2021.115838).

This sample annotates records; it does not load full OWL files, execute a reasoner or provide SHACL validation.

## Checks

```powershell
npm run typecheck
npm test
npm run build
```

The tests exercise signatures, canonicalization, tampered inbox files, asset hashes, registry status, assurance independence, grant requester binding/expiry, calculation mismatch despite a valid signature, cloud-quality failure, immutable revisions, persistence, complete endorsement and request/callback idempotency.

Browser verification needs a normally launched local server and a Mapbox token for imagery. The initial restricted execution environment denied loopback socket connections, so a successful production build is not evidence of completed visual or live HTTP testing. Use the internal browser after starting the server in a normal local terminal.

## Source layout

`app/` contains Next.js routes and global design styles. `components/` contains distinct role experiences and the Mapbox component. `lib/model.ts` defines the actor/profile/domain vocabulary. `server/crypto.ts` implements canonicalization and signatures. `server/engine.ts` implements resource lifecycle, assurance and persistence. `server/index.ts` provides HTTP authentication and asynchronous delivery. `scripts/` contains lifecycle and CLI tools. `tests/` contains protocol checks. Generated runtime data, keys and inbox files stay out of git.

This implementation was informed by the repository README/specification, `Open dMRV Design Conversation.md`, the supplied `Open dMRV v0.0.1.pptx`, and the local Forum website. It follows the five actions and the four separately signed assurance objects; it does not rewrite the protocol specification.
