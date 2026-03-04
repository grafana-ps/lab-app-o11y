# Instrumenting Java and .NET apps for Grafana Cloud Application Observability

## Prerequisites

To provide and participate in this lab, you will need the following

1. Google cloud access to our [professional services project](https://console.cloud.google.com/kubernetes/workload/overview?project=grafana-professional-services).  Ping [steven.shaw@grafana.com] to get added if you don't have access with your grafana.com account
1. [gcloud CLI](https://cloud.google.com/sdk/docs/install)
1. [gke-gcloud-auth-plugin](https://cloud.google.com/kubernetes-engine/docs/how-to/cluster-access-for-kubectl#install_plugin)
1. Grafana Cloud Stack
    1. Recommend using your own staff instance if possible, but if you don't have access to one you can create a free account [here](https://grafana.com/pricing/).  You will need to setup an access policy and token that permits the following scopes
        1. metrics:write
        1. logs:write
        1. traces:write
        1. profiles:write
    1. You will also need your stack endpoints for prometheus (metrics), loki (logs), tempo (traces) and pyroscope (profiles).  You can find these via the docs [here](https://grafana.com/docs/grafana-cloud/account-management/cloud-stacks/#find-instance-endpoints)
1. [kubectl](https://kubernetes.io/docs/tasks/tools/)
1. [helm](https://helm.sh/docs/intro/install/)
1. [k9s](https://k9scli.io/topics/install/)

## Next up

For lab participants, move on to [k8s-monitoring deployment](./participant-guide-k8s-monitoring.md)

## Lab providers

*not for lab participants*
For lab providers only, move on to the [provider guide](./provider-guide.md)
