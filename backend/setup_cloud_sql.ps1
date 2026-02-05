# Cloud SQL Setup Script
param (
    [string]$ProjectID = "superblue-backend-v0",
    [string]$Region = "us-central1",
    [string]$InstanceName = "nachos-db-instance",
    [string]$DbName = "nachos",
    [string]$DbUser = "nachos_user",
    [string]$DbPass # Optional, will generate if empty
)

if (-not $DbPass) {
    $DbPass = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 16 | % {[char]$_})
    Write-Host "Generated Password: $DbPass" -ForegroundColor Yellow
}

Write-Host "🌮 Setting up Cloud SQL for project $ProjectID..." -ForegroundColor Cyan

# 1. Enable API
Write-Host "Enabling Cloud SQL Admin API..."
gcloud services enable sqladmin.googleapis.com --project $ProjectID

# 2. Check/Create Instance
$instanceExists = gcloud sql instances describe $InstanceName --project $ProjectID --format="value(name)" 2>$null
if ($instanceExists) {
    Write-Host "Instance $InstanceName already exists. Skipping creation." -ForegroundColor Yellow
} else {
    Write-Host "Creating Cloud SQL Instance '$InstanceName' (This may take 5-10 minutes)..." -ForegroundColor Cyan
    # Using specific tier for cost/performance balance usually db-f1-micro is too small for prod but ok for dev
    # Standard: db-custom-1-3840 (1 vCPU, 3.75GB)
    gcloud sql instances create $InstanceName `
        --database-version=POSTGRES_15 `
        --tier=db-custom-1-3840 `
        --region=$Region `
        --project=$ProjectID `
        --root-password=$DbPass
}

# 3. Create Database
Write-Host "Creating Database '$DbName'..."
gcloud sql databases create $DbName --instance=$InstanceName --project=$ProjectID 2>$null

# 4. Create User
Write-Host "Creating User '$DbUser'..."
gcloud sql users create $DbUser --instance=$InstanceName --password=$DbPass --project=$ProjectID 2>$null

# 5. Get IP
$ip = gcloud sql instances describe $InstanceName --project $ProjectID --format="value(ipAddresses[0].ipAddress)"

Write-Host "`n✅ Setup Complete!" -ForegroundColor Green
Write-Host "Connection String (Internal): postgres://$($DbUser):$($DbPass)@$($ip)/$($DbName)"
Write-Host "Connection String (Public): postgres://$($DbUser):$($DbPass)@$($ip)/$($DbName)"
Write-Host "NOTE: For public access, ensure you authorize your IP network or use Cloud SQL Proxy."
Write-Host "---------------------------------------------------"
Write-Host "SAVE THIS URL:"
Write-Host "postgresql://$($DbUser):$($DbPass)@$($ip)/$($DbName)" -ForegroundColor Green
