# Instrumenting Java and .NET apps for Grafana Cloud Application Observability

## Troubleshooting guide

### Metrics/traces/logs for Java via OTEL

To troubleshoot, work backwards as it's easiest to check this way in terms of effort

1. Look at Grafana Cloud billing/usage dashboard to see if any traces are getting blocked there
1. Look at OTEL receiver stats to see if any traces are getting blocked there
    1. Via the Alloy Health integration is the best way as it has pre-built OTEL metrics dashboards
    1. Follow the steps [here](https://grafana.com/docs/grafana-cloud/monitor-infrastructure/integrations/integration-reference/integration-alloy-health/) to install the Alloy health dashboards into your hosted Grafana instance.  These allow you to see alloy and opentelemetry stats for your deployed namespace based on the k8s-monitoring deployment performed
1. Get a shell into one of the pods and check that env vars are passing through properly `printenv | grep otel`
1. Add debug env vars so that the OTEL exporters write out to the app logs

``` shell
- name: JAVA_TOOL_OPTIONS
  value: >-
    # Previous OTEL configuration items
    -Dotel.javaagent.debug="true"
    -Dotel.span.exporter="otlp,console"
    -Dotel.metrics.exporter="otlp,console"
    -Dotel.logs.exporter="otlp,console"
```

### Profiles for Java via Alloy pyroscope.java

If you see errors in the app logs like PyroscopePprofSink 400, you'll have to look at the pyroscope logs on the server side in Grafana Cloud to see what the problem is. 400 is the HTTP response code only, not the actual error message.

You can find the query to run on ops.grafana-ops.net [here](https://ops.grafana-ops.net/explore?schemaVersion=1&panes=%7B%227ih%22%3A%7B%22datasource%22%3A%22000000193%22%2C%22queries%22%3A%5B%7B%22refId%22%3A%22A%22%2C%22expr%22%3A%22%7Bnamespace%3D%5C%22profiles-prod-006%5C%22%7D+%7C+logfmt+%7C%3D+%5C%22927888%5C%22+%7C+level%3D%5C%22error%5C%22%22%2C%22queryType%22%3A%22range%22%2C%22datasource%22%3A%7B%22type%22%3A%22loki%22%2C%22uid%22%3A%22000000193%22%7D%2C%22editorMode%22%3A%22code%22%7D%5D%2C%22range%22%3A%7B%22from%22%3A%221723562902859%22%2C%22to%22%3A%221723563706046%22%7D%7D%7D&orgId=1), adjust for your cluster and instance.

### Metrics/traces/logs for .NET via OTEL

### Profiles for .NET via Pyroscope profiler
