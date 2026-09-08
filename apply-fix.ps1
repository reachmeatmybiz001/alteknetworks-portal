$ErrorActionPreference = "Stop"

Write-Host "Applying ALTEKNETWORKS portal fixes..." -ForegroundColor Cyan

git apply fixes/src-main.patch
git apply fixes/backend-index.patch

Write-Host ""
Write-Host "Checking patch..." -ForegroundColor Cyan
git diff --check

Write-Host ""
Write-Host "Fixes applied successfully." -ForegroundColor Green
Write-Host "Next:"
Write-Host "1. Set VITE_API_BASE_URL in Amplify."
Write-Host "2. Deploy backend/index.mjs to the existing ticket Lambda."
Write-Host "3. Build/deploy the frontend."
