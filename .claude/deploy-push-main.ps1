# Push direto do commit para main sem trocar working tree
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

# Fetch remote main
Clear-Lock
Run-Git -gitArgs @('fetch','origin','main') -label 'fetch'

# Ver quantos commits local fix/date-parse-timezone esta a frente de origin/main
Clear-Lock
Run-Git -gitArgs @('log','--oneline','origin/main..16525c2') -label 'ahead'

# Ver quantos commits origin/main tem que nao estao em 16525c2 (se >0 precisa force push)
Clear-Lock
Run-Git -gitArgs @('log','--oneline','16525c2..origin/main') -label 'behind'

# Ver se e fast-forward
Clear-Lock
Run-Git -gitArgs @('merge-base','--is-ancestor','origin/main','16525c2') -label 'is-ancestor'
$isFF = ($LASTEXITCODE -eq 0)

# Push usando refspec local-commit:remote-branch
Clear-Lock
$rc = Run-Git -gitArgs @('push','origin','16525c2:main') -label 'push-commit-to-main'
if ($rc -ne 0) {
    Write-Host "Push direto falhou - pode ser non-fast-forward. Verifique logs."
    exit 1
}

Clear-Lock
Run-Git -gitArgs @('log','--oneline','origin/main','-5') -label 'final'

Write-Host 'PUSH_MAIN_OK'
