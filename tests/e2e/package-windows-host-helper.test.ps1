$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot "../../scripts/package-smoke-windows.ps1")

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw $Message }
}

function Assert-Throws([scriptblock]$Action, [string]$Message) {
  $threw = $false
  try { & $Action } catch { $threw = $true }
  if (-not $threw) { throw $Message }
}

function New-AppLayout([string]$Root) {
  New-Item -ItemType Directory -Force (Join-Path $Root "resources") | Out-Null
  New-Item -ItemType File -Force (Join-Path $Root "DeepSeek Harness Code.exe") | Out-Null
  New-Item -ItemType File -Force (Join-Path $Root "Uninstall DeepSeek Harness Code.exe") | Out-Null
}

$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) "dhc-windows-host-helper-$PID"
$localAppData = Join-Path $fixtureRoot "LocalAppData"
$programsRoot = Join-Path $localAppData "Programs"
$customRoot = Join-Path $fixtureRoot "runner-owned-custom"
$registeredRoot = Join-Path $programsRoot "DeepSeek Harness Code"
$outsideRoot = Join-Path $fixtureRoot "outside-sentinel"
$junctionPath = Join-Path $customRoot "outside-junction"

try {
  New-AppLayout $customRoot
  New-AppLayout $registeredRoot

  $custom = Resolve-DhscInstalledApplication -CustomRoot $customRoot -RegistryEntries @() -LocalAppData $localAppData
  Assert-True ($custom.Source -eq "custom") "safe custom direct root was not accepted"
  Assert-True ($custom.Root -eq [IO.Path]::GetFullPath($customRoot)) "custom root was not canonical"

  $wideEntry = [pscustomobject]@{
    DisplayName = "DeepSeek Harness Code"
    InstallLocation = $programsRoot
    UninstallString = ""
  }
  Assert-Throws {
    Resolve-DhscInstalledApplication -CustomRoot (Join-Path $fixtureRoot "missing-custom") -RegistryEntries @($wideEntry) -LocalAppData $localAppData
  } "wide Programs root with a nested app was accepted"

  $safeEntry = [pscustomobject]@{
    DisplayName = "DeepSeek Harness Code"
    InstallLocation = $registeredRoot
    UninstallString = ""
  }
  $registered = Resolve-DhscInstalledApplication -CustomRoot (Join-Path $fixtureRoot "missing-custom") -RegistryEntries @($safeEntry) -LocalAppData $localAppData
  Assert-True ($registered.Source -eq "registry") "safe registered direct root was not accepted"

  Assert-Throws {
    Resolve-DhscInstalledApplication -CustomRoot (Join-Path $fixtureRoot "missing-custom") -RegistryEntries @($safeEntry, $safeEntry) -LocalAppData $localAppData
  } "duplicate registry entries were accepted"

  $uninstallEntry = [pscustomobject]@{
    DisplayName = "DeepSeek Harness Code"
    InstallLocation = ""
    UninstallString = "`"$(Join-Path $registeredRoot 'Uninstall DeepSeek Harness Code.exe')`" /S"
  }
  $fromUninstall = Resolve-DhscInstalledApplication -CustomRoot (Join-Path $fixtureRoot "missing-custom") -RegistryEntries @($uninstallEntry) -LocalAppData $localAppData
  Assert-True ($fromUninstall.Root -eq [IO.Path]::GetFullPath($registeredRoot)) "exact UninstallString root was not accepted"

  $badUninstallEntry = [pscustomobject]@{
    DisplayName = "DeepSeek Harness Code"
    InstallLocation = ""
    UninstallString = "`"$(Join-Path $registeredRoot 'other-uninstaller.exe')`" /S"
  }
  Assert-Throws {
    Resolve-DhscInstalledApplication -CustomRoot (Join-Path $fixtureRoot "missing-custom") -RegistryEntries @($badUninstallEntry) -LocalAppData $localAppData
  } "non-exact uninstaller filename was accepted"

  New-Item -ItemType Directory -Force $outsideRoot | Out-Null
  $sentinel = Join-Path $outsideRoot "sentinel.txt"
  New-Item -ItemType File -Force $sentinel | Out-Null
  New-Item -ItemType Junction -Path $junctionPath -Target $outsideRoot | Out-Null
  Assert-Throws {
    Remove-DhscRunnerOwnedCustomRoot -CustomRoot $customRoot -RunnerTemp $fixtureRoot
  } "custom cleanup accepted a junction"
  Assert-True (Test-Path -LiteralPath $sentinel -PathType Leaf) "junction cleanup changed the outside sentinel"
  Assert-True (Test-Path -LiteralPath $customRoot -PathType Container) "junction rejection partially deleted the custom root"
  Remove-Item -LiteralPath $junctionPath -Force

  $cleanupFailures = New-DhscCleanupFailureList
  Add-DhscDirectCleanupFailure -CleanupFailures $cleanupFailures -Message "restore direct failure"
  try {
    throw [InvalidOperationException]::new("uninstall caught failure")
  } catch {
    Add-DhscCaughtCleanupFailure -CleanupFailures $cleanupFailures -ErrorRecord $_
  }
  Assert-True ($cleanupFailures.Count -eq 2) "cleanup failure count was not preserved"
  Assert-True ($cleanupFailures[0].GetType() -eq [Exception]) "direct cleanup failure type was not distinguishable"
  Assert-True ($cleanupFailures[1].GetType() -eq [InvalidOperationException]) "caught cleanup failure type was not distinguishable"
  Assert-True (@($cleanupFailures | Where-Object { [string]::IsNullOrWhiteSpace($_.Message) }).Count -eq 0) "cleanup failure message was empty"
  $reportedCleanup = [Collections.Generic.List[string]]::new()
  $primaryFailure = [ApplicationException]::new("primary failure")
  $finalFailure = $null
  try {
    Complete-DhscPackageStep -PrimaryFailure $primaryFailure -CleanupFailures $cleanupFailures -ReportCleanup {
      param($Message)
      $reportedCleanup.Add($Message) | Out-Null
    }
  } catch {
    $finalFailure = $_.Exception
  }
  Assert-True ($finalFailure.GetType() -eq [ApplicationException]) "primary failure type lost final priority"
  Assert-True ($finalFailure.Message -eq "primary failure") "primary failure message lost final priority"
  Assert-True ($reportedCleanup.Count -eq 2) "cleanup messages were not all reported"
  Assert-True (@($reportedCleanup | Where-Object { [string]::IsNullOrWhiteSpace($_) }).Count -eq 0) "reported cleanup message was empty"

  $nodeRoot = Join-Path $fixtureRoot "nodes"
  New-Item -ItemType Directory -Force $nodeRoot | Out-Null
  $nodes = @("one", "two", "three") | ForEach-Object {
    $path = Join-Path $nodeRoot "$_.exe"
    New-Item -ItemType File -Force $path | Out-Null
    $path
  }
  $moves = New-DhscNodeMoveList
  Hide-DhscNodeCandidates -Candidates $nodes -Moves $moves -RunToken "reverse"
  $restoreOrder = [Collections.Generic.List[string]]::new()
  Restore-DhscNodeCandidates -Moves $moves -MoveEntry {
    param($From, $To)
    $restoreOrder.Add([IO.Path]::GetFileName($To)) | Out-Null
    Move-Item -LiteralPath $From -Destination $To -ErrorAction Stop
  }
  Assert-True (($restoreOrder -join ",") -eq "three.exe,two.exe,one.exe") "Node candidates were not restored in reverse order"
  Assert-True (@($nodes | Where-Object { -not (Test-Path -LiteralPath $_) }).Count -eq 0) "Node candidates were not restored"

  $partialNodes = @("partial-one", "partial-two") | ForEach-Object {
    $path = Join-Path $nodeRoot "$_.exe"
    New-Item -ItemType File -Force $path | Out-Null
    $path
  }
  $partialMoves = New-DhscNodeMoveList
  $moveAttempt = 0
  Assert-Throws {
    Hide-DhscNodeCandidates -Candidates $partialNodes -Moves $partialMoves -RunToken "partial" -MoveEntry {
      param($From, $To)
      $script:moveAttempt += 1
      if ($script:moveAttempt -eq 2) { throw "fixture move failure" }
      Move-Item -LiteralPath $From -Destination $To -ErrorAction Stop
    }
  } "partial Node move failure was not reported"
  Assert-True ($partialMoves.Count -eq 1) "successful partial move was not retained for finally"
  Restore-DhscNodeCandidates -Moves $partialMoves
  Assert-True (@($partialNodes | Where-Object { -not (Test-Path -LiteralPath $_) }).Count -eq 0) "partial move was not restored"

  $restoreFailureNode = Join-Path $nodeRoot "restore-failure.exe"
  New-Item -ItemType File -Force $restoreFailureNode | Out-Null
  $restoreFailureMoves = New-DhscNodeMoveList
  Hide-DhscNodeCandidates -Candidates @($restoreFailureNode) -Moves $restoreFailureMoves -RunToken "restore-failure"
  Assert-Throws {
    Restore-DhscNodeCandidates -Moves $restoreFailureMoves -MoveEntry { throw "fixture restore failure" }
  } "restore failure did not fail the helper"
  Move-Item -LiteralPath $restoreFailureMoves[0].Hidden -Destination $restoreFailureMoves[0].Original -ErrorAction Stop
} finally {
  if (Test-Path -LiteralPath $junctionPath) { Remove-Item -LiteralPath $junctionPath -Force }
  if (Test-Path -LiteralPath $fixtureRoot) { Remove-Item -LiteralPath $fixtureRoot -Recurse -Force }
}

Write-Output "Windows package host helper fixtures passed"
