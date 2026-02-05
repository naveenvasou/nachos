# Deploy Script for Nachos Backend
param (
    [string]$ProjectID,
    [string]$Region = "us-central1",
    [string]$ServiceName = "nachos-backend",
    [string]$DatabaseUrl
)

Write-Host "🌮 Deploying Nachos Backend to GCP Cloud Run..." -ForegroundColor Cyan

# Check if gcloud is installed
if (-not (Get-Command "gcloud" -ErrorAction SilentlyContinue)) {
    Write-Error "gcloud CLI is not installed. Please install Google Cloud SDK."
    exit 1
}

# Config Check
if (-not $ProjectID) {
    $ProjectID = Read-Host "Enter your GCP Project ID"
}

if (-not $DatabaseUrl) {
    Write-Warning "No Database URL provided. Using local SQLite (DATA WILL BE LOST ON RESTART)."
    Write-Host "To use Cloud SQL, pass -DatabaseUrl 'postgresql://user:pass@host/db'" -ForegroundColor Yellow
    $DatabaseUrl = ""
}

# Set Project
Write-Host "Setting project to $ProjectID..."
gcloud config set project $ProjectID

# Deploy
Write-Host "Deploying to Cloud Run..."
# We use --source . to let Cloud Run sublit the build to Cloud Build using the Dockerfile
# --allow-unauthenticated allows public access (simplest for this demo, restrict in prod)
$deployArgs = @(
    "run", "deploy", $ServiceName,
    "--source", ".",
    "--platform", "managed",
    "--region", $Region,
    "--allow-unauthenticated"
)

if ($DatabaseUrl) {
    $deployArgs += "--set-env-vars", "DATABASE_URL=$DatabaseUrl"
}

# Execute gcloud command
& gcloud $deployArgs

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Deployment Successful!" -ForegroundColor Green
    $url = gcloud run services describe $ServiceName --platform managed --region $Region --format 'value(status.url)'
    Write-Host "Service URL: $url"
} else {
    Write-Error "Deployment failed."
}
