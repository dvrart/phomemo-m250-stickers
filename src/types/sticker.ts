export type LabelShape = 'rect' | 'circle' | 'cable';

export interface LabelSizePreset {
  id: string;
  name: string;
  shortName: string;
  widthMm: number;
  heightMm: number;
  shape: LabelShape;
  description: string;
  recommendedFor: string;
}

export type FrameStyle =
  | 'none'
  | 'classic-double'
  | 'vintage-jar'
  | 'rounded-bold'
  | 'dashed-cut'
  | 'industrial-box'
  | 'warning-stripes'
  | 'top-header-bar'
  | 'botanical-corners'
  | 'apothecary'
  | 'circle-seal'
  | 'notebook-lines';

export type FontFamilyId =
  | 'sans'       // Rubik — Чёткий современный
  | 'serif'      // Playfair Display — Классический (варенье, вино, закрутки)
  | 'hand'       // Caveat — Домашний рукописный
  | 'condensed'  // Oswald — Крупный узкий (коробки, склад, ГОСТ)
  | 'mono'       // JetBrains Mono — Штамп / дата / инвентарь
  | 'rounded'    // Comfortaa — Мягкий уютный (детское, крупы, дом)
  | 'vintage'    // Cormorant Garamond — Аптекарский ретро
  | 'bold';      // Unbounded — Сверхжирный акцент

export type TemplateCategory =
  | 'all'
  | 'canning'      // Закрутки, соленья, варенье, компоты, заморозка
  | 'lids'         // Круглые наклейки на крышки банок
  | 'kitchen'      // Крупы, специи, кухня, свежесть продуктов
  | 'boxes'        // Коробки, хранение, гардероб, переезд, гараж
  | 'daily'        // Повседневные дела, чек-листы, напоминания
  | 'home';        // Аптечка, косметика, кабели, подарки, школа

export type ElementType =
  | 'text'
  | 'icon'
  | 'divider'
  | 'qr'
  | 'checklist'
  | 'image';

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface StickerElement {
  id: string;
  type: ElementType;
  /** Position in normalized coordinates 0..100 of label width/height so templates adapt smoothly when switching label sizes! */
  x: number;
  y: number;
  // Text properties
  text?: string;
  fieldLabel?: string;
  fontSize?: number; // Relative to label height (1..25)
  fontFamily?: FontFamilyId;
  fontWeight?: 'normal' | 'bold' | 'black';
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  inverted?: boolean; // White text on black background band/pill
  fullWidthBand?: boolean; // Black band spans full width
  uppercase?: boolean;
  maxWidth?: number; // 10..100% of width
  // Icon properties
  iconId?: string;
  iconSize?: number; // 5..45% of label min dimension
  // Divider properties
  dividerStyle?: 'solid' | 'dashed' | 'dotted' | 'double' | 'ornament';
  width?: number; // 10..96% of label width
  thickness?: number; // 1..4
  // QR properties
  qrData?: string;
  qrSize?: number; // 15..55% of label min dimension
  // Checklist properties
  checklistItems?: ChecklistItem[];
  // Image properties (with thermal dithering)
  imageUrl?: string;
  imageSize?: number;
  ditherMode?: 'atkinson' | 'threshold';
  threshold?: number;
}

export interface StickerTemplate {
  id: string;
  name: string;
  category: Exclude<TemplateCategory, 'all'>;
  subcategory: string;
  defaultSizeId: string;
  frame: FrameStyle;
  description: string;
  tags: string[];
  /** Quick presets to swap product/title in 1 tap (e.g. Огурцы -> Помидоры -> Лечо) */
  quickVariants?: {
    label: string;
    iconId?: string;
    fields: Record<string, string>;
  }[];
  elements: StickerElement[];
}

export interface PrintQueueItem {
  id: string;
  name: string;
  sizePreset: LabelSizePreset;
  copies: number;
  dataUrl: string;
  createdAt: string;
}
