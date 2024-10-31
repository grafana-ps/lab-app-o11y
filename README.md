# Instrumenting Java and .NET apps for Grafana Cloud Application Observability

![Grafana Cloud Application Observability](assets/images/grafana-application-observability-icon.png)

Welcome to the lab! Here, participants will learn how to instrument a demo Java and .NET app running on a k8s cluster with OpenTelemetry and Pyroscope to send metrics/logs/traces/profiles to Grafana Cloud, and then view the results in Application Observability.

## Definitions

### OpenTelemetry

A collection of tools, APIs, and SDKs, OpenTelemetry helps engineers instrument, generate, collect, and export telemetry data such as metrics, logs, and traces, in order to analyze software performance and behavior.

More details [here](https://grafana.com/oss/opentelemetry/)

### What is Pyroscope/Profiles?

[Grafana Pyroscope](https://grafana.com/oss/pyroscope/) is an open source continuous profiling database that provides fast, scalable, highly available, and efficient storage and querying. This helps you get a better understanding of resource usage in your applications down to the line number.

Profiles are the output from Pyroscope and considered the new 4th pillar of observability.  Profiles offer a view of where and how resources are used, down to the code level. In profiling, data is captured periodically, creating snapshots of application behavior that can help identify performance bottlenecks, inefficient code, or unexpected resource consumption. Pyroscope supports integration with OpenTelemetry, so profiles can be correlated with traces and metrics for comprehensive observability, making it valuable for performance tuning and resource optimization.

### Grafana Cloud Application Observability

[Application Observability](https://grafana.com/docs/grafana-cloud/monitor-applications/application-observability/) or as it is often referred to as `app o11y`, is an Application and Performance Monitoring (APM) solution built around OpenTelemetry semantic conventions and the Prometheus data-model and designed to empower your team to minimize the mean time to repair (MTTR) for application problems.

We market this as a replacement for other APM solutions by vendors such as AppDynamics, Datadog and New Relic.  This is one of our newer Act III services available in Grafana Cloud only.

## Lab Overview

This lab will have participants actively perform the following

1. Deploy our [k8s-monitoring helm chart](https://github.com/grafana/k8s-monitoring-helm) with the minimal setup of OTEL receivers to process metrics/logs/traces and send to their personal Grafana Cloud stack of choice
1. Auto-instrument a java app on k8s with the [Grafana OpenTelemetry distribution for Java](https://github.com/grafana/grafana-opentelemetry-java) giving us metrics/logs/traces
1. Auto-instrument a java app on k8s with Alloy's [pyroscope.java component](https://grafana.com/docs/alloy/latest/reference/components/pyroscope/pyroscope.java/) giving us profiles
1. SDK-instrument a .NET app on k8s with the [Grafana OpenTelemetry distribution for .NET](https://github.com/grafana/grafana-opentelemetry-dotnet) giving us metrics/logs/traces
1. SDK-instrument a .NET app on k8s with the [Grafana Pyroscope .NET Profiler](https://grafana.com/docs/pyroscope/latest/configure-client/language-sdks/dotnet) giving us profiles
1. Review results in Grafana Cloud Application Observability

## Start here

First up, [prerequisites](docs/prerequisites.md) for this lab
