import Link from 'next/link'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getEnvStatus } from '@/lib/env'
import { mcpGetAccountStatus } from '@/lib/mcp-client'
import { WritebackPanel } from '@/components/writeback-panel'

export default async function SetupPage() {
  const env = getEnvStatus()
  const webhookUrl = `${env.publicAppUrl}/api/webhooks/hebrah`
  const envReady = env.webhookSecret && env.pat && env.connectionId

  let mcpOk = false
  let mcpError: string | null = null
  let orgName: string | null = null

  if (env.pat && env.mcpUrl) {
    try {
      const status = await mcpGetAccountStatus() as {
        organization?: { name?: string }
      }
      mcpOk = true
      orgName = status.organization?.name ?? null
    } catch (error) {
      mcpError = error instanceof Error ? error.message : 'MCP check failed'
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Setup</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Register the webhook URL in hebrah, configure hosted MCP credentials, and run
          prior auth scenarios via <code>run_sandbox_scenario</code>.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Environment</CardTitle>
            <CardDescription>From `.env` in this app</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Webhook secret</span>
              <Badge variant={env.webhookSecret ? 'default' : 'destructive'}>
                {env.webhookSecret ? 'Set' : 'Missing'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>HEBRAH_PAT</span>
              <Badge variant={env.pat ? 'default' : 'destructive'}>
                {env.pat ? 'Set' : 'Missing'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Connection ID</span>
              <Badge variant={env.connectionId ? 'default' : 'destructive'}>
                {env.connectionId ? 'Set' : 'Missing'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>MCP URL</span>
              <Badge variant={env.mcpUrl ? 'default' : 'secondary'}>
                {env.mcpUrl ? 'Set' : 'Default'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Webhook URL</CardTitle>
            <CardDescription>hebrah dashboard → Settings → Webhook URL</CardDescription>
          </CardHeader>
          <CardContent>
            <code className="block break-all rounded-md bg-muted p-3 text-xs">{webhookUrl}</code>
            <p className="mt-2 text-xs text-muted-foreground">
              Docker hebrah-api: use <code>host.docker.internal:3003</code> instead of localhost.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hosted MCP</CardTitle>
          <CardDescription>
            hebrah-mcp-host on port 3021 — set <code>HEBRAH_SANDBOX_API_KEY</code> on the host
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span>Account status via MCP</span>
            <Badge variant={mcpOk ? 'default' : 'destructive'}>
              {mcpOk ? 'Connected' : 'Unavailable'}
            </Badge>
          </div>
          {orgName && <p className="text-muted-foreground">Organization: {orgName}</p>}
          {mcpError && <p className="text-destructive text-xs">{mcpError}</p>}
        </CardContent>
      </Card>

      {!envReady && (
        <Alert variant="destructive">
          <AlertTitle>Configuration incomplete</AlertTitle>
          <AlertDescription>
            Copy `.env.example` to `.env`. Add `hbsec_*` from onboarding, `hb_pat_*` from Settings →
            MCP, and your sandbox connection id.
          </AlertDescription>
        </Alert>
      )}

      {envReady && mcpOk && (
        <div className="flex flex-wrap gap-2">
          <Link href="/queue" className={buttonVariants()}>
            View PA queue
          </Link>
          <Link href="/activity" className={buttonVariants({ variant: 'outline' })}>
            Run scenarios
          </Link>
        </div>
      )}

      {env.sidecarWritebackUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Sidecar write-back</CardTitle>
            <CardDescription>
              Optional local sidecar stub at <code>SIDECAR_WRITEBACK_URL</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WritebackPanel />
          </CardContent>
        </Card>
      )}
    </div>
  )
}