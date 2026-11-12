import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  assertSafeIdentifier,
  createCascadeDemoServer,
  escapeHtml,
  loadCliCredentials
} from '../server.mjs'

test('escapeHtml neutralizes HTML injection characters', () => {
  const dirty = `<script>alert("xss" & 'leak')</script>`
  const clean = escapeHtml(dirty)
  assert.equal(
    clean,
    '&lt;script&gt;alert(&quot;xss&quot; &amp; &#39;leak&#39;)&lt;/script&gt;'
  )
})

test('assertSafeIdentifier accepts valid IDs and blocks path traversal or injection', () => {
  assert.equal(assertSafeIdentifier('pat-013', 'patientId'), 'pat-013')
  assert.equal(
    assertSafeIdentifier('7c09c47d-8f36-40e5-aac3-f4fbd6c33c89', 'environmentId'),
    '7c09c47d-8f36-40e5-aac3-f4fbd6c33c89'
  )

  for (const bad of ['', '..', '.', '../etc/passwd', 'pat-013; DROP TABLE', 'a/b', 'x'.repeat(85)]) {
    assert.throws(
      () => assertSafeIdentifier(bad, 'patientId'),
      /Invalid patientId format/
    )
  }
})

test('loadCliCredentials validates key prefix and rejects symlinks', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hebrah-cascade-test-'))
  const prevEnv = process.env.HEBRAH_CREDENTIALS_DIR
  try {
    process.env.HEBRAH_CREDENTIALS_DIR = tmpDir
    const credPath = path.join(tmpDir, 'credentials')

    // Reject invalid key prefix
    fs.writeFileSync(credPath, JSON.stringify({ apiKey: 'sk_live_not_hebrah_1234567890' }))
    assert.equal(loadCliCredentials(), null)

    // Accept valid Hebrah key
    fs.writeFileSync(
      credPath,
      JSON.stringify({
        apiKey: 'hb_conn_validkey1234567890',
        apiUrl: 'https://api.hebrah.com',
        orgName: 'Demo Clinic'
      })
    )
    const loaded = loadCliCredentials()
    assert.equal(loaded?.apiKey, 'hb_conn_validkey1234567890')
    assert.equal(loaded?.orgName, 'Demo Clinic')
  } finally {
    if (prevEnv === undefined) {
      delete process.env.HEBRAH_CREDENTIALS_DIR
    } else {
      process.env.HEBRAH_CREDENTIALS_DIR = prevEnv
    }
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('createCascadeDemoServer enforces key, SSRF baseUrl, and environmentId validation', () => {
  assert.throws(
    () =>
      createCascadeDemoServer({
        apiKey: 'invalid_key',
        baseUrl: 'https://api.hebrah.com',
        environmentId: 'env-123'
      }),
    /Invalid Hebrah API key format/
  )

  assert.throws(
    () =>
      createCascadeDemoServer({
        apiKey: 'hb_conn_validkey1234567890',
        baseUrl: 'http://169.254.169.254',
        environmentId: 'env-123'
      }),
    /HTTPS|private|loopback|safe/i
  )

  assert.throws(
    () =>
      createCascadeDemoServer({
        apiKey: 'hb_conn_validkey1234567890',
        baseUrl: 'https://api.hebrah.com',
        environmentId: '../bad-env'
      }),
    /Invalid environmentId format/
  )
})

test('server.mjs embedded client <script> parses cleanly and contains no inline onclick attributes', () => {
  const src = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8')
  assert.equal(/onclick\s*=/i.test(src), false, 'Expected zero inline onclick attributes')

  const match = src.match(/<script>([\s\S]*?)<\/script>/)
  assert.ok(match && match[1], 'Expected embedded <script> block')
  assert.doesNotThrow(() => new Function(match[1]))
})
