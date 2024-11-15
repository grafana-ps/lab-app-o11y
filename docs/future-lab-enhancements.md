# Instrumenting Java and .NET apps for Grafana Cloud Application Observability

## Future enhancements for this lab

A list of things we could enhance given more time and interest

- Combine this repo with the best practices guide version here https://github.com/grafana/cx-best-practice-guides/tree/main/guides/public/cloud/app-o11y
- Ensure that participants under the prereqs have enabled Application Observability -> Metrics generation, and selected the proper datasources which can often be blank in a new Grafana Cloud stack
- k8s-monitoring chart v1 is not restricted to monitor only the Alloy instances in each participant namespace. It will monitor any Alloy pod in the cluster.  Post to #k8s-monitoring about this, might be able to fix this with a metrics.namespace limit but may be a problem for the larger k8s-monitoring deployment use cases
- Update to k8s-monitoring chart v2 once it's available
- Finish off or remove java and .net what did we do sections, considering steps below for instrumentation changes
- Set a username env var instead of having to manually modify everything
- Moving from external loadbalancer IPs to a secure ingress for participant app deployments
- Cluster roles for participants so they can’t delete or modify other participants namespaces only their own
- Steps for participants to manually add the bits to instrument a java app - adding initContainer, volume mount, configmap mount, and JAVA_TOOL_OPTIONS env vars
- Steps for participants to make the code changes for the .NET app and modifying the deployment to add all the env vars etc
- Add resource provider detection back into .NET if possible
- Deploy in multiple k8s cluster regions and demo grouping by cloud metadata
- Add new [pyroscope receiver in Alloy](https://grafana.com/docs/alloy/latest/reference/components/pyroscope/pyroscope.receive_http/) so we don't need to send profiles directly to cloud anymore
