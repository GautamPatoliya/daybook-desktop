# Opens the Spider-Verse announcement in Outlook as rendered HTML (ready to review & send).
# Usage:
#   .\send-v1.1.1-email.ps1
#   .\send-v1.1.1-email.ps1 -To "team@company.com"
#   .\send-v1.1.1-email.ps1 -To "you@company.com" -Send   # sends immediately (no preview)

param(
  [string]$To = "",
  [switch]$Send
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$htmlPath = Join-Path $here "v1.1.1-spider-verse-announcement.html"

if (-not (Test-Path $htmlPath)) {
  Write-Error "HTML not found: $htmlPath"
}

$html = Get-Content -Path $htmlPath -Raw -Encoding UTF8
$subject = "Daybook v1.1.1 — The Spider-Verse theme is here. Switch today."

try {
  $outlook = New-Object -ComObject Outlook.Application
} catch {
  Write-Error "Outlook is not installed or not available. Use Word method in SEND-EMAIL.md instead."
}

$mail = $outlook.CreateItem(0) # olMailItem
$mail.Subject = $subject
$mail.HTMLBody = $html

if ($To) {
  $mail.To = $To
}

if ($Send) {
  $mail.Send()
  Write-Host "Sent to: $To"
} else {
  $mail.Display()
  Write-Host "Outlook draft opened — review images/links, add recipients, then click Send."
}
