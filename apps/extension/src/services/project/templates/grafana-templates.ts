/**
 * Grafana dashboard JSON template generator.
 * Produces a portable dashboard with RED metric panels
 * (Request rate, Error rate, Duration percentiles).
 */

export function generateGrafanaDashboard(serviceName: string): object {
    const uid = serviceName.replace(/[^a-zA-Z0-9-]/g, '-').substring(0, 40);

    return {
        __inputs: [
            {
                name: 'DS_PROMETHEUS',
                label: 'Prometheus',
                description: 'Prometheus data source',
                type: 'datasource',
                pluginId: 'prometheus',
                pluginName: 'Prometheus',
            },
        ],
        annotations: { list: [] },
        editable: true,
        fiscalYearStartMonth: 0,
        graphTooltip: 1,
        id: null,
        links: [],
        panels: [
            // ── Row: Overview ─────────────────────────────────────
            {
                type: 'row',
                title: 'Service Overview',
                gridPos: { h: 1, w: 24, x: 0, y: 0 },
                collapsed: false,
                panels: [],
            },
            // ── Panel 1: Request Rate ─────────────────────────────
            {
                type: 'timeseries',
                title: 'HTTP Request Rate',
                gridPos: { h: 8, w: 12, x: 0, y: 1 },
                datasource: { type: 'prometheus', uid: '${DS_PROMETHEUS}' },
                targets: [
                    {
                        expr: `rate(http_requests_total{service="${serviceName}"}[5m])`,
                        legendFormat: '{{method}} {{status}}',
                        refId: 'A',
                    },
                ],
                fieldConfig: {
                    defaults: {
                        color: { mode: 'palette-classic' },
                        unit: 'reqps',
                    },
                    overrides: [],
                },
            },
            // ── Panel 2: Error Rate ───────────────────────────────
            {
                type: 'timeseries',
                title: 'Error Rate (5xx)',
                gridPos: { h: 8, w: 12, x: 12, y: 1 },
                datasource: { type: 'prometheus', uid: '${DS_PROMETHEUS}' },
                targets: [
                    {
                        expr: `rate(http_requests_total{service="${serviceName}", status=~"5.."}[5m])`,
                        legendFormat: '{{status}}',
                        refId: 'A',
                    },
                ],
                fieldConfig: {
                    defaults: {
                        color: { mode: 'fixed', fixedColor: 'red' },
                        unit: 'reqps',
                    },
                    overrides: [],
                },
            },
            // ── Panel 3: Latency Percentiles ──────────────────────
            {
                type: 'timeseries',
                title: 'Request Latency (p50 / p95 / p99)',
                gridPos: { h: 8, w: 12, x: 0, y: 9 },
                datasource: { type: 'prometheus', uid: '${DS_PROMETHEUS}' },
                targets: [
                    {
                        expr: `histogram_quantile(0.50, rate(http_request_duration_seconds_bucket{service="${serviceName}"}[5m]))`,
                        legendFormat: 'p50',
                        refId: 'A',
                    },
                    {
                        expr: `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{service="${serviceName}"}[5m]))`,
                        legendFormat: 'p95',
                        refId: 'B',
                    },
                    {
                        expr: `histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{service="${serviceName}"}[5m]))`,
                        legendFormat: 'p99',
                        refId: 'C',
                    },
                ],
                fieldConfig: {
                    defaults: {
                        unit: 's',
                    },
                    overrides: [],
                },
            },
            // ── Panel 4: Active Connections ────────────────────────
            {
                type: 'stat',
                title: 'Active Connections',
                gridPos: { h: 8, w: 12, x: 12, y: 9 },
                datasource: { type: 'prometheus', uid: '${DS_PROMETHEUS}' },
                targets: [
                    {
                        expr: `sum(active_connections{service="${serviceName}"})`,
                        legendFormat: 'connections',
                        refId: 'A',
                    },
                ],
                fieldConfig: {
                    defaults: {
                        color: { mode: 'thresholds' },
                        thresholds: {
                            mode: 'absolute',
                            steps: [
                                { color: 'green', value: null },
                                { color: 'yellow', value: 100 },
                                { color: 'red', value: 500 },
                            ],
                        },
                    },
                    overrides: [],
                },
            },
        ],
        refresh: '30s',
        schemaVersion: 39,
        tags: ['auto-generated', 'verno', serviceName],
        templating: { list: [] },
        time: { from: 'now-1h', to: 'now' },
        timepicker: {},
        timezone: 'browser',
        title: `${serviceName} — Service Dashboard`,
        uid,
        version: 1,
    };
}
