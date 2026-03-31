@echo off
cd /d C:\Users\Caldera\Claude\CRM-Croma
del do_commit.bat
del git-commit-all.bat
git add -A
git commit -m "chore: remove-temp-scripts"
git push origin main
del cleanup.bat
