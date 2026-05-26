# CPI Agent (MVP)

> **Note:** This is a working MVP — built to validate the concept and demonstrate what's possible. It is not a production-ready product. The goal of this demo is to show the core idea in action and outline the direction for what comes next.

---

## What Is This?

Managing SAP Cloud Platform Integration (CPI) typically means logging into a web portal, navigating menus, clicking through forms, and repeating the same steps for every iFlow you need to check or update. It's slow, repetitive, and error-prone — especially when managing multiple integration flows across a tenant.

**CPI Agent** is an MVP that explores a different approach — a chat interface where you type what you want in plain English, and the system figures out what CPI operations to run, executes them, and returns the result.

> *"List all deployed artifacts"*
> *"What's the status of message ABC123?"*
> *"Update the endpoint parameter on MyIFlow and deploy it"*

No portal. No clicking. Just ask.

---

## The Problem

SAP CPI is powerful but operationally heavy. Day-to-day tasks like:

- Checking message processing status
- Updating iFlow configuration parameters before a deployment
- Deploying or undeploying artifacts
- Running the same parameter updates across multiple iFlows at once

...all require manual interaction with the CPI portal or raw API calls with OAuth tokens and CSRF handling. For teams managing large integration landscapes, this is a significant time drain with no easy way to automate or schedule operations without custom scripting.

---

## What We Built

CPI Agent is a full-stack AI-powered application that sits in front of the CPI API and lets you interact with it through natural language. It's an MVP — the focus was on proving the core loop works end to end, not on polish or scale.

### How It Works

```
You type a message
  → AI understands the intent
  → Calls the right CPI API operation
  → Returns the result in a readable format
```

Under the hood, the system uses a multi-agent architecture built on the **Model Context Protocol (MCP)** — an open standard for connecting AI models to external tools and services. The AI doesn't guess what to do — it has a defined set of tools it can call, and it picks the right one based on your request.

---

## What the MVP Can Do

### 1. Natural Language Chat Interface

> *[SCREENSHOT: Chat UI with a question and table response]*

Ask questions and give instructions the way you'd talk to a colleague. Responses containing lists or structured data are automatically formatted as tables.

This is the core of the MVP — the chat loop works reliably for the supported operations below.

---

### 2. Core CPI Operations

> *[SCREENSHOT: List of available tools in the admin panel]*

The following CPI operations are wired up and tested against a real CPI trial tenant:

| Operation | What It Does |
|---|---|
| Get Message Status | Check the processing status of a CPI message |
| Get Message Log | Retrieve detailed logs for a message |
| List Artifacts | Show all integration flows on the tenant |
| Get iFlow Configuration | View current parameter values for an iFlow |
| Update iFlow Configuration | Change a parameter value |
| Deploy Artifact | Deploy an iFlow to the runtime |
| Undeploy Artifact | Remove an iFlow from the runtime |
| Find Message by Application ID | Look up a message using your application's own ID |

All operations use **OAuth 2.0 Client Credentials** flow and handle CSRF tokens automatically.

---

### 3. Excel-Driven Bulk Operations

> *[SCREENSHOT: Excel file upload button in chat input]*

One of the more practical additions to the MVP — upload an Excel file in the chat to drive bulk parameter updates across multiple iFlows. The system reads the file, updates each iFlow's parameters in sequence, deploys the ones you've flagged, and generates a downloadable report.

**Excel format:**

| ArtifactId | ParameterKey | ParameterValue | Deploy |
|---|---|---|---|
| MyIFlow_v1 | endpoint | https://... | yes |
| MyIFlow_v1 | timeout | 30 | no |
| MyIFlow_v2 | endpoint | https://... | yes |

- Merged cells for `ArtifactId` are handled automatically
- `Deploy = yes` triggers deployment after all parameters for that iFlow are updated
- If any parameter update fails, deployment is skipped for that iFlow to avoid partial states

> *[SCREENSHOT: Batch results table rendered in chat after upload]*

A downloadable Excel report is generated at the end showing the outcome of every operation.

---

### 4. Scheduled Jobs

> *[SCREENSHOT: Jobs panel in sidebar]*

Schedule any CPI operation to run automatically via chat:

> *"Deploy MyIFlow every Monday at 9am UTC"*

The AI previews the job for your confirmation before creating it. Jobs run in the background and send real-time notifications when they complete.

> *[SCREENSHOT: Toast notification for completed job]*

This is an early-stage feature — the scheduling engine works, but job persistence across restarts and more advanced scheduling options are on the backlog.

---

### 5. Dynamic Tool Management

> *[SCREENSHOT: MCP Admin panel with tool list]*

New CPI operations can be added without touching application code. Each tool is defined in a JSON configuration file — add a new entry, reload, and it becomes available to the AI immediately.

This is built on the **Model Context Protocol (MCP)**. The application runs three MCP servers:

| Server | Purpose |
|---|---|
| CPI MCP Server | All CPI API operations |
| Scheduler MCP Server | Job scheduling and management |
| Excel MCP Server | Excel file parsing and report generation |

---

### 6. AI Provider Flexibility

> *[SCREENSHOT: Provider dropdown in settings]*

The AI engine is swappable via settings — no code changes needed. The MVP supports:

- **Groq** — free tier, fast, reliable tool calling (primary provider used in testing)
- **Claude** — Anthropic's models
- **OpenAI** — GPT models
- **Ollama** — run locally with no API key

---

### 7. Containerised Deployment

> *[SCREENSHOT: Docker containers running]*

The full stack runs in Docker. One command brings everything up:

```bash
docker compose up -d
```

| Service | Role |
|---|---|
| Frontend | React UI served via Nginx |
| Backend | Express API + AI orchestration |
| CPI MCP Server | CPI tool execution |
| Scheduler MCP Server | Job scheduling |
| Excel MCP Server | Excel processing |

---

## Known Limitations of the MVP

These are known gaps — not bugs, just scope boundaries for what was built:

- **No authentication** — anyone with the URL can access the tool
- **No conversation memory** — chat history resets on page refresh
- **Job persistence** — scheduled jobs are lost if the scheduler container restarts
- **Single tenant** — connected to one CPI tenant at a time via environment config
- **No streaming** — AI responses appear all at once, not token by token
- **Error messages** — some CPI API errors surface as generic messages rather than helpful guidance

---

## What's Next

These are the natural next steps if the concept is taken further:

| Feature | Why It Matters |
|---|---|
| **Authentication** | Required before this can be shared across a team safely |
| **Streaming Responses** | Better UX — see the AI thinking in real time |
| **Log Monitoring** | View agent and MCP server logs from the admin UI |
| **OpenAPI Auto-Generation** | Upload a Swagger/YAML spec → automatically generate a new MCP server with all operations pre-configured |
| **Conversation Memory** | Persistent chat history across sessions |
| **Admin Dashboard** | Per-agent analytics and execution metrics |
| **Multi-tenant Support** | Connect to multiple CPI tenants from one instance |

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, TailwindCSS |
| Backend | Node.js, Express |
| AI Orchestration | Multi-agent ReAct pattern via MCP |
| AI Providers | Groq, Claude, OpenAI, Ollama |
| CPI Authentication | OAuth 2.0 Client Credentials + CSRF |
| Scheduling | node-cron |
| Logging | Pino with daily rotation |
| Containers | Docker + Nginx |