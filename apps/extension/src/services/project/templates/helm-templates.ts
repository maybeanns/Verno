export const HELM_CHART_TEMPLATE = (projectName: string) => `apiVersion: v2
name: ${projectName}
description: A Helm chart for Kubernetes deployment
type: application
version: 0.1.0
appVersion: "1.0.0"
`;

export const HELM_VALUES_TEMPLATE = (projectName: string) => `# Default values for ${projectName}.
replicaCount: 1

image:
  repository: your-docker-repo/${projectName}
  pullPolicy: IfNotPresent
  tag: "latest"

service:
  type: ClusterIP
  port: 80

ingress:
  enabled: false

resources: {}
`;

export const HELM_DEPLOYMENT_TEMPLATE = (projectName: string) => `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "${projectName}.fullname" . }}
  labels:
    {{- include "${projectName}.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "${projectName}.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "${projectName}.selectorLabels" . | nindent 8 }}
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.service.port }}
              protocol: TCP
`;

export const HELM_SERVICE_TEMPLATE = (projectName: string) => `apiVersion: v1
kind: Service
metadata:
  name: {{ include "${projectName}.fullname" . }}
  labels:
    {{- include "${projectName}.labels" . | nindent 4 }}
spec:
  type: {{ .Values.service.type }}
  ports:
    - port: {{ .Values.service.port }}
      targetPort: http
      protocol: TCP
      name: http
  selector:
    {{- include "${projectName}.selectorLabels" . | nindent 4 }}
`;

export const HELM_HELPERS_TEMPLATE = (projectName: string) => `{{/*
Expand the name of the chart.
*/}}
{{- define "${projectName}.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "${projectName}.fullname" -}}
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
{{- define "${projectName}.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "${projectName}.labels" -}}
helm.sh/chart: {{ include "${projectName}.chart" . }}
{{ include "${projectName}.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "${projectName}.selectorLabels" -}}
app.kubernetes.io/name: {{ include "${projectName}.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
`;
