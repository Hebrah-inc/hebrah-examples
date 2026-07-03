# Athena model agent demo

BYOM agent workflow using `@hebrah/sdk` `HebrahAgentHarness`:

1. List base EHR models (Epic, Cerner, Athena)
2. Read connection developer doc via MCP
3. Ingest Athena docs → generate custom model draft (integration agent)
4. Validate synthetic EHR profile

## Run

```bash
cd hebrah-examples/athena-model-agent-demo
npm install @hebrah/sdk

# Terminal 1: integration agent
cd ../../hebrah-integration-agent && uvicorn api.main:app --port 3050

# Terminal 2: demo
export HEBRAH_MCP_URL=http://localhost:3021/mcp
export HEBRAH_PAT=hb_pat_...
export CONNECTION_ID=conn-your-sandbox-id
node index.mjs
```

Port **3009** (reserved in architecture docs for future UI wrapper).
