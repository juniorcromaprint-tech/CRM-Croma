# Descarta arquivos bloqueantes, checkout main, cherry-pick 16525c2, push
$ErrorActionPreference = 'Continue'
$repo = 'C:\Users\Caldera\Claude\CRM-Croma'
$git = 'C:\Program Files\Git\cmd\git.exe'
$lock = Join-Path $repo '.git\index.lock'
$logDir = Join-Path $repo '.claude'

function Run-Git {
    param([string[]]$gitArgs, [string]$label)
    $outFile = Join-Path $logDir "step-$label-out.txt"
    $errFile = Join-Path $logDir "step-$label-err.txt"
    Write-Host "[$label] git $($gitArgs -join ' ')"
    $proc = Start-Process -FilePath $git -ArgumentList $gitArgs -WorkingDirectory $repo -NoNewWindow -Wait -PassThru -RedirectStandardOutput $outFile -RedirectStandardError $errFile
    $out = Get-Content $outFile -Raw -ErrorAction SilentlyContinue
    $err = Get-Content $errFile -Raw -ErrorAction SilentlyContinue
    if ($out) { Write-Host "STDOUT: $out" }
    if ($err) { Write-Host "STDERR: $err" }
    Write-Host "[$label] ExitCode=$($proc.ExitCode)"
    return $proc.ExitCode
}

function Clear-Lock {
    if (Test-Path $lock) {
        for ($i = 0; $i -lt 10; $i++) {
            try { Remove-Item $lock -Force -ErrorAction Stop; break } catch { Start-Sleep -Milliseconds 200 }
        }
    }
}

# 1) Descartar os 2 arquivos bloqueantes (build artifacts do mcp-server)
Clear-Lock
Run-Git -gitArgs @('checkout','--','mcp-server/dist/tools/financeiro.js','mcp-server/src/tools/financeiro.ts') -label 'discard-blockers'

# 2) Checkout main
Clear-Lock
$rc = Run-Git -gitArgs @('checkout','main') -label 'checkout-main'
if ($rc -ne 0) { Write-Host "Checkout main falhou"; exit 1 }

# 3) Pull main
Clear-Lock
$rc = Run-Git -gitArgs @('pull','origin','main') -label 'pull-main'
if ($rc -ne 0) { Write-Host "Pull main falhou"; exit 2 }

# 4) Cherry-pick o commit do PDF (16525c2)
Clear-Lock
$rc = Run-Git -gitArgs @('cherry-pick','16525c2') -label 'cherry-pick'
if ($rc -ne 0) {
    Write-Host "Cherry-pick falhou - abortando"
    Run-Git -gitArgs @('cherry-pick','--abort') -label 'abort'
    exit 3
}

# 5) Push main
Clear-Lock
$rc = Run-Git -gitArgs @('push','origin','main') -label 'push-main'
if ($rc -ne 0) { Write-Host "Push main falhou"; exit 4 }

# 6) Log final
Clear-Lock
Run-Git -gitArgs @('log','--oneline','-3') -label 'final'

Write-Host 'DEPLOY_MAIN_OK'
