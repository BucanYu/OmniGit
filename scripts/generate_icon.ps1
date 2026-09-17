Add-Type -AssemblyName System.Drawing

$buildDir = "$PSScriptRoot\..\app\build"
if (!(Test-Path $buildDir)) {
    New-Item -ItemType Directory -Path $buildDir -Force | Out-Null
}

$sizes = @(256, 64, 48, 32, 16)
$bitmaps = @()

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    $scale = $size / 32.0

    # Draw rounded background
    $rectX = [int](2 * $scale)
    $rectY = [int](2 * $scale)
    $rectW = [int](28 * $scale)
    $rectH = [int](28 * $scale)
    $radius = [int](6 * $scale)

    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($rectX, $rectY, $radius, $radius, 180, 90)
    $path.AddArc($rectX + $rectW - $radius, $rectY, $radius, $radius, 270, 90)
    $path.AddArc($rectX + $rectW - $radius, $rectY + $rectH - $radius, $radius, $radius, 0, 90)
    $path.AddArc($rectX, $rectY + $rectH - $radius, $radius, $radius, 90, 90)
    $path.CloseFigure()

    # Fill background
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 18, 19, 22))
    $g.FillPath($bgBrush, $path)

    # Border gradient
    $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 99, 102, 241), [Math]::Max(1.0, 1.6 * $scale))
    $g.DrawPath($borderPen, $path)

    # Git branch vertical lines
    $linePen1 = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 99, 102, 241), [Math]::Max(1.0, 2.2 * $scale))
    $linePen2 = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 56, 189, 248), [Math]::Max(1.0, 2.2 * $scale))

    $g.DrawLine($linePen1, [float](10 * $scale), [float](8.5 * $scale), [float](10 * $scale), [float](23.5 * $scale))
    $g.DrawLine($linePen2, [float](20 * $scale), [float](9.0 * $scale), [float](20 * $scale), [float](23.0 * $scale))

    # Curved connecting branch
    $curvePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 139, 92, 246), [Math]::Max(1.0, 2.0 * $scale))
    $g.DrawBezier($curvePen, [float](10 * $scale), [float](13.5 * $scale), [float](13 * $scale), [float](9.0 * $scale), [float](17 * $scale), [float](9.0 * $scale), [float](20 * $scale), [float](9.0 * $scale))
    $g.DrawBezier($curvePen, [float](20 * $scale), [float](18.5 * $scale), [float](17 * $scale), [float](23.0 * $scale), [float](13 * $scale), [float](23.0 * $scale), [float](10 * $scale), [float](23.0 * $scale))

    # Commit nodes (Circles)
    $nodes = @(
        @{ X = 10; Y = 8.5; Color = [System.Drawing.Color]::FromArgb(255, 129, 140, 248) },
        @{ X = 10; Y = 23.5; Color = [System.Drawing.Color]::FromArgb(255, 6, 182, 212) },
        @{ X = 20; Y = 9.0; Color = [System.Drawing.Color]::FromArgb(255, 56, 189, 248) },
        @{ X = 20; Y = 23.0; Color = [System.Drawing.Color]::FromArgb(255, 168, 85, 247) }
    )

    $r = 2.8 * $scale
    foreach ($node in $nodes) {
        $nx = ($node.X * $scale) - $r
        $ny = ($node.Y * $scale) - $r
        $d = $r * 2

        $fillBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 18, 19, 22))
        $g.FillEllipse($fillBrush, [float]$nx, [float]$ny, [float]$d, [float]$d)

        $strokePen = New-Object System.Drawing.Pen($node.Color, [Math]::Max(1.0, 1.8 * $scale))
        $g.DrawEllipse($strokePen, [float]$nx, [float]$ny, [float]$d, [float]$d)

        # Center pulse
        $cr = 1.2 * $scale
        $cx = ($node.X * $scale) - $cr
        $cy = ($node.Y * $scale) - $cr
        $cd = $cr * 2
        $coreBrush = New-Object System.Drawing.SolidBrush($node.Color)
        $g.FillEllipse($coreBrush, [float]$cx, [float]$cy, [float]$cd, [float]$cd)
    }

    $g.Dispose()
    $bitmaps += $bmp
}

# Save 256x256 PNG as well for installer banners
$bitmaps[0].Save("$buildDir\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)

# Build multi-resolution ICO file
$icoStream = New-Object System.IO.FileStream("$buildDir\icon.ico", [System.IO.FileMode]::Create)
$writer = New-Object System.IO.BinaryWriter($icoStream)

# ICO Header
$writer.Write([uint16]0) # Reserved
$writer.Write([uint16]1) # Type: ICO
$writer.Write([uint16]$bitmaps.Count) # Count of images

$offset = 6 + ($bitmaps.Count * 16)
$pngBuffers = @()

foreach ($bmp in $bitmaps) {
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bytes = $ms.ToArray()
    $pngBuffers += ,$bytes
    $ms.Dispose()

    $w = if ($bmp.Width -ge 256) { 0 } else { [byte]$bmp.Width }
    $h = if ($bmp.Height -ge 256) { 0 } else { [byte]$bmp.Height }

    $writer.Write([byte]$w)
    $writer.Write([byte]$h)
    $writer.Write([byte]0) # Color palette count
    $writer.Write([byte]0) # Reserved
    $writer.Write([uint16]1) # Color planes
    $writer.Write([uint16]32) # Bits per pixel
    $writer.Write([uint32]$bytes.Length) # Image size in bytes
    $writer.Write([uint32]$offset) # Offset to image data

    $offset += $bytes.Length
}

foreach ($bytes in $pngBuffers) {
    $writer.Write($bytes)
}

$writer.Flush()
$icoStream.Close()

foreach ($bmp in $bitmaps) {
    $bmp.Dispose()
}

Write-Host "[SUCCESS] Generated multi-resolution icon at: $buildDir\icon.ico and $buildDir\icon.png" -ForegroundColor Green
