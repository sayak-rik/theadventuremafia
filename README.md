# The Adventure Mafia — Untouched West Sikkim Expedition

A premium one-product microsite for a 7-day guided motorcycle tour through West &
North Sikkim. Built with **Next.js 15 (App Router) + TypeScript**, **Tailwind CSS v4**,
**Framer Motion**, **PostgreSQL**, and an **SMTP email manager** — all running as
Docker containers.

## Stack at a glance

| Concern        | Choice                                                        |
| -------------- | ------------------------------------------------------------- |
| Framework      | Next.js 15, React 19, TypeScript                              |
| Styling        | Tailwind v4 (navy + adventure-green core, gold luxe accents)  |
| Animation      | Framer Motion (`motion`) — scroll reveals, route line-draw    |
| Database       | PostgreSQL 16 (Docker), accessed via `pg`                     |
| Email          | Nodemailer + SMTP; MailHog container for local testing        |
| DB admin       | Adminer container                                             |

## Quick start (Docker — recommended)

```bash
cp .env.example .env        # already provided with working dev defaults
docker compose up --build
```

Then open:

- **Site** → http://localhost:3000
- **MailHog inbox** (all outgoing email) → http://localhost:8025
- **Adminer** (DB admin) → http://localhost:8080 · server `db`, user/pass from `.env`

The Postgres container auto-loads `db/init/01-schema.sql` and `db/init/02-seed.sql`
on first boot (bike models, Sunday departures for the season, testimonials).

### Hot-reload development

```bash
docker compose -f docker-compose.dev.yml up --build
```

Source is bind-mounted; edits reload instantly.

## Running the app outside Docker

```bash
npm install
# point DATABASE_URL at a reachable Postgres (or leave unset to use seed
# fallbacks), then:
npm run dev
```

If `DATABASE_URL` is unset/unreachable the site still renders using seed data,
and form submissions are accepted but not persisted — handy for UI work.

## Key paths

```
src/app/            routes: / itinerary pricing booking testimonials contact terms privacy
src/app/api/        /api/bookings, /api/contact  (validate → persist → email)
src/components/     Hero, Navbar, Footer, RouteMap, BookingForm, SundayCalendar, ContactForm
src/lib/db.ts       pg pool with graceful fallback
src/lib/data.ts     DB getters + seed fallbacks
src/lib/pricing.ts  fare logic (single = double + ₹10k; −₹2k per engine step)
src/lib/dates.ts    Sunday / Sep–May departure rules
src/lib/email/      SMTP manager + branded HTML templates (booking + contact)
db/init/            schema + seed SQL
```

## Email flows

- **Booking** → team notification + customer confirmation (branded HTML).
- **Contact** → team notification + sender acknowledgement (branded HTML).

Sending failures never break a booking/enquiry — they're logged and swallowed.
For production, set `SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM`, `TEAM_EMAIL` to a
real provider (Resend / SES / Postmark SMTP).

## Branding / logo

`public/logo.svg` is a placeholder in the brand colours. See
[`public/ASSETS.md`](public/ASSETS.md) to drop in the real motorcycle-badge logo.

## Pricing logic

Loaded live from the `bike_models` table. Rule (also encoded in the seed data so
admins can override any cell): single = double **+ ₹10,000**; each step down in
engine size **− ₹2,000** per rider. Flagship Himalayan 450 → ₹45,000 double /
₹55,000 single.
