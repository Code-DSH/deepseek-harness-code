function Get-DhscCanonicalPath {
  param([Parameter(Mandatory = $true)][string]$Path)

  try {
    return [IO.Path]::GetFullPath($Path)
  } catch {
    throw "package host path was invalid"
  }
}

function Test-DhscDirectAppLayout {
  param([Parameter(Mandatory = $true)][string]$Root)

  return (
    (Test-Path -LiteralPath (Join-Path $Root "DeepSeek Harness Code.exe") -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $Root "resources") -PathType Container) -and
    (Test-Path -LiteralPath (Join-Path $Root "Uninstall DeepSeek Harness Code.exe") -PathType Leaf)
  )
}

function Test-DhscStrictDescendant {
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][string]$Parent
  )

  $canonicalRoot = Get-DhscCanonicalPath $Root
  $canonicalParent = (Get-DhscCanonicalPath $Parent).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
  $prefix = "$canonicalParent$([IO.Path]::DirectorySeparatorChar)"
  return $canonicalRoot.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)
}

function Get-DhscUninstallRegistryEntries {
  param([Parameter(Mandatory = $true)][string]$ExpectedDisplayName)

  $registryPaths = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKCU:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
  )
  return @(
    Get-ItemProperty -Path $registryPaths -ErrorAction SilentlyContinue |
      Where-Object { $_.DisplayName -eq $ExpectedDisplayName }
  )
}

function Get-DhscRootFromUninstallString {
  param([Parameter(Mandatory = $true)][string]$UninstallString)

  $uninstallerPath = $null
  if ($UninstallString -match '^\s*"([^"]+\\Uninstall DeepSeek Harness Code\.exe)"(?:\s.*)?$') {
    $uninstallerPath = $Matches[1]
  } elseif ($UninstallString -match '^\s*(.+\\Uninstall DeepSeek Harness Code\.exe)(?:\s.*)?$') {
    $uninstallerPath = $Matches[1]
  }
  if (
    [string]::IsNullOrWhiteSpace($uninstallerPath) -or
    [IO.Path]::GetFileName($uninstallerPath) -ne "Uninstall DeepSeek Harness Code.exe"
  ) {
    throw "registered uninstall command was not the exact app uninstaller"
  }
  return Get-DhscCanonicalPath (Split-Path -Parent $uninstallerPath)
}

function New-DhscInstalledApplication {
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][ValidateSet("custom", "registry")][string]$Source
  )

  $canonicalRoot = Get-DhscCanonicalPath $Root
  if (-not (Test-DhscDirectAppLayout $canonicalRoot)) {
    throw "installed application direct layout was incomplete"
  }
  return [pscustomobject]@{
    Root = $canonicalRoot
    Source = $Source
    Executable = Join-Path $canonicalRoot "DeepSeek Harness Code.exe"
    Resources = Join-Path $canonicalRoot "resources"
    Uninstaller = Join-Path $canonicalRoot "Uninstall DeepSeek Harness Code.exe"
  }
}

function Get-DhscAppLayoutsInsideRunnerBoundary {
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][string]$Boundary
  )

  Assert-DhscTreeHasNoReparsePoint -Root $Boundary
  $candidateRoots = @(
    $Root
    Get-ChildItem -LiteralPath $Root -Recurse -File -Force -Filter "DeepSeek Harness Code.exe" -ErrorAction Stop |
      ForEach-Object { $_.DirectoryName }
  ) | Sort-Object -Unique
  return @($candidateRoots | Where-Object { Test-DhscDirectAppLayout $_ })
}

function Resolve-DhscInstalledApplication {
  param(
    [Parameter(Mandatory = $true)][string]$CustomRoot,
    [Parameter(Mandatory = $true)][AllowEmptyCollection()][object[]]$RegistryEntries,
    [Parameter(Mandatory = $true)][string]$LocalAppData,
    [string]$ExpectedDisplayName = "DeepSeek Harness Code"
  )

  $canonicalCustomRoot = Get-DhscCanonicalPath $CustomRoot
  if (Test-DhscDirectAppLayout $canonicalCustomRoot) {
    return New-DhscInstalledApplication -Root $canonicalCustomRoot -Source "custom"
  }
  $installerAppendedRoot = Get-DhscCanonicalPath (Join-Path $canonicalCustomRoot "DeepSeek Harness Code")
  if (Test-DhscDirectAppLayout $installerAppendedRoot) {
    return New-DhscInstalledApplication -Root $installerAppendedRoot -Source "custom"
  }

  $matchingEntries = @(
    $RegistryEntries | Where-Object { $_.DisplayName -eq $ExpectedDisplayName }
  )
  if ($matchingEntries.Count -ne 1) {
    throw "expected exactly one app uninstall entry, found $($matchingEntries.Count)"
  }
  $entry = $matchingEntries[0]
  $registeredRoots = [Collections.Generic.List[string]]::new()
  if (-not [string]::IsNullOrWhiteSpace([string]$entry.InstallLocation)) {
    $registeredRoots.Add((Get-DhscCanonicalPath ([string]$entry.InstallLocation))) | Out-Null
  }
  if (-not [string]::IsNullOrWhiteSpace([string]$entry.UninstallString)) {
    $registeredRoots.Add((Get-DhscRootFromUninstallString ([string]$entry.UninstallString))) | Out-Null
  }
  $canonicalRegisteredRoots = @($registeredRoots | Sort-Object -Unique)
  if ($canonicalRegisteredRoots.Count -eq 0) {
    throw "registered install entry contained no usable roots"
  }

  $programsRoot = Get-DhscCanonicalPath (Join-Path $LocalAppData "Programs")
  $resolvedLayouts = [Collections.Generic.List[object]]::new()
  $outOfBoundsRoots = 0
  foreach ($canonicalRoot in $canonicalRegisteredRoots) {
    if (
      $canonicalRoot.Equals($canonicalCustomRoot, [StringComparison]::OrdinalIgnoreCase) -or
      (Test-DhscStrictDescendant -Root $canonicalRoot -Parent $canonicalCustomRoot)
    ) {
      foreach ($layout in @(Get-DhscAppLayoutsInsideRunnerBoundary -Root $canonicalRoot -Boundary $canonicalCustomRoot)) {
        $resolvedLayouts.Add([pscustomobject]@{ Root = $layout; Source = "custom" }) | Out-Null
      }
    } elseif (Test-DhscStrictDescendant -Root $canonicalRoot -Parent $programsRoot) {
      if (Test-DhscDirectAppLayout $canonicalRoot) {
        $resolvedLayouts.Add([pscustomobject]@{ Root = $canonicalRoot; Source = "registry" }) | Out-Null
      }
    } else {
      $outOfBoundsRoots += 1
    }
  }
  if ($outOfBoundsRoots -ne 0) {
    throw "registered install entry contained an out-of-bounds root"
  }
  $distinctLayouts = @($resolvedLayouts | Sort-Object -Property Root -Unique)
  if ($distinctLayouts.Count -ne 1) {
    throw "registered install entry resolved $($distinctLayouts.Count) complete app layouts from $($canonicalRegisteredRoots.Count) roots"
  }
  return New-DhscInstalledApplication -Root $distinctLayouts[0].Root -Source $distinctLayouts[0].Source
}

function New-DhscNodeMoveList {
  return ,([Collections.Generic.List[object]]::new())
}

function Hide-DhscNodeCandidates {
  param(
    [Parameter(Mandatory = $true)][AllowEmptyCollection()][string[]]$Candidates,
    [Parameter(Mandatory = $true)][AllowEmptyCollection()][Collections.Generic.List[object]]$Moves,
    [Parameter(Mandatory = $true)][string]$RunToken,
    [scriptblock]$MoveEntry = {
      param($From, $To)
      Move-Item -LiteralPath $From -Destination $To -ErrorAction Stop
    }
  )

  $safeToken = $RunToken -replace '[^A-Za-z0-9_-]', '_'
  $candidateIndex = 0
  foreach ($candidate in $Candidates) {
    $candidateIndex += 1
    $hidden = "$candidate.deepseek-smoke-$safeToken-$candidateIndex"
    if (Test-Path -LiteralPath $hidden) {
      throw "node quarantine destination already exists (candidate $candidateIndex)"
    }
    try {
      & $MoveEntry $candidate $hidden
      $Moves.Add([pscustomobject]@{
        Original = $candidate
        Hidden = $hidden
        Index = $candidateIndex
      }) | Out-Null
    } catch {
      throw "failed to quarantine Node candidate $candidateIndex"
    }
  }
}

function Restore-DhscNodeCandidates {
  param(
    [Parameter(Mandatory = $true)][AllowEmptyCollection()][Collections.Generic.List[object]]$Moves,
    [scriptblock]$MoveEntry = {
      param($From, $To)
      Move-Item -LiteralPath $From -Destination $To -ErrorAction Stop
    }
  )

  $restoreFailures = 0
  for ($index = $Moves.Count - 1; $index -ge 0; $index -= 1) {
    $move = $Moves[$index]
    try {
      if (-not (Test-Path -LiteralPath $move.Hidden -PathType Leaf)) {
        throw "hidden candidate missing"
      }
      if (Test-Path -LiteralPath $move.Original) {
        throw "original candidate already exists"
      }
      & $MoveEntry $move.Hidden $move.Original
      $Moves.RemoveAt($index)
    } catch {
      $restoreFailures += 1
    }
  }
  if ($restoreFailures -ne 0) {
    throw "node quarantine cleanup failed ($restoreFailures candidates)"
  }
}

function New-DhscCleanupFailureList {
  return ,([Collections.Generic.List[Exception]]::new())
}

function Add-DhscCaughtCleanupFailure {
  param(
    [Parameter(Mandatory = $true)][AllowEmptyCollection()][Collections.Generic.List[Exception]]$CleanupFailures,
    [Parameter(Mandatory = $true)][System.Management.Automation.ErrorRecord]$ErrorRecord
  )

  $CleanupFailures.Add($ErrorRecord.Exception) | Out-Null
}

function Add-DhscDirectCleanupFailure {
  param(
    [Parameter(Mandatory = $true)][AllowEmptyCollection()][Collections.Generic.List[Exception]]$CleanupFailures,
    [Parameter(Mandatory = $true)][string]$Message
  )

  $CleanupFailures.Add([Exception]::new($Message)) | Out-Null
}

function Complete-DhscPackageStep {
  param(
    [AllowNull()][Exception]$PrimaryFailure,
    [Parameter(Mandatory = $true)][AllowEmptyCollection()][Collections.Generic.List[Exception]]$CleanupFailures,
    [scriptblock]$ReportCleanup = {
      param($Message)
      Write-Host "::error::Cleanup failed: $Message"
    }
  )

  foreach ($cleanupFailure in $CleanupFailures) {
    & $ReportCleanup $cleanupFailure.Message
  }
  if ($null -ne $PrimaryFailure) { throw $PrimaryFailure }
  if ($CleanupFailures.Count -gt 0) { throw $CleanupFailures[0] }
}

function Assert-DhscTreeHasNoReparsePoint {
  param([Parameter(Mandatory = $true)][string]$Root)

  if (-not (Test-Path -LiteralPath $Root)) { return }
  $stack = [Collections.Generic.Stack[IO.DirectoryInfo]]::new()
  $stack.Push([IO.DirectoryInfo]::new($Root))
  while ($stack.Count -gt 0) {
    $directory = $stack.Pop()
    $directory.Refresh()
    if (($directory.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw "runner-owned custom root contained a reparse point"
    }
    try {
      $entries = $directory.EnumerateFileSystemInfos("*", [IO.SearchOption]::TopDirectoryOnly)
      foreach ($entry in $entries) {
        if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
          throw "runner-owned custom root contained a reparse point"
        }
        if (($entry.Attributes -band [IO.FileAttributes]::Directory) -ne 0) {
          $stack.Push([IO.DirectoryInfo]$entry)
        }
      }
    } catch {
      if ($_.Exception.Message -eq "runner-owned custom root contained a reparse point") {
        throw
      }
      throw "runner-owned custom root safety scan failed"
    }
  }
}

function Remove-DhscRunnerOwnedCustomRoot {
  param(
    [Parameter(Mandatory = $true)][string]$CustomRoot,
    [Parameter(Mandatory = $true)][string]$RunnerTemp
  )

  $canonicalRoot = Get-DhscCanonicalPath $CustomRoot
  if (-not (Test-DhscStrictDescendant -Root $canonicalRoot -Parent $RunnerTemp)) {
    throw "custom install root was outside runner temp"
  }
  if (Test-Path -LiteralPath $canonicalRoot) {
    Assert-DhscTreeHasNoReparsePoint -Root $canonicalRoot
    Remove-Item -LiteralPath $canonicalRoot -Recurse -Force -ErrorAction Stop
  }
  if (Test-Path -LiteralPath $canonicalRoot) {
    throw "runner-owned custom install root remained after cleanup"
  }
}

function Assert-DhscInstalledApplicationRemoved {
  param([Parameter(Mandatory = $true)]$Application)

  if (Test-Path -LiteralPath $Application.Root) {
    throw "registered install root remained after uninstall"
  }
}
