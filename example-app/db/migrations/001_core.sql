CREATE SCHEMA IF NOT EXISTS dmrv;
CREATE TABLE IF NOT EXISTS dmrv.migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS dmrv.parties (
 id text PRIMARY KEY, profile_id text UNIQUE NOT NULL, name text NOT NULL, person_name text NOT NULL,
 role text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS dmrv.agents (
 id text PRIMARY KEY, party_id text NOT NULL REFERENCES dmrv.parties(id), role text NOT NULL,
 callback_origin text NOT NULL, active boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS dmrv.verification_methods (
 id text PRIMARY KEY, party_id text NOT NULL REFERENCES dmrv.parties(id), agent_id text NOT NULL REFERENCES dmrv.agents(id),
 public_key_pem text NOT NULL, public_key_jwk jsonb NOT NULL, role text NOT NULL,
 valid_from timestamptz NOT NULL, valid_until timestamptz NOT NULL, revoked_at timestamptz,
 CHECK(valid_until > valid_from)
);
CREATE TABLE IF NOT EXISTS dmrv.projects (
 id uuid PRIMARY KEY, activity_id text UNIQUE NOT NULL, transaction_id text UNIQUE NOT NULL,
 name text NOT NULL CHECK(length(name) BETWEEN 2 AND 120), domain text NOT NULL CHECK(domain IN ('carbon','digital-twin')),
 created_by text NOT NULL REFERENCES dmrv.parties(id), parcel_id text NOT NULL,
 next_action text NOT NULL DEFAULT 'consent' CHECK(next_action IN ('consent','register','monitor','report','verify','attest','complete')),
 revision integer NOT NULL DEFAULT 0, correction jsonb, pending_message_id text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS dmrv.project_members (
 project_id uuid NOT NULL REFERENCES dmrv.projects(id), party_id text NOT NULL REFERENCES dmrv.parties(id),
 role text NOT NULL, PRIMARY KEY(project_id,party_id,role)
);
CREATE TABLE IF NOT EXISTS dmrv.subjects (
 id text PRIMARY KEY, project_id uuid UNIQUE NOT NULL REFERENCES dmrv.projects(id),
 name text NOT NULL, geometry jsonb NOT NULL, crs text NOT NULL DEFAULT 'OGC:CRS84', area_ha numeric NOT NULL CHECK(area_ha>0)
);
CREATE TABLE IF NOT EXISTS dmrv.resources (
 id text PRIMARY KEY, project_id uuid NOT NULL REFERENCES dmrv.projects(id), action text NOT NULL,
 kind text NOT NULL, version integer NOT NULL CHECK(version>0), issuer text NOT NULL REFERENCES dmrv.parties(id),
 document jsonb NOT NULL, canonical_document text NOT NULL, digest text NOT NULL,
 revision_of text REFERENCES dmrv.resources(id), supersedes_digest text, revision_reason text,
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','superseded','suspended','withdrawn')),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(project_id,action,version)
);
CREATE UNIQUE INDEX IF NOT EXISTS resources_one_active_action ON dmrv.resources(project_id,action) WHERE status='active';
CREATE TABLE IF NOT EXISTS dmrv.resource_references (
 resource_id text NOT NULL REFERENCES dmrv.resources(id), target_id text NOT NULL, target_digest text NOT NULL,
 relation text NOT NULL, PRIMARY KEY(resource_id,target_id,relation)
);
CREATE TABLE IF NOT EXISTS dmrv.resource_status_events (
 id bigserial PRIMARY KEY, resource_id text NOT NULL REFERENCES dmrv.resources(id), status text NOT NULL,
 reason text, superseded_by text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS dmrv.assets (
 id text PRIMARY KEY, project_id uuid NOT NULL REFERENCES dmrv.projects(id), manifest_id text,
 name text NOT NULL, media_type text NOT NULL, custodian text NOT NULL REFERENCES dmrv.parties(id),
 relative_path text NOT NULL, digest text NOT NULL, size_bytes bigint NOT NULL,
 descriptor jsonb NOT NULL, descriptor_digest text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS dmrv.messages (
 message_id text PRIMARY KEY, project_id uuid NOT NULL REFERENCES dmrv.projects(id), transaction_id text NOT NULL,
 action text NOT NULL, direction text NOT NULL CHECK(direction IN ('request','callback')),
 correlation_id text REFERENCES dmrv.messages(message_id), sender text NOT NULL REFERENCES dmrv.parties(id),
 recipient text NOT NULL REFERENCES dmrv.parties(id), envelope jsonb NOT NULL, canonical_envelope text NOT NULL,
 digest text NOT NULL, endpoint text NOT NULL, acknowledgement jsonb NOT NULL,
 http_status integer NOT NULL, status text NOT NULL DEFAULT 'accepted', business_outcome text,
 error jsonb, result_resource_id text REFERENCES dmrv.resources(id), expected_revision integer,
 received_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS messages_project_received ON dmrv.messages(project_id,received_at DESC);
CREATE TABLE IF NOT EXISTS dmrv.callback_deliveries (
 message_id text PRIMARY KEY REFERENCES dmrv.messages(message_id), request_id text UNIQUE NOT NULL REFERENCES dmrv.messages(message_id),
 callback_url text NOT NULL, status text NOT NULL DEFAULT 'pending', attempts integer NOT NULL DEFAULT 0,
 last_http_status integer, last_response jsonb, last_error text, delivered_at timestamptz
);
CREATE TABLE IF NOT EXISTS dmrv.outbox (
 id uuid PRIMARY KEY, kind text NOT NULL CHECK(kind IN ('process','callback')), message_id text NOT NULL REFERENCES dmrv.messages(message_id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','completed','dead')),
 attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(), locked_until timestamptz,
 last_error text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(kind,message_id)
);
CREATE INDEX IF NOT EXISTS outbox_ready ON dmrv.outbox(available_at) WHERE status IN ('pending','running');
CREATE TABLE IF NOT EXISTS dmrv.access_requests (
 id text PRIMARY KEY, project_id uuid NOT NULL REFERENCES dmrv.projects(id), requester text NOT NULL REFERENCES dmrv.parties(id),
 resource_id text NOT NULL, purpose text NOT NULL, request jsonb NOT NULL, response jsonb, status integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS dmrv.access_grants (
 id text PRIMARY KEY, project_id uuid NOT NULL REFERENCES dmrv.projects(id), asset_id text NOT NULL REFERENCES dmrv.assets(id),
 requester text NOT NULL REFERENCES dmrv.parties(id), purpose text NOT NULL, expires_at timestamptz NOT NULL,
 revoked_at timestamptz, document jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS dmrv.api_exchanges (
 id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES dmrv.projects(id), requester text NOT NULL,
 method text NOT NULL, endpoint text NOT NULL, request jsonb, response jsonb, http_status integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS dmrv.sessions (
 token_hash text PRIMARY KEY, party_id text NOT NULL REFERENCES dmrv.parties(id), profile_id text NOT NULL,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS dmrv.audit_events (
 id bigserial PRIMARY KEY, project_id uuid REFERENCES dmrv.projects(id), actor text NOT NULL,
 event text NOT NULL, detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION dmrv.protect_resource() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.document IS DISTINCT FROM OLD.document OR NEW.digest IS DISTINCT FROM OLD.digest
 OR NEW.canonical_document IS DISTINCT FROM OLD.canonical_document OR NEW.id IS DISTINCT FROM OLD.id
 OR NEW.issuer IS DISTINCT FROM OLD.issuer OR NEW.project_id IS DISTINCT FROM OLD.project_id
 OR NEW.action IS DISTINCT FROM OLD.action OR NEW.version IS DISTINCT FROM OLD.version
 OR NEW.revision_of IS DISTINCT FROM OLD.revision_of OR NEW.supersedes_digest IS DISTINCT FROM OLD.supersedes_digest
 OR NEW.revision_reason IS DISTINCT FROM OLD.revision_reason OR NEW.created_at IS DISTINCT FROM OLD.created_at
 THEN RAISE EXCEPTION 'Signed resources are immutable; create a new revision'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS immutable_resource ON dmrv.resources;
CREATE TRIGGER immutable_resource BEFORE UPDATE ON dmrv.resources FOR EACH ROW EXECUTE FUNCTION dmrv.protect_resource();
CREATE OR REPLACE FUNCTION dmrv.protect_message() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.envelope IS DISTINCT FROM OLD.envelope OR NEW.canonical_envelope IS DISTINCT FROM OLD.canonical_envelope
 OR NEW.digest IS DISTINCT FROM OLD.digest OR NEW.message_id IS DISTINCT FROM OLD.message_id
 THEN RAISE EXCEPTION 'Protocol message bytes are immutable'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS immutable_message ON dmrv.messages;
CREATE TRIGGER immutable_message BEFORE UPDATE ON dmrv.messages FOR EACH ROW EXECUTE FUNCTION dmrv.protect_message();
INSERT INTO dmrv.migrations(version) VALUES(1) ON CONFLICT DO NOTHING;
