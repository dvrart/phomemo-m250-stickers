import { DOTS_PER_MM } from '../data/labelSizes';
import { FrameStyle, LabelSizePreset, StickerElement } from '../types/sticker';
import { renderStickerToCanvas } from './thermalCanvasRenderer';

export const M250_HEAD_WIDTH_BYTES = 72;

export type M250ProtocolMode = 'm-series-esc' | 'm250-72byte' | 'm220-exact';

/**
 * Generates an offscreen canvas rendered cleanly (without editor selection guides)
 */
export function createCleanStickerCanvas(
  sizePreset: LabelSizePreset,
  frame: FrameStyle,
  elements: StickerElement[],
  dpiMultiplier = 3
): HTMLCanvasElement {
  const off = document.createElement('canvas');
  renderStickerToCanvas(off, {
    sizePreset,
    frame,
    elements,
    selectedElementId: null,
    dpiMultiplier,
    showEditorGuides: false,
  });
  return off;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Не удалось создать изображение стикера'));
    }, 'image/png');
  });
}

export async function prepareStickerAssets(
  sizePreset: LabelSizePreset,
  frame: FrameStyle,
  elements: StickerElement[],
  templateName: string
): Promise<{
  imageUrl: string;
  downloadUrl: string;
  shareFile: File;
  fileName: string;
}> {
  const canvas = createCleanStickerCanvas(sizePreset, frame, elements, 3);
  const dataUrl = canvas.toDataURL('image/png');
  const blob = await canvasToBlob(canvas);
  const safeName =
    templateName
      .replace(/[^a-zA-Zа-яА-ЯёЁ0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'stiker';
  const fileName = `Phomemo_M250_${sizePreset.widthMm}x${sizePreset.heightMm}mm_${safeName}.png`;
  const shareFile = new File([blob], fileName, { type: 'image/png' });

  if (location.hostname === 'localhost' || location.hostname.startsWith('192.168.')) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 900);
      const resp = await fetch('/api/prepare-sticker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl, fileName }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (resp.ok) {
        const json = await resp.json();
        if (json.ok && json.imageUrl) {
          return {
            imageUrl: json.imageUrl,
            downloadUrl: json.downloadUrl,
            shareFile,
            fileName,
          };
        }
      }
    } catch {
      // Autonomous mode
    }
  }

  return {
    imageUrl: dataUrl,
    downloadUrl: dataUrl,
    shareFile,
    fileName,
  };
}

export function printStickerNativeDialog(
  sizePreset: LabelSizePreset,
  frame: FrameStyle,
  elements: StickerElement[],
  copies = 1
): void {
  const canvas = createCleanStickerCanvas(sizePreset, frame, elements, 3);
  const dataUrl = canvas.toDataURL('image/png');
  const win = window.open('', '_blank', 'width=500,height=600');
  if (!win) return;

  const pagesHtml = Array.from({ length: Math.max(1, copies) })
    .map(
      () => `
      <div class="label-page">
        <img src="${dataUrl}" alt="Sticker" />
      </div>`
    )
    .join('');

  win.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Печать Phomemo M250 (${sizePreset.widthMm}×${sizePreset.heightMm} мм)</title>
        <style>
          @page {
            size: ${sizePreset.widthMm}mm ${sizePreset.heightMm}mm;
            margin: 0;
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #fff; }
          .label-page {
            width: ${sizePreset.widthMm}mm;
            height: ${sizePreset.heightMm}mm;
            page-break-after: always;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
          }
          .label-page img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
        </style>
      </head>
      <body>
        ${pagesHtml}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 250);
          };
        </script>
      </body>
    </html>
  `);
  win.document.close();
}

/**
 * Builds the 1-bit monochrome raster for Phomemo M250.
 */
export function buildPhomemoM250Raster(
  sizePreset: LabelSizePreset,
  frame: FrameStyle,
  elements: StickerElement[],
  padTo72Bytes = true
): { raster: Uint8Array; widthBytes: number; heightLines: number } {
  const canvas = createCleanStickerCanvas(sizePreset, frame, elements, 1);
  const width = canvas.width;
  const heightLines = canvas.height;
  const canvasBytesPerRow = Math.ceil(width / 8);
  const outputWidthBytes = padTo72Bytes ? M250_HEAD_WIDTH_BYTES : canvasBytesPerRow;

  const byteOffset = padTo72Bytes
    ? Math.max(0, Math.floor((outputWidthBytes - canvasBytesPerRow) / 2))
    : 0;

  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.getImageData(0, 0, width, heightLines).data;

  const raster = new Uint8Array(outputWidthBytes * heightLines);

  for (let y = 0; y < heightLines; y++) {
    for (let byteX = 0; byteX < canvasBytesPerRow; byteX++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = byteX * 8 + bit;
        if (x >= width) continue;
        const idx = (y * width + x) * 4;
        const lum =
          0.299 * imgData[idx] + 0.587 * imgData[idx + 1] + 0.114 * imgData[idx + 2];
        if (lum < 150) {
          byte |= 1 << (7 - bit);
        }
      }
      const outPos = y * outputWidthBytes + byteOffset + byteX;
      if (outPos >= 0 && outPos < raster.length) {
        raster[outPos] = byte;
      }
    }
  }

  return {
    raster,
    widthBytes: outputWidthBytes,
    heightLines,
  };
}

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export class WebBluetoothNotSupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebBluetoothNotSupportedError';
  }
}

/**
 * Submits print job via top-level form POST to local PC Bluetooth bridge (http://192.168.18.7:5173/api/print-m250-form)
 * Works even from HTTPS (dvrart.github.io) inside Yandex Browser or Safari when on home Wi-Fi!
 */
export function submitPrintViaLocalForm(
  sizePreset: LabelSizePreset,
  frame: FrameStyle,
  elements: StickerElement[],
  copies = 1,
  protocolMode: M250ProtocolMode = 'm-series-esc',
  hostIp = '192.168.18.7:5173'
): void {
  const padTo72 = protocolMode !== 'm220-exact';
  const { raster, widthBytes, heightLines } = buildPhomemoM250Raster(
    sizePreset,
    frame,
    elements,
    padTo72
  );
  const rasterBase64 = uint8ToBase64(raster);

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = `http://${hostIp}/api/print-m250-form`;
  form.style.display = 'none';

  const fields: Record<string, string> = {
    rasterBase64,
    widthBytes: String(widthBytes),
    heightLines: String(heightLines),
    copies: String(copies),
    protocolMode,
    returnUrl: window.location.href,
  };

  for (const [k, v] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = k;
    input.value = v;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
  setTimeout(() => {
    try {
      document.body.removeChild(form);
    } catch {
      // ignore
    }
  }, 2000);
}

/**
 * Encodes current sticker state into a compact URL hash so opening in Chrome/Bluefy restores the exact sticker
 */
export function encodeStickerStateForHandoff(
  sizeId: string,
  frame: FrameStyle,
  elements: StickerElement[],
  templateName: string
): string {
  try {
    const payload = JSON.stringify({
      s: sizeId,
      f: frame,
      n: templateName,
      e: elements.filter((el) => el.type !== 'image'),
    });
    return encodeURIComponent(btoa(unescape(encodeURIComponent(payload))));
  } catch {
    return '';
  }
}

export function decodeStickerStateFromHandoff(hashStr: string): {
  sizeId: string;
  frame: FrameStyle;
  templateName: string;
  elements: StickerElement[];
} | null {
  try {
    const m = hashStr.match(/autoprint=([^&]+)/);
    if (!m) return null;
    const jsonStr = decodeURIComponent(escape(atob(decodeURIComponent(m[1]))));
    const parsed = JSON.parse(jsonStr);
    if (parsed && Array.isArray(parsed.e)) {
      return {
        sizeId: parsed.s || '50x30',
        frame: parsed.f || 'classic-double',
        templateName: parsed.n || 'Стикер',
        elements: parsed.e,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Autonomous & Bridge Bluetooth printing for Phomemo M250
 */
export async function printDirectBlePhomemoM250(
  sizePreset: LabelSizePreset,
  frame: FrameStyle,
  elements: StickerElement[],
  copies = 1,
  onStatus?: (msg: string) => void,
  protocolMode: M250ProtocolMode = 'm-series-esc'
): Promise<void> {
  const padTo72 = protocolMode !== 'm220-exact';
  const { raster, widthBytes, heightLines } = buildPhomemoM250Raster(
    sizePreset,
    frame,
    elements,
    padTo72
  );

  // 1. If we are on local network HTTP (192.168.x.x or localhost), print directly via server COM9 bridge first!
  if (location.hostname === 'localhost' || location.hostname.startsWith('192.168.')) {
    onStatus?.('Отправка этикетки на Phomemo M250 по Bluetooth...');
    const rasterBase64 = uint8ToBase64(raster);
    const resp = await fetch('/api/print-m250', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rasterBase64,
        widthBytes,
        heightLines,
        copies,
        protocolMode,
        port: 'COM9',
      }),
    });
    const data = await resp.json();
    if (resp.ok && data.ok) {
      onStatus?.(
        `Напечатано! Стикер (${sizePreset.widthMm}×${sizePreset.heightMm} мм, ${copies} шт.) отправлен на Phomemo M250.`
      );
      return;
    }
    if (data?.error) {
      throw new Error(data.error);
    }
  }

  // 2. Try Direct Autonomous Web Bluetooth (works in Chrome on Android/Mac/PC and Bluefy on iPhone)
  const nav = navigator as Navigator & {
    bluetooth?: {
      requestDevice: (options: unknown) => Promise<{
        name?: string;
        gatt?: {
          connect: () => Promise<{
            getPrimaryService: (uuid: number | string) => Promise<{
              getCharacteristic: (uuid: number | string) => Promise<{
                uuid: string;
                properties: { write?: boolean; writeWithoutResponse?: boolean };
                writeValueWithResponse?: (val: BufferSource) => Promise<void>;
                writeValueWithoutResponse?: (val: BufferSource) => Promise<void>;
                writeValue?: (val: BufferSource) => Promise<void>;
                startNotifications?: () => Promise<void>;
              }>;
            }>;
          }>;
        };
      }>;
    };
  };

  if (nav.bluetooth) {
    let device: Awaited<ReturnType<NonNullable<typeof nav.bluetooth>['requestDevice']>> | null =
      null;
    const optionalServices = [
      0xff00,
      0xffe0,
      0xae30,
      '0000ff00-0000-1000-8000-00805f9b34fb',
      '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    ];

    try {
      onStatus?.('Поиск принтера Phomemo M250 по Bluetooth...');
      try {
        device = await nav.bluetooth.requestDevice({
          filters: [
            { namePrefix: 'M' },
            { namePrefix: 'Q' },
            { namePrefix: 'Phomemo' },
          ],
          optionalServices,
        });
      } catch (filterErr) {
        const msg = filterErr instanceof Error ? filterErr.message : String(filterErr);
        if (msg.includes('cancelled') || msg.includes('canceled') || msg.includes('User')) {
          throw new Error('Выбор Bluetooth-устройства отменён');
        }
        if (
          msg.includes('not supported') ||
          msg.includes('NotSupported') ||
          msg.includes('globally disabled')
        ) {
          throw new WebBluetoothNotSupportedError(msg);
        }
        device = await nav.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices,
        });
      }
    } catch (bleErr) {
      if (bleErr instanceof WebBluetoothNotSupportedError) {
        throw bleErr;
      }
      const msg = bleErr instanceof Error ? bleErr.message : String(bleErr);
      if (msg.includes('not supported') || msg.includes('NotSupported')) {
        throw new WebBluetoothNotSupportedError(msg);
      }
      throw bleErr;
    }

    if (device && device.gatt) {
      onStatus?.(`Подключение к ${device.name || 'Phomemo M250'}...`);
      const server = await device.gatt.connect();
      await new Promise((r) => setTimeout(r, 100));

      let service = null;
      for (const uuid of optionalServices) {
        try {
          service = await server.getPrimaryService(uuid);
          break;
        } catch {
          // try next
        }
      }

      if (!service) {
        throw new Error('Не найден Bluetooth-сервис принтера Phomemo M250 (0xFF00)');
      }

      const writeChar = await service.getCharacteristic(0xff02);
      const useWriteWithResponse =
        !writeChar.properties.writeWithoutResponse && !!writeChar.properties.write;

      try {
        const notifyChar = await service.getCharacteristic(0xff03);
        if (notifyChar.startNotifications) {
          await notifyChar.startNotifications();
        }
      } catch {
        // optional
      }

      const sendBytes = async (data: Uint8Array) => {
        const cleanBuffer = new Uint8Array(data).buffer;
        if (useWriteWithResponse && writeChar.writeValue) {
          await writeChar.writeValue(cleanBuffer);
        } else if (writeChar.writeValueWithoutResponse) {
          try {
            await writeChar.writeValueWithoutResponse(cleanBuffer);
          } catch {
            if (writeChar.writeValue) {
              await writeChar.writeValue(cleanBuffer);
            }
          }
        } else if (writeChar.writeValue) {
          await writeChar.writeValue(cleanBuffer);
        }
      };

      const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

      for (let c = 0; c < copies; c++) {
        onStatus?.(`Печать этикетки ${c + 1} из ${copies} по Bluetooth...`);

        if (protocolMode === 'm-series-esc') {
          // Verified Phomemo M250 m-series sequence (ESC @, ESC 7, GS |, GS v 0, ESC J)
          await sendBytes(new Uint8Array([0x1b, 0x40]));
          await delay(100);
          await sendBytes(new Uint8Array([0x1b, 0x37, 7, 140, 2]));
          await delay(30);
          await sendBytes(new Uint8Array([0x1d, 0x7c, 6]));
          await delay(50);
        } else {
          await sendBytes(new Uint8Array([0x1b, 0x4e, 0x0d, 0x05]));
          await delay(30);
          await sendBytes(new Uint8Array([0x1b, 0x4e, 0x04, 0x0c]));
          await delay(30);
          await sendBytes(new Uint8Array([0x1f, 0x11, 0x0a]));
          await delay(30);
        }

        await sendBytes(
          new Uint8Array([
            0x1d,
            0x76,
            0x30,
            0x00,
            widthBytes & 0xff,
            0x00,
            heightLines & 0xff,
            (heightLines >> 8) & 0xff,
          ])
        );

        const chunkSize = 128;
        for (let offset = 0; offset < raster.length; offset += chunkSize) {
          const slice = raster.slice(offset, Math.min(offset + chunkSize, raster.length));
          await sendBytes(slice);
          await delay(20);
        }

        await delay(300);
        if (protocolMode === 'm-series-esc') {
          await sendBytes(new Uint8Array([0x1b, 0x4a, 48]));
        } else {
          await sendBytes(new Uint8Array([0x1f, 0xf0, 0x05, 0x00, 0x1f, 0xf0, 0x03, 0x00]));
        }
        await delay(1200);
      }

      onStatus?.('Готово! Этикетка напечатана напрямую с телефона на Phomemo M250!');
      return;
    }
  }

  throw new WebBluetoothNotSupportedError('Web Bluetooth недоступен в текущем браузере');
}
