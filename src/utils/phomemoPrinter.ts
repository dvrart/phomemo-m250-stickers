import { DOTS_PER_MM } from '../data/labelSizes';
import { FrameStyle, LabelSizePreset, StickerElement } from '../types/sticker';
import { renderStickerToCanvas } from './thermalCanvasRenderer';

export const M250_HEAD_WIDTH_BYTES = 72;

export type M250ProtocolMode = 'm220-exact' | 'm250-72byte' | 'm-series-esc';

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

/**
 * Works 100% autonomously on the iPhone even when the computer is turned off!
 */
export async function prepareServerStickerImage(
  sizePreset: LabelSizePreset,
  frame: FrameStyle,
  elements: StickerElement[],
  templateName: string
): Promise<{ imageUrl: string; downloadUrl: string }> {
  const canvas = createCleanStickerCanvas(sizePreset, frame, elements, 3);
  const dataUrl = canvas.toDataURL('image/png');
  const safeName =
    templateName
      .replace(/[^a-zA-Zа-яА-ЯёЁ0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'stiker';
  const fileName = `Phomemo_M250_${sizePreset.widthMm}x${sizePreset.heightMm}mm_${safeName}.png`;

  // Only call local server if we are on local network HTTP
  if (location.hostname === 'localhost' || location.hostname.startsWith('192.168.')) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1000);
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
          return { imageUrl: json.imageUrl, downloadUrl: json.downloadUrl };
        }
      }
    } catch {
      // Autonomous mode
    }
  }
  return { imageUrl: dataUrl, downloadUrl: dataUrl };
}

export async function shareOrDownloadSticker(
  sizePreset: LabelSizePreset,
  frame: FrameStyle,
  elements: StickerElement[],
  templateName: string
): Promise<{ mode: 'shared' | 'server-image'; imageUrl?: string; downloadUrl?: string }> {
  const canvas = createCleanStickerCanvas(sizePreset, frame, elements, 3);
  const blob = await canvasToBlob(canvas);
  const safeName =
    templateName
      .replace(/[^a-zA-Zа-яА-ЯёЁ0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'stiker';
  const fileName = `Phomemo_M250_${sizePreset.widthMm}x${sizePreset.heightMm}mm_${safeName}.png`;
  const file = new File([blob], fileName, { type: 'image/png' });

  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };

  if (
    window.isSecureContext &&
    typeof nav.share === 'function' &&
    (!nav.canShare || nav.canShare({ files: [file] }))
  ) {
    try {
      await nav.share({
        files: [file],
        title: `${templateName} (${sizePreset.widthMm}×${sizePreset.heightMm} мм)`,
      });
      return { mode: 'shared' };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { mode: 'shared' };
      }
    }
  }

  const prepared = await prepareServerStickerImage(sizePreset, frame, elements, templateName);
  return {
    mode: 'server-image',
    imageUrl: prepared.imageUrl,
    downloadUrl: prepared.downloadUrl,
  };
}

export async function downloadStickerPng(
  sizePreset: LabelSizePreset,
  frame: FrameStyle,
  elements: StickerElement[],
  templateName: string
): Promise<{ imageUrl: string; downloadUrl: string }> {
  const prepared = await prepareServerStickerImage(sizePreset, frame, elements, templateName);
  const a = document.createElement('a');
  a.href = prepared.downloadUrl;
  a.download = `Phomemo_M250_${sizePreset.widthMm}x${sizePreset.heightMm}mm.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return prepared;
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
 * - If padTo72Bytes is false ('m220-exact'), widthBytes = exact label width in bytes (e.g. 50 for 50mm), matching phomemo-tools rastertopm110.py!
 * - If padTo72Bytes is true ('m250-72byte' / 'm-series-esc'), widthBytes = 72 bytes (576 dots) with label centered.
 */
export function buildPhomemoM250Raster(
  sizePreset: LabelSizePreset,
  frame: FrameStyle,
  elements: StickerElement[],
  padTo72Bytes = false
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

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
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
  protocolMode: M250ProtocolMode = 'm220-exact'
): Promise<void> {
  const padTo72 = protocolMode !== 'm220-exact';
  const { raster, widthBytes, heightLines } = buildPhomemoM250Raster(
    sizePreset,
    frame,
    elements,
    padTo72
  );

  const nav = navigator as Navigator & {
    bluetooth?: {
      requestDevice: (options: unknown) => Promise<{
        name?: string;
        gatt?: {
          connect: () => Promise<{
            getPrimaryServices: () => Promise<
              Array<{
                uuid: string;
                getCharacteristics: () => Promise<
                  Array<{
                    uuid: string;
                    properties: { write?: boolean; writeWithoutResponse?: boolean };
                    writeValueWithResponse?: (val: BufferSource) => Promise<void>;
                    writeValueWithoutResponse?: (val: BufferSource) => Promise<void>;
                    writeValue?: (val: BufferSource) => Promise<void>;
                  }>
                >;
              }>
            >;
          }>;
        };
      }>;
    };
  };

  // 1. Direct Autonomous Web Bluetooth (works in Bluefy on iPhone 24/7 without any computer!)
  if (nav.bluetooth) {
    onStatus?.('Поиск принтера Phomemo M250 по Bluetooth напрямую с телефона...');
    const device = await nav.bluetooth.requestDevice({
      filters: [
        { namePrefix: 'M250' },
        { namePrefix: 'Phomemo' },
        { namePrefix: 'Q' },
        { services: [0xff00] },
      ],
      optionalServices: [
        0xff00,
        '0000ff00-0000-1000-8000-00805f9b34fb',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455',
      ],
    });

    if (!device.gatt) {
      throw new Error('Не удалось подключиться к Bluetooth принтера Phomemo M250');
    }

    onStatus?.(`Подключение к ${device.name || 'Phomemo M250'}...`);
    const server = await device.gatt.connect();
    const services = await server.getPrimaryServices();
    let writeChar: {
      writeValueWithResponse?: (val: BufferSource) => Promise<void>;
      writeValueWithoutResponse?: (val: BufferSource) => Promise<void>;
      writeValue?: (val: BufferSource) => Promise<void>;
    } | null = null;

    for (const svc of services) {
      const chars = await svc.getCharacteristics();
      for (const ch of chars) {
        if (ch.properties.write || ch.properties.writeWithoutResponse) {
          writeChar = ch;
          if (ch.uuid.includes('ff02')) break;
        }
      }
      if (writeChar) break;
    }

    if (!writeChar) {
      throw new Error('Не найдена характеристика записи Bluetooth принтера');
    }

    const sendBytes = async (chunk: Uint8Array) => {
      if (writeChar!.writeValueWithoutResponse) {
        await writeChar!.writeValueWithoutResponse(chunk as unknown as BufferSource);
      } else if (writeChar!.writeValueWithResponse) {
        await writeChar!.writeValueWithResponse(chunk as unknown as BufferSource);
      } else if (writeChar!.writeValue) {
        await writeChar!.writeValue(chunk as unknown as BufferSource);
      }
    };

    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    for (let c = 0; c < copies; c++) {
      onStatus?.(`Печать этикетки ${c + 1} из ${copies} напрямую по Bluetooth...`);
      if (protocolMode === 'm-series-esc') {
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
        const slice = raster.subarray(offset, Math.min(offset + chunkSize, raster.length));
        await sendBytes(slice);
        await delay(20);
      }
      await delay(300);
      if (protocolMode === 'm-series-esc') {
        await sendBytes(new Uint8Array([0x1b, 0x4a, 32]));
      } else {
        await sendBytes(new Uint8Array([0x1f, 0xf0, 0x05, 0x00, 0x1f, 0xf0, 0x03, 0x00]));
      }
      await delay(800);
    }

    onStatus?.('Готово! Этикетка напечатана напрямую с телефона на Phomemo M250!');
    return;
  }

  // 2. Try local PC Bluetooth bridge if reachable
  if (location.hostname === 'localhost' || location.hostname.startsWith('192.168.')) {
    onStatus?.('Отправка этикетки на Phomemo M250...');
    const rasterBase64 = uint8ToBase64(raster);
    try {
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
    } catch {
      // Computer is off
    }
  }

  throw new Error(
    'Для печати с iPhone без компьютера: нажмите жёлтую кнопку «Отправить в Print Master / Фото» (откроется системное меню iPhone → выберите Print Master) ИЛИ откройте этот сайт в бесплатном приложении Bluefy из App Store для прямой Bluetooth-печати!'
  );
}
