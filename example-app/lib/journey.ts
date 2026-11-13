import { actionRole } from './model.ts';
import type { RoleId, Action } from './model.ts';
export const journeySteps = [
    {
        id: 'consent',
        role: 'controller',
        label: 'Choose land',
        title: 'Start with the land.',
        explanation: 'You are the land steward. Choose the field and give permission for this project to use its demonstration data.',
        task: 'Review the selected field, then authorise participation.',
        button: 'Authorise this field',
        next: 'Project Studio registers the activity.',
    },
    {
        id: 'register',
        role: 'implementer',
        label: 'Register',
        title: 'Give the project an identity.',
        explanation: 'You are the project implementer. Connect the land, permission, participants and methodology in one registration.',
        task: 'Review the project details, then sign the registration request.',
        button: 'Sign & register project',
        next: 'The laboratory collects and publishes evidence.',
    },
    {
        id: 'monitor',
        role: 'measurement',
        label: 'Monitor',
        title: 'Publish what was measured.',
        explanation: 'You are the measurement provider. Choose manual field study, satellite capture, or both, and publish the selected evidence.',
        task: 'Review the observations, then sign the monitoring request.',
        button: 'Sign & publish evidence',
        next: 'The reporter uses the selected evidence to build a claim.',
    },
    {
        id: 'report',
        role: 'reporter',
        label: 'Report',
        title: 'Make a claim from the evidence.',
        explanation: 'You are the reporter. Retrieve the selected evidence and methodology, reproduce its result and take responsibility for the claim.',
        task: 'Inspect the selected evidence and result, then sign the reporting request.',
        button: 'Sign & submit claim',
        next: 'An independent verifier checks the claim and its source evidence.',
    },
    {
        id: 'verify',
        role: 'verifier',
        label: 'Verify',
        title: 'Check it independently.',
        explanation: 'You are the independent verifier. Check who signed, retrieve the selected source assets, test their hashes and reproduce the reported result.',
        task: 'Review the evidence, then run and sign the independent assessment.',
        button: 'Sign & verify claim',
        next: 'Accepted assurance can be endorsed by the attesting authority.',
    },
    {
        id: 'attest',
        role: 'attester',
        label: 'Attest',
        title: 'Endorse the assured result.',
        explanation: 'You are the attesting authority. Bind the accepted claim, verification and methodology in a separate signed endorsement.',
        task: 'Review the assurance and qualifications, then sign the attestation request.',
        button: 'Sign & issue attestation',
        next: 'The attestation and every earlier revision remain available in the project archive.',
    },
] as const;
export type FlowStep = (typeof journeySteps)[number]['id'];
export const roleForStep = (step: string): RoleId => (step === 'consent' ? 'controller' : actionRole[step as Action] || 'attester');
export const outputType: Record<string, string> = {
    consent: 'SubjectAuthorisation',
    register: 'RegistrationResult',
    monitor: 'EvidenceManifest',
    report: 'Claim',
    verify: 'VerificationResult',
    attest: 'Attestation',
};
export const stageIndex = (step: string) => journeySteps.findIndex((s) => s.id === step);
export const materialRoles = ['reporter', 'verifier', 'attester', 'measurement', 'implementer'] as const;
