import { actionRole } from './model.ts';
import type { RoleId, Action } from './model.ts';
export const journeySteps = [
    {
        id: 'consent',
        role: 'controller',
        label: 'Choose land',
        title: 'Start with the land.',
        explanation: 'Choose the project field and record the land steward’s permission to use its demonstration data.',
        task: 'Review the field, then record permission to participate.',
        button: 'Record field permission',
        next: 'Your project is ready for registration.',
    },
    {
        id: 'register',
        role: 'implementer',
        label: 'Register',
        title: 'Give the project an identity.',
        explanation: 'Connect your land, permission, service providers and methodology in one registration.',
        task: 'Review the project details, then sign the registration request.',
        button: 'Sign & register project',
        next: 'Choose how to collect the project’s evidence.',
    },
    {
        id: 'monitor',
        role: 'measurement',
        label: 'Monitor',
        title: 'Collect your project’s evidence.',
        explanation: 'Choose manual field study, satellite capture, or both. The measurement provider publishes the selected demonstration evidence.',
        task: 'Review the observations, then send the monitoring request.',
        button: 'Request monitoring',
        next: 'The reporter uses the selected evidence to build a claim.',
    },
    {
        id: 'report',
        role: 'reporter',
        label: 'Report',
        title: 'Request a claim from the evidence.',
        explanation: 'The reporter uses your selected evidence and methodology to calculate the result and issue a signed claim.',
        task: 'Inspect the evidence and requested quantity, then send the reporting request.',
        button: 'Request report',
        next: 'An independent verifier checks the claim and its source evidence.',
    },
    {
        id: 'verify',
        role: 'verifier',
        label: 'Verify',
        title: 'Request an independent check.',
        explanation: 'Review the reporter’s claim below. The independent verifier checks its signatures, original evidence, file hashes and reported result.',
        task: 'Inspect the signed claim and source evidence, then send the verification request.',
        button: 'Request verification',
        next: 'Accepted assurance can be endorsed by the attesting authority.',
    },
    {
        id: 'attest',
        role: 'attester',
        label: 'Attest',
        title: 'Request an endorsement.',
        explanation: 'The attesting authority binds the accepted claim, independent verification and methodology in a separate signed endorsement.',
        task: 'Review the assurance and qualifications, then send the attestation request.',
        button: 'Request attestation',
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
