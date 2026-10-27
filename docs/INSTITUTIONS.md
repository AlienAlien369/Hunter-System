# Institutions (B2B), individuals (B2C) and the platform settings

The same app serves two kinds of customer:

| | Individuals (B2C) | Members of an institution (B2B) |
|---|---|---|
| Who | Anyone who signs up on their own | Students and staff of a school, college or coaching institute |
| Tasks | Their own timetable and modules | The institution's **core timetable** *plus* their own timetable and modules |
| XP and levels | One ledger: personal XP (`users.xp`) | Two ledgers: **institution XP** (`org_members.xp`) and **personal XP** (`users.xp`) |
| Price (India default) | ₹600 a year for Pro | ₹600 per student seat a year (each seat includes Pro) |

## The two XP ledgers

Institution work and personal work never mix:

- Core tasks live in `org_tasks`; their completions in `org_task_completions`; the XP they earn is added to `org_members.xp`. Nothing here touches `users.xp`, `quest_completions` or personal streaks.
- Personal tasks keep using `quests` / `quest_completions` / `users.xp` exactly as before.
- Activity-log rows for core tasks store `orgXp`, never `xp`, so every existing personal XP history query is unaffected.
- XP for a core task is always derived from its difficulty (`taskXp`), so staff cannot inflate the ledger.
- Leaving an institution keeps personal XP; institution XP stays with the institution.

## Roles

A user belongs to at most one institution.

| Role | Can |
|---|---|
| `admin` | Everything below, plus settings, report emails, roles, seats and billing, closing the institution |
| `teacher` | Manage the core timetable, see member progress, remove students, add guardian emails |
| `student` | See and complete today's core tasks; sees their own two levels |

Students join with the **student code**, staff with the **staff code** (admins only see the staff code). Before joining, the join screen states exactly what staff will see (name, institution level/XP, core tasks done, active days, last active) and never see (personal tasks, personal XP, modules, notes). Staff accounts are for adults.

Invite link for students: `https://<your-domain>/login?org=<STUDENT_CODE>` — new users register and land on the join screen with the code filled in.

## Seats and billing

A new institution starts a free trial (`orgTrialDays` days, `orgTrialSeats` students — both set by the super admin). Afterwards, seats come from:

- **Seat subscriptions** — admins buy seats per year in *Institution → Seats & billing* (plan `teams` through the existing Razorpay/Stripe adapters; the webhook records `org_id` and `seats` on the subscription), or
- **Manual grants** — the super admin sets seats and an end date in */admin → Institutions* (offline invoices, pilots, discounts).

Students only join while a seat is free; staff never use a seat. Members of an institution with an active plan get Pro.

## Weekly email reports

Every Sunday from 6 pm in the hunter's timezone (fallback `Asia/Kolkata`) each active recipient gets the part of the report its **scope** allows:

- `org` — institution progress only (guardian emails added by staff are always this scope, and the student cannot widen or remove them)
- `personal` — the hunter's own progress only
- `both` — both, in clearly separate sections (individuals only have the personal part)

Hunters manage their own recipients (parents, teachers, family, friends — up to 10) on the Weekly Report page, preview the email and can send it immediately. Institution admins choose the emails that receive the whole-institution summary. Every email carries a one-click unsubscribe link (signed per recipient, RFC 8058 headers). Sending needs `RESEND_API_KEY` and `MAIL_FROM`; without them the app says so and nothing is sent.

## Platform settings (super admin)

Super admins are the usernames in `ADMIN_USERNAMES`. In */admin → Platform settings* they change, without a deploy:

- the **website name** and tagline (used by every page, the sidebar, the browser title, emails, checkout product names and the AI coach),
- the support email shown to institutions that want an invoice,
- the rupee prices: individual per year / per month, institution per student per year,
- the institution trial length and seats.

The settings are stored in `app_settings` (`platform.settings`) and served to everyone at `GET /api/public/config`. Crawlers that never run JavaScript see the build-time name; set `VITE_APP_NAME` when building after a rename so link previews match.

## API summary

| Method | Path | Who |
|---|---|---|
| GET | `/api/orgs/me` | member: institution, progress, today's core tasks |
| POST | `/api/orgs` | adult: set up an institution |
| GET | `/api/orgs/lookup?code=` | anyone signed in |
| POST | `/api/orgs/join` | anyone signed in |
| DELETE | `/api/orgs/membership` | member: leave |
| GET/POST/PATCH/DELETE | `/api/orgs/tasks[/:id]` | staff (GET: every member) |
| POST | `/api/orgs/tasks/:id/toggle` | member: complete/undo today |
| GET | `/api/orgs/members` | staff |
| PATCH/DELETE | `/api/orgs/members/:userId` | admin / staff |
| GET/POST/DELETE | `/api/orgs/members/:userId/guardians[/:id]` | staff |
| PATCH | `/api/orgs/settings`, POST `/api/orgs/rotate-codes`, DELETE `/api/orgs` | admin |
| GET | `/api/orgs/billing`, POST `/api/orgs/checkout` | admin |
| GET/POST/PATCH/DELETE | `/api/reports/recipients[/:id]` | the hunter |
| GET | `/api/reports/weekly?scope=`, POST `/api/reports/weekly/send` | the hunter |
| GET | `/api/reports/org/weekly`, POST `/api/reports/org/weekly/send` | staff / admin |
| GET/POST | `/api/public/report-unsubscribe?token=` | email link |
| GET | `/api/public/config` | public |
| GET/PUT | `/api/admin/settings`, GET `/api/admin/orgs`, PATCH `/api/admin/orgs/:id` | super admin |
