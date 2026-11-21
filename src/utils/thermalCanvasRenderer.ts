import QRCode from 'qrcode';
import { DOTS_PER_MM, FONT_OPTIONS } from '../data/labelSizes';
import { getThermalIconById } from '../data/thermalIcons';
import { FrameStyle, LabelSizePreset, StickerElement } from '../types/sticker';

export interface RenderStickerOptions {
  sizePreset: LabelSizePreset;
  frame: FrameStyle;
  elements: StickerElement[];
  selectedElementId?: string | null;
  /** Multiplier over 203 DPI (8 dots/mm). Use 2 for crisp Retina UI & Print Master import, 1 for raw 203 DPI thermal raster */
  dpiMultiplier?: number;
  /** Show subtle non-printed guide for circular labels in editor preview */
  showEditorGuides?: boolean;
}

export interface ElementBoundingBox {
  id: string;
  x: number; // in canvas px
  y: number;
  width: number;
  height: number;
}

const imageCache = new Map<string, HTMLImageElement>();

export function preloadStickerImage(url: string): Promise<HTMLImageElement> {
  if (imageCache.has(url)) {
    return Promise.resolve(imageCache.get(url)!);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function getFontCss(fontId: StickerElement['fontFamily']): string {
  const found = FONT_OPTIONS.find((f) => f.id === fontId);
  return found ? found.cssFamily : '"Rubik", -apple-system, sans-serif';
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  frame: FrameStyle,
  W: number,
  H: number,
  minDim: number,
  isCircle: boolean
) {
  ctx.save();
  ctx.strokeStyle = '#000000';
  ctx.fillStyle = '#000000';
  const pad = Math.round(minDim * 0.045);
  const stroke = Math.max(2, Math.round(minDim * 0.012));

  if (isCircle && frame !== 'none') {
    const cx = W / 2;
    const cy = H / 2;
    const rOuter = Math.min(W, H) / 2 - pad;
    ctx.lineWidth = stroke * 1.4;
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
    ctx.stroke();

    if (frame === 'circle-seal' || frame === 'classic-double' || frame === 'vintage-jar') {
      ctx.lineWidth = Math.max(1.5, stroke * 0.7);
      ctx.beginPath();
      ctx.arc(cx, cy, rOuter - stroke * 2.6, 0, Math.PI * 2);
      ctx.stroke();

      // Decorative dots on left & right of circle seal
      const dotR = stroke * 1.3;
      ctx.beginPath();
      ctx.arc(cx - rOuter + stroke * 5.5, cy, dotR, 0, Math.PI * 2);
      ctx.arc(cx + rOuter - stroke * 5.5, cy, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  switch (frame) {
    case 'none':
      break;

    case 'classic-double': {
      ctx.lineWidth = stroke * 1.3;
      ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2);
      const inner = pad + stroke * 2.5;
      ctx.lineWidth = Math.max(1.5, stroke * 0.65);
      ctx.strokeRect(inner, inner, W - inner * 2, H - inner * 2);
      break;
    }

    case 'vintage-jar': {
      const c = Math.round(minDim * 0.07);
      ctx.lineWidth = stroke * 1.3;
      ctx.beginPath();
      ctx.moveTo(pad + c, pad);
      ctx.lineTo(W - pad - c, pad);
      ctx.arc(W - pad, pad, c, Math.PI, Math.PI * 0.5, true);
      ctx.lineTo(W - pad, H - pad - c);
      ctx.arc(W - pad, H - pad, c, Math.PI * 1.5, Math.PI, true);
      ctx.lineTo(pad + c, H - pad);
      ctx.arc(pad, H - pad, c, 0, Math.PI * 1.5, true);
      ctx.lineTo(pad, pad + c);
      ctx.arc(pad, pad, c, Math.PI * 0.5, 0, true);
      ctx.closePath();
      ctx.stroke();

      const p2 = pad + stroke * 2.2;
      ctx.lineWidth = Math.max(1, stroke * 0.6);
      ctx.strokeRect(p2 + c * 0.4, p2 + c * 0.4, W - (p2 + c * 0.4) * 2, H - (p2 + c * 0.4) * 2);
      break;
    }

    case 'rounded-bold': {
      ctx.lineWidth = stroke * 1.7;
      drawRoundedRect(ctx, pad, pad, W - pad * 2, H - pad * 2, minDim * 0.07);
      ctx.stroke();
      break;
    }

    case 'top-header-bar': {
      ctx.lineWidth = stroke * 1.4;
      drawRoundedRect(ctx, pad, pad, W - pad * 2, H - pad * 2, minDim * 0.05);
      ctx.stroke();
      // Top solid header band
      const headerH = Math.round(H * 0.19);
      ctx.save();
      drawRoundedRect(ctx, pad, pad, W - pad * 2, H - pad * 2, minDim * 0.05);
      ctx.clip();
      ctx.fillRect(pad, pad, W - pad * 2, headerH);
      ctx.restore();
      break;
    }

    case 'industrial-box': {
      ctx.lineWidth = stroke * 1.4;
      ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2);
      // Heavy corner brackets
      const bLen = Math.round(minDim * 0.12);
      const bThick = stroke * 2.6;
      ctx.lineWidth = bThick;
      // Top-left
      ctx.beginPath();
      ctx.moveTo(pad, pad + bLen);
      ctx.lineTo(pad, pad);
      ctx.lineTo(pad + bLen, pad);
      // Top-right
      ctx.moveTo(W - pad - bLen, pad);
      ctx.lineTo(W - pad, pad);
      ctx.lineTo(W - pad, pad + bLen);
      // Bottom-right
      ctx.moveTo(W - pad, H - pad - bLen);
      ctx.lineTo(W - pad, H - pad);
      ctx.lineTo(W - pad - bLen, H - pad);
      // Bottom-left
      ctx.moveTo(pad + bLen, H - pad);
      ctx.lineTo(pad, H - pad);
      ctx.lineTo(pad, H - pad - bLen);
      ctx.stroke();
      break;
    }

    case 'warning-stripes': {
      ctx.lineWidth = stroke * 1.3;
      ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2);
      const stripeH = Math.round(H * 0.085);
      const drawHazardBar = (yTop: number) => {
        ctx.save();
        ctx.beginPath();
        ctx.rect(pad, yTop, W - pad * 2, stripeH);
        ctx.clip();
        const step = Math.round(stripeH * 1.6);
        ctx.lineWidth = Math.round(stripeH * 0.55);
        for (let x = -H; x < W + H; x += step) {
          ctx.beginPath();
          ctx.moveTo(x, yTop + stripeH);
          ctx.lineTo(x + stripeH, yTop);
          ctx.stroke();
        }
        ctx.restore();
        ctx.lineWidth = stroke;
        ctx.strokeRect(pad, yTop, W - pad * 2, stripeH);
      };
      drawHazardBar(pad);
      drawHazardBar(H - pad - stripeH);
      break;
    }

    case 'botanical-corners': {
      ctx.lineWidth = stroke * 1.1;
      drawRoundedRect(ctx, pad, pad, W - pad * 2, H - pad * 2, minDim * 0.04);
      ctx.stroke();
      // Draw small leaf ornaments in all 4 corners
      const leafSize = minDim * 0.055;
      const corners = [
        [pad + leafSize * 1.1, pad + leafSize * 1.1],
        [W - pad - leafSize * 1.1, pad + leafSize * 1.1],
        [pad + leafSize * 1.1, H - pad - leafSize * 1.1],
        [W - pad - leafSize * 1.1, H - pad - leafSize * 1.1],
      ];
      corners.forEach(([cx, cy]) => {
        ctx.beginPath();
        ctx.arc(cx, cy, stroke * 1.3, 0, Math.PI * 2);
        ctx.fill();
      });
      break;
    }

    case 'apothecary': {
      const outer = pad;
      const inner = pad + stroke * 2.8;
      ctx.lineWidth = stroke * 1.6;
      ctx.strokeRect(outer, outer, W - outer * 2, H - outer * 2);
      ctx.lineWidth = Math.max(1, stroke * 0.7);
      ctx.strokeRect(inner, inner, W - inner * 2, H - inner * 2);
      // Corner squares
      const sq = stroke * 2.8;
      ctx.fillRect(outer, outer, sq, sq);
      ctx.fillRect(W - outer - sq, outer, sq, sq);
      ctx.fillRect(outer, H - outer - sq, sq, sq);
      ctx.fillRect(W - outer - sq, H - outer - sq, sq, sq);
      break;
    }

    case 'circle-seal': {
      const cx = W / 2;
      const cy = H / 2;
      const r = Math.min(W, H) / 2 - pad;
      ctx.lineWidth = stroke * 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, stroke * 0.7);
      ctx.beginPath();
      ctx.arc(cx, cy, r - stroke * 2.5, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }

    case 'dashed-cut': {
      ctx.lineWidth = stroke * 1.4;
      ctx.setLineDash([stroke * 3.5, stroke * 2.2]);
      drawRoundedRect(ctx, pad, pad, W - pad * 2, H - pad * 2, minDim * 0.05);
      ctx.stroke();
      ctx.setLineDash([]);
      break;
    }

    case 'notebook-lines': {
      ctx.lineWidth = stroke * 1.3;
      ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2);
      ctx.lineWidth = Math.max(1, stroke * 0.5);
      const startY = Math.round(H * 0.28);
      const stepY = Math.round(H * 0.14);
      for (let y = startY; y < H - pad - stepY * 0.4; y += stepY) {
        ctx.beginPath();
        ctx.moveTo(pad + stroke * 3, y);
        ctx.lineTo(W - pad - stroke * 3, y);
        ctx.stroke();
      }
      break;
    }
  }

  ctx.restore();
}

function drawDitheredImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  targetSize: number,
  mode: 'atkinson' | 'threshold' = 'atkinson',
  threshold = 135
): { x: number; y: number; width: number; height: number } {
  const aspect = img.width / Math.max(1, img.height);
  let w = targetSize;
  let h = targetSize;
  if (aspect > 1) {
    h = Math.round(targetSize / aspect);
  } else {
    w = Math.round(targetSize * aspect);
  }
  w = Math.max(16, Math.round(w));
  h = Math.max(16, Math.round(h));

  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const octx = off.getContext('2d')!;
  octx.fillStyle = '#ffffff';
  octx.fillRect(0, 0, w, h);
  octx.drawImage(img, 0, 0, w, h);

  const imgData = octx.getImageData(0, 0, w, h);
  const d = imgData.data;
  const lum = new Float32Array(w * h);

  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    const alpha = d[idx + 3] / 255;
    const r = d[idx] * alpha + 255 * (1 - alpha);
    const g = d[idx + 1] * alpha + 255 * (1 - alpha);
    const b = d[idx + 2] * alpha + 255 * (1 - alpha);
    lum[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const oldP = lum[i];
      const newP = oldP < threshold ? 0 : 255;
      lum[i] = newP;
      if (mode === 'atkinson') {
        const err = (oldP - newP) / 8;
        if (x + 1 < w) lum[i + 1] += err;
        if (x + 2 < w) lum[i + 2] += err;
        if (y + 1 < h) {
          if (x - 1 >= 0) lum[i + w - 1] += err;
          lum[i + w] += err;
          if (x + 1 < w) lum[i + w + 1] += err;
        }
        if (y + 2 < h) {
          lum[i + w * 2] += err;
        }
      }
    }
  }

  for (let i = 0; i < w * h; i++) {
    const val = lum[i] < 128 ? 0 : 255;
    const idx = i * 4;
    d[idx] = val;
    d[idx + 1] = val;
    d[idx + 2] = val;
    d[idx + 3] = 255;
  }

  octx.putImageData(imgData, 0, 0);
  const drawX = Math.round(cx - w / 2);
  const drawY = Math.round(cy - h / 2);
  ctx.drawImage(off, drawX, drawY);
  return { x: drawX, y: drawY, width: w, height: h };
}

export function renderStickerToCanvas(
  canvas: HTMLCanvasElement,
  options: RenderStickerOptions
): ElementBoundingBox[] {
  const {
    sizePreset,
    frame,
    elements,
    selectedElementId,
    dpiMultiplier = 2,
    showEditorGuides = false,
  } = options;

  const W = Math.round(sizePreset.widthMm * DOTS_PER_MM * dpiMultiplier);
  const H = Math.round(sizePreset.heightMm * DOTS_PER_MM * dpiMultiplier);
  const minDim = Math.min(W, H);
  const isCircle = sizePreset.shape === 'circle';

  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }

  const ctx = canvas.getContext('2d')!;
  ctx.save();

  // Fill crisp white paper background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  if (isCircle && showEditorGuides) {
    ctx.save();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = Math.max(1, dpiMultiplier);
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, minDim / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Draw Frame
  drawFrame(ctx, frame, W, H, minDim, isCircle);

  const boundingBoxes: ElementBoundingBox[] = [];

  // Draw Elements
  for (const el of elements) {
    const cx = (el.x / 100) * W;
    const cy = (el.y / 100) * H;

    if (el.type === 'divider') {
      const divW = ((el.width ?? 80) / 100) * W;
      const thick = Math.max(1.5, (el.thickness ?? 1.5) * dpiMultiplier);
      const x1 = cx - divW / 2;
      const x2 = cx + divW / 2;

      ctx.save();
      ctx.strokeStyle = '#000000';
      ctx.fillStyle = '#000000';
      ctx.lineWidth = thick;

      if (el.dividerStyle === 'dashed') {
        ctx.setLineDash([thick * 3.5, thick * 2.2]);
      } else if (el.dividerStyle === 'dotted') {
        ctx.setLineDash([thick * 1.4, thick * 2]);
      }

      if (el.dividerStyle === 'double') {
        const gap = thick * 1.3;
        ctx.beginPath();
        ctx.moveTo(x1, cy - gap);
        ctx.lineTo(x2, cy - gap);
        ctx.moveTo(x1, cy + gap);
        ctx.lineTo(x2, cy + gap);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(x1, cy);
        ctx.lineTo(x2, cy);
        ctx.stroke();
      }
      ctx.restore();

      boundingBoxes.push({
        id: el.id,
        x: x1,
        y: cy - thick * 4,
        width: divW,
        height: thick * 8,
      });
    } else if (el.type === 'icon') {
      const iconDef = getThermalIconById(el.iconId);
      if (iconDef) {
        const sizePx = ((el.iconSize ?? 22) / 100) * minDim;
        const scale = sizePx / 24;
        ctx.save();
        ctx.translate(cx - sizePx / 2, cy - sizePx / 2);
        ctx.scale(scale, scale);
        ctx.strokeStyle = '#000000';
        ctx.fillStyle = '#000000';
        ctx.lineWidth = 2.05;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (const dPath of iconDef.paths) {
          const p = new Path2D(dPath);
          ctx.stroke(p);
        }
        if (iconDef.filledPaths) {
          for (const fPath of iconDef.filledPaths) {
            const p = new Path2D(fPath);
            ctx.fill(p);
          }
        }
        ctx.restore();

        boundingBoxes.push({
          id: el.id,
          x: cx - sizePx / 2,
          y: cy - sizePx / 2,
          width: sizePx,
          height: sizePx,
        });
      }
    } else if (el.type === 'qr') {
      const qrText = (el.qrData || 'Phomemo M250').trim();
      const sizePx = Math.round(((el.qrSize ?? 38) / 100) * minDim);
      try {
        const qr = QRCode.create(qrText, { errorCorrectionLevel: 'M' });
        const count = qr.modules.size;
        const cellSize = Math.max(1, Math.floor(sizePx / (count + 2)));
        const actualSize = cellSize * count;
        const startX = Math.round(cx - actualSize / 2);
        const startY = Math.round(cy - actualSize / 2);

        ctx.save();
        // White quiet zone
        const qPad = cellSize;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(startX - qPad, startY - qPad, actualSize + qPad * 2, actualSize + qPad * 2);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1.5, dpiMultiplier);
        ctx.strokeRect(startX - qPad, startY - qPad, actualSize + qPad * 2, actualSize + qPad * 2);

        ctx.fillStyle = '#000000';
        for (let r = 0; r < count; r++) {
          for (let c = 0; c < count; c++) {
            if (qr.modules.get(r, c)) {
              ctx.fillRect(startX + c * cellSize, startY + r * cellSize, cellSize, cellSize);
            }
          }
        }
        ctx.restore();

        boundingBoxes.push({
          id: el.id,
          x: startX - qPad,
          y: startY - qPad,
          width: actualSize + qPad * 2,
          height: actualSize + qPad * 2,
        });
      } catch {
        // Fallback if empty
      }
    } else if (el.type === 'checklist') {
      const items = el.checklistItems ?? [];
      const listW = ((el.width ?? 82) / 100) * W;
      const fontPx = Math.max(10, Math.round(((el.fontSize ?? 5.5) / 100) * minDim));
      const lineH = Math.round(fontPx * 1.48);
      const totalH = items.length * lineH;
      const startX = cx - listW / 2;
      const startY = cy - totalH / 2;
      const boxSize = Math.round(fontPx * 0.88);

      ctx.save();
      ctx.font = `600 ${fontPx}px "Rubik", -apple-system, sans-serif`;
      ctx.fillStyle = '#000000';
      ctx.strokeStyle = '#000000';
      ctx.textBaseline = 'middle';

      items.forEach((item, idx) => {
        const rowY = startY + idx * lineH + lineH / 2;
        const bx = startX;
        const by = rowY - boxSize / 2;

        ctx.lineWidth = Math.max(1.8, dpiMultiplier * 1.1);
        ctx.strokeRect(bx, by, boxSize, boxSize);

        if (item.checked) {
          ctx.beginPath();
          ctx.lineWidth = Math.max(2.2, dpiMultiplier * 1.4);
          ctx.moveTo(bx + boxSize * 0.2, rowY);
          ctx.lineTo(bx + boxSize * 0.44, by + boxSize * 0.76);
          ctx.lineTo(bx + boxSize * 0.84, by + boxSize * 0.22);
          ctx.stroke();
        }

        ctx.fillText(item.text, bx + boxSize + fontPx * 0.45, rowY);
      });

      ctx.restore();

      boundingBoxes.push({
        id: el.id,
        x: startX,
        y: startY,
        width: listW,
        height: Math.max(lineH, totalH),
      });
    } else if (el.type === 'image' && el.imageUrl) {
      const cached = imageCache.get(el.imageUrl);
      const targetSize = ((el.imageSize ?? 45) / 100) * minDim;
      if (cached) {
        const box = drawDitheredImage(
          ctx,
          cached,
          cx,
          cy,
          targetSize,
          el.ditherMode ?? 'atkinson',
          el.threshold ?? 135
        );
        boundingBoxes.push({ id: el.id, ...box });
      }
    } else if (el.type === 'text') {
      const rawText = el.uppercase ? (el.text ?? '').toUpperCase() : (el.text ?? '');
      const fontPx = Math.max(9, Math.round(((el.fontSize ?? 8) / 100) * minDim));
      const weight = el.fontWeight === 'black' ? '800' : el.fontWeight === 'bold' ? '700' : '500';
      const italic = el.italic ? 'italic ' : '';
      const family = getFontCss(el.fontFamily);

      ctx.save();
      ctx.font = `${italic}${weight} ${fontPx}px ${family}`;
      ctx.textBaseline = 'middle';

      const maxW = ((el.maxWidth ?? 88) / 100) * W;
      const manualLines = rawText.split('\n');
      const lines: string[] = [];

      for (const mLine of manualLines) {
        if (ctx.measureText(mLine).width <= maxW) {
          lines.push(mLine);
        } else {
          const words = mLine.split(' ');
          let current = '';
          for (const word of words) {
            const test = current ? `${current} ${word}` : word;
            if (ctx.measureText(test).width > maxW && current) {
              lines.push(current);
              current = word;
            } else {
              current = test;
            }
          }
          if (current) lines.push(current);
        }
      }

      const lineH = Math.round(fontPx * 1.18);
      const totalH = lines.length * lineH;
      let maxMeasuredW = 0;
      for (const l of lines) {
        maxMeasuredW = Math.max(maxMeasuredW, ctx.measureText(l).width);
      }

      // Check if top-header-bar already provides black background at the top
      const isInsideTopHeaderBar = frame === 'top-header-bar' && el.y <= 18;

      if (el.inverted && !isInsideTopHeaderBar) {
        const padX = Math.round(fontPx * 0.55);
        const padY = Math.round(fontPx * 0.24);
        const pillW = maxMeasuredW + padX * 2;
        const pillH = totalH + padY * 2;
        const pillX =
          el.align === 'left'
            ? cx - padX
            : el.align === 'right'
            ? cx - pillW + padX
            : cx - pillW / 2;
        const pillY = cy - pillH / 2;

        ctx.fillStyle = '#000000';
        drawRoundedRect(ctx, pillX, pillY, pillW, pillH, Math.round(fontPx * 0.28));
        ctx.fill();
      }

      ctx.fillStyle = el.inverted || isInsideTopHeaderBar ? '#ffffff' : '#000000';
      ctx.textAlign = el.align ?? 'center';

      lines.forEach((line, idx) => {
        const ly = cy - totalH / 2 + idx * lineH + lineH / 2;
        ctx.fillText(line, cx, ly);
      });

      const boxX =
        el.align === 'left'
          ? cx
          : el.align === 'right'
          ? cx - maxMeasuredW
          : cx - maxMeasuredW / 2;

      boundingBoxes.push({
        id: el.id,
        x: boxX - 6,
        y: cy - totalH / 2 - 4,
        width: Math.max(24, maxMeasuredW + 12),
        height: Math.max(18, totalH + 8),
      });

      ctx.restore();
    }
  }

  // Highlight selected element in interactive editor mode
  if (selectedElementId && showEditorGuides) {
    const found = boundingBoxes.find((b) => b.id === selectedElementId);
    if (found) {
      ctx.save();
      ctx.strokeStyle = '#d97706'; // Amber highlight for selected element
      ctx.lineWidth = Math.max(2, dpiMultiplier * 1.3);
      ctx.setLineDash([5, 4]);
      drawRoundedRect(ctx, found.x - 4, found.y - 4, found.width + 8, found.height + 8, 6);
      ctx.stroke();
      ctx.restore();
    }
  }

  ctx.restore();
  return boundingBoxes;
}
