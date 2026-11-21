/**
 * High-contrast monochrome vector graphics designed specifically for 203 DPI thermal printing on Phomemo M250.
 * All icons use a 24x24 coordinate space and bold strokes/fills so they never blur on thermal paper.
 */
export interface ThermalIconDef {
  id: string;
  name: string;
  category: 'canning' | 'kitchen' | 'boxes' | 'daily';
  /** Draw function on 2D Canvas in 0..24 coordinate box */
  paths: string[];
  filledPaths?: string[];
}

export const THERMAL_ICONS: ThermalIconDef[] = [
  // === ЗАКРУТКИ И УРОЖАЙ ===
  {
    id: 'jar',
    name: 'Банка закрутки',
    category: 'canning',
    paths: [
      'M7 3h10v2.5H7z',
      'M6 5.5h12l1.5 2.5v11a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V8z',
      'M7.5 11h9v6h-9z',
    ],
  },
  {
    id: 'cucumber',
    name: 'Огурец',
    category: 'canning',
    paths: [
      'M6 18c-1.5-1.5-1-4.5 2.5-8S15 6 17.5 6c1.5 0 2.5 1 2.5 2.5 0 2.5-2 6-5.5 9.5S8 20 6 18z',
      'M17.5 6c1-1 2-1.5 3-1',
      'M9 15h.5 M12 12h.5 M14.5 9.5h.5 M10 11.5h.5 M13 14.5h.5',
    ],
  },
  {
    id: 'tomato',
    name: 'Помидор',
    category: 'canning',
    paths: [
      'M12 7c-5 0-8 3.2-8 7.5S7.5 21 12 21s8-2.2 8-6.5S17 7 12 7z',
      'M12 3v4 M8.5 5.5L12 7l3.5-1.5 M7 8l5-1 5 1',
    ],
  },
  {
    id: 'strawberry',
    name: 'Клубника',
    category: 'canning',
    paths: [
      'M12 7c-4.5 0-6.5 3-6 7 .4 3.5 3.5 7 6 7s5.6-3.5 6-7c.5-4-1.5-7-6-7z',
      'M9 4.5L12 7l3-2.5 M12 3v4 M7.5 6.5L12 7l4.5-.5',
      'M10 11h.4 M14 11h.4 M12 13.5h.4 M9.5 15h.4 M14.5 15h.4 M12 17.5h.4',
    ],
  },
  {
    id: 'berry',
    name: 'Малина / Ягода',
    category: 'canning',
    paths: [
      'M9 4l3 2.5L15 4 M12 2.5V6',
      'M9.5 8.5a2.2 2.2 0 1 1 0 .1z M14.5 8.5a2.2 2.2 0 1 1 0 .1z',
      'M7.5 12.5a2.2 2.2 0 1 1 0 .1z M12 12.5a2.2 2.2 0 1 1 0 .1z M16.5 12.5a2.2 2.2 0 1 1 0 .1z',
      'M9.5 16.5a2.2 2.2 0 1 1 0 .1z M14.5 16.5a2.2 2.2 0 1 1 0 .1z',
      'M12 19.5a2 2 0 1 1 0 .1z',
    ],
  },
  {
    id: 'cherry',
    name: 'Вишня / Компот',
    category: 'canning',
    paths: [
      'M7.5 17.5a3.5 3.5 0 1 0 0 .1z',
      'M16.5 17.5a3.5 3.5 0 1 0 0 .1z',
      'M8 14C8.5 9 11 5.5 15 3.5',
      'M16.5 14C16 10 15 6.5 15 3.5',
      'M15 3.5c2 0 4 1 4.5 2.5-1.5 1-3.5.5-4.5-2.5z',
    ],
  },
  {
    id: 'apple',
    name: 'Яблоко / Сидр / Пюре',
    category: 'canning',
    paths: [
      'M12 7c-2.5-1-6-.5-6.5 4-.5 4.5 2 9.5 5 9.5.8 0 1.2-.4 1.5-.4s.7.4 1.5.4c3 0 5.5-5 5-9.5-.5-4.5-4-5-6.5-4z',
      'M12 7c0-2 1-3.5 2.5-4',
      'M13 4.5c2-.5 3.5.5 3.5 2-1.5.5-3 0-3.5-2z',
    ],
  },
  {
    id: 'chili',
    name: 'Перец / Аджика / Лечо',
    category: 'canning',
    paths: [
      'M15 6c2-1 3.5.5 3.5 2.5 0 4.5-3.5 10.5-10.5 12.5-2 .5-3-.5-2-2 3.5-3 5-7.5 5.5-10.5.3-1.5 1.5-2 3.5-2.5z',
      'M16.5 5.5c.5-1.5 1.5-2.5 3-2.5',
    ],
  },
  {
    id: 'mushroom',
    name: 'Грибы',
    category: 'canning',
    paths: [
      'M4 12c0-5 3.5-8.5 8-8.5s8 3.5 8 8.5H4z',
      'M9.5 12v6.5a2.5 2.5 0 0 0 5 0V12',
      'M8 8.5a1 1 0 1 0 0 .1z M13 7a1.2 1.2 0 1 0 0 .1z M15.5 9.5a.8.8 0 1 0 0 .1z',
    ],
  },
  {
    id: 'honey',
    name: 'Мёд / Соты',
    category: 'canning',
    paths: [
      'M12 3l4 2.3v4.6L12 12.2 8 9.9V5.3z',
      'M8 9.9l4 2.3v4.6L8 19.1 4 16.8v-4.6z',
      'M16 9.9l4 2.3v4.6l-4 2.3-4-2.3v-4.6z',
    ],
  },
  {
    id: 'bottle',
    name: 'Настойка / Вино / Масло',
    category: 'canning',
    paths: [
      'M10 2.5h4v3l2.5 4v10a1.5 1.5 0 0 1-1.5 1.5H9a1.5 1.5 0 0 1-1.5-1.5v-10l2.5-4z',
      'M7.5 12h9v5.5h-9z',
    ],
  },
  {
    id: 'snowflake',
    name: 'Заморозка в морозилку',
    category: 'canning',
    paths: [
      'M12 2v20 M2 12h20 M5 5l14 14 M19 5L5 19',
      'M9.5 4.5L12 7l2.5-2.5 M9.5 19.5L12 17l2.5 2.5',
      'M4.5 9.5L7 12l-2.5 2.5 M19.5 9.5L17 12l2.5 2.5',
    ],
  },
  {
    id: 'pumpkin',
    name: 'Тыква / Кабачок / Икра',
    category: 'canning',
    paths: [
      'M12 7C6.5 7 3.5 10 3.5 14.5S6.5 21 12 21s8.5-2 8.5-6.5S17.5 7 12 7z',
      'M12 7c-2.5 0-4 3-4 7.5S9.5 21 12 21s4-3 4-6.5S14.5 7 12 7z',
      'M11 3.5c1 0 1.5 1.5 1 3.5',
    ],
  },

  // === КУХНЯ, КРУПЫ И СПЕЦИИ ===
  {
    id: 'wheat',
    name: 'Крупы / Мука / Злаки',
    category: 'kitchen',
    paths: [
      'M12 21V4',
      'M12 7c-2.5 0-4-1.5-4-3.5 2.5 0 4 1.5 4 3.5z',
      'M12 7c2.5 0 4-1.5 4-3.5-2.5 0-4 1.5-4 3.5z',
      'M12 11c-2.5 0-4-1.5-4-3.5 2.5 0 4 1.5 4 3.5z',
      'M12 11c2.5 0 4-1.5 4-3.5-2.5 0-4 1.5-4 3.5z',
      'M12 15c-2.5 0-4-1.5-4-3.5 2.5 0 4 1.5 4 3.5z',
      'M12 15c2.5 0 4-1.5 4-3.5-2.5 0-4 1.5-4 3.5z',
    ],
  },
  {
    id: 'coffee',
    name: 'Кофе / Чай',
    category: 'kitchen',
    paths: [
      'M4 8h12v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8z',
      'M16 9.5h2.5a2.5 2.5 0 0 1 0 5H16',
      'M7.5 3.5v2.5 M10.5 3v3 M13.5 3.5v2.5',
    ],
  },
  {
    id: 'leaf',
    name: 'Специи / Травы / Чай',
    category: 'kitchen',
    paths: [
      'M5 19C5 10 11 4 20 4c0 9-6 15-15 15z',
      'M5 19L15 9',
      'M9 15h4 M12 12v-4',
    ],
  },
  {
    id: 'pot',
    name: 'Варка / Готовка',
    category: 'kitchen',
    paths: [
      'M5 9h14v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V9z',
      'M3 9h18 M9 6.5h6v2.5H9z',
      'M2.5 11.5H5 M19 11.5h2.5',
    ],
  },
  {
    id: 'clock',
    name: 'Срок годности / Время',
    category: 'kitchen',
    paths: [
      'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
      'M12 7v5.5l3.5 2',
    ],
  },

  // === КОРОБКИ, ХРАНЕНИЕ И ПЕРЕЕЗД ===
  {
    id: 'box',
    name: 'Коробка хранения',
    category: 'boxes',
    paths: [
      'M3 7.5L12 3l9 4.5v9L12 21l-9-4.5v-9z',
      'M3 7.5L12 12l9-4.5',
      'M12 12v9',
      'M7.5 5.25l9 4.5',
    ],
  },
  {
    id: 'fragile',
    name: 'Хрупкое / Стекло',
    category: 'boxes',
    paths: [
      'M7 3h10l-1 6.5a4 4 0 0 1-8 0L7 3z',
      'M12 13.5V20 M8 20h8',
      'M13 3l-2.5 3.5 2 1.5-2 3',
    ],
  },
  {
    id: 'arrows-up',
    name: 'Верх! Не кантовать',
    category: 'boxes',
    paths: [
      'M7.5 17V5 M4 8.5L7.5 5 11 8.5',
      'M16.5 17V5 M13 8.5L16.5 5 20 8.5',
      'M3.5 20h17',
    ],
  },
  {
    id: 'hanger',
    name: 'Одежда / Гардероб',
    category: 'boxes',
    paths: [
      'M12 7a2.2 2.2 0 1 1 2.2-2.2c0 1.4-2.2 2-2.2 3.7',
      'M12 8.5L2.5 16a1.2 1.2 0 0 0 .8 2h17.4a1.2 1.2 0 0 0 .8-2L12 8.5z',
    ],
  },
  {
    id: 'tools',
    name: 'Инструменты / Гараж',
    category: 'boxes',
    paths: [
      'M14.7 6.3a4.5 4.5 0 0 0-5.9 5.9l-5.3 5.3a1.8 1.8 0 0 0 2.5 2.5l5.3-5.3a4.5 4.5 0 0 0 5.9-5.9l-2.7 2.7-2.5-2.5 2.7-2.7z',
    ],
  },
  {
    id: 'tree',
    name: 'Новогодний декор / Сезон',
    category: 'boxes',
    paths: [
      'M12 3L6.5 10h3.5l-4.5 6.5h13L14 10h3.5L12 3z',
      'M10.5 16.5v4h3v-4',
    ],
  },
  {
    id: 'shoes',
    name: 'Обувь',
    category: 'boxes',
    paths: [
      'M3 16.5V10h5l3 3.5h7a3 3 0 0 1 3 3v2H3v-2z',
      'M3 18.5h18',
      'M8.5 11.5l1.5-1.5 M10.5 13l1.5-1.5',
    ],
  },

  // === ПОВСЕДНЕВНЫЕ ДЕЛА И ДОМ ===
  {
    id: 'med-cross',
    name: 'Аптечка / Лекарства',
    category: 'daily',
    paths: [
      'M9.5 3.5h5v6h6v5h-6v6h-5v-6h-6v-5h6v-6z',
    ],
  },
  {
    id: 'heart',
    name: 'С любовью / Ручная работа',
    category: 'daily',
    paths: [
      'M12 20.5S3.5 15 3.5 9A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 8.5 3c0 6-8.5 11.5-8.5 11.5z',
    ],
  },
  {
    id: 'gift',
    name: 'Подарок / Праздник',
    category: 'daily',
    paths: [
      'M3.5 8.5h17v3.5h-17z',
      'M5 12h14v8.5H5z',
      'M12 8.5v12',
      'M12 8.5c-2.5 0-4.5-1.5-4.5-3S9 3 12 6c3-3 4.5-2 4.5-.5s-2 3-4.5 3z',
    ],
  },
  {
    id: 'wifi',
    name: 'Wi-Fi для гостей',
    category: 'daily',
    paths: [
      'M2.5 9a14.5 14.5 0 0 1 19 0',
      'M5.8 12.8a10 10 0 0 1 12.4 0',
      'M9.2 16.5a5 5 0 0 1 5.6 0',
      'M12 19.5a.8.8 0 1 0 0 .2z',
    ],
  },
  {
    id: 'bolt',
    name: 'Кабель / Зарядка / Электро',
    category: 'daily',
    paths: [
      'M13 2.5L4.5 13.5h6.5L10 21.5l9.5-11.5H13l0-7.5z',
    ],
  },
  {
    id: 'cosmetic',
    name: 'Косметика / Срок вскрытия',
    category: 'daily',
    paths: [
      'M6 10.5h12v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-8z',
      'M5.5 8.5l12-3',
      'M9.5 15h5',
    ],
  },
  {
    id: 'warning',
    name: 'Важно! Внимание',
    category: 'daily',
    paths: [
      'M12 3L2.5 20h19L12 3z',
      'M12 9.5v5.5',
      'M12 17.5a.6.6 0 1 0 0 .2z',
    ],
  },
  {
    id: 'paw',
    name: 'Питомец / Корм',
    category: 'daily',
    paths: [
      'M12 13c-3 0-5 2-5 4.2 0 1.5 1.3 2.5 2.8 2.5 1 0 1.6-.4 2.2-.4s1.2.4 2.2.4c1.5 0 2.8-1 2.8-2.5 0-2.2-2-4.2-5-4.2z',
      'M6.5 10.5a1.6 1.6 0 1 0 0 .1z M10 7.5a1.6 1.6 0 1 0 0 .1z M14 7.5a1.6 1.6 0 1 0 0 .1z M17.5 10.5a1.6 1.6 0 1 0 0 .1z',
    ],
  },
];

export function getThermalIconById(id?: string): ThermalIconDef | undefined {
  if (!id) return undefined;
  return THERMAL_ICONS.find((i) => i.id === id);
}
