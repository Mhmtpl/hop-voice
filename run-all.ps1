# Servisleri ve API Gateway'i ayrı PowerShell pencerelerinde başlatır
Write-Host "Sistem başlatılıyor..." -ForegroundColor Green

Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'ProductService Başlatılıyor...' -ForegroundColor Yellow; dotnet run --project src/Services/ProductService"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'OrderService Başlatılıyor...' -ForegroundColor Yellow; dotnet run --project src/Services/OrderService"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'YarpApiGateway Başlatılıyor...' -ForegroundColor Yellow; dotnet run --project src/Gateways/YarpApiGateway"

Write-Host "Sistem arka planda açıldı! Test etmeye hazırsın." -ForegroundColor Green
Write-Host "API Gateway (YARP): http://localhost:5000" -ForegroundColor Magenta
Write-Host "ProductService (Internal): http://localhost:5093" -ForegroundColor Cyan
Write-Host "OrderService (Internal): http://localhost:5249" -ForegroundColor Cyan
