// English is the source of truth. Every other language is typed against this
// object (see messages/index.ts), so a missing key is a compile error, and a
// test checks that placeholders ({name}) and plural forms match.
//
// Conventions: keys are `area.thing`. Plurals use `_one` / `_other` suffixes
// (extra CLDR forms like `_few` are allowed per language) and the `count`
// variable. Variables are written {name}.

export const en = {
  // Shared
  'common.appName': 'HUNTER SYSTEM',
  'common.language': 'Language',
  'common.logout': 'Log out',
  'common.loading': 'Loading…',
  'common.back': '← Back to login',

  // Navigation
  'nav.dashboard': 'Dashboard',
  'nav.quests': 'Quests',
  'nav.stats': 'Stats',
  'nav.rank': 'Rank',
  'nav.progress': 'Progress',
  'nav.timetable': 'Timetable',
  'nav.inventory': 'Inventory',
  'nav.achievements': 'Achievements',
  'nav.weekly': 'Weekly Report',
  'nav.modules': 'Modules',
  'nav.settings': 'Settings',
  'nav.admin': 'Admin',
  'nav.paused': '{name} (paused)',

  // Login / sign-up
  'auth.eyebrow': 'THE SYSTEM HAS CHOSEN YOU',
  'auth.headline.before': 'Level up your',
  'auth.headline.accent': 'real life',
  'auth.pitch': 'Hunter turns your day into quests. Earn XP for the habits you keep, rank up from E to S, and see who\'s grinding hardest this week.',
  'auth.feature.timetable.title': 'Your timetable becomes your quest log',
  'auth.feature.timetable.body': 'Describe your day — Hunter builds the schedule, every slot earns XP.',
  'auth.feature.modules.title': 'Modules for everything you care about',
  'auth.feature.modules.body': 'Fitness, skincare, reading, content creation — or build your own with AI.',
  'auth.feature.stakes.title': 'Real consequences, real progress',
  'auth.feature.stakes.body': 'Streaks, penalties for skipped days, and a 2-day rule that keeps you honest.',
  'auth.feature.ranks.title': 'Ranks, leaderboard & shareable cards',
  'auth.feature.ranks.body': 'Climb the weekly board and flex your Hunter card with friends.',
  'auth.subtitle.login': 'ENTER THE DUNGEON',
  'auth.subtitle.register': 'JOIN THE HUNTERS',
  'auth.subtitle.recover': 'RECOVER YOUR ACCOUNT',
  'auth.invited': '⚔️ {name} invited you — you\'ll race each other on weekly XP.',
  'auth.tab.login': 'LOGIN',
  'auth.tab.register': 'REGISTER',
  'auth.username': 'Username',
  'auth.username.placeholder': 'Enter your username',
  'auth.password': 'Password',
  'auth.password.new': 'New password',
  'auth.password.placeholder': 'Enter your password',
  'auth.recoveryCode': 'Recovery code',
  'auth.birthMonth': 'Month and year you were born',
  'auth.birthMonth.hint': 'Only used for age rules. We never store the day.',
  'auth.under13': 'Hunter System is for people aged 13 and over.',
  'auth.minorNotice': 'Under 18? A parent or guardian has to approve your account. We\'ll email them — nothing is active until they agree.',
  'auth.parentEmail': 'Parent or guardian\'s email',
  'auth.agree.before': 'I agree to the',
  'auth.agree.terms': 'Terms',
  'auth.agree.middle': 'and have read the',
  'auth.agree.privacy': 'Privacy Policy',
  'auth.submit.login': 'ENTER SYSTEM',
  'auth.submit.register': 'CREATE ACCOUNT',
  'auth.submit.recover': 'RESET PASSWORD',
  'auth.processing': 'PROCESSING...',
  'auth.forgot': 'Forgot password? Use your recovery code',
  'auth.failed': 'Authentication failed',
  'auth.footer': 'Hunter System · free to play',

  // Legal footer
  'legal.terms': 'Terms',
  'legal.privacy': 'Privacy',
  'legal.refunds': 'Refunds',

  // Age gate / parental consent (child side)
  'consent.pending.title': 'WAITING FOR A PARENT OR GUARDIAN',
  'consent.pending.body': 'Because you are under 18, a parent or guardian has to approve your account. We emailed {email} a link. Once they approve, you are in — nothing is active before that.',
  'consent.pending.bodyNoEmail': 'Because you are under 18, a parent or guardian has to approve your account. We emailed them a link. Once they approve, you are in — nothing is active before that.',
  'consent.pending.expiry': 'No reply in 14 days and the request is cancelled and your account deleted. Check their spam folder, or send it again, even to a different address:',
  'consent.pending.emailLabel': 'Parent\'s email (leave empty to reuse)',
  'consent.pending.send': 'SEND AGAIN',
  'consent.pending.sending': 'SENDING…',
  'consent.pending.sent': 'We emailed {email} again.',
  'consent.pending.failed': 'We could not send the email right now. Please try again later.',
  'consent.age.title': 'ONE QUICK QUESTION',
  'consent.age.body': 'We now ask everyone their age so we can protect younger hunters. We only keep the month and year.',
  'consent.age.blocked': 'Hunter System is for people aged 13 and over. If you continue, your account will be deleted.',
  'consent.age.minor': 'You are under 18, so a parent or guardian must approve your account. Enter their email and we will ask them.',
  'consent.age.continue': 'CONTINUE',
  'consent.age.delete': 'DELETE MY ACCOUNT',
  'consent.age.wait': 'PLEASE WAIT…',

  // Parent page
  'parent.title': 'Parental consent',
  'parent.invalid': 'This link is not valid, has expired, or has already been used. If your child still wants to join, they can sign in and send a fresh request.',
  'parent.intro.before': 'Someone using the name',
  'parent.intro.middle': 'says they are your child and asked to use',
  'parent.intro.after': ', a productivity app that turns a daily timetable into quests, XP and ranks. They are under 18, so we need your decision.',
  'parent.collect.title': 'What we collect about them',
  'parent.collect.1': 'Username, Hunter name, birth month (not the day), and this email address.',
  'parent.collect.2': 'What they create in the app: timetable, tasks, completions and XP.',
  'parent.collect.3': 'Text they type into AI features is sent to our AI providers to produce a suggestion.',
  'parent.never.title': 'What we do not do',
  'parent.never.1': 'No advertising, no selling of data, no ad tracking.',
  'parent.never.2': 'Their public profile and leaderboard entry show only a chosen nickname, level, rank and streak, and can be turned off.',
  'parent.change': 'You can change your mind later with this same link: withdrawing consent deletes the account and its data.',
  'parent.alreadyApproved': 'You have already approved this account.',
  'parent.approve': 'I APPROVE',
  'parent.decline': 'DECLINE & DELETE',
  'parent.withdraw': 'WITHDRAW CONSENT & DELETE',
  'parent.confirmDelete': 'This permanently deletes the account and everything in it. Continue?',
  'parent.granted': 'Thank you — your child can now use Hunter System. You can return to this link any time to withdraw consent.',
  'parent.deleted': 'Done. The account and all of its data have been deleted.',

  // Settings
  'settings.title': 'SETTINGS',
  'settings.subtitle': 'Personalize your hunter system',
  'settings.language.title': 'Language',
  'settings.language.hint': 'Changes the app language on this device. Dates, numbers and the first day of the week follow it.',
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
