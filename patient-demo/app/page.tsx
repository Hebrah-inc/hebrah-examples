import Link from 'next/link'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getEnvStatus } from '@/lib/env'
import { fetchSandboxCatalog } from '@/lib/hebrah-api'
import { HebrahApiError } from '@/lib/hebrah-api'

export default async function SetupPage() {
  const env = getEnvStatus()
  const webhookUrl = `${env.publicAppUrl}/api/webhooks/hebrah`
  const envReady = env.apiKey && env.webhookSecret

  let catalog: Awaited<ReturnType<typeof fetchSandboxCatalog>> | null = null
  let catalogError: string | null = null

  if (envReady) {
    try {
      catalog = await fetchSandboxCatalog()
    } catch (error) {
      catalogError = error instanceof HebrahApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Failed to load sandbox catalog'
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Setup</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect this demo to your While sandbox credentials and register the webhook URL in the
          dashboard.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Environment</CardTitle>
            <CardDescription>Server-side credentials from `.env`</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>API base URL</span>
              <Badge variant={env.apiBaseUrl ? 'default' : 'secondary'}>
                {env.apiBaseUrl ? 'Set' : 'Default localhost:8000'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Sandbox API key</span>
              <Badge variant={env.apiKey ? 'default' : 'destructive'}>
                {env.apiKey ? 'Set' : 'Missing'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Webhook secret</span>
              <Badge variant={env.webhookSecret ? 'default' : 'destructive'}>
                {env.webhookSecret ? 'Set' : 'Missing'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Webhook URL</CardTitle>
            <CardDescription>
              Paste into While dashboard → Settings → Webhook URL
            </CardDescription>
          </CardHeader>
          <CardContent>
            <code className="block break-all rounded-md bg-muted p-3 text-xs">{webhookUrl}</code>
          </CardContent>
        </Card>
      </div>

      {!envReady && (
        <Alert variant="destructive">
          <AlertTitle>Configuration incomplete</AlertTitle>
          <AlertDescription>
            Copy `.env.example` to `.env` and add your `hb_test_*` and `hbsec_*` values from hebrah
            onboarding Step 2.
          </AlertDescription>
        </Alert>
      )}

      {catalogError && (
        <Alert variant="destructive">
          <AlertTitle>Catalog check failed</AlertTitle>
          <AlertDescription>{catalogError}</AlertDescription>
        </Alert>
      )}

      {catalog && (
        <Card>
          <CardHeader>
            <CardTitle>Sandbox catalog</CardTitle>
            <CardDescription>
              {catalog.org_name} · {catalog.connection_id}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="font-medium">Sample patient IDs</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {catalog.sample_patient_ids.join(', ')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/patients" className={buttonVariants()}>
                View patients
              </Link>
              <Link href="/events" className={buttonVariants({ variant: 'outline' })}>
                Webhook events
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
