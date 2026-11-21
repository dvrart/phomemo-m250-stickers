import { FontFamilyId, FrameStyle, LabelSizePreset, TemplateCategory } from '../types/sticker';

/**
 * Phomemo M250 specs:
 * - Resolution: 203 DPI (8 dots per mm)
 * - Supported label width: 20 mm – 75 mm
 */
export const DOTS_PER_MM = 8; // 203.2 DPI = 8 dots/mm

export const LABEL_SIZE_PRESETS: LabelSizePreset[] = [
  {
    id: '40x30',
    name: '40 × 30 мм (Стандарт)',
    shortName: '40×30 мм',
    widthMm: 40,
    heightMm: 30,
    shape: 'rect',
    description: 'Комплектный размер M250 (320×240 тчк)',
    recommendedFor: 'Специи, небольшие баночки, аптечка, даты вскрытия',
  },
  {
    id: '50x30',
    name: '50 × 30 мм (Средняя)',
    shortName: '50×30 мм',
    widthMm: 50,
    heightMm: 30,
    shape: 'rect',
    description: 'Универсальная этикетка (400×240 тчк)',
    recommendedFor: 'Банки 0.5–1 л с закрутками, контейнеры, крупы',
  },
  {
    id: '70x40',
    name: '70 × 40 мм (Широкая)',
    shortName: '70×40 мм',
    widthMm: 70,
    heightMm: 40,
    shape: 'rect',
    description: 'Крупная горизонтальная (560×320 тчк)',
    recommendedFor: '3-литровые банки, соленья, ящики, обувные коробки',
  },
  {
    id: '70x80',
    name: '70 × 80 мм (Большая коробка)',
    shortName: '70×80 мм',
    widthMm: 70,
    heightMm: 80,
    shape: 'rect',
    description: 'Максимальный формат M250 (560×640 тчк)',
    recommendedFor: 'Коробки переезда, большие списки вещей, чек-листы на день',
  },
  {
    id: '50x50',
    name: '50 × 50 мм (Квадратная)',
    shortName: '50×50 ■',
    widthMm: 50,
    heightMm: 50,
    shape: 'rect',
    description: 'Квадратная наклейка (400×400 тчк)',
    recommendedFor: 'Банки с крупами, настойки, QR-коды для коробок',
  },
  {
    id: '50x50-round',
    name: 'Ø 50 мм (Круглая на крышку)',
    shortName: 'Ø 50 ●',
    widthMm: 50,
    heightMm: 50,
    shape: 'circle',
    description: 'Круглый стикер на крышку СКО/Твист (400×400 тчк)',
    recommendedFor: 'Крышки банок сверху (варенье, соленья, мёд, подарки)',
  },
  {
    id: '40x40-round',
    name: 'Ø 40 мм (Малый круг)',
    shortName: 'Ø 40 ●',
    widthMm: 40,
    heightMm: 40,
    shape: 'circle',
    description: 'Компактный круг на малые крышки (320×320 тчк)',
    recommendedFor: 'Маленькие баночки с джемом, соусами и специями',
  },
  {
    id: '30x20',
    name: '30 × 20 мм (Мини-метка)',
    shortName: '30×20 мм',
    widthMm: 30,
    heightMm: 20,
    shape: 'rect',
    description: 'Малютка для мелочей (240×160 тчк)',
    recommendedFor: 'Провода, косметика, сроки годности, мини-флаконы',
  },
];

export const CATEGORIES: {
  id: TemplateCategory;
  name: string;
  shortName: string;
  emoji: string;
  countHint: string;
}[] = [
  { id: 'all', name: 'Все шаблоны', shortName: 'Все', emoji: '✨', countHint: '56+' },
  { id: 'canning', name: 'Закрутки и Заготовки', shortName: 'Закрутки', emoji: '🥫', countHint: 'Соленья, варенье' },
  { id: 'lids', name: 'Круглые на крышки', shortName: 'На крышки ●', emoji: '🍯', countHint: 'Сверху на банку' },
  { id: 'kitchen', name: 'Крупы, Специи и Кухня', shortName: 'Кухня/Банки', emoji: '🫙', countHint: 'Крупы, приправы' },
  { id: 'boxes', name: 'Коробки и Переезд', shortName: 'Коробки', emoji: '📦', countHint: 'Хранение, склад' },
  { id: 'daily', name: 'Повседневные дела', shortName: 'Дела/Списки', emoji: '📋', countHint: 'Чек-листы, планы' },
  { id: 'home', name: 'Аптечка, Дом, Провода', shortName: 'Дом/Быт', emoji: '🏠', countHint: 'Лекарства, Wi-Fi' },
];

export const FONT_OPTIONS: {
  id: FontFamilyId;
  name: string;
  cssFamily: string;
  sample: string;
}[] = [
  { id: 'sans', name: 'Чёткий ГОСТ', cssFamily: '"Rubik", -apple-system, sans-serif', sample: 'Огурцы' },
  { id: 'serif', name: 'Усадьба', cssFamily: '"Playfair Display", Georgia, serif', sample: 'Варенье' },
  { id: 'hand', name: 'Домашний почерк', cssFamily: '"Caveat", cursive', sample: 'С любовью' },
  { id: 'condensed', name: 'Коробка / Склад', cssFamily: '"Oswald", Impact, sans-serif', sample: 'КОРОБКА №1' },
  { id: 'mono', name: 'Штамп / Дата', cssFamily: '"JetBrains Mono", monospace', sample: '2026-08' },
  { id: 'rounded', name: 'Мягкий уют', cssFamily: '"Comfortaa", sans-serif', sample: 'Гречка' },
  { id: 'vintage', name: 'Аптекарь', cssFamily: '"Cormorant Garamond", Georgia, serif', sample: 'Рецепт №5' },
  { id: 'bold', name: 'Супер-жирный', cssFamily: '"Unbounded", sans-serif', sample: 'ХРУПКОЕ' },
];

export const FRAME_OPTIONS: {
  id: FrameStyle;
  name: string;
  description: string;
}[] = [
  { id: 'classic-double', name: 'Двойная классика', description: 'Традиционная рамка для солений и банок' },
  { id: 'vintage-jar', name: 'Винтажные уголки', description: 'Красивая фигурная рамка для домашнего варенья' },
  { id: 'top-header-bar', name: 'Чёрная шапка', description: 'Контрастная полоса сверху — идеально для коробок и специй' },
  { id: 'rounded-bold', name: 'Жирная скруглённая', description: 'Чёткий современный контур' },
  { id: 'industrial-box', name: 'Склад / Коробка', description: 'Усиленные углы для ящиков, инструментов и хранения' },
  { id: 'warning-stripes', name: 'Полосы «Внимание»', description: 'Диагональная штриховка для переезда и хрупких вещей' },
  { id: 'botanical-corners', name: 'Веточки в углах', description: 'Ботанический орнамент для чая, мёда и трав' },
  { id: 'apothecary', name: 'Аптекарская', description: 'Строгая рамка с внутренним кантом для лекарств и настоек' },
  { id: 'circle-seal', name: 'Круглая печать ●', description: 'Двойной круг со звёздочками специально для крышек банок' },
  { id: 'dashed-cut', name: 'Пунктирный штамп', description: 'Штриховая рамка как на крафтовых бирках' },
  { id: 'notebook-lines', name: 'Блокнот в линейку', description: 'Горизонтальная разлиновка для списков и записей' },
  { id: 'none', name: 'Без рамки', description: 'Чистое поле этикетки' },
];
