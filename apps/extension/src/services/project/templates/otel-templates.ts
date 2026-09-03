/**
 * OpenTelemetry instrumentation templates — stack-aware boilerplate
 * for wiring up tracing, metrics, and auto-instrumentation.
 */

export const OTEL_TEMPLATES: Record<string, string> = {

    // ── TypeScript / Node.js ──────────────────────────────────────────
    typescript: `// instrumentation.ts — OpenTelemetry auto-instrumentation for Node.js
// Import this file BEFORE your application entry point:
//   node -r ./instrumentation.ts src/index.ts
// Or add to your package.json scripts:
//   "start": "node -r ./instrumentation.js dist/index.js"

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || '{{SERVICE_NAME}}';

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: SERVICE_NAME,
    [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '0.1.0',
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/metrics',
    }),
    exportIntervalMillis: 15000,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false }, // noisy
    }),
  ],
});

sdk.start();
console.log(\`[OTel] Tracing started for service: \${SERVICE_NAME}\`);

// Graceful shutdown
const shutdown = async () => {
  try {
    await sdk.shutdown();
    console.log('[OTel] SDK shut down successfully');
  } catch (err) {
    console.error('[OTel] Error during shutdown', err);
  } finally {
    process.exit(0);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
`,

    // ── Python ────────────────────────────────────────────────────────
    python: `# instrumentation.py — OpenTelemetry auto-instrumentation for Python
# Usage:
#   opentelemetry-instrument python app.py
# Or import this module at the top of your entry point:
#   import instrumentation  # noqa: F401

import os
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource, SERVICE_NAME, SERVICE_VERSION
from opentelemetry.instrumentation.auto_instrumentation import sitecustomize  # noqa: F401

SERVICE = os.getenv("OTEL_SERVICE_NAME", "{{SERVICE_NAME}}")

resource = Resource(attributes={
    SERVICE_NAME: SERVICE,
    SERVICE_VERSION: os.getenv("APP_VERSION", "0.1.0"),
})

provider = TracerProvider(resource=resource)
otlp_exporter = OTLPSpanExporter(
    endpoint=os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318/v1/traces"),
)
provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
trace.set_tracer_provider(provider)

print(f"[OTel] Tracing started for service: {SERVICE}")
`,

    // ── Generic (shell wrapper) ───────────────────────────────────────
    generic: `#!/usr/bin/env bash
# otel-entrypoint.sh — Generic OpenTelemetry agent wrapper
# Wraps your application start command with OTel environment variables.
# Usage: ./otel-entrypoint.sh <your-start-command>

set -euo pipefail

export OTEL_SERVICE_NAME="\${OTEL_SERVICE_NAME:-{{SERVICE_NAME}}}"
export OTEL_EXPORTER_OTLP_ENDPOINT="\${OTEL_EXPORTER_OTLP_ENDPOINT:-http://localhost:4318}"
export OTEL_TRACES_EXPORTER="otlp"
export OTEL_METRICS_EXPORTER="otlp"
export OTEL_LOGS_EXPORTER="otlp"

echo "[OTel] Service: $OTEL_SERVICE_NAME"
echo "[OTel] Endpoint: $OTEL_EXPORTER_OTLP_ENDPOINT"

# If using Java, attach the OTel Java agent:
# export JAVA_TOOL_OPTIONS="-javaagent:/path/to/opentelemetry-javaagent.jar"

exec "$@"
`,
};
