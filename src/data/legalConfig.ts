// Who operates Hunter System. These appear in the Terms and Privacy pages and
// MUST be filled in before launch: privacy law requires naming the operator
// and a contact (and, in India, a grievance officer). Set them as Vercel
// environment variables; until then the pages show a visible placeholder
// rather than silently omitting them.

const env = import.meta.env as Record<string, string | undefined>;
const PLACEHOLDER = '[to be completed by the operator]';

export const LEGAL = {
  operator: env.VITE_LEGAL_OPERATOR || PLACEHOLDER,
  email: env.VITE_LEGAL_EMAIL || PLACEHOLDER,
  address: env.VITE_LEGAL_ADDRESS || PLACEHOLDER,
  grievanceOfficer: env.VITE_GRIEVANCE_OFFICER || PLACEHOLDER,
  governingLaw: env.VITE_GOVERNING_LAW || PLACEHOLDER,
  // Must match TERMS_VERSION / PRIVACY_VERSION in server/src/consent.ts.
  version: '2026-10-10',
  effective: '10 October 2026',
};

export const legalConfigured = [LEGAL.operator, LEGAL.email, LEGAL.address, LEGAL.grievanceOfficer].every(v => v !== PLACEHOLDER);
