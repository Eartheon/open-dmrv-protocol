import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { runtimeDir } from './config.ts';
import { transaction } from './db.ts';
import { canonicalize, digest, uid } from './protocol.ts';
import { parcels, areaHa, party } from '../lib/model.ts';
import type { Doc } from '../lib/model.ts';
// Preserve original signed bytes. Historical files are never rewritten to fit a new schema.
export async function importLegacy() {
    const oldState = resolve('../examples/carbon-market/runtime/state.json');
    const file = existsSync(oldState) ? oldState : join(runtimeDir, 'legacy-state.json');
    if (!existsSync(file)) return 0;
    const state = JSON.parse(readFileSync(file, 'utf8'));
    const documents: Doc[] = state.history || [];
    const actions: Record<string, string> = {
        SubjectAuthorisation: 'consent',
        RegistrationResult: 'register',
        EvidenceManifest: 'monitor',
        Claim: 'report',
        VerificationResult: 'verify',
        Attestation: 'attest',
    };
    let imported = 0;
    for (const activity of [...new Set(documents.map((d) => d.activityId).filter(Boolean))]) {
        await transaction(async (db) => {
            if ((await db.query('SELECT id FROM dmrv.projects WHERE activity_id=$1', [activity])).rowCount) return;
            const group = documents.filter((d) => d.activityId === activity),
                registration = group.find((d) => d.type === 'RegistrationResult');
            const parcel = parcels.find((p) => p.id === state.selectedParcel) || parcels[0],
                geometry = registration?.subject?.spatial?.geometry || parcel.geometry;
            const projectId = randomUUID();
            await db.query(
                'INSERT INTO dmrv.projects(id,activity_id,transaction_id,name,domain,created_by,parcel_id,correction) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
                [
                    projectId,
                    activity,
                    uid(),
                    (registration?.subject?.name || parcel.name) + ' · previous demo',
                    'carbon',
                    party('implementer'),
                    parcel.id,
                    {
                        code: 'LEGACY_HISTORY_IMPORTED',
                        message:
                            'Earlier signed objects are preserved as historical records. Begin a new authorisation and registration before using the new workflow.',
                        retryFrom: 'consent',
                    },
                ]
            );
            await db.query('INSERT INTO dmrv.subjects(id,project_id,name,geometry,area_ha) VALUES($1,$2,$3,$4,$5)', [
                'urn:open-dmrv:subject:' + projectId,
                projectId,
                registration?.subject?.name || parcel.name,
                geometry,
                areaHa(geometry),
            ]);
            await db.query('INSERT INTO dmrv.project_members(project_id,party_id,role) SELECT $1,id,role FROM dmrv.parties', [projectId]);
            const versions: Record<string, number> = {};
            for (const doc of group) {
                const type = Array.isArray(doc.type) ? doc.type[0] : doc.type,
                    action = actions[type];
                if (!action) continue;
                const issuer =
                    action === 'consent'
                        ? 'controller'
                        : action === 'register'
                        ? 'registrar'
                        : action === 'monitor'
                        ? 'measurement'
                        : action === 'report'
                        ? 'reporter'
                        : action === 'verify'
                        ? 'verifier'
                        : 'attester';
                versions[action] = (versions[action] || 0) + 1;
                await db.query(
                    "INSERT INTO dmrv.resources(id,project_id,action,kind,version,issuer,document,canonical_document,digest,status,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'withdrawn',$10) ON CONFLICT(id) DO NOTHING",
                    [doc.id, projectId, action, type, versions[action], party(issuer), doc, canonicalize(doc), digest(doc), doc.issuedAt || doc.proof.created]
                );
                await db.query(
                    "INSERT INTO dmrv.resource_status_events(resource_id,status,reason) VALUES($1,'withdrawn','Imported historical demonstration; original signed bytes retained')",
                    [doc.id]
                );
            }
            await db.query('INSERT INTO dmrv.audit_events(project_id,actor,event,detail) VALUES($1,$2,$3,$4)', [
                projectId,
                'migration',
                'legacy_history_imported',
                { count: group.length, originalSignaturesPreserved: true },
            ]);
            imported++;
        });
    }
    return imported;
}
