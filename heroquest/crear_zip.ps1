$src = Split-Path -Parent $MyInvocation.MyCommand.Path
$dst = "$env:USERPROFILE\Downloads\heroquest_optimizado.zip"
if (Test-Path $dst) { Remove-Item $dst }
Compress-Archive -Path "$src\*" -DestinationPath $dst
Write-Host "Zip creado en: $dst"
Pause
