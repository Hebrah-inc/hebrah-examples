#!/usr/bin/env node
/**
 * athena-model-agent-demo — BYOM agent loop using HebrahAgentHarness.
 *
 * Usage:
 *   HEBRAH_MCP_URL=http://localhost:3021/mcp \
 *   HEBRAH_PAT=hb_pat_... \
 *   CONNECTION_ID=conn-... \
 *   node index.mjs
 */

import { HebrahAgentHarness } from '@hebrah/sdk'

const mcpUrl = process.env.HEBRAH_MCP_URL ?? 'http://localhost:3021/mcp'
const pat = process.env.HEBRAH_PAT
const connectionId = process.env.CONNECTION_ID

if (!pat) {
  console.error('Set HEBRAH_PAT to a dashboard machine token')
  process.exit(1)
}

const harness = new HebrahAgentHarness({
  mcpUrl,
  pat,
  integrationAgentUrl: process.env.INTEGRATION_AGENT_URL ?? 'http://localhost:3050',
  llm: {
    provider: 'openai',
    model: process.env.LLM_MODEL ?? 'gpt-4.1'
  }
})

async function main() {
  console.log('Listing base EHR models…')
  const models = await harness.listBaseEhrModels()
  console.log(models)

  if (connectionId) {
    console.log('\nSynthetic EHR profile:')
    console.log(await harness.getSyntheticEhrProfile(connectionId))

    console.log('\nDeveloper doc (first 500 chars):')
    const doc = await harness.getDeveloperDoc(connectionId)
    const md = typeof doc === 'object' && doc && 'markdown' in doc ? String(doc.markdown) : JSON.stringify(doc)
    console.log(md.slice(0, 500))

    console.log('\nResearch + model Athena (integration agent):')
    const draft = await harness.researchAndModelEhr({
      vendor: 'Athena',
      connectionId,
      docUrls: ['https://docs.athenahealth.com/api/fhir']
    })
    console.log(draft)

    console.log('\nValidate sandbox:')
    console.log(await harness.validateSandbox(connectionId))
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
