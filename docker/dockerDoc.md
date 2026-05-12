# Docker Reference

## Service architecture

| Service | Container | Port | Dockerfile | Purpose |
|---|---|---|---|---|
| `cpi-mcp` | `cpi-mcp-server` | 3001 | `Dockerfile.cpi` | SAP CPI integration tool server |
| `scheduler-mcp` | `scheduler-mcp-server` | 3002 | `Dockerfile.scheduler` | Job scheduling tool server |
| `excel-mcp` | `excel-mcp-server` | 3003 | `Dockerfile.excel` | Excel parsing tool server |
| `backend` | `cpi-agent-backend` | 3000 | `Dockerfile.backend` | Node.js API + MCP host |
| `frontend` | `cpi-agent-frontend` | 80 | `Dockerfile.frontend` | React app via nginx |

Startup order enforced by `depends_on` + `service_healthy`:
```
cpi-mcp → scheduler-mcp ┐
cpi-mcp → excel-mcp     ├─→ backend → frontend
```

---

## Prerequisites

- Docker Desktop (Windows / Mac) or Docker Engine 20.10+ (Linux)
- All `.env` files created from their `.env.example` counterparts (see below)
- `backend/tmp/` directory created on the host (see tmp checklist)

---

## Quick start

```bash
# from the docker/ directory
docker compose up --build

# detached
docker compose up --build -d

# tail logs
docker compose logs -f

# stop and remove containers
docker compose down

# stop and also remove volumes
docker compose down -v
```

---

## Environment setup

Each service loads a `.env` file. Create them from the examples before first run:

```bash
cp backend/.env.example          backend/.env
cp mcp-servers/cpi/.env.example  mcp-servers/cpi/.env
cp mcp-servers/scheduler/.env.example  mcp-servers/scheduler/.env
cp mcp-servers/excel/.env.example      mcp-servers/excel/.env
```

### backend/.env — key variables

| Variable | Local default | Docker override (set in compose) |
|---|---|---|
| `CPI_MCP_URL` | `http://localhost:3001/mcp` | `http://cpi-mcp:3001/mcp` |
| `SCHEDULER_MCP_URL` | `http://localhost:3002/mcp` | `http://scheduler-mcp:3002/mcp` |
| `EXCEL_MCP_URL` | `http://localhost:3003/mcp` | `http://excel-mcp:3003/mcp` |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | `http://host.docker.internal:11434` |

The `environment:` block in `docker-compose.yml` overrides the `.env` values at runtime.
You do not need to edit `backend/.env` for Docker — only fill in secrets (API keys, CPI credentials).

### mcp-servers/cpi/.env — required secrets

```
CPI_BASE_URL=https://your-tenant.hana.ondemand.com
CPI_CLIENT_ID=your-client-id
CPI_CLIENT_SECRET=your-client-secret
CPI_TOKEN_URL=https://your-tenant.authentication.hana.ondemand.com/oauth/token
USE_MOCK=false
```

Leave `USE_MOCK=true` to run without real CPI credentials.

### mcp-servers/scheduler/.env

```
PORT=3002
CPI_MCP_URL=http://localhost:3001   # overridden to http://cpi-mcp:3001 in Docker
```

### mcp-servers/excel/.env

```
PORT=3003
USE_MOCK=true
```

---

## Volume mounts

### backend volumes

| Host path | Container path | Purpose |
|---|---|---|
| `backend/logs` | `/app/logs` | Persistent log files |
| `backend/src/config/loggingConfig.js` | `/app/src/config/loggingConfig.js` | Live config override without rebuild |
| `backend/tmp` | `/app/tmp` | Excel report files written by `generateReport()` |

### scheduler-mcp — job persistence (optional)

The scheduler writes `jobsConfig.json` and `executionHistory.json` to `/app/src/config/` inside the container.
These are **not** mounted by default, so scheduled jobs are lost on container restart.

To persist them, add to the `scheduler-mcp` service in `docker-compose.yml`:

```yaml
volumes:
  - ../mcp-servers/scheduler/src/config/jobsConfig.json:/app/src/config/jobsConfig.json
  - ../mcp-servers/scheduler/src/config/executionHistory.json:/app/src/config/executionHistory.json
```

The host files must exist before starting (Docker will create a directory instead of a file if they don't):

```bash
touch mcp-servers/scheduler/src/config/jobsConfig.json
echo '{"jobs":[]}' > mcp-servers/scheduler/src/config/jobsConfig.json
echo '[]' > mcp-servers/scheduler/src/config/executionHistory.json
```

---

## tmp directory — report files checklist

`generateReport()` in `backend/src/utils/reportGenerator.js` writes Excel report files to
`/app/tmp` inside the `backend` container. The volume mount `../backend/tmp:/app/tmp` maps
this to `backend/tmp/` on the host so reports survive restarts and are downloadable.

Work through this checklist before starting the stack:

- [x] **Host directory is created automatically**
  Docker Compose creates `backend/tmp/` on the host the first time `docker compose up` runs,
  because it sees a bind mount pointing there. No manual `mkdir` needed.

- [ ] **Verify the mount line exists in docker-compose.yml**
  Under `backend.volumes`, confirm this line is present:
  ```yaml
  - ../backend/tmp:/app/tmp
  ```

- [ ] **Check write permission** (Linux / WSL only)
  The Node process inside the container runs as the default `node` user (UID 1000).
  If the host directory is owned by root, writes will fail:
  ```bash
  ls -la backend/tmp          # should show your user as owner
  chmod 755 backend/tmp       # fix if needed
  ```

- [ ] **Confirm reports appear on the host after an upload**
  After uploading an Excel file through the UI, check:
  ```bash
  ls backend/tmp/             # should show report_<timestamp>.xlsx
  ```

- [ ] **Set the retention period** (`REPORT_RETENTION_DAYS` in `backend/.env`)
  Default is 7. Old files are not auto-deleted yet — this variable is reserved for
  a future cleanup job. For now, clear `backend/tmp/` manually when needed.

- [ ] **Add `backend/tmp` to `.gitignore`** (if not already)
  Report files should never be committed:
  ```
  backend/tmp/
  ```

---

## Docker networking

All services share the default bridge network created by Compose. Service names act as
hostnames inside that network — `http://cpi-mcp:3001` resolves to the `cpi-mcp` container.

### host.docker.internal

Used to reach services running on the host machine (e.g. Ollama):

| Platform | Status |
|---|---|
| Docker Desktop (Mac / Windows) | Works automatically |
| Docker Engine on Linux | Requires `extra_hosts: ["host.docker.internal:host-gateway"]` — already set on `backend` |

### Ports exposed to the host

Only the ports listed in `docker-compose.yml` are reachable from your browser:

| URL | Reaches |
|---|---|
| `http://localhost` | frontend (nginx) |
| `http://localhost/api/...` | backend via nginx proxy |
| `http://localhost:3000` | backend directly (useful for debugging) |
| `http://localhost:3001` | cpi-mcp directly |
| `http://localhost:3002` | scheduler-mcp directly |
| `http://localhost:3003` | excel-mcp directly |

---

## Adding a new MCP server

1. Create `mcp-servers/<name>/` with the same structure as an existing server.
2. Add `docker/Dockerfile.<name>` following the same pattern as `Dockerfile.cpi`.
3. Add a service block to `docker-compose.yml` (copy the `excel-mcp` block, update name/port).
4. Add the URL override to the `backend` service `environment:` block:
   ```yaml
   - <NAME>_MCP_URL=http://<name>-mcp:<port>/mcp
   ```
5. Register the server in `backend/src/config/mcpConfig.js`.
6. Restart the stack: `docker compose up --build -d`.

---

## Useful commands

```bash
# rebuild a single service without restarting others
docker compose up --build -d cpi-mcp

# open a shell inside a running container
docker compose exec backend sh

# inspect health status of all services
docker compose ps

# view logs for one service
docker compose logs -f backend

# force remove everything including images
docker compose down --rmi all -v

# check how much space images are using
docker system df
```

---

## Build context note

All Dockerfiles use `context: ..` (the project root). This means Docker sends the **entire
project tree** to the build daemon on every build, even if only one service changed.
To speed up builds, add a `.dockerignore` at the project root:

```
**/node_modules
**/.env
**/*.log
backend/tmp
backend/logs
```