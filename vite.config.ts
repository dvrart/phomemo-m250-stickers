import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { ChildProcess, execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import querystring from 'node:querystring';

const stickerStore = new Map<string, { buffer: Buffer; fileName: string }>();

// Pure ASCII path inside project root to avoid Windows Cyrillic username encoding issues in PowerShell
const SAFE_JOB_FILE = path.resolve('C:/Projects/olha/.m250_print_job.bin').replace(/\\/g, '/');
const CLOUDFLARED_BIN = path.resolve('C:/Projects/olha/cloudflared.exe').replace(/\\/g, '/');

let currentTunnelUrl = '';
let tunnelProc: ChildProcess | null = null;
let isRestartingTunnel = false;

function publishTunnelUrlToGithub(tunnelUrl: string) {
  const payload = JSON.stringify({
    url: tunnelUrl,
    localUrl: 'http://192.168.18.7:5173',
    updatedAt: new Date().toISOString(),
  });
  const base64Content = Buffer.from(payload, 'utf8').toString('base64');

  // Check if bridge.json already exists on gh-pages to get its sha
  execFile(
    'gh',
    ['api', 'repos/dvrart/phomemo-m250-stickers/contents/bridge.json?ref=gh-pages', '--jq', '.sha'],
    { timeout: 10000 },
    (err, stdout) => {
      const sha = !err && stdout ? stdout.trim() : '';
      const args = [
        'api',
        '-X',
        'PUT',
        'repos/dvrart/phomemo-m250-stickers/contents/bridge.json',
        '-f',
        'message=Update live M250 HTTPS bridge URL',
        '-f',
        'branch=gh-pages',
        '-f',
        `content=${base64Content}`,
      ];
      if (sha && !sha.includes('Not Found')) {
        args.push('-f', `sha=${sha}`);
      }
      execFile('gh', args, { timeout: 15000 }, (putErr) => {
        if (!putErr) {
          console.log(`[M250 Bridge] Published live HTTPS bridge URL to GitHub: ${tunnelUrl}`);
        }
      });
    }
  );
}

function startAutoHealingCloudflareTunnel() {
  if (!fs.existsSync(CLOUDFLARED_BIN) || isRestartingTunnel) return;
  isRestartingTunnel = true;

  if (tunnelProc) {
    try {
      tunnelProc.kill();
    } catch {
      // ignore
    }
    tunnelProc = null;
  }

  setTimeout(() => {
    isRestartingTunnel = false;
    const proc = spawn(CLOUDFLARED_BIN, ['tunnel', '--url', 'http://localhost:5173'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    tunnelProc = proc;

    const handleLog = (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
      if (match && match[0] !== currentTunnelUrl) {
        currentTunnelUrl = match[0];
        console.log(`[M250 Bridge] Active Cloudflare HTTPS Tunnel: ${currentTunnelUrl}`);
        publishTunnelUrlToGithub(currentTunnelUrl);
      }
      // If PC woke from sleep and Quick Tunnel expired, automatically restart it!
      if (text.includes('Unauthorized: Tunnel not found')) {
        console.log('[M250 Bridge] Tunnel expired after sleep, restarting cloudflared...');
        startAutoHealingCloudflareTunnel();
      }
    };

    proc.stdout?.on('data', handleLog);
    proc.stderr?.on('data', handleLog);
    proc.on('exit', () => {
      if (!isRestartingTunnel) {
        setTimeout(() => startAutoHealingCloudflareTunnel(), 3000);
      }
    });
  }, 800);
}

function executeM250SerialPrint(
  rasterBuffer: Buffer,
  widthBytes: number,
  heightLines: number,
  copies: number,
  protocolMode: string,
  port: string,
  cb: (err: Error | null, stdout: string, stderr: string) => void
) {
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
      # Phomemo M250 verified m-series sequence: ESC @, ESC 7, GS |, GS v 0 (72 bytes), ESC J
      [byte[]]$cmdInit = @(0x1b, 0x40)
      $sp.Write($cmdInit, 0, $cmdInit.Length)
      Start-Sleep -Milliseconds 100

      [byte[]]$cmdHeat = @(0x1b, 0x37, 7, 140, 2)
      $sp.Write($cmdHeat, 0, $cmdHeat.Length)
      Start-Sleep -Milliseconds 30

      [byte[]]$cmdDensity = @(0x1d, 0x7c, 6)
      $sp.Write($cmdDensity, 0, $cmdDensity.Length)
      Start-Sleep -Milliseconds 50
    } else {
      [byte[]]$cmdSetup = @(0x1b, 0x4e, 0x0d, 0x05, 0x1b, 0x4e, 0x04, 0x0c, 0x1f, 0x11, 0x0a)
      $sp.Write($cmdSetup, 0, $cmdSetup.Length)
      Start-Sleep -Milliseconds 40
    }

    [byte[]]$cmdHeader = @(0x1d, 0x76, 0x30, 0x00, ${wB}, 0x00, ${hL}, ${hH})
    $sp.Write($cmdHeader, 0, $cmdHeader.Length)

    $chunkSize = 128
    for ($i = 0; $i -lt $raster.Length; $i += $chunkSize) {
      $len = [Math]::Min($chunkSize, $raster.Length - $i)
      $sp.Write($raster, $i, $len)
      Start-Sleep -Milliseconds 18
    }
    $sp.BaseStream.Flush()

    Start-Sleep -Milliseconds 300
    if ($${isEscMode ? 'true' : 'false'}) {
      [byte[]]$cmdFooter = @(0x1b, 0x4a, 48)
    } else {
      [byte[]]$cmdFooter = @(0x1f, 0xf0, 0x05, 0x00, 0x1f, 0xf0, 0x03, 0x00)
    }
    $sp.Write($cmdFooter, 0, $cmdFooter.Length)
    $sp.BaseStream.Flush()

    # Hold Bluetooth RFCOMM connection open for ~5.5 seconds while printer finishes physical printing
    $waitLoops = 28
    for ($w = 0; $w -lt $waitLoops; $w++) {
      Start-Sleep -Milliseconds 200
      $avail = $sp.BytesToRead
      if ($avail -gt 0) {
        $rx = New-Object byte[] $avail
        $sp.Read($rx, 0, $avail) | Out-Null
        $hex = [BitConverter]::ToString($rx)
        Write-Output "RX=$hex"
        if ($w -ge 15) { break }
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
        // ignore
      }
      cb(err, stdout, stderr);
    }
  );
}

function phomemoM250BridgePlugin(): Plugin {
  return {
    name: 'phomemo-m250-bridge',
    configureServer(server) {
      startAutoHealingCloudflareTunnel();

      server.middlewares.use((req, res, next) => {
        const url = req.url || '';

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Allow-Private-Network', 'true');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

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
                res.end(
                  JSON.stringify({ ok: false, connected: false, tunnelUrl: currentTunnelUrl })
                );
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
                  tunnelUrl: currentTunnelUrl,
                })
              );
            }
          );
          return;
        }

        // 1. Serve stored PNG sticker images
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

        // 2. Store PNG image from client
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

        // 3. JSON POST to /api/print-m250
        if (req.method === 'POST' && url === '/api/print-m250') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const {
                rasterBase64,
                widthBytes = 72,
                heightLines = 240,
                copies = 1,
                protocolMode = 'm-series-esc',
                port = 'COM9',
              } = JSON.parse(body);

              const rasterBuffer = Buffer.from(rasterBase64, 'base64');
              executeM250SerialPrint(
                rasterBuffer,
                Number(widthBytes),
                Number(heightLines),
                Number(copies),
                protocolMode,
                port,
                (err, stdout, stderr) => {
                  res.setHeader('Content-Type', 'application/json');
                  if (err) {
                    res.statusCode = 500;
                    res.end(
                      JSON.stringify({
                        ok: false,
                        error:
                          stderr?.trim() ||
                          err.message ||
                          'Не удалось отправить данные на Phomemo M250 (COM9).',
                      })
                    );
                    return;
                  }
                  res.end(JSON.stringify({ ok: true, output: stdout.trim() }));
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

        // 4. Form POST to /api/print-m250-form (works over local Wi-Fi http://192.168.18.7:5173 from any browser!)
        if (req.method === 'POST' && url === '/api/print-m250-form') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const parsed = querystring.parse(body);
              const rasterBase64 = String(parsed.rasterBase64 || '');
              const widthBytes = Number(parsed.widthBytes || 72);
              const heightLines = Number(parsed.heightLines || 240);
              const copies = Number(parsed.copies || 1);
              const protocolMode = String(parsed.protocolMode || 'm-series-esc');
              const returnUrl = String(parsed.returnUrl || 'http://192.168.18.7:5173/');

              const rasterBuffer = Buffer.from(rasterBase64, 'base64');
              executeM250SerialPrint(
                rasterBuffer,
                widthBytes,
                heightLines,
                copies,
                protocolMode,
                'COM9',
                (err) => {
                  res.setHeader('Content-Type', 'text/html; charset=utf-8');
                  const statusTitle = err
                    ? 'Ошибка связи с принтером COM9'
                    : 'Напечатано на Phomemo M250!';
                  res.end(`<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${statusTitle}</title>
  <style>
    body { font-family: -apple-system, sans-serif; background: #0f172a; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; text-align: center; }
    .card { background: #1e293b; padding: 28px; border-radius: 24px; max-width: 360px; width: 100%; }
    .btn { display: inline-block; margin-top: 18px; padding: 12px 24px; background: #f59e0b; color: #0f172a; font-weight: 800; border-radius: 14px; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <h2>${statusTitle}</h2>
    <p>Возвращаемся в студию стикеров...</p>
    <a class="btn" href="${returnUrl}">Вернуться назад</a>
  </div>
  <script>setTimeout(function(){ window.location.href = ${JSON.stringify(returnUrl)}; }, 1200);</script>
</body>
</html>`);
                }
              );
            } catch (e) {
              res.statusCode = 400;
              res.end(String(e));
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
    allowedHosts: true,
  },
});
