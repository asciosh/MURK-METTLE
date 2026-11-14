# Tests the built current-user NSIS installer on an interactive Windows CI runner.
# It never authenticates or writes to the production game backend.
$ErrorActionPreference = 'Stop'
$installer = Get-ChildItem "$PSScriptRoot/../src-tauri/target/release/bundle/nsis/*-setup.exe" | Select-Object -First 1
if (-not $installer) { throw 'NSIS installer was not produced' }
$installDir = Join-Path $env:RUNNER_TEMP 'murk-desktop-install'
# NSIS requires /D to be last and unquoted, even when the directory contains spaces.
$setup = Start-Process -FilePath $installer.FullName -ArgumentList "/S /D=$installDir" -Wait -PassThru
if ($setup.ExitCode -ne 0) { throw "Installer exited $($setup.ExitCode)" }
$exe = Join-Path $installDir 'murk-mettle-desktop.exe'
if (-not (Test-Path $exe)) { throw 'Installed game host executable missing' }
$stdout = Join-Path $env:RUNNER_TEMP 'murk-host-stdout.log'
$stderr = Join-Path $env:RUNNER_TEMP 'murk-host-stderr.log'
$app = Start-Process -FilePath $exe -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
try {
  $deadline = (Get-Date).AddSeconds(45)
  do {
    Start-Sleep -Milliseconds 500
    $app.Refresh()
    if ($app.HasExited) { throw "Desktop host exited early: $($app.ExitCode)" }
  } until ($app.MainWindowHandle -ne 0 -or (Get-Date) -gt $deadline)
  if ($app.MainWindowTitle -notlike '*MURK & METTLE*') { throw "Branded window not found: $($app.MainWindowTitle)" }
  Add-Type -AssemblyName UIAutomationClient
  Add-Type -AssemblyName UIAutomationTypes
  $window = [System.Windows.Automation.AutomationElement]::FromHandle($app.MainWindowHandle)
  $condition = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::NameProperty, 'Open / return to game')
  $button = $null
  $deadline = (Get-Date).AddSeconds(30)
  do {
    $button = $window.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
    if (-not $button) { Start-Sleep -Milliseconds 500 }
  } until ($button -or (Get-Date) -gt $deadline)
  if (-not $button) { throw 'Launcher content did not load in WebView2' }
  $deadline = (Get-Date).AddSeconds(30)
  while (-not $button.Current.IsEnabled -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 200 }
  if (-not $button.Current.IsEnabled) { throw 'Launcher module did not become ready' }
  # Click through the real local IPC capability; require a branded window owned by this host.
  $invoke = $button.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
  $invoke.Invoke()
  $field = $null
  $processCondition = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ProcessIdProperty, $app.Id)
  $deadline = (Get-Date).AddSeconds(30)
  do {
    $windows = [System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children, $processCondition)
    for ($i = 0; $i -lt $windows.Count; $i++) {
      $candidate = $windows.Item($i)
      if ($candidate.Current.Name -match 'MURK.*METTLE' -and $candidate.Current.Name -notlike '*launcher*') { $field = $candidate; break }
    }
    if (-not $field) { Start-Sleep -Milliseconds 500 }
  } until ($field -or (Get-Date) -gt $deadline)
  if (-not $field) { throw 'Launcher command did not open the game window' }
  $loginCondition = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::NameProperty, 'LOGIN')
  $login = $null
  $deadline = (Get-Date).AddSeconds(45)
  do {
    $login = $field.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $loginCondition)
    if (-not $login) { Start-Sleep -Milliseconds 500 }
  } until ($login -or (Get-Date) -gt $deadline)
  if (-not $login) { throw 'Hosted HTTPS login page did not appear' }
  Write-Output 'Hosted HTTPS game login page is visible (no authentication attempted).'
  Write-Output 'Installed host launches, renders the local launcher and opens its branded game window through the scoped command.'
  # Force-stop only this test process: the normal close path deliberately requires user confirmation.
} catch {
  # Local throwaway CI profile only; no account is used. Preserve diagnostic UI names on failure.
  if ($window) {
    $nodes = $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
    for ($i = 0; $i -lt [Math]::Min($nodes.Count, 100); $i++) {
      Write-Output ("UI: " + $nodes.Item($i).Current.Name)
    }
  }
  if ($processCondition) {
    $windows = [System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children, $processCondition)
    for ($i = 0; $i -lt $windows.Count; $i++) { Write-Output ('Host window: ' + $windows.Item($i).Current.Name) }
  }
  Get-Process | Where-Object { $_.Id -eq $app.Id } | Select-Object Id, MainWindowTitle | Format-List
  throw
} finally {
  if (-not $app.HasExited) { Stop-Process -Id $app.Id -Force }
  if (Test-Path $stdout) { Get-Content $stdout }
  if (Test-Path $stderr) { Get-Content $stderr }
}
$uninstaller = Get-ChildItem "$installDir/*uninstall*.exe" | Select-Object -First 1
if (-not $uninstaller) { throw 'Uninstaller missing' }
$remove = Start-Process -FilePath $uninstaller.FullName -ArgumentList '/S' -Wait -PassThru
if ($remove.ExitCode -ne 0) { throw "Uninstaller exited $($remove.ExitCode)" }
if (Test-Path $exe) { throw 'Uninstaller left the installed host executable behind' }
Write-Output 'Silent install, native launch and uninstall smoke checks passed. Login, WebGL, fullscreen and gameplay still require manual Windows testing.'
