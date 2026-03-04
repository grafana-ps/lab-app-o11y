# Step 0: Prereqs

Deploying a GKE cluster within our Professional Services GCP tenant is a prereq to this lab.  If you don't have access you can always use your own k8s cluster of choice, but we recommend using GKE to run these labs for the simplicity of it

``` shell
# Install gcloud cli
brew install gcloud-cli
# Login
gcloud auth login
# Create GKE cluster, make sure to change the cluster name, zone and node-locations in the first few lines
gcloud container \
  --project "grafana-professional-services" \
  clusters create "<yourname>-app-o11y" \
  --zone "us-west1-b" \
  --node-locations "us-west1-b" \
  --machine-type "e2-standard-2" \
  --image-type "COS_CONTAINERD" \
  --disk-type "pd-standard" \
  --disk-size "100" \
  --spot \
  --num-nodes "3" \
  --default-max-pods-per-node "110" \
  --enable-ip-alias \
  --enable-autoscaling \
  --total-min-nodes "3" \
  --total-max-nodes "20" \
  --location-policy "ANY" \
  --enable-dns-access \
  --enable-ip-access \
  --security-posture=standard \
  --workload-vulnerability-scanning=disabled \
  --no-enable-google-cloud-access \
  --addons HorizontalPodAutoscaling,HttpLoadBalancing,NodeLocalDNS,GcePersistentDiskCsiDriver,GcpFilestoreCsiDriver \
  --enable-autoupgrade \
  --enable-autorepair \
  --max-surge-upgrade 1 \
  --max-unavailable-upgrade 0 \
  --maintenance-window-start "2026-02-04T08:00:00.000Z" \
  --maintenance-window-end "2026-02-04T16:00:00.000Z" \
  --maintenance-window-recurrence "FREQ=WEEKLY;BYDAY=SA,SU" \
  --binauthz-evaluation-mode=DISABLED \
  --no-enable-managed-prometheus \
  --enable-shielded-nodes \
  --shielded-integrity-monitoring \
  --no-shielded-secure-boot
```

While that's deploying, ensure you have both kubernetes observability and application observability enabled in your Grafana Cloud stack as follows

- [K8s o11y activation](https://grafana.com/docs/grafana-cloud/monitor-infrastructure/kubernetes-monitoring/configuration/activate/)
- App o11y activation can be done at the following URL with your Grafana Cloud stack domain name (https:/your_stack_name.grafana.net/a/grafana-app-observability-app/configuration)

---

Next: [Step 1: Deploy the Demo Apps](01-deploy-apps.md)
