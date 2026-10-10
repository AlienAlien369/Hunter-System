# Legal review checklist

The Terms, Privacy Policy and Refund Policy in `src/data/legal.ts` are a
good-faith baseline written to match what the product actually does. They are
**not lawyer-reviewed**. Get a qualified lawyer (ideally one with India DPDP
and EU GDPR experience) to review them before paid plans launch or before the
service is promoted to the public. Whenever a data practice changes, update the
text and bump `LEGAL.version` (`src/data/legalConfig.ts`) and `TERMS_VERSION` /
`PRIVACY_VERSION` (`server/src/consent.ts`).

## Must be filled in before launch (not a lawyer question)

Set these as Vercel environment variables. Until set, the legal pages show a
visible "to be completed" notice.

| Variable | What |
|---|---|
| `VITE_LEGAL_OPERATOR` | Legal name of the person/company that operates the service |
| `VITE_LEGAL_ADDRESS` | Registered or postal address |
| `VITE_LEGAL_EMAIL` | Contact for privacy, refund and parental-consent requests |
| `VITE_GRIEVANCE_OFFICER` | Name and email of the grievance officer (required for India) |
| `VITE_GOVERNING_LAW` | e.g. "the laws of India, courts at <city>" (needs the lawyer) |

Parental-consent emails need `RESEND_API_KEY`, `MAIL_FROM` (a sender on a domain
verified in Resend) and optionally `APP_URL` on the **backend** (Render). Without
them no email is sent, the API reports `parentMailSent: false`, and minors cannot
get approved. This blocks all 13-17 signups, so set them before promoting.

## Questions for the lawyer

1. **DPDP Act 2023 and children (under 18).** We require verifiable-ish parental
   consent by emailed link before processing. Is an emailed link enough under the
   DPDP Rules, or is stronger verification (e.g. a DigiLocker/virtual-token check)
   required? Does the XP/streak/leaderboard mechanic count as "tracking or
   behavioural monitoring" of children, which the Act prohibits unless exempt?
2. **One policy for all ages 13-17.** We apply the strictest rule (parent consent
   under 18) everywhere to keep one product. Confirm this is acceptable and that
   we do not also need region-specific flows (GDPR-K age of consent 13-16, COPPA is
   only under 13, UK 13).
3. **Under-13 handling.** We refuse sign-up and delete any under-13 account found.
   Confirm that is sufficient for COPPA (we do not collect data from under-13s).
4. **Is `region` + `user_id` personal data / profiling?** (GDPR/UK GDPR.)
   We store a country guess from Accept-Language/timezone, not from IP.
5. **AI providers.** Text users type is sent to Anthropic and/or Google Gemini.
   Depending on the Gemini tier (free tier may allow use for product improvement),
   this may need a DPA, explicit consent, or a paid/zero-retention tier. Confirm
   which tier is in use and fix the Privacy Policy section 4 wording accordingly.
6. **International transfers.** Servers are in the US (Render Oregon) and
   possibly elsewhere; DB provider region to be confirmed. India allows transfers
   except to restricted countries; EU/UK need SCCs/UK addendum with each processor.
7. **Retention and backups.** We say deleted data leaves backups on the providers'
   normal schedule. Confirm the actual backup retention of the DB provider.
8. **Cookies.** We use one strictly necessary session cookie (SameSite=None because
   frontend and API are on different sites) and no analytics/advertising cookies,
   so no consent banner is shown. Confirm for ePrivacy/GDPR. A banner IS needed
   the moment any non-essential script (payment provider widgets, analytics,
   ads) is added.
9. **Consumer terms.** Refund policy (7-day first-purchase, 48-hour renewal,
   14-day EU/UK withdrawal), liability cap, and governing law/jurisdiction for
   India, the EU, UK and US. Auto-renewal disclosure rules differ (e.g. US state
   ARL laws, India RBI e-mandate rules for UPI AutoPay / cards).
10. **Taxes and merchant of record** (step 4): GST for India, VAT/OSS for EU/UK,
    US sales tax. Using a merchant-of-record outside India shifts this.
11. **DPDP "significant data fiduciary" / consent manager / breach reporting**
    obligations as the user base grows, and whether a Data Protection Officer or
    EU/UK representative is required once we target those markets.

12. **Classes and minors.** A teacher (any adult) can create a class; 13-17 year
    olds with parental consent can join with a code and the teacher then sees
    their Hunter name, level/rank, streak and activity counts. Is the student's
    own act of entering the code sufficient, or should joining a class by a
    minor need the parent's consent (DPDP, COPPA-style school consent, GDPR-K)?
    Is the teacher (or institute) a separate data fiduciary/controller, and do
    we need an institute agreement for the paid Teams plan? Teachers are
    self-declared adults; do they need verification?

## Known gaps in the implementation (engineering, not legal)

- Age is self-declared. A determined minor can lie; there is no verification.
- A parent link is a bearer token in an email; anyone with the email can use it.
  It stays valid so the parent can withdraw later.
- Withdrawal by a parent is only via the emailed link (or the contact address).
- Existing accounts were asked their age once on next login (`needs_age`);
  they are blocked from the product until they answer.
- There is no email address for adults, so no password-reset by email and no
  receipts yet; that arrives with paid plans (step 4).
- Class teachers are not verified: any adult can create one free pilot class.
  Students must choose a Hunter name before joining so a login username is never
  shown, but a Hunter name can still be a real name the student chose.
- The Teams plan (more classes, bigger classes, institute billing) is priced in
  the catalogue but not purchasable yet.
