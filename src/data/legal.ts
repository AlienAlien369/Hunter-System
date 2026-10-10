import { LEGAL } from './legalConfig';

// Plain-English legal text. These are a good-faith baseline written to match
// what the product actually does today — NOT lawyer-reviewed. See
// docs/LEGAL_REVIEW.md for the open questions that need a qualified lawyer
// before paid plans launch. If the product's data practices change, change
// this text and bump the version in legalConfig.ts and server/src/consent.ts.

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface LegalDoc {
  title: string;
  intro: string;
  sections: LegalSection[];
}

export type LegalKind = 'terms' | 'privacy' | 'refund';

export const TERMS: LegalDoc = {
  title: 'Terms of Service',
  intro: `These terms are the agreement between you and ${LEGAL.operator} ("we", "Hunter System") for using Hunter System, a productivity app that turns your timetable into quests, XP and ranks.`,
  sections: [
    {
      heading: '1. Who can use Hunter System',
      bullets: [
        'You must be at least 13.',
        'If you are under 18, your parent or guardian must approve your account before you can use it. We email them a link; nothing is active until they agree, and they can withdraw consent at any time, which deletes the account.',
        'You must give an honest birth month. If we learn you are under 13, we delete the account.',
      ],
    },
    {
      heading: '2. Your account',
      bullets: [
        'You are responsible for your password and your recovery code. We cannot reset your password by email.',
        'One person, one account. Do not share or sell accounts.',
        'You can export your data or delete your account yourself at any time in Settings → Account.',
      ],
    },
    {
      heading: '3. What XP, ranks and streaks are',
      paragraphs: [
        'XP, levels, ranks, streaks, items and leaderboard positions are part of the game. They have no cash value, cannot be bought or sold, and we may adjust the rules to keep the game fair. We will never sell XP, rank or leaderboard position.',
      ],
    },
    {
      heading: '4. Acceptable use',
      bullets: [
        'Do not cheat the XP system (scripts, fake completions, multiple accounts to farm rewards). We may reset or remove XP gained that way.',
        'Do not harass others, impersonate people, or choose a Hunter name that is hateful, sexual, or someone else’s identity.',
        'Do not attack, overload, scrape, or reverse-engineer the service, or try to access other people’s data.',
        'Do not use the service for anything unlawful.',
      ],
    },
    {
      heading: '5. AI features and health content',
      paragraphs: [
        'Some features use AI to turn what you write into suggestions (for example estimating XP for an unplanned activity, drafting a module, or the weekly coach). AI can be wrong. It only suggests: the app’s fixed rules decide your XP.',
        'Hunter System is not medical, nutrition, skincare, fitness, legal or financial advice. Modules for diet, fitness or skincare are for organising habits. Talk to a qualified professional before changing your health routine.',
      ],
    },
    {
      heading: '6. Your content',
      paragraphs: [
        'You own what you put in (your timetable, task names, notes). You give us a limited licence to store and process it solely to run the service for you, including sending the text you enter into AI features to our AI providers to produce the suggestion you asked for. If you make your profile public, your Hunter name, level, rank, streak, XP and module names are visible to anyone with the link.',
      ],
    },
    {
      heading: '7. Paid plans',
      paragraphs: [
        'Hunter System is free to use today. If we introduce paid plans, prices, billing periods, renewal and cancellation will be shown clearly before you pay, you will be able to cancel online in the app, and our Refund Policy will apply. Paid plans never change how XP is earned.',
      ],
    },
    {
      heading: '8. Ending things',
      paragraphs: [
        'You can stop using Hunter System and delete your account at any time. We may suspend or remove accounts that break these terms, or the service itself, with reasonable notice where we can give it.',
      ],
    },
    {
      heading: '9. Disclaimers and limits',
      paragraphs: [
        'The service is provided “as is”, without promises that it will be uninterrupted or error-free. To the extent the law allows, we are not liable for indirect or consequential losses, and our total liability to you for anything arising from the service is limited to the amount you paid us in the 12 months before the claim (or INR 1,000 / USD 15 if you paid nothing). Nothing in these terms limits liability that cannot be limited by law, or your rights as a consumer where you live.',
      ],
    },
    {
      heading: '10. Changes, law and contact',
      paragraphs: [
        `We may update these terms. Material changes will be announced in the app and the version date below will change; continuing to use the service after that means you accept them. These terms are governed by ${LEGAL.governingLaw}, without taking away any mandatory consumer protection of the country where you live.`,
        `Questions: ${LEGAL.email}. Operator: ${LEGAL.operator}, ${LEGAL.address}.`,
      ],
    },
  ],
};

export const PRIVACY: LegalDoc = {
  title: 'Privacy Policy',
  intro: `${LEGAL.operator} runs Hunter System and is responsible for your personal data (the “data fiduciary” under India’s DPDP Act and the “controller” under the GDPR / UK GDPR). This page explains what we collect, why, who sees it, and your rights — in plain language. In short: we collect what the app needs to work, we do not show ads, and we do not sell your data.`,
  sections: [
    {
      heading: '1. What we collect',
      bullets: [
        'Account: your username, your password (stored only as a one-way hash), the Hunter name you choose, and your birth month (to apply our age rules; we never store your birth day).',
        'If you are under 18: your parent or guardian’s email address, used only to ask for their consent.',
        'What you create: your timetable, quests, modules, completions, XP history, notes and task names, content-channel and nutrition entries, items, friends you follow, and AI coach reviews.',
        'Region: a rough country guess from your browser language or timezone (not from your IP address), used to show the right language and prices and to understand where the app is used.',
        'Your browser’s timezone (so your day ends at your midnight) and, only if you turn on reminders, a push-notification address from your browser.',
        'Anonymous usage counts: page views and button clicks like “opened pricing”. They carry no cookie, device ID or IP address. If your browser sends Do Not Track or Global Privacy Control, we do not record them.',
        'Technical crash reports (error message and browser type) so we can fix bugs. They contain no account details.',
      ],
    },
    {
      heading: '2. What we do not do',
      bullets: [
        'We do not show advertising and we do not sell or “share” personal data for advertising (including under the California CCPA/CPRA definitions).',
        'We do not use ad trackers or analytics cookies, and we do not build advertising profiles.',
        'We do not collect precise location, contacts, photos, or payment card details. When paid plans arrive, card and UPI details go directly to the payment provider, not to us.',
      ],
    },
    {
      heading: '3. Why we use it (and our legal basis)',
      bullets: [
        'To run the app you signed up for — quests, XP, streaks, leaderboards, reminders (performance of a contract / your consent under DPDP).',
        'To keep it safe and working — security, abuse prevention, fixing crashes, counting aggregate usage (legitimate interests / legitimate uses).',
        'To ask a parent for consent for under-18s (consent; legal obligation).',
        'To send reminders you switched on (consent — you can switch them off at any time).',
      ],
    },
    {
      heading: '4. AI features',
      paragraphs: [
        'When you use an AI feature (describing an unplanned activity, building a module with AI, timetable suggestions, the weekly coach), the text you enter and the minimum context needed is sent to our AI providers (currently Anthropic and Google) to produce the suggestion. Do not put sensitive information in those boxes. The AI never changes your XP: the app’s fixed rules do. Depending on the provider’s terms for the service tier we use, they may retain that text for a limited time for safety and abuse monitoring; we do not use it to train our own models.',
      ],
    },
    {
      heading: '5. Who we share data with',
      bullets: [
        'Service providers that run Hunter System for us: hosting and database providers (servers in the United States and/or Singapore), an email delivery provider (parental consent messages), AI providers (section 4), payment providers if you subscribe (Razorpay in India, Stripe elsewhere), and browser push-notification services if you enable reminders.',
        'Other people, only in the ways you choose: if you pick a Hunter name and stay visible, your name, level, rank, streak and weekly/total XP appear on the leaderboard and on your public profile link, plus the names of your active modules. You can opt out in Rank → Leaderboard.',
        'Your teacher, only if you join a class with its code: they see your Hunter name, level and rank, streak, how many days you were active this week and over the last 4 weeks, and when you were last active. They never see your tasks, notes, modules, XP history, country or account details. You can leave a class at any time and they lose that view immediately.',
        'Authorities, when the law requires it.',
      ],
    },
    {
      heading: '6. International transfers',
      paragraphs: [
        'Our servers are outside your country if you live outside the United States/Singapore. By using Hunter System you understand your data is processed there. Where the law requires safeguards for transfers (for example from the EU/UK), we rely on the providers’ standard contractual clauses or equivalent mechanisms.',
      ],
    },
    {
      heading: '7. How long we keep it',
      bullets: [
        'Your account data: until you delete your account (Settings → Account) — then it is erased from our systems, apart from routine backups that expire on the providers’ normal schedule.',
        'Anonymous usage counts and event records: up to 13 months.',
        'A request to a parent that is never answered: the child’s pending account is deleted after 14 days.',
        'Records that you accepted our terms and your parent’s consent are kept as long as the account exists, as proof.',
        'Class membership: until you leave the class, the teacher removes you, the class is archived, or you delete your account.',
        'Payment records (what you paid, when, and the provider’s reference) are kept for as long as tax and accounting law require, even after you delete your account. We never hold your card or UPI details; the payment provider does.',
      ],
    },
    {
      heading: '8. Your rights',
      paragraphs: [
        'Everywhere: you can download all your data (Settings → Account → Download) and permanently delete your account there, yourself, without asking us. You can also contact us for anything below.',
      ],
      bullets: [
        'India (DPDP Act 2023): access a summary of your data, correct or erase it, withdraw consent, nominate someone to exercise your rights if you die or cannot, and get your grievance addressed. Grievance officer: ' + LEGAL.grievanceOfficer + '. If unresolved, you may complain to the Data Protection Board of India.',
        'EU / UK (GDPR): access, rectification, erasure, restriction, portability, objection to processing based on legitimate interests, and withdrawal of consent. You may complain to your national data protection authority (in the UK, the ICO).',
        'California and other US states (CCPA/CPRA and similar): know, access, correct and delete your data, and opt out of sale/sharing — we do neither. We will not discriminate against you for using these rights.',
        'Elsewhere: we apply the same rights wherever you live.',
      ],
    },
    {
      heading: '9. Children',
      paragraphs: [
        'Hunter System is not for children under 13: we do not knowingly collect their data and we delete any such account we find. People aged 13 to 17 can use it only after a parent or guardian approves by email. We show children no advertising, we do not track them for advertising, and we do not sell their data. A parent can use the link in the consent email at any time to withdraw consent, which deletes the account and its data, or contact us at the address below.',
      ],
    },
    {
      heading: '10. Cookies and local storage',
      paragraphs: [
        'We use one strictly necessary cookie that keeps you signed in, and your browser’s local storage for settings like your theme and sounds. We use no analytics or advertising cookies, which is why we do not show a cookie banner. If that ever changes we will ask first.',
      ],
    },
    {
      heading: '11. Security',
      paragraphs: [
        'Passwords are hashed, connections are encrypted, access to data is limited, and the leaderboard never shows usernames. No system is perfectly secure; if a breach affecting you occurs, we will notify you and the authorities as the law requires.',
      ],
    },
    {
      heading: '12. Changes and contact',
      paragraphs: [
        'We will announce material changes in the app and update the version date. Contact: ' + LEGAL.email + ' — ' + LEGAL.operator + ', ' + LEGAL.address + '.',
      ],
    },
  ],
};

export const REFUND: LegalDoc = {
  title: 'Refund & Cancellation Policy',
  intro: 'Hunter System is free today, so there is nothing to refund yet. This is the policy that will apply the day paid plans launch, published now so you know in advance.',
  sections: [
    {
      heading: '1. Cancel any time',
      paragraphs: ['You will be able to cancel a paid plan online in Settings in a couple of taps, with no calls or emails. After you cancel you keep paid features until the end of the period you already paid for, then the account returns to the free plan. Your quests, XP and rank are never lost by cancelling.'],
    },
    {
      heading: '2. Refunds',
      bullets: [
        'First purchase: if you are not happy, ask within 7 days of your first payment and we will refund it in full.',
        'Renewals: if you forgot to cancel and ask within 48 hours of a renewal charge, we will refund it.',
        'EU / UK consumers: you have a 14-day right to withdraw from a digital subscription; by asking for the service to start immediately you agree it starts straight away, and we will refund the unused part if you withdraw within 14 days.',
        'Technical faults: if a paid feature does not work as described and we cannot fix it, we will refund the affected period.',
      ],
    },
    {
      heading: '3. How refunds are paid',
      paragraphs: ['Back to the original payment method (card, UPI or wallet) through our payment provider. Banks usually take 5 to 10 working days to show it. Taxes (GST/VAT) paid on a refunded charge are refunded with it.'],
    },
    {
      heading: '4. What is never refundable or sold',
      paragraphs: ['XP, ranks, streaks and leaderboard positions can never be bought, so there is nothing to refund there. Accounts closed for cheating or abuse are not refunded.'],
    },
    {
      heading: '5. Contact',
      paragraphs: [`Write to ${LEGAL.email} with your username and the payment reference. Operator: ${LEGAL.operator}.`],
    },
  ],
};

export const LEGAL_DOCS: Record<LegalKind, LegalDoc> = { terms: TERMS, privacy: PRIVACY, refund: REFUND };
