# Validate the entire archive before writing. Destination is a new, app-owned staging directory.
param([Parameter(Mandatory=$true)][string]$Archive,
      [Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = [IO.Path]::GetFullPath($Destination).TrimEnd('\') + '\'
if (-not (Test-Path -LiteralPath $root -PathType Container)) { throw 'Missing staging directory' }
if (Get-ChildItem -LiteralPath $root -Force) { throw 'Staging directory must be empty' }
$zip = [IO.Compression.ZipFile]::OpenRead($Archive)
try {
    $seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    [long]$total = 0
    foreach ($entry in $zip.Entries) {
        $name = $entry.FullName.Replace('\', '/')
        $parts = $name.TrimEnd('/').Split('/')
        if (-not $name -or $name.StartsWith('/') -or $name.Contains(':') -or
            ($parts | Where-Object { $_ -eq '..' -or $_ -eq '.' -or $_ -eq '' -or
                $_ -match '[. ]$|[<>"|?*\x00-\x1f]|^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(\.|$)' })) {
            throw "Unsafe archive path: $name"
        }
        $target = [IO.Path]::GetFullPath([IO.Path]::Combine($root, $name))
        if (-not $target.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -or
            -not $seen.Add($target.TrimEnd('\')) -or
            (($entry.ExternalAttributes -shr 16) -band 0xf000) -eq 0xa000 -or
            ($entry.ExternalAttributes -band 0x400) -ne 0) { throw "Unsafe archive entry: $name" }
        $total += $entry.Length
        if ($total -gt 4294967296 -or $seen.Count -gt 100000) { throw 'Archive exceeds installation limits' }
    }
    foreach ($entry in $zip.Entries) {
        $target = [IO.Path]::Combine($root, $entry.FullName)
        if ($entry.FullName.EndsWith('/')) {
            [IO.Directory]::CreateDirectory($target) | Out-Null
        } else {
            [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target)) | Out-Null
            [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $false)
        }
    }
} finally { $zip.Dispose() }
