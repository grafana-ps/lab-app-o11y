# Instrumenting Java and .NET apps for Grafana Cloud Application Observability

## Future enhancements for this lab

A list of things we could enhance given more time and interest

- Set a username env var instead of having to manually modify everything
- Moving from external loadbalancer IPs to a secure ingress for participant app deployments
- Cluster roles for participants so they can’t delete or modify other participants namespaces only their own
- More time to allow participants to make the code changes for the .NET app
- Add resource providers to .NET, deploy in multiple k8s cluster regions and demo grouping by cloud metadata
- k8s-monitoring chart is not resitricted to montintor Alloy's it deployed. It will monitor any Alloy pod in the cluster.
