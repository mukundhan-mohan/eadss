# EADSS Deployment Runbook (GitHub + AWS + eadss.com)

This runbook uses a fast first-production path:
- Code in GitHub
- One AWS EC2 instance running Docker Compose
- Domain on GoDaddy pointing to EC2 Elastic IP
- TLS via Nginx + Let's Encrypt

## 1) Push to GitHub

From project root (`/Users/mukundhanmohan/Desktop/EADSS/eadss`):

```bash
git status
git remote -v
```

If no remote exists, create a GitHub repo named `eadss` and run:

```bash
git remote add origin git@github.com:<YOUR_GITHUB_USERNAME>/eadss.git
git push -u origin main
```

If you prefer HTTPS:

```bash
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/eadss.git
git push -u origin main
```

## 2) AWS EC2 Setup

1. Create Ubuntu 22.04 EC2 (`t3.large` recommended).
2. Create and attach an Elastic IP.
3. Security Group inbound:
   - 22 (SSH) from your IP
   - 80 (HTTP) from all
   - 443 (HTTPS) from all

SSH in:

```bash
ssh -i <your-key>.pem ubuntu@<EC2_PUBLIC_IP>
```

Install Docker + Compose plugin:

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

Clone and configure:

```bash
git clone https://github.com/<YOUR_GITHUB_USERNAME>/eadss.git
cd eadss
cp .env.example .env
```

Edit `.env` for production values:
- `POSTGRES_PASSWORD`
- `ADMIN_JWT_SECRET`
- `NEXT_PUBLIC_API_BASE_URL=https://api.eadss.com` (or `https://eadss.com` if same host reverse-proxy)
- any API keys/secrets required by your inference pipeline

Start stack:

```bash
docker compose up -d --build
```

## 3) Domain Setup (GoDaddy)

In GoDaddy DNS:
- `A` record: `@` -> `<ELASTIC_IP>`
- `A` record: `www` -> `<ELASTIC_IP>`
- Optional API split:
  - `A` record: `api` -> `<ELASTIC_IP>`

Wait for DNS propagation.

## 4) HTTPS + Reverse Proxy

Use Nginx (host-level) to route:
- `eadss.com` -> frontend container
- `api.eadss.com` -> backend container

Then issue certs with certbot:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
# add nginx server blocks first
sudo certbot --nginx -d eadss.com -d www.eadss.com -d api.eadss.com
```

## 5) Health Checks

- Frontend: `https://eadss.com`
- API docs: `https://api.eadss.com/docs`
- App API docs page: `https://eadss.com/api-docs`

## 6) Updates

```bash
cd ~/eadss
git pull
docker compose up -d --build
```

---

## Recommended next hardening (after first deploy)
- Move Postgres to RDS
- Move Redis to ElastiCache
- Add CloudWatch + alarms
- Use AWS WAF and backups
