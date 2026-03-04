{{/*
Expand the name of the chart.
*/}}
{{- define "otel-demo-apps.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "otel-demo-apps.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "otel-demo-apps.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "otel-demo-apps.labels" -}}
helm.sh/chart: {{ include "otel-demo-apps.chart" . }}
{{ include "otel-demo-apps.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- with .Values.global.labels }}
{{- toYaml . | nindent 0 }}
{{- end }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "otel-demo-apps.selectorLabels" -}}
app.kubernetes.io/name: {{ include "otel-demo-apps.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Component name: <chart-name>-<component>
Usage: {{ include "otel-demo-apps.componentName" (dict "root" . "component" "payment") }}
*/}}
{{- define "otel-demo-apps.componentName" -}}
{{- printf "%s-%s" (include "otel-demo-apps.name" .root) .component }}
{{- end }}

{{/*
Component selector labels — sets app.kubernetes.io/name to the per-component
name so it aligns with OTEL_SERVICE_NAME for each microservice.
Usage: {{ include "otel-demo-apps.componentSelectorLabels" (dict "root" . "component" "payment") }}
*/}}
{{- define "otel-demo-apps.componentSelectorLabels" -}}
app.kubernetes.io/name: {{ include "otel-demo-apps.componentName" . }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
{{- end }}

{{/*
Component common labels — includes component selector labels, chart metadata,
and app.kubernetes.io/component.
Usage: {{ include "otel-demo-apps.componentLabels" (dict "root" . "component" "payment") }}
*/}}
{{- define "otel-demo-apps.componentLabels" -}}
helm.sh/chart: {{ include "otel-demo-apps.chart" .root }}
{{ include "otel-demo-apps.componentSelectorLabels" . }}
{{- if .root.Chart.AppVersion }}
app.kubernetes.io/version: {{ .root.Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .root.Release.Service }}
app.kubernetes.io/component: {{ .component }}
{{- with .root.Values.global.labels }}
{{- toYaml . | nindent 0 }}
{{- end }}
{{- end }}

{{/*
Create the namespace to use
*/}}
{{- define "otel-demo-apps.namespace" -}}
{{- default .Release.Namespace .Values.namespace }}
{{- end }}

{{/*
Create image reference
*/}}
{{- define "otel-demo-apps.image" -}}
{{- $registry := .root.Values.global.image.registry -}}
{{- $repository := .root.Values.global.image.repository -}}
{{- $tag := .root.Values.global.image.tag -}}
{{- $name := .name -}}
{{- printf "%s/%s/%s:%s" $registry $repository $name $tag }}
{{- end }}

{{/*
OTel instrumentation annotation
*/}}
{{- define "otel-demo-apps.instrumentationAnnotation" -}}
{{- if .enabled }}
instrumentation.opentelemetry.io/inject-{{ .language }}: "true"
{{- end }}
{{- end }}


