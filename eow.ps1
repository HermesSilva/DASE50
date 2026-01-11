"End of Work |" + (Get-Date -Format "yyyy-MM-dd HH:mm:ss") | Add-Content -Path "work-mark.txt"

git pull
git add .
git commit -m "End of Work "
git push
