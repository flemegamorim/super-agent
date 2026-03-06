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

## Usage

1. Open the dashboard at http://localhost:3000
2. Click **New Task** to upload files and provide instructions
3. Monitor task progress in real-time on the task detail page
4. Download generated output files when complete
5. Cancel running tasks or re-run completed/failed ones
