# Super Agent Node

Agent task flow application powered by OpenCode. Upload files (PDF, XLSX, images), run AI-driven analysis pipelines, and download generated output.

## Architecture

- **OpenCode Server** (port 4096) — AI agent engine with custom subagents (ingest, analyze, generate) and file processing tools
- **Next.js Dashboard** (port 3000) — Web UI for uploading files, monitoring tasks, and managing agent activity

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [OpenCode](https://opencode.ai/) CLI installed (`winget install SST.opencode`)
- An LLM provider API key (e.g., `ANTHROPIC_API_KEY`)

## Quick Start

```bash
# Install dependencies
npm install
npm install --prefix web

# Set your API key
set ANTHROPIC_API_KEY=your-key-here

# Start both servers
npm run dev
```

Then open http://localhost:3000.

## Project Structure

```
opencode.json              # OpenCode configuration
.opencode/
  agents/                  # Custom agent definitions
    ingest.md              # File ingestion subagent
    analyze.md             # Data analysis subagent
    generate.md            # Output generation subagent
  tools/                   # Custom tool definitions (TypeScript)
  scripts/                 # Processing scripts (Node.js)
  package.json             # Tool dependencies
web/                       # Next.js dashboard
  src/
    app/                   # Pages (dashboard, new task, task detail, agents)
    lib/                   # Backend (db, opencode client, file helpers)
    components/            # Shared UI components
input/                     # Uploaded input files (per-task subdirectories)
output/                    # Generated output files (per-task subdirectories)
```

## Docker

### Local (HTTP only)

For local development with Docker, the base `docker-compose.yml` is all you need. It runs Nginx on port 80 with plain HTTP via `nginx.local.conf`.

```bash
docker compose up -d --build
```

Then open http://localhost.

### Production Deployment (EC2 with HTTPS)

`docker-compose.prod.yml` is a Compose **override file** — it layers production-specific configuration on top of the base `docker-compose.yml`:

| Base (`docker-compose.yml`) | Prod override (`docker-compose.prod.yml`) |
|---|---|
| Nginx on port **80** only | Adds port **443** for HTTPS |
| Uses `nginx.local.conf` (plain HTTP proxy) | Swaps to `nginx.conf` (HTTP→HTTPS redirect + SSL termination) |
| No SSL | Mounts **certbot** volumes for Let's Encrypt certs |
| — | Adds a **certbot** service for certificate management |

You must pass both files explicitly to every `docker compose` command:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml <command>
```

#### Prerequisites

- Docker & Docker Compose on the host
- A domain pointing to the instance (Route 53 A record → Elastic IP)
- Ports 80 and 443 open in the EC2 security group

#### 1. Configure environment

```bash
cp .env.example .env
# Fill in AUTH_SECRET, ANTHROPIC_API_KEY, and:
#   DOMAIN=superagent.yourdomain.com
#   NEXTAUTH_URL=https://superagent.yourdomain.com
```

#### 2. Obtain SSL certificate (first time only)

```bash
chmod +x init-ssl.sh
./init-ssl.sh superagent.yourdomain.com you@example.com
```

This spins up a temporary Nginx to complete the Let's Encrypt ACME challenge, stores the certificate in a Docker volume, then starts the full stack with HTTPS.

#### 3. Start / restart the stack

Always stop the previous stack before rebuilding to avoid stale network references:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml down --remove-orphans
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

#### 4. Auto-renew certificates

Add a cron job on the host to renew certificates daily:

```bash
crontab -e
# Add:
0 3 * * * cd /home/ec2-user/super-agent && docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm certbot renew --quiet && docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx nginx -s reload
```

#### Useful commands

```bash
# Status and logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f nginx

# Stop everything
docker compose -f docker-compose.yml -f docker-compose.prod.yml down

# Rebuild without cache (use when Docker layers are stale)
docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

#### Troubleshooting

**`network <hash> not found`** — Stale network from a previous run. Clean up and rebuild:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml down --remove-orphans
docker network prune -f
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

**`no space left on device`** — Docker build cache filled the disk. Free space and rebuild:

```bash
docker system prune -af
docker builder prune -af
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

**Verify container health from EC2:**

```bash
docker exec super-agent curl -s http://127.0.0.1:4096/health    # OpenCode server
docker exec super-agent curl -s http://localhost:3000/api/tasks  # Next.js API
docker logs super-agent 2>&1 | head -30                          # Startup logs
```

## Usage

1. Open the dashboard at https://superagent.yourdomain.com
2. Click **New Task** to upload files and provide instructions
3. Monitor task progress in real-time on the task detail page
4. Download generated output files when complete
5. Cancel running tasks or re-run completed/failed ones
