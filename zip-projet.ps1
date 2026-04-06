# Script ZIP pour DictaBill — exclut node_modules
$source = $PSScriptRoot
$destination = "$env:USERPROFILE\Desktop\dictabill-backup.zip"

Write-Host "Creation du ZIP..." -ForegroundColor Cyan

# Collecter tous les fichiers sauf node_modules et .expo
$files = Get-ChildItem -Path $source -Recurse -File | Where-Object {
    $_.FullName -notmatch "\\node_modules\\" -and
    $_.FullName -notmatch "\\.expo\\" -and
    $_.FullName -notmatch "\\dist\\" -and
    $_.FullName -notmatch "\\web-build\\"
}

# Supprimer le ZIP existant si besoin
if (Test-Path $destination) { Remove-Item $destination }

# Creer le ZIP
Add-Type -Assembly "System.IO.Compression.FileSystem"
$zip = [System.IO.Compression.ZipFile]::Open($destination, 'Create')

foreach ($file in $files) {
    $relativePath = $file.FullName.Substring($source.Length + 1)
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $relativePath) | Out-Null
    Write-Host "  + $relativePath" -ForegroundColor Gray
}

$zip.Dispose()

$sizeMB = [math]::Round((Get-Item $destination).Length / 1MB, 1)
Write-Host ""
Write-Host "ZIP cree : $destination ($sizeMB MB)" -ForegroundColor Green
Write-Host "Upload ce fichier sur Google Drive / OneDrive !" -ForegroundColor Yellow
