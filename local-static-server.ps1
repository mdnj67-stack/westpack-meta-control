$root = $PSScriptRoot
$port = 4173

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://127.0.0.1:$port/")
$listener.Start()

Write-Host "Local static server running at http://127.0.0.1:$port/"

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".js" = "application/javascript; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".svg" = "image/svg+xml"
}

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $relativePath = $context.Request.Url.AbsolutePath.TrimStart("/")
    if ([string]::IsNullOrWhiteSpace($relativePath)) {
      $relativePath = "index.html"
    }

    $resolvedPath = [System.IO.Path]::GetFullPath((Join-Path $root $relativePath))
    if (-not $resolvedPath.StartsWith([System.IO.Path]::GetFullPath($root))) {
      $context.Response.StatusCode = 403
      $context.Response.Close()
      continue
    }

    if (-not [System.IO.File]::Exists($resolvedPath)) {
      $context.Response.StatusCode = 404
      $context.Response.Close()
      continue
    }

    $bytes = [System.IO.File]::ReadAllBytes($resolvedPath)
    $extension = [System.IO.Path]::GetExtension($resolvedPath).ToLowerInvariant()
    $context.Response.ContentType = if ($mime.ContainsKey($extension)) { $mime[$extension] } else { "application/octet-stream" }
    $context.Response.ContentLength64 = $bytes.Length
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $context.Response.OutputStream.Close()
  }
}
finally {
  $listener.Stop()
  $listener.Close()
}
