# Automatic setup for Generative Studio on Windows 10/11.
# No administrator access required: Node.js is installed locally under .tools/node.
[CmdletBinding()]
param(
    [string] $ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Get-NodeVersion {
    param([string] $Executable)
    if (-not $Executable -or -not (Test-Path -LiteralPath $Executable -PathType Leaf)) { return $null }
    try {
        $value = & $Executable -p 'process.versions.node' 2>$null
        if ($LASTEXITCODE -ne 0) { return $null }
        return [version]($value | Select-Object -First 1)
    } catch {
        return $null
    }
}

function Get-UsableNode {
    param([string] $LocalDir)
    $localExe = Join-Path $LocalDir 'node.exe'
    $localNpm = Join-Path $LocalDir 'npm.cmd'
    $localVersion = Get-NodeVersion -Executable $localExe
    if ($localVersion -and $localVersion.Major -ge 20 -and (Test-Path $localNpm)) {
        Write-Host "Using local Node.js $localVersion"
        return $localExe
    }

    $systemNode = Get-Command 'node.exe' -ErrorAction SilentlyContinue
    $systemNpm = Get-Command 'npm.cmd' -ErrorAction SilentlyContinue
    if ($systemNode -and $systemNpm) {
        $systemVersion = Get-NodeVersion -Executable $systemNode.Source
        if ($systemVersion -and $systemVersion.Major -ge 20) {
            Write-Host "Using installed Node.js $systemVersion"
            return $systemNode.Source
        }
    }
    return $null
}

function Install-LocalNode {
    param([string] $ToolsDir, [string] $NodeDir)
    # Current supported LTS line, rather than the newest non-LTS release.
    $releaseBase = 'https://nodejs.org/dist/latest-v24.x'
    $arch = 'x64'
    if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') {
        $arch = 'arm64'
    } elseif ($env:PROCESSOR_ARCHITECTURE -eq 'x86' -and $env:PROCESSOR_ARCHITEW6432 -ne 'AMD64') {
        throw 'A 64-bit Windows system is required (x64 or arm64).'
    }

    Write-Host '[1/3] Node.js 20+ not found. Downloading portable Node.js 24 LTS from nodejs.org...'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $shaUrl = "$releaseBase/SHASUMS256.txt"
    $checksums = (Invoke-WebRequest -Uri $shaUrl -UseBasicParsing -TimeoutSec 90).Content
    $pattern = "(?m)^(?<hash>[0-9a-fA-F]{64})\s+node-(?<version>v24\.\d+\.\d+)-win-$arch\.zip\s*$"
    $match = [regex]::Match([string]$checksums, $pattern)
    if (-not $match.Success) { throw "Cannot find a Windows $arch Node.js ZIP in $shaUrl" }
    $versionName = $match.Groups['version'].Value
    $filename = "node-$versionName-win-$arch.zip"
    $expectedHash = $match.Groups['hash'].Value.ToLowerInvariant()
    $tempDir = Join-Path $ToolsDir (".node-download-" + $PID)

    if (Test-Path -LiteralPath $tempDir) { Remove-Item -LiteralPath $tempDir -Recurse -Force }
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    try {
        $archive = Join-Path $tempDir $filename
        $url = "https://nodejs.org/dist/$versionName/$filename"
        Write-Host "Downloading $filename..."
        Invoke-WebRequest -Uri $url -OutFile $archive -UseBasicParsing -TimeoutSec 300
        $actualHash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actualHash -ne $expectedHash) { throw 'Node.js ZIP SHA-256 verification failed. The archive will not be used.' }

        Write-Host 'Checksum OK; extracting Node.js...'
        $extractDir = Join-Path $tempDir 'unpacked'
        Expand-Archive -LiteralPath $archive -DestinationPath $extractDir -Force
        $extractedNodeDir = Join-Path $extractDir ("node-$versionName-win-$arch")
        if (-not (Test-Path -LiteralPath (Join-Path $extractedNodeDir 'node.exe'))) {
            throw 'node.exe was not found in the extracted official archive.'
        }
        if (-not (Test-Path -LiteralPath (Join-Path $extractedNodeDir 'npm.cmd'))) {
            throw 'npm.cmd was not found in the extracted official archive.'
        }
        if (Test-Path -LiteralPath $NodeDir) { Remove-Item -LiteralPath $NodeDir -Recurse -Force }
        Move-Item -LiteralPath $extractedNodeDir -Destination $NodeDir
        Write-Host "Node.js $versionName installed locally in $NodeDir"
    } finally {
        if (Test-Path -LiteralPath $tempDir) {
            Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

function Get-DependencyStamp {
    param([string] $Root, [int] $NodeMajor)
    $packagePath = Join-Path $Root 'package.json'
    $lockPath = Join-Path $Root 'package-lock.json'
    if (-not (Test-Path -LiteralPath $packagePath)) { throw 'package.json is missing.' }
    $packageHash = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash
    $lockHash = 'NO-LOCKFILE'
    if (Test-Path -LiteralPath $lockPath) {
        $lockHash = (Get-FileHash -LiteralPath $lockPath -Algorithm SHA256).Hash
    }
    return ('node{0}:{1}:{2}' -f $NodeMajor, $packageHash, $lockHash)
}

try {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
    Set-Location -LiteralPath $ProjectRoot
    $toolsDir = Join-Path $ProjectRoot '.tools'
    $nodeDir = Join-Path $toolsDir 'node'
    New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null

    $node = Get-UsableNode -LocalDir $nodeDir
    if (-not $node) {
        Install-LocalNode -ToolsDir $toolsDir -NodeDir $nodeDir
        $node = Join-Path $nodeDir 'node.exe'
    }
    $nodeVersion = Get-NodeVersion -Executable $node
    if (-not $nodeVersion -or $nodeVersion.Major -lt 20) {
        throw 'Node.js installation failed. Node.js 20 or newer is required.'
    }
    $nodeBin = Split-Path -Parent $node
    $env:PATH = "$nodeBin;$env:PATH"
    $npm = Join-Path $nodeBin 'npm.cmd'
    if (-not (Test-Path -LiteralPath $npm)) {
        $npmCommand = Get-Command 'npm.cmd' -ErrorAction SilentlyContinue
        if (-not $npmCommand) { throw 'npm.cmd not found after Node.js setup.' }
        $npm = $npmCommand.Source
    }

    $stampPath = Join-Path $toolsDir 'dependencies.stamp'
    $expectedStamp = Get-DependencyStamp -Root $ProjectRoot -NodeMajor $nodeVersion.Major
    $viteCommand = Join-Path $ProjectRoot 'node_modules\.bin\vite.cmd'
    $dependenciesReady = (Test-Path -LiteralPath $viteCommand) -and (Test-Path -LiteralPath $stampPath)
    if ($dependenciesReady) {
        $dependenciesReady = ((Get-Content -LiteralPath $stampPath -Raw).Trim() -eq $expectedStamp)
    }
    if (-not $dependenciesReady) {
        Write-Host '[2/3] Installing all project npm dependencies. This needs Internet access on the first run...'
        $lockPath = Join-Path $ProjectRoot 'package-lock.json'
        if (Test-Path -LiteralPath $lockPath) {
            & $npm ci --include=dev --no-audit --no-fund
        } else {
            & $npm install --include=dev --no-audit --no-fund
        }
        if ($LASTEXITCODE -ne 0) { throw "npm dependency installation failed (exit code $LASTEXITCODE). Check network access and npm logs." }
        if (-not (Test-Path -LiteralPath $viteCommand)) { throw 'Vite was not installed by npm.' }
        $expectedStamp = Get-DependencyStamp -Root $ProjectRoot -NodeMajor $nodeVersion.Major
        [System.IO.File]::WriteAllText($stampPath, $expectedStamp, [System.Text.Encoding]::ASCII)
        Write-Host 'Dependencies installed successfully.'
    } else {
        Write-Host '[2/3] npm dependencies already installed; skipping download.'
    }

    Write-Host '[3/3] Starting Generative Studio...'
    Write-Host 'Open http://127.0.0.1:5176/ in your browser. Press Ctrl+C to stop the server.'
    & $npm run dev
    if ($LASTEXITCODE -ne 0) { throw "Vite failed to start (exit code $LASTEXITCODE)." }
    exit 0
} catch {
    Write-Host ''
    Write-Host ('ERROR: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host 'If automatic download fails, check your Internet connection and access to nodejs.org / registry.npmjs.org.'
    exit 1
}
