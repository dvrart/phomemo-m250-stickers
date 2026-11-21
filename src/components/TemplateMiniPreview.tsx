import React, { useEffect, useRef } from 'react';
import { LABEL_SIZE_PRESETS } from '../data/labelSizes';
import { FrameStyle, LabelSizePreset, StickerElement } from '../types/sticker';
import { renderStickerToCanvas } from '../utils/thermalCanvasRenderer';

interface TemplateMiniPreviewProps {
  sizeId?: string;
  sizePreset?: LabelSizePreset;
  frame: FrameStyle;
  elements: StickerElement[];
  className?: string;
}

export const TemplateMiniPreview: React.FC<TemplateMiniPreviewProps> = ({
  sizeId,
  sizePreset,
  frame,
  elements,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const resolvedSize =
    sizePreset ||
    LABEL_SIZE_PRESETS.find((s) => s.id === sizeId) ||
    LABEL_SIZE_PRESETS[1];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderStickerToCanvas(canvas, {
      sizePreset: resolvedSize,
      frame,
      elements,
      selectedElementId: null,
      dpiMultiplier: 1.25,
      showEditorGuides: false,
    });
  }, [resolvedSize, frame, elements]);

  const isCircle = resolvedSize.shape === 'circle';

  return (
    <div
      className={`flex items-center justify-center bg-slate-100/90 p-2 rounded-xl overflow-hidden ${className}`}
    >
      <canvas
        ref={canvasRef}
        className={`max-w-full max-h-full object-contain bg-white shadow-sm border border-slate-300/80 ${
          isCircle ? 'rounded-full' : 'rounded-md'
        }`}
        style={{
          aspectRatio: `${resolvedSize.widthMm} / ${resolvedSize.heightMm}`,
        }}
      />
    </div>
  );
};
