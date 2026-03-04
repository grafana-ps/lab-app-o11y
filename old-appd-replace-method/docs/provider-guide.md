# Instrumenting Java and .NET apps for Grafana Cloud Application Observability

## Provider Guide for running the lab

This guide is for the provider of the lab to get things set up ahead of time.  Please ensure [prerequisites](./prerequisites.md) are completed first.

### Deploy a GKE K8s cluster on Google Cloud

This should be done under our `grafana-professional-services` project.  A few recommendations on deployment options

1. Deploy in a region close to where the lab is being held if possible for better latency/performance
1. Deploy a standard cluster instead of autopilot as there are special considerations for k8s-monitoring for autopilot.  Also allows the lab provider to increase the number of nodes ahead of the lab, as waiting for more nodes to spin up as participants deploy slows down the pace and wastes time
1. Specific machine types in the node pool aren't required, but e2-standard-4 are a good balance for cost/scaling
1. Name the cluster something associated to the lab as the cluster name will be used by participants

Note that this can be done with other cloud providers or K8s clusters, but this guide provides steps for GKE specifically.

### Deploy k8smonitoring instance for monitoring resources and workloads during the lab

Each participant will deploy their own k8s-monitoring instance that will be used primarily for OTEL receivers.  These instances have all the actual k8s monitoring components disabled as the purpose of the lab is to pull OTEL data in a standard way.  This instance will deploy these componets so the lab provider can monitor things as the lab progresses and view any errors while participants primarily use k9s for debugging pretending to be a customer.

Modify the [example values file](../provider/k8s-monitoring-provider-values.yaml) as follows

1. Update cluster.name with the name of your lab
1. Update externalServices with your prometheus and loki endpoints found in your Grafana Cloud Stack details.  Use the token from the access policy created in the [prerequisites](1-provider-guide.md) as the password

Commands to run the deployment as follows

``` shell
# Get creds for this lab's k8s cluster
gcloud container clusters get-credentials <cluster-name> --region <region> --project grafana-professional-services
# Deploy k8smonitoring to monitor the entire cluster
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update
# Get the example values file deploy to your own namespace pointed to your own Grafana Cloud stack
helm upgrade --install --atomic --timeout 300s provider-k8s-monitoring grafana/k8s-monitoring --namespace "provider-k8smonitoring" --create-namespace --values k8s-monitoring-provider-values.yaml
```

Use `k9s` to ensure services are deployed and running properly, check your Grafana Cloud k8s monitoring app to ensure cluster signals are being sent.

### Install the Alloy Health integration into your Grafana Cloud Stack

Follow the steps [here](https://grafana.com/docs/grafana-cloud/monitor-infrastructure/integrations/integration-reference/integration-alloy-health/) to install the Alloy health dashboards, these allow you to see alloy and opentelemetry stats in each deployed namespace for all the participants based on the k8s-monitoring deployment performed above.
