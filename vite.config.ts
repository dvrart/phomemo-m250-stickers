import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const stickerStore = new Map<string, { buffer: Buffer; fileName: string }>();

// Pure ASCII path inside project root to avoid Windows Cyrillic username encoding issues in PowerShell
const SAFE_JOB_FILE = path.resolve('C:/Projects/olha/.m250_print_job.bin').replace(/\\/g, '/');

function phomemoM250BridgePlugin(): Plugin {
  return {
    name: 'phomemo-m250-bridge',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';

        // 0. Live Phomemo M250 status & battery check on COM9
        if (req.method === 'GET' && url.startsWith('/api/printer-status')) {
          const psStatus = `
$ErrorActionPreference = 'Stop'
$sp = New-Object System.IO.Ports.SerialPort 'COM9', 115200, 'None', 8, 'One'
$sp.WriteTimeout = 2500
$sp.ReadTimeout = 1500
try {
  $sp.Open()
  [byte[]]$q = @(0x1f, 0x11, 0x08, 0x1f, 0x11, 0x0e, 0x1f, 0x11, 0x07, 0x1f, 0x11, 0x09)
  $sp.Write($q, 0, $q.Length)
  Start-Sleep -Milliseconds 250
  $avail = $sp.BytesToRead
  if ($avail -gt 0) {
    $buf = New-Object byte[] $avail
    $sp.Read($buf, 0, $avail) | Out-Null
    Write-Output ("HEX=" + [BitConverter]::ToString($buf))
  } else {
    Write-Output "HEX=READY"
  }
} finally {
  if ($sp.IsOpen) { $sp.Close() }
}
`;
          execFile(
            'powershell.exe',
            ['-NoProfile', '-NonInteractive', '-Command', psStatus],
            { timeout: 6000 },
            (err, stdout) => {
              res.setHeader('Content-Type', 'application/json');
              if (err) {
                res.end(JSON.stringify({ ok: false, connected: false }));
                return;
              }
              const out = stdout.trim();
              let battery = 100;
              const m = out.match(/1A-04-([0-9A-F]{2})/i);
              if (m) {
                battery = Math.min(100, Math.max(0, parseInt(m[1], 16)));
              }
              res.end(
                JSON.stringify({
                  ok: true,
                  connected: true,
                  port: 'COM9',
                  model: 'Phomemo M250',
                  battery,
                })
              );
            }
          );
          return;
        }

        // 1. Serve stored PNG sticker images with real HTTP URLs for iPhone Safari/Yandex Browser
        if (req.method === 'GET' && url.startsWith('/api/sticker/')) {
          const parsed = new URL(url, 'http://localhost');
          const id = parsed.pathname.replace('/api/sticker/', '').replace(/\.png$/i, '');
          const item = stickerStore.get(id);
          if (!item) {
            res.statusCode = 404;
            res.end('Sticker not found');
            return;
          }
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Cache-Control', 'no-store');
          if (parsed.searchParams.get('download') === '1') {
            res.setHeader(
              'Content-Disposition',
              `attachment; filename="${encodeURIComponent(item.fileName)}"`
            );
          }
          res.end(item.buffer);
          return;
        }

        // 2. Store PNG image from client so iPhone over HTTP has a native <img> / download URL
        if (req.method === 'POST' && url === '/api/prepare-sticker') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const { dataUrl, fileName } = JSON.parse(body);
              const base64 = String(dataUrl).replace(/^data:image\/\w+;base64,/, '');
              const buffer = Buffer.from(base64, 'base64');
              const id = `stk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
              stickerStore.set(id, { buffer, fileName: fileName || 'sticker.png' });
              if (stickerStore.size > 30) {
                const oldestKey = stickerStore.keys().next().value;
                if (oldestKey) stickerStore.delete(oldestKey);
              }
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  ok: true,
                  id,
                  imageUrl: `/api/sticker/${id}.png`,
                  downloadUrl: `/api/sticker/${id}.png?download=1`,
                })
              );
            } catch (e) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: false, error: String(e) }));
            }
          });
          return;
        }

        // 3. Direct Bluetooth SPP printing to Phomemo M250 (paired as COM9 on Windows host)
        // Exact Wireshark-verified M220/M250 protocol:
        // - Header: 1B 4E 0D 05 (speed 5), 1B 4E 04 0C (density 12), 1F 11 0A (die-cut label with gaps)
        // - Single GS v 0: 1D 76 30 00 48 00 <yL> <yH> (widthBytes = 0x48 = 72 bytes = 576 dots)
        // - Footer: 1F F0 05 00 1F F0 03 00
        // - Keep RFCOMM socket open while printer physically prints (~5-7s) and drains status reply!
        if (req.method === 'POST' && url === '/api/print-m250') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const {
                rasterBase64,
                widthBytes = 50,
                heightLines = 240,
                copies = 1,
                protocolMode = 'm220-exact',
                port = 'COM9',
              } = JSON.parse(body);

              const rasterBuffer = Buffer.from(rasterBase64, 'base64');
              fs.writeFileSync(SAFE_JOB_FILE, rasterBuffer);

              const cleanPort = String(port).replace(/[^a-zA-Z0-9]/g, '') || 'COM9';
              const numCopies = Math.max(1, Math.min(20, Number(copies) || 1));
              const wB = Number(widthBytes) & 0xff;
              const hL = Number(heightLines) & 0xff;
              const hH = (Number(heightLines) >> 8) & 0xff;
              const isEscMode = protocolMode === 'm-series-esc';

              const psScript = `
$ErrorActionPreference = 'Stop'
$raster = [System.IO.File]::ReadAllBytes('${SAFE_JOB_FILE}')
$sp = New-Object System.IO.Ports.SerialPort '${cleanPort}', 115200, 'None', 8, 'One'
$sp.WriteTimeout = 10000
$sp.ReadTimeout = 2000
$sp.Open()
try {
  for ($c = 0; $c -lt ${numCopies}; $c++) {
    if ($${isEscMode ? 'true' : 'false'}) {
      [byte[]]$cmdInit = @(0x1b, 0x40)
      $sp.Write($cmdInit, 0, $cmdInit.Length)
      Start-Sleep -Milliseconds 80
      [byte[]]$cmdHeat = @(0x1b, 0x37, 7, 140, 2, 0x1d, 0x7c, 6)
      $sp.Write($cmdHeat, 0, $cmdHeat.Length)
      Start-Sleep -Milliseconds 40
    } else {
      [byte[]]$cmdSetup = @(0x1b, 0x4e, 0x0d, 0x05, 0x1b, 0x4e, 0x04, 0x0c, 0x1f, 0x11, 0x0a)
      $sp.Write($cmdSetup, 0, $cmdSetup.Length)
      Start-Sleep -Milliseconds 40
    }

    [byte[]]$cmdHeader = @(0x1d, 0x76, 0x30, 0x00, ${wB}, 0x00, ${hL}, ${hH})
    $sp.Write($cmdHeader, 0, $cmdHeader.Length)

    $chunkSize = 256
    for ($i = 0; $i -lt $raster.Length; $i += $chunkSize) {
      $len = [Math]::Min($chunkSize, $raster.Length - $i)
      $sp.Write($raster, $i, $len)
      Start-Sleep -Milliseconds 15
    }

    if ($${isEscMode ? 'true' : 'false'}) {
      [byte[]]$cmdFooter = @(0x1b, 0x4a, 32)
    } else {
      [byte[]]$cmdFooter = @(0x1f, 0xf0, 0x05, 0x00, 0x1f, 0xf0, 0x03, 0x00)
    }
    $sp.Write($cmdFooter, 0, $cmdFooter.Length)
    $sp.BaseStream.Flush()

    $waitLoops = 28
    for ($w = 0; $w -lt $waitLoops; $w++) {
      Start-Sleep -Milliseconds 200
      $avail = $sp.BytesToRead
      if ($avail -gt 0) {
        $rx = New-Object byte[] $avail
        $sp.Read($rx, 0, $avail) | Out-Null
        $hex = [BitConverter]::ToString($rx)
        Write-Output "RX=$hex"
        if ($w -ge 12) { break }
      }
    }
  }
  Write-Output "PRINT_OK"
} finally {
  if ($sp.IsOpen) { $sp.Close() }
}
`;

              execFile(
                'powershell.exe',
                ['-NoProfile', '-NonInteractive', '-Command', psScript],
                { timeout: 45000 },
                (err, stdout, stderr) => {
                  try {
                    if (fs.existsSync(SAFE_JOB_FILE)) {
                      fs.unlinkSync(SAFE_JOB_FILE);
                    }
                  } catch {
                    // ignore cleanup error
                  }

                  res.setHeader('Content-Type', 'application/json');
                  if (err) {
                    res.statusCode = 500;
                    res.end(
                      JSON.stringify({
                        ok: false,
                        error:
                          stderr?.trim() ||
                          err.message ||
                          'Не удалось отправить данные на Phomemo M250 (COM9). Проверьте, включён ли принтер.',
                      })
                    );
                    return;
                  }
                  res.end(
                    JSON.stringify({
                      ok: true,
                      port: cleanPort,
                      output: stdout.trim(),
                    })
                  );
                }
              );
            } catch (e) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: false, error: String(e) }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), phomemoM250BridgePlugin()],
  server: {
    host: true,
    port: 5173,
  },
});
