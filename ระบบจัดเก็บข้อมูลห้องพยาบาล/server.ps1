param(
    [int]$Port = 8080
)

$path = $PSScriptRoot
if (-not $path) { $path = (Get-Location).Path }

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
    Write-Host "=======================================================" -ForegroundColor Cyan
    Write-Host "  เซิร์ฟเวอร์ระบบห้องพยาบาล โรงเรียนวิสุทธิกษัตรี กำลังทำงาน" -ForegroundColor Green
    Write-Host "  URL: $prefix" -ForegroundColor Yellow
    Write-Host "=======================================================" -ForegroundColor Cyan

    try {
        Start-Process $prefix
    } catch {}

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $localPath = [System.Uri]::UnescapeDataString($request.Url.LocalPath)
        if ($localPath -eq "/" -or $localPath -eq "") {
            $localPath = "/index.html"
        }

        $rel = $localPath.TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar)
        $filePath = Join-Path $path $rel

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = switch ($ext) {
                ".html" { "text/html; charset=utf-8" }
                ".htm"  { "text/html; charset=utf-8" }
                ".css"  { "text/css; charset=utf-8" }
                ".js"   { "application/javascript; charset=utf-8" }
                ".json" { "application/json; charset=utf-8" }
                ".jpg"  { "image/jpeg" }
                ".jpeg" { "image/jpeg" }
                ".png"  { "image/png" }
                ".svg"  { "image/svg+xml" }
                ".ico"  { "image/x-icon" }
                ".csv"  { "text/csv; charset=utf-8" }
                default { "application/octet-stream" }
            }

            $response.ContentType = $contentType
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.ContentLength64 = $msg.Length
            $response.OutputStream.Write($msg, 0, $msg.Length)
        }
        $response.OutputStream.Close()
    }
} catch {
    Write-Error $_.Exception.Message
} finally {
    $listener.Stop()
    $listener.Close()
}
