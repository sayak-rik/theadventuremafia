# Deploying The Adventure Mafia — Free, on Oracle Cloud + Docker

This guide deploys the **entire Docker stack** (Next.js app + Postgres + Caddy
TLS) onto a single **Oracle Cloud "Always Free"** virtual machine, served over
HTTPS on your existing domain. It is **free forever** (within Oracle's Always
Free limits) and keeps your containerized setup unchanged in production.

**Time:** ~45–60 minutes the first time.
**You need:** an email address, a phone number + card for Oracle signup (not
charged on Always Free), and access to your domain's DNS.

What runs in production (from [`docker-compose.prod.yml`](docker-compose.prod.yml)):

| Container | Role                                   | Exposed to internet |
| --------- | -------------------------------------- | ------------------- |
| `caddy`   | TLS termination + reverse proxy        | Yes (80, 443)       |
| `app`     | Next.js production server (port 3000)  | No (internal only)  |
| `db`      | PostgreSQL 16 + auto schema/seed       | No (internal only)  |

> Production drops MailHog and Adminer. Email goes through a real SMTP provider;
> manage the DB over SSH when needed.

---

## Step 0 — Prerequisites checklist

- [ ] A domain you control (e.g. `theadventuremafia.in`) with access to its DNS.
- [ ] Your project in a Git repo (GitHub/GitLab) **or** ready to copy via `scp`.
- [ ] An SSH key pair on your laptop. Create one if needed:
  ```bash
  ssh-keygen -t ed25519 -C "adventuremafia-deploy"
  # press Enter for defaults; this creates ~/.ssh/id_ed25519(.pub)
  ```

---

## Step 1 — Create an Oracle Cloud account

1. Go to <https://www.oracle.com/cloud/free/> and click **Start for free**.
2. Sign up. You'll add a phone number and a card for identity verification —
   **Always Free resources are never charged**. Pick a **Home Region** close to
   your users (e.g. *India South (Hyderabad)* or *India West (Mumbai)*).
   > Note: your Home Region can't be changed later, and Always Free ARM capacity
   > is region-specific — if one region is full, retry or pick another nearby.

---

## Step 2 — Create the Always Free VM (compute instance)

1. In the Oracle Cloud Console: **☰ Menu → Compute → Instances → Create instance**.
2. **Name:** `adventuremafia`.
3. **Image and shape → Edit:**
   - **Image:** Canonical **Ubuntu 22.04** (or 24.04).
   - **Shape:** click *Change shape* → **Ampere (ARM)** → **VM.Standard.A1.Flex**.
     Set **1–2 OCPU** and **6–12 GB RAM** (Always Free allows up to 4 OCPU /
     24 GB total across A1 instances).
     > If ARM capacity is unavailable, you can instead use the Always Free
     > **VM.Standard.E2.1.Micro** (AMD, 1 OCPU / 1 GB) — it works but is tight;
     > ARM is strongly preferred.
4. **Networking:** keep the default VCN (it creates one). Ensure **Assign a
   public IPv4 address** is checked.
5. **Add SSH keys:** choose **Paste public keys** and paste the contents of
   `~/.ssh/id_ed25519.pub`.
6. Click **Create**. Wait until state is **Running**, then copy the
   **Public IP address** (e.g. `140.238.x.x`).

---

## Step 3 — Open the firewall (ports 80 & 443)

Oracle blocks inbound traffic by default in **two** places. Open both.

### 3a. Security List (cloud firewall)

1. On the instance page, click the **Virtual Cloud Network** link → **Security
   Lists** → the **Default Security List**.
2. **Add Ingress Rules** (Stateless: No, Source CIDR `0.0.0.0/0`):
   - TCP, **Destination Port 80**
   - TCP, **Destination Port 443**

   (Port 22/SSH is already open by default.)

### 3b. OS firewall (do this after Step 4 login)

Ubuntu on Oracle ships with strict `iptables`. After you SSH in (Step 4), run:
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

---

## Step 4 — Connect and prepare the server

From your laptop:
```bash
ssh ubuntu@YOUR_PUBLIC_IP
```

Update the OS and install Docker Engine + Compose plugin:
```bash
sudo apt update && sudo apt -y upgrade

# Install Docker (official convenience script)
curl -fsSL https://get.docker.com | sudo sh

# Run docker without sudo
sudo usermod -aG docker $USER
newgrp docker   # apply the group now (or log out/in)

# Verify
docker --version
docker compose version
```

Now run the OS-firewall commands from **Step 3b** if you haven't.

---

## Step 5 — Get the project onto the server

**Option A — Git (recommended):**
```bash
sudo apt -y install git
git clone https://github.com/<you>/theadventuremafia.git
cd theadventuremafia
```

**Option B — Copy from your laptop** (run on your laptop, not the server):
```bash
# exclude heavy/regenerated dirs
rsync -av --exclude node_modules --exclude .next --exclude .git \
  ./ ubuntu@YOUR_PUBLIC_IP:~/theadventuremafia/
```
Then back on the server: `cd ~/theadventuremafia`.

---

## Step 6 — Point your domain at the server (DNS)

In your domain registrar / DNS provider, create an **A record**:

| Type | Name              | Value (points to)   | TTL  |
| ---- | ----------------- | ------------------- | ---- |
| A    | `@` (root/apex)   | `YOUR_PUBLIC_IP`    | 300  |
| A    | `www` (optional)  | `YOUR_PUBLIC_IP`    | 300  |

Wait for it to propagate (usually minutes). Verify from your laptop:
```bash
dig +short theadventuremafia.in     # should print YOUR_PUBLIC_IP
```
> Caddy can only issue the HTTPS certificate **after** DNS resolves to the VM,
> so don't skip this before Step 8.

---

## Step 7 — Set up a free SMTP provider (email)

Pick one (both have free tiers and work with the app's nodemailer SMTP):

- **Brevo** — 300 emails/day free. <https://www.brevo.com>
  → Settings → **SMTP & API** → copy SMTP host `smtp-relay.brevo.com`, port `587`,
  login, and an SMTP key.
- **Resend** — 3,000/month free. <https://resend.com>
  → host `smtp.resend.com`, port `465` (set `SMTP_SECURE=true`), user `resend`,
  pass = your `re_...` API key.

**Verify your domain** in the provider (add the DKIM/SPF DNS records they show)
so booking/contact emails don't land in spam. Use a `MAIL_FROM` on your domain.

---

## Step 8 — Configure environment and launch

On the server, in `~/theadventuremafia`:
```bash
cp .env.prod.example .env.prod
nano .env.prod
```
Fill in:
- `DOMAIN` = your domain (e.g. `theadventuremafia.in`)
- `ACME_EMAIL` = your email (Let's Encrypt notices)
- `POSTGRES_PASSWORD` = a long random string
- the `SMTP_*`, `MAIL_FROM`, `TEAM_EMAIL` values from Step 7

Build and start the whole stack:
```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

First boot:
- Postgres loads `db/init/*.sql` (bike models, Sunday departures, testimonials).
- Caddy automatically obtains a Let's Encrypt TLS certificate for your domain.

Check it:
```bash
docker compose -f docker-compose.prod.yml ps          # all "running"/"healthy"
docker compose -f docker-compose.prod.yml logs -f caddy   # watch cert issuance
```

Open **https://your-domain** — you should see the site on HTTPS. 🎉
Submit a test booking and confirm the team + customer emails arrive.

---

## Step 9 — Day-2 operations

**Deploy an update** (after `git pull` or re-`rsync`):
```bash
cd ~/theadventuremafia
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

**View logs:**
```bash
docker compose -f docker-compose.prod.yml logs -f app
```

**Back up the database:**
```bash
docker compose -f docker-compose.prod.yml exec db \
  pg_dump -U adventure adventuremafia > backup_$(date +%F).sql
```

**Restore a backup:**
```bash
cat backup_2026-06-15.sql | docker compose -f docker-compose.prod.yml exec -T db \
  psql -U adventure -d adventuremafia
```

**Inspect bookings quickly:**
```bash
docker compose -f docker-compose.prod.yml exec db \
  psql -U adventure -d adventuremafia -c "SELECT id,name,email,trip_date FROM bookings ORDER BY created_at DESC LIMIT 20;"
```

**Stop / restart the stack:**
```bash
docker compose -f docker-compose.prod.yml down       # stop (keeps data volumes)
docker compose -f docker-compose.prod.yml up -d       # start again
```

**Auto-restart on reboot:** already handled — every service uses
`restart: always`, and Docker starts on boot. Optionally enable unattended
security updates:
```bash
sudo apt -y install unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Site unreachable, but containers run | Re-check **both** firewalls: Oracle Security List (Step 3a) **and** OS `iptables` (Step 3b). |
| Caddy can't get a certificate | Confirm `dig +short your-domain` returns the VM IP, and ports 80/443 are open. Watch `logs -f caddy`. |
| Emails not arriving | Check `logs -f app` for `[email]` lines; verify SMTP creds and that your domain's SPF/DKIM are set at the provider. |
| ARM shape "out of capacity" | Retry later, or temporarily use the AMD `E2.1.Micro` Always Free shape. |
| Postgres data reset unexpectedly | Don't run `down -v` — the `-v` flag deletes the `db_data` volume. |

---

## Cost summary

| Item | Cost |
| --- | --- |
| Oracle Always Free VM (ARM, up to 4 OCPU / 24 GB) | **Free forever** |
| Outbound data transfer (10 TB/mo free) | **Free** |
| TLS certificate (Let's Encrypt via Caddy) | **Free** |
| SMTP (Brevo 300/day or Resend 3k/mo) | **Free tier** |
| Domain | Your existing domain (already owned) |

Total recurring cost: **₹0** beyond the domain you already have.
