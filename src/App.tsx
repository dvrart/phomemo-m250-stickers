import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bookmark,
  BookmarkCheck,
  Calendar,
  CheckSquare,
  Copy,
  Download,
  Frame,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  Minus,
  PenTool,
  Plus,
  Printer,
  QrCode,
  RotateCcw,
  Search,
  Share2,
  Sliders,
  Smartphone,
  Sparkles,
  Trash2,
  Type,
  Wifi,
} from 'lucide-react';
import { ALL_STICKER_TEMPLATES } from './data/extraTemplates';
import {
  CATEGORIES,
  DOTS_PER_MM,
  FONT_OPTIONS,
  FRAME_OPTIONS,
  LABEL_SIZE_PRESETS,
} from './data/labelSizes';
import { THERMAL_ICONS } from './data/thermalIcons';
import {
  ChecklistItem,
  FrameStyle,
  LabelSizePreset,
  PrintQueueItem,
  StickerElement,
  StickerTemplate,
  TemplateCategory,
} from './types/sticker';
import {
  createCleanStickerCanvas,
} from './utils/phomemoPrinter';
import {
  ElementBoundingBox,
  preloadStickerImage,
  renderStickerToCanvas,
} from './utils/thermalCanvasRenderer';
import { PrintSheetModal } from './components/PrintSheetModal';
import { TemplateMiniPreview } from './components/TemplateMiniPreview';

type MainTab = 'catalog' | 'editor' | 'saved' | 'printer';
type EditorSubTab = 'quick' | 'design' | 'frames';

const SAVED_TEMPLATES_KEY = 'phomemo_m250_saved_templates_v1';
const PRINT_QUEUE_KEY = 'phomemo_m250_print_queue_v1';

export function App() {
  // Desktop preview wrapper mode: iPhone 14 Pro Max (430x932) frame vs full width
  const [phoneFrameMode, setPhoneFrameMode] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<MainTab>('catalog');
  const [editorSubTab, setEditorSubTab] = useState<EditorSubTab>('quick');

  // Catalog Filters
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sizeFilter, setSizeFilter] = useState<string>('all');

  // Active Sticker State in Editor
  const [currentTemplateId, setCurrentTemplateId] = useState<string>(ALL_STICKER_TEMPLATES[0].id);
  const [stickerName, setStickerName] = useState<string>(ALL_STICKER_TEMPLATES[0].name);
  const [sizePreset, setSizePreset] = useState<LabelSizePreset>(LABEL_SIZE_PRESETS[1]); // 50x30 default
  const [customWidthMm, setCustomWidthMm] = useState<number>(50);
  const [customHeightMm, setCustomHeightMm] = useState<number>(30);
  const [showCustomSizeModal, setShowCustomSizeModal] = useState<boolean>(false);

  const [frame, setFrame] = useState<FrameStyle>(ALL_STICKER_TEMPLATES[0].frame);
  const [elements, setElements] = useState<StickerElement[]>(() =>
     structuredClone(ALL_STICKER_TEMPLATES[0].elements)
  );
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    ALL_STICKER_TEMPLATES[0].elements.find((e) => e.type === 'text')?.id || null
  );

  // Saved templates & Print Queue
  const [savedTemplates, setSavedTemplates] = useState<StickerTemplate[]>(() => {
    try {
      const raw = localStorage.getItem(SAVED_TEMPLATES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [printQueue, setPrintQueue] = useState<PrintQueueItem[]>(() => {
    try {
      const raw = localStorage.getItem(PRINT_QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Wi-Fi QR quick helper state
  const [wifiSsid, setWifiSsid] = useState<string>('Home_5G');
  const [wifiPassword, setWifiPassword] = useState<string>('MySweetHome2026');

  // Canvas & Dragging Refs
  const editorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const boundingBoxesRef = useRef<ElementBoundingBox[]>([]);
  const draggingRef = useRef<{
    elementId: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_TEMPLATES_KEY, JSON.stringify(savedTemplates));
    } catch {
      // ignore storage quota errors
    }
  }, [savedTemplates]);

  useEffect(() => {
    try {
      localStorage.setItem(PRINT_QUEUE_KEY, JSON.stringify(printQueue));
    } catch {
      // ignore
    }
  }, [printQueue]);

  // Re-render interactive editor canvas whenever sticker state changes
  useEffect(() => {
    const canvas = editorCanvasRef.current;
    if (!canvas) return;
    const boxes = renderStickerToCanvas(canvas, {
      sizePreset,
      frame,
      elements,
      selectedElementId,
      dpiMultiplier: 2,
      showEditorGuides: true,
    });
    boundingBoxesRef.current = boxes;
  }, [sizePreset, frame, elements, selectedElementId, activeTab]);

  // Current template reference (for quickVariants)
  const currentBaseTemplate = useMemo(
    () =>
      ALL_STICKER_TEMPLATES.find((t) => t.id === currentTemplateId) ||
      savedTemplates.find((t) => t.id === currentTemplateId),
    [currentTemplateId, savedTemplates]
  );

  // Filtered catalog templates
  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ALL_STICKER_TEMPLATES.filter((tpl) => {
      if (selectedCategory !== 'all' && tpl.category !== selectedCategory) {
        return false;
      }
      if (sizeFilter !== 'all') {
        if (sizeFilter === 'round') {
          if (!tpl.defaultSizeId.includes('round')) return false;
        } else if (tpl.defaultSizeId !== sizeFilter) {
          return false;
        }
      }
      if (!q) return true;
      const inName = tpl.name.toLowerCase().includes(q);
      const inDesc = tpl.description.toLowerCase().includes(q);
      const inSub = tpl.subcategory.toLowerCase().includes(q);
      const inTags = tpl.tags.some((t) => t.toLowerCase().includes(q));
      const inVariants = tpl.quickVariants?.some((v) => v.label.toLowerCase().includes(q));
      return inName || inDesc || inSub || inTags || inVariants;
    });
  }, [selectedCategory, searchQuery, sizeFilter]);

  // Load a template into the Editor
  const loadTemplate = (
    tpl: StickerTemplate,
    variantOverride?: NonNullable<StickerTemplate['quickVariants']>[number]
  ) => {
    setCurrentTemplateId(tpl.id);
    setStickerName(variantOverride ? `${tpl.name} (${variantOverride.label})` : tpl.name);
    const foundSize =
      LABEL_SIZE_PRESETS.find((s) => s.id === tpl.defaultSizeId) || LABEL_SIZE_PRESETS[1];
    setSizePreset(foundSize);
    setFrame(tpl.frame);

    const cloned = structuredClone(tpl.elements);
    if (variantOverride) {
      cloned.forEach((el) => {
        if (el.type === 'text' && variantOverride.fields[el.id] !== undefined) {
          el.text = variantOverride.fields[el.id];
        }
        if (el.type === 'icon' && variantOverride.iconId) {
          el.iconId = variantOverride.iconId;
        }
      });
    }

    setElements(cloned);
    const firstText = cloned.find((e) => e.type === 'text');
    setSelectedElementId(firstText ? firstText.id : cloned[0]?.id || null);
    setActiveTab('editor');
    setEditorSubTab('quick');
  };

  // Apply a quick variant inside the editor
  const applyQuickVariant = (
    variant: NonNullable<StickerTemplate['quickVariants']>[number]
  ) => {
    setElements((prev) =>
      prev.map((el) => {
        if (el.type === 'text' && variant.fields[el.id] !== undefined) {
          return { ...el, text: variant.fields[el.id] };
        }
        if (el.type === 'icon' && variant.iconId) {
          return { ...el, iconId: variant.iconId };
        }
        return el;
      })
    );
    showToast(`Применён вариант: ${variant.label}`);
  };

  // Switch Label Size Preset (automatically adapts round seal if circle chosen)
  const handleSelectSizePreset = (preset: LabelSizePreset) => {
    setSizePreset(preset);
    if (preset.shape === 'circle' && frame !== 'circle-seal' && frame !== 'none') {
      setFrame('circle-seal');
    } else if (preset.shape === 'rect' && frame === 'circle-seal') {
      setFrame('classic-double');
    }
  };

  // Update a specific element by ID
  const updateElement = (id: string, patch: Partial<StickerElement>) => {
    setElements((prev) => prev.map((el) => (el.id === id ? { ...el, ...patch } : el)));
  };

  const selectedElement = useMemo(
    () => elements.find((e) => e.id === selectedElementId) || null,
    [elements, selectedElementId]
  );

  // Smart Quick Actions (Today's date, Season+Year, Box Number +1, Jar Volume)
  const insertTodayDate = () => {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const formatted = `${dd}.${mm}.${yyyy}`;

    setElements((prev) => {
      const target =
        prev.find((e) => e.id === selectedElementId && e.type === 'text') ||
        [...prev].reverse().find((e) => e.type === 'text');
      if (!target) return prev;
      return prev.map((el) =>
        el.id === target.id ? { ...el, text: `Дата: ${formatted}` } : el
      );
    });
    showToast(`Подставлена дата: ${formatted}`);
  };

  const insertMonthYear = () => {
    const months = [
      'Январь',
      'Февраль',
      'Март',
      'Апрель',
      'Май',
      'Июнь',
      'Июль',
      'Август',
      'Сентябрь',
      'Октябрь',
      'Ноябрь',
      'Декабрь',
    ];
    const now = new Date();
    const label = `Урожай: ${months[now.getMonth()]} ${now.getFullYear()}`;
    setElements((prev) => {
      const target =
        [...prev].reverse().find((e) => e.type === 'text') ||
        prev.find((e) => e.id === selectedElementId && e.type === 'text');
      if (!target) return prev;
      return prev.map((el) => (el.id === target.id ? { ...el, text: label } : el));
    });
    showToast(`Обновлено: ${label}`);
  };

  const incrementBoxNumber = () => {
    let incrementedNumber = 2;
    setElements((prev) =>
      prev.map((el) => {
        if (el.type !== 'text' || !el.text) return el;
        if (/(?:№|#)\s*(\d+)/i.test(el.text)) {
          return {
            ...el,
            text: el.text.replace(/(№|#)\s*(\d+)/i, (_, prefix, numStr) => {
              incrementedNumber = parseInt(numStr, 10) + 1;
              return `${prefix} ${incrementedNumber}`;
            }),
          };
        }
        return el;
      })
    );
    showToast(`Номер увеличен → № ${incrementedNumber}`);
  };

  const setJarVolumeTag = (vol: string) => {
    setElements((prev) => {
      const lastText = [...prev].reverse().find((e) => e.type === 'text');
      if (!lastText) return prev;
      const cleaned = (lastText.text || '').replace(/\s*•?\s*\d+(?:[.,]\d+)?\s*л\b/gi, '');
      return prev.map((el) =>
        el.id === lastText.id ? { ...el, text: `${cleaned} • ${vol}` } : el
      );
    });
    showToast(`Добавлен объём банки: ${vol}`);
  };

  // Add new elements to canvas
  const handleAddText = () => {
    const newEl: StickerElement = {
      id: `txt_${Date.now()}`,
      type: 'text',
      fieldLabel: 'Доп. надпись',
      text: 'НОВАЯ НАДПИСЬ',
      x: 50,
      y: 50,
      fontSize: 9,
      fontFamily: 'sans',
      fontWeight: 'bold',
      align: 'center',
    };
    setElements((prev) => [...prev, newEl]);
    setSelectedElementId(newEl.id);
    setEditorSubTab('design');
  };

  const handleAddIcon = (iconId = 'jar') => {
    const newEl: StickerElement = {
      id: `ic_${Date.now()}`,
      type: 'icon',
      iconId,
      x: 20,
      y: 45,
      iconSize: 24,
    };
    setElements((prev) => [...prev, newEl]);
    setSelectedElementId(newEl.id);
  };

  const handleAddQr = () => {
    const newEl: StickerElement = {
      id: `qr_${Date.now()}`,
      type: 'qr',
      qrData: 'Коробка №1: Зимние вещи, обувь, свитера',
      x: 78,
      y: 50,
      qrSize: 38,
    };
    setElements((prev) => [...prev, newEl]);
    setSelectedElementId(newEl.id);
    setEditorSubTab('quick');
    showToast('Добавлен QR-код! Введите список вещей или текст ниже');
  };

  const handleAddChecklist = () => {
    const newEl: StickerElement = {
      id: `cl_${Date.now()}`,
      type: 'checklist',
      x: 50,
      y: 55,
      width: 82,
      fontSize: 5.8,
      checklistItems: [
        { id: '1', text: 'Пункт списка 1', checked: false },
        { id: '2', text: 'Пункт списка 2', checked: false },
        { id: '3', text: 'Пункт списка 3', checked: false },
      ],
    };
    setElements((prev) => [...prev, newEl]);
    setSelectedElementId(newEl.id);
    setEditorSubTab('quick');
  };

  const handleAddDivider = () => {
    const newEl: StickerElement = {
      id: `div_${Date.now()}`,
      type: 'divider',
      dividerStyle: 'solid',
      x: 50,
      y: 70,
      width: 82,
      thickness: 1.5,
    };
    setElements((prev) => [...prev, newEl]);
    setSelectedElementId(newEl.id);
    setEditorSubTab('design');
  };

  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      await preloadStickerImage(dataUrl);
      const newEl: StickerElement = {
        id: `img_${Date.now()}`,
        type: 'image',
        imageUrl: dataUrl,
        x: 50,
        y: 48,
        imageSize: 48,
        ditherMode: 'atkinson',
        threshold: 135,
      };
      setElements((prev) => [...prev, newEl]);
      setSelectedElementId(newEl.id);
      setEditorSubTab('design');
      showToast('Фото преобразовано в ч/б термо-печать!');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Interactive Pointer Dragging on Sticker Canvas
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = editorCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Hit-test in reverse draw order (topmost element first)
    const boxes = [...boundingBoxesRef.current].reverse();
    const hit = boxes.find(
      (b) =>
        clickX >= b.x - 10 &&
        clickX <= b.x + b.width + 10 &&
        clickY >= b.y - 10 &&
        clickY <= b.y + b.height + 10
    );

    if (hit) {
      setSelectedElementId(hit.id);
      const el = elements.find((item) => item.id === hit.id);
      if (el) {
        draggingRef.current = {
          elementId: el.id,
          startClientX: e.clientX,
          startClientY: e.clientY,
          origX: el.x,
          origY: el.y,
        };
        canvas.setPointerCapture(e.pointerId);
      }
    } else {
      setSelectedElementId(null);
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = draggingRef.current;
    const canvas = editorCanvasRef.current;
    if (!drag || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dxPct = ((e.clientX - drag.startClientX) / rect.width) * 100;
    const dyPct = ((e.clientY - drag.startClientY) / rect.height) * 100;
    const nextX = Math.max(4, Math.min(96, Math.round((drag.origX + dxPct) * 2) / 2));
    const nextY = Math.max(4, Math.min(96, Math.round((drag.origY + dyPct) * 2) / 2));
    updateElement(drag.elementId, { x: nextX, y: nextY });
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggingRef.current && editorCanvasRef.current) {
      try {
        editorCanvasRef.current.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    draggingRef.current = null;
  };

  // Save current sticker to "Мои шаблоны"
  const handleSaveTemplate = () => {
    const customTpl: StickerTemplate = {
      id: `saved_${Date.now()}`,
      name: stickerName || 'Мой стикер',
      category: 'canning',
      subcategory: 'Мои сохранённые',
      defaultSizeId: sizePreset.id,
      frame,
      description: `${sizePreset.widthMm}×${sizePreset.heightMm} мм • Сохранённый шаблон`,
      tags: ['мои'],
      elements: structuredClone(elements),
    };
    setSavedTemplates((prev) => [customTpl, ...prev]);
    showToast('Стикер сохранён в «Мои стикеры»!');
  };

  // Add current sticker to batch Print Queue
  const handleAddToPrintQueue = (copies = 1) => {
    const cleanCanvas = createCleanStickerCanvas(sizePreset, frame, elements, 2);
    const item: PrintQueueItem = {
      id: `q_${Date.now()}`,
      name: stickerName,
      sizePreset,
      copies,
      dataUrl: cleanCanvas.toDataURL('image/png'),
      createdAt: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    };
    setPrintQueue((prev) => [item, ...prev]);
    showToast(`Добавлено в очередь печати (${copies} шт.)`);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-start sm:justify-center sm:py-4 sm:px-4 select-none">
      {/* Desktop Top Controls Bar (hidden on mobile iPhone viewport) */}
      <div className="hidden md:flex items-center justify-between w-full max-w-[920px] mb-3 px-4 py-2 rounded-2xl bg-slate-900/90 border border-slate-800 text-slate-300 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
            Phomemo M250 (20–75 мм • 203 DPI)
          </span>
          <span>
            Адаптировано под экран <b>iPhone 14 Pro Max (430 × 932 pt)</b>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPhoneFrameMode((v) => !v)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold flex items-center gap-1.5 transition"
          >
            <Smartphone className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {phoneFrameMode ? 'Рамка iPhone 14 Pro Max: ВКЛ' : 'Широкий режим экрана'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Container: iPhone 14 Pro Max 430x932 frame on desktop, 100% fullscreen on real iPhone */}
      <div
        className={`w-full bg-slate-50 flex flex-col overflow-hidden relative transition-all ${
          phoneFrameMode
            ? 'md:w-[430px] md:h-[900px] md:rounded-[52px] md:border-[10px] md:border-slate-800 md:shadow-[0_25px_70px_rgba(0,0,0,0.75)] min-h-screen md:min-h-0'
            : 'md:max-w-[920px] md:h-[900px] md:rounded-3xl md:border md:border-slate-800 min-h-screen md:min-h-0'
        }`}
      >
        {/* Simulated iPhone 14 Pro Max Dynamic Island Header (visible on desktop frame mode) */}
        {phoneFrameMode && (
          <div className="hidden md:flex items-center justify-between px-7 pt-2.5 pb-1.5 bg-slate-900 text-white text-xs font-semibold select-none shrink-0">
            <span>9:41</span>
            <div className="w-[120px] h-[28px] bg-black rounded-full flex items-center justify-end px-3 gap-1.5 shadow-inner border border-slate-800/80">
              <span className="w-2 h-2 rounded-full bg-emerald-500/80 animate-pulse" />
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-950 border border-slate-700" />
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span>5G</span>
              <div className="w-5 h-2.5 rounded-sm border border-white/80 p-0.5 flex items-center">
                <div className="w-full h-full bg-emerald-400 rounded-[1px]" />
              </div>
            </div>
          </div>
        )}

        {/* App Top Header */}
        <header className="bg-slate-900 text-white px-4 pt-2.5 pb-3 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/20">
              <Printer className="w-5 h-5 stroke-[2.3]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-extrabold tracking-tight text-white">
                  Phomemo M250
                </h1>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  3&quot; Термо
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Стикеры для закруток, банок, коробок и дома
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="px-3.5 py-2 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition"
          >
            <Share2 className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Печать</span>
          </button>
        </header>

        {/* Floating Toast Notification */}
        {toastMsg && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-2xl bg-slate-900/95 text-amber-300 text-xs font-bold shadow-xl border border-slate-700 whitespace-nowrap animate-bounce">
            {toastMsg}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 1: SHABLONY (TEMPLATE CATALOG — 31 TEMPLATES + 120+ VARIANTS) */}
        {/* ================================================================= */}
        {activeTab === 'catalog' && (
          <div className="flex-1 overflow-y-auto flex flex-col bg-slate-100">
            {/* Search & Quick Size Filter */}
            <div className="bg-white px-3.5 pt-3 pb-2.5 border-b border-slate-200 sticky top-0 z-20 space-y-2.5 shadow-sm">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Найти: огурцы, варенье, крышка, гречка, коробка, аптечка..."
                  className="w-full pl-9 pr-8 py-2 rounded-2xl bg-slate-100 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 hover:text-slate-700"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Category Horizontal Strip */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {CATEGORIES.map((cat) => {
                  const active = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition shrink-0 ${
                        active
                          ? 'bg-slate-900 text-amber-400 shadow-sm'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <span>{cat.emoji}</span>
                      <span>{cat.shortName}</span>
                    </button>
                  );
                })}
              </div>

              {/* Label Size Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[11px]">
                <span className="text-slate-400 font-semibold shrink-0">Лента:</span>
                {[
                  { id: 'all', label: 'Все размеры' },
                  { id: '40x30', label: '40×30 мм' },
                  { id: '50x30', label: '50×30 мм' },
                  { id: '70x40', label: '70×40 мм' },
                  { id: '70x80', label: '70×80 мм' },
                  { id: '50x50', label: '50×50 ■' },
                  { id: 'round', label: 'На крышки ●' },
                ].map((sz) => (
                  <button
                    key={sz.id}
                    onClick={() => setSizeFilter(sz.id)}
                    className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap shrink-0 transition ${
                      sizeFilter === sz.id
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {sz.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Template Cards Grid */}
            <div className="p-3 space-y-3 pb-6">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-slate-600">
                  Найдено шаблонов: {filteredTemplates.length} (и 120+ быстрых вариантов)
                </span>
                <button
                  onClick={() => {
                    setStickerName('Чистая этикетка');
                    setFrame('rounded-bold');
                    setElements([
                      {
                        id: 't1',
                        type: 'text',
                        fieldLabel: 'Заголовок',
                        text: 'МОЙ СТИКЕР',
                        x: 50,
                        y: 38,
                        fontSize: 13,
                        fontFamily: 'sans',
                        fontWeight: 'bold',
                        align: 'center',
                      },
                      {
                        id: 't2',
                        type: 'text',
                        fieldLabel: 'Подпись',
                        text: 'Подпись или дата • 2026',
                        x: 50,
                        y: 68,
                        fontSize: 7,
                        fontFamily: 'mono',
                        fontWeight: 'bold',
                        align: 'center',
                      },
                    ]);
                    setActiveTab('editor');
                  }}
                  className="text-xs font-extrabold text-amber-700 hover:text-amber-800 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>С нуля</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {filteredTemplates.map((tpl) => {
                  const preset =
                    LABEL_SIZE_PRESETS.find((s) => s.id === tpl.defaultSizeId) ||
                    LABEL_SIZE_PRESETS[1];
                  return (
                    <div
                      key={tpl.id}
                      className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition overflow-hidden p-3 flex flex-col gap-2.5"
                    >
                      <div className="flex items-center gap-3">
                        {/* Live Rendered Thermal Label Thumbnail */}
                        <div
                          onClick={() => loadTemplate(tpl)}
                          className="w-36 h-24 shrink-0 cursor-pointer"
                        >
                          <TemplateMiniPreview
                            sizePreset={preset}
                            frame={tpl.frame}
                            elements={tpl.elements}
                            className="w-full h-full"
                          />
                        </div>

                        {/* Template Info & Action */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-slate-900 text-amber-300 font-mono">
                              {preset.shortName}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 truncate">
                              {tpl.subcategory}
                            </span>
                          </div>
                          <h3
                            onClick={() => loadTemplate(tpl)}
                            className="text-sm font-extrabold text-slate-900 mt-1 leading-snug cursor-pointer hover:text-amber-700"
                          >
                            {tpl.name}
                          </h3>
                          <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                            {tpl.description}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              onClick={() => loadTemplate(tpl)}
                              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-extrabold text-xs flex items-center gap-1 shadow-sm"
                            >
                              <PenTool className="w-3.5 h-3.5" />
                              <span>Выбрать и изменить</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Quick 1-Tap Variants Strip (e.g. Клубника / Малина / Вишня / Абрикос) */}
                      {tpl.quickVariants && tpl.quickVariants.length > 0 && (
                        <div className="pt-2 border-t border-slate-100">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                            Быстрый выбор варианта в 1 нажатие:
                          </div>
                          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                            {tpl.quickVariants.map((v, idx) => (
                              <button
                                key={idx}
                                onClick={() => loadTemplate(tpl, v)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-amber-100 hover:text-amber-950 text-slate-700 text-[11px] font-bold whitespace-nowrap shrink-0 active:scale-95 transition border border-slate-200/80"
                              >
                                {v.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: KONSTRUKTOR (INTERACTIVE STICKER EDITOR FOR M250)          */}
        {/* ================================================================= */}
        {activeTab === 'editor' && (
          <div className="flex-1 overflow-y-auto flex flex-col bg-slate-100">
            {/* Top Size Selector Strip */}
            <div className="bg-white px-3 py-2 border-b border-slate-200 shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  Размер наклейки Phomemo M250:
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowCustomSizeModal((v) => !v)}
                    className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
                  >
                    Свой размер (20–75 мм)
                  </button>
                  <button
                    onClick={handleSaveTemplate}
                    className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 flex items-center gap-1"
                  >
                    <Bookmark className="w-3 h-3" />
                    <span>Сохранить</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {LABEL_SIZE_PRESETS.map((preset) => {
                  const active = sizePreset.id === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => handleSelectSizePreset(preset)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-extrabold whitespace-nowrap shrink-0 transition ${
                        active
                          ? 'bg-slate-900 text-amber-400 shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {preset.shortName}
                    </button>
                  );
                })}
              </div>

              {/* Optional Custom Size Drawer (20-75 mm for M250) */}
              {showCustomSizeModal && (
                <div className="mt-2 p-2.5 rounded-xl bg-slate-900 text-white flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-slate-300">Ширина (20–75):</label>
                    <input
                      type="number"
                      min={20}
                      max={75}
                      value={customWidthMm}
                      onChange={(e) => setCustomWidthMm(Number(e.target.value))}
                      className="w-14 px-2 py-1 rounded bg-slate-800 text-white font-mono font-bold text-center"
                    />
                    <label className="text-[11px] text-slate-300">Высота (15–120):</label>
                    <input
                      type="number"
                      min={15}
                      max={120}
                      value={customHeightMm}
                      onChange={(e) => setCustomHeightMm(Number(e.target.value))}
                      className="w-14 px-2 py-1 rounded bg-slate-800 text-white font-mono font-bold text-center"
                    />
                  </div>
                  <button
                    onClick={() => {
                      const w = Math.max(20, Math.min(75, customWidthMm || 50));
                      const h = Math.max(15, Math.min(120, customHeightMm || 30));
                      setSizePreset({
                        id: `custom_${w}x${h}`,
                        name: `${w} × ${h} мм (Свой)`,
                        shortName: `${w}×${h} мм`,
                        widthMm: w,
                        heightMm: h,
                        shape: 'rect',
                        description: 'Пользовательский размер M250',
                        recommendedFor: 'Под любой рулон 20–75 мм',
                      });
                      setShowCustomSizeModal(false);
                    }}
                    className="px-3 py-1 rounded-lg bg-amber-500 text-slate-950 font-extrabold"
                  >
                    ОК
                  </button>
                </div>
              )}
            </div>

            {/* Interactive Thermal Sticker Canvas Stage */}
            <div className="bg-slate-200/80 px-4 py-3 flex flex-col items-center justify-center border-b border-slate-300/80 relative">
              <div className="mb-1.5 flex items-center justify-between w-full text-[11px] text-slate-600 font-mono">
                <span>
                  Лента: <b>{sizePreset.widthMm}×{sizePreset.heightMm} мм</b> ({sizePreset.widthMm * DOTS_PER_MM}×{sizePreset.heightMm * DOTS_PER_MM} тчк)
                </span>
                <span className="text-slate-500">Касайтесь элементов для перемещения</span>
              </div>

              {/* Backing Paper + Sticker Shadow */}
              <div className="p-2.5 rounded-2xl bg-sky-100/70 border border-sky-200/90 shadow-inner flex items-center justify-center max-w-full">
                <canvas
                  ref={editorCanvasRef}
                  onPointerDown={handleCanvasPointerDown}
                  onPointerMove={handleCanvasPointerMove}
                  onPointerUp={handleCanvasPointerUp}
                  className={`bg-white shadow-lg border border-slate-300 touch-none cursor-grab active:cursor-grabbing ${
                    sizePreset.shape === 'circle' ? 'rounded-full' : 'rounded-lg'
                  }`}
                  style={{
                    maxHeight: sizePreset.heightMm >= 70 ? '230px' : '185px',
                    maxWidth: '100%',
                    aspectRatio: `${sizePreset.widthMm} / ${sizePreset.heightMm}`,
                  }}
                />
              </div>

              {/* Quick Print / Add to Queue Bar right below the canvas */}
              <div className="mt-2.5 w-full flex items-center gap-2">
                <button
                  onClick={() => setIsPrintModalOpen(true)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-extrabold text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4 stroke-[2.4]" />
                  <span>Напечатать / В Print Master ({sizePreset.shortName})</span>
                </button>
                <button
                  onClick={() => handleAddToPrintQueue(1)}
                  title="В пакетную очередь"
                  className="py-2.5 px-3 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center gap-1 active:scale-95"
                >
                  <Plus className="w-4 h-4 text-amber-400" />
                  <span>В очередь</span>
                </button>
              </div>
            </div>

            {/* Editor Mode Switcher Tabs */}
            <div className="grid grid-cols-3 bg-white border-b border-slate-200 p-1 gap-1 shrink-0">
              <button
                onClick={() => setEditorSubTab('quick')}
                className={`py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                  editorSubTab === 'quick'
                    ? 'bg-slate-900 text-amber-400 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Текст и Даты</span>
              </button>
              <button
                onClick={() => setEditorSubTab('design')}
                className={`py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                  editorSubTab === 'design'
                    ? 'bg-slate-900 text-amber-400 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Шрифт и Слой</span>
              </button>
              <button
                onClick={() => setEditorSubTab('frames')}
                className={`py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                  editorSubTab === 'frames'
                    ? 'bg-slate-900 text-amber-400 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Frame className="w-3.5 h-3.5" />
                <span>Рамки и Значки</span>
              </button>
            </div>

            {/* SUB-TAB 1: QUICK FILL (БЫСТРОЕ ЗАПОЛНЕНИЕ ТЕКСТА, ВАРИАНТОВ, ДАТ, QR И СПИСКОВ) */}
            {editorSubTab === 'quick' && (
              <div className="p-3.5 space-y-3.5 pb-8">
                {/* Quick Variants of Current Template */}
                {currentBaseTemplate?.quickVariants &&
                  currentBaseTemplate.quickVariants.length > 0 && (
                    <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm">
                      <div className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">
                        Готовые варианты для этого шаблона (в 1 тап):
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {currentBaseTemplate.quickVariants.map((variant, idx) => (
                          <button
                            key={idx}
                            onClick={() => applyQuickVariant(variant)}
                            className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200/80 text-xs font-bold active:scale-95 transition"
                          >
                            {variant.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                {/* 1-Tap Smart Helpers (Auto-Date, Jar Volume, Box Counter) */}
                <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm space-y-2">
                  <div className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                    Быстрые подстановки для банок и коробок:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={insertTodayDate}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1 active:scale-95"
                    >
                      <Calendar className="w-3.5 h-3.5 text-amber-600" />
                      <span>Сегодняшняя дата</span>
                    </button>
                    <button
                      onClick={insertMonthYear}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold active:scale-95"
                    >
                      🍂 Урожай: Месяц 2026
                    </button>
                    <button
                      onClick={incrementBoxNumber}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-900 text-amber-300 text-xs font-bold active:scale-95"
                    >
                      🔢 Коробка № +1
                    </button>
                    {['0.5 л', '0.7 л', '1.0 л', '1.5 л', '3.0 л'].map((vol) => (
                      <button
                        key={vol}
                        onClick={() => setJarVolumeTag(vol)}
                        className="px-2 py-1.5 rounded-xl bg-slate-100 hover:bg-amber-100 text-slate-700 text-xs font-bold active:scale-95"
                      >
                        🫙 {vol}
                      </button>
                    ))}
                  </div>
                </div>

                {/* All Text Fields on Sticker */}
                <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                      Надписи на этикетке
                    </span>
                    <button
                      onClick={handleAddText}
                      className="text-xs font-extrabold text-amber-700 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Добавить строку</span>
                    </button>
                  </div>

                  {elements
                    .filter((el) => el.type === 'text')
                    .map((el, idx) => (
                      <div key={el.id} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-500">
                            {el.fieldLabel || `Строка ${idx + 1}`}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                updateElement(el.id, { inverted: !el.inverted })
                              }
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                el.inverted
                                  ? 'bg-slate-900 text-white'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {el.inverted ? 'Чёрная плашка: ВКЛ' : 'Чёрная плашка'}
                            </button>
                            <button
                              onClick={() => {
                                setSelectedElementId(el.id);
                                setEditorSubTab('design');
                              }}
                              className="text-amber-700 font-bold"
                            >
                              Шрифт/Размер
                            </button>
                          </div>
                        </div>
                        <input
                          type="text"
                          value={el.text || ''}
                          onFocus={() => setSelectedElementId(el.id)}
                          onChange={(e) => updateElement(el.id, { text: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                        />
                      </div>
                    ))}
                </div>

                {/* Checklist Editor (if sticker contains a checklist) */}
                {elements
                  .filter((el) => el.type === 'checklist')
                  .map((clEl) => (
                    <div
                      key={clEl.id}
                      className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                          Пункты чек-листа / описи коробки
                        </span>
                        <button
                          onClick={() => {
                            const items: ChecklistItem[] = [
                              ...(clEl.checklistItems || []),
                              {
                                id: `${Date.now()}`,
                                text: 'Новый пункт',
                                checked: false,
                              },
                            ];
                            updateElement(clEl.id, { checklistItems: items });
                          }}
                          className="text-xs font-extrabold text-amber-700 flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ Пункт</span>
                        </button>
                      </div>

                      <div className="space-y-2">
                        {(clEl.checklistItems || []).map((item, idx) => (
                          <div key={item.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={item.checked}
                              onChange={(e) => {
                                const next = (clEl.checklistItems || []).map((it, i) =>
                                  i === idx ? { ...it, checked: e.target.checked } : it
                                );
                                updateElement(clEl.id, { checklistItems: next });
                              }}
                              className="w-4 h-4 rounded accent-slate-900"
                            />
                            <input
                              type="text"
                              value={item.text}
                              onChange={(e) => {
                                const next = (clEl.checklistItems || []).map((it, i) =>
                                  i === idx ? { ...it, text: e.target.value } : it
                                );
                                updateElement(clEl.id, { checklistItems: next });
                              }}
                              className="flex-1 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900"
                            />
                            <button
                              onClick={() => {
                                const next = (clEl.checklistItems || []).filter(
                                  (_, i) => i !== idx
                                );
                                updateElement(clEl.id, { checklistItems: next });
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                {/* QR Code Editor (if sticker contains a QR code) */}
                {elements
                  .filter((el) => el.type === 'qr')
                  .map((qrEl) => (
                    <div
                      key={qrEl.id}
                      className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <QrCode className="w-4 h-4 text-amber-600" />
                          <span>Содержимое QR-кода (читается камерой iPhone)</span>
                        </span>
                      </div>
                      <textarea
                        rows={3}
                        value={qrEl.qrData || ''}
                        onChange={(e) => updateElement(qrEl.id, { qrData: e.target.value })}
                        placeholder="Введите список вещей в коробке, рецепт закрутки или ссылку..."
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono text-slate-900"
                      />

                      {/* Quick Wi-Fi QR Builder */}
                      <div className="p-2.5 rounded-xl bg-slate-100 space-y-2">
                        <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                          <Wifi className="w-3.5 h-3.5 text-slate-700" />
                          <span>Генератор QR для домашнего Wi-Fi:</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={wifiSsid}
                            onChange={(e) => setWifiSsid(e.target.value)}
                            placeholder="Имя сети (SSID)"
                            className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs"
                          />
                          <input
                            type="text"
                            value={wifiPassword}
                            onChange={(e) => setWifiPassword(e.target.value)}
                            placeholder="Пароль Wi-Fi"
                            className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs"
                          />
                        </div>
                        <button
                          onClick={() => {
                            updateElement(qrEl.id, {
                              qrData: `WIFI:T:WPA;S:${wifiSsid};P:${wifiPassword};;`,
                            });
                            showToast('QR-код настроен на автоматический вход в Wi-Fi!');
                          }}
                          className="w-full py-1.5 rounded-lg bg-slate-900 text-amber-300 text-xs font-bold"
                        >
                          Записать Wi-Fi в QR-код
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* SUB-TAB 2: DESIGN & ELEMENT INSPECTOR (ШРИФТЫ, СЛОИ, ДОБАВЛЕНИЕ QR/ФОТО/ЧЕК-ЛИСТА) */}
            {editorSubTab === 'design' && (
              <div className="p-3.5 space-y-3.5 pb-8">
                {/* Add New Elements Toolbar */}
                <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm">
                  <div className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">
                    Добавить на этикетку:
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={handleAddText}
                      className="py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <Type className="w-3.5 h-3.5 text-amber-600" />
                      <span>+ Текст</span>
                    </button>
                    <button
                      onClick={() => {
                        handleAddIcon('cucumber');
                        setEditorSubTab('frames');
                      }}
                      className="py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>+ Значок</span>
                    </button>
                    <button
                      onClick={handleAddQr}
                      className="py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <QrCode className="w-3.5 h-3.5 text-amber-600" />
                      <span>+ QR-код</span>
                    </button>
                    <button
                      onClick={handleAddChecklist}
                      className="py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <CheckSquare className="w-3.5 h-3.5 text-amber-600" />
                      <span>+ Чек-лист</span>
                    </button>
                    <button
                      onClick={handleAddDivider}
                      className="py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <Minus className="w-3.5 h-3.5 text-amber-600" />
                      <span>+ Линия</span>
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="py-2 px-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-amber-700" />
                      <span>+ Фото Ч/Б</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleUploadImage}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Element Layer Pills */}
                <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm">
                  <div className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">
                    Выберите элемент для настройки:
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                    {elements.map((el, i) => {
                      const active = el.id === selectedElementId;
                      const label =
                        el.type === 'text'
                          ? el.text?.slice(0, 16) || `Текст ${i + 1}`
                          : el.type === 'icon'
                          ? 'Значок'
                          : el.type === 'qr'
                          ? 'QR-код'
                          : el.type === 'checklist'
                          ? 'Чек-лист'
                          : el.type === 'image'
                          ? 'Фото Ч/Б'
                          : 'Линия';
                      return (
                        <button
                          key={el.id}
                          onClick={() => setSelectedElementId(el.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition ${
                            active
                              ? 'bg-slate-900 text-amber-400'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Element Inspector */}
                {selectedElement ? (
                  <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-extrabold text-slate-800">
                        Настройка выбранного элемента
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            const copy: StickerElement = {
                              ...structuredClone(selectedElement),
                              id: `dup_${Date.now()}`,
                              y: Math.min(92, selectedElement.y + 8),
                            };
                            setElements((prev) => [...prev, copy]);
                            setSelectedElementId(copy.id);
                          }}
                          className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                          title="Дублировать"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setElements((prev) =>
                              prev.filter((e) => e.id !== selectedElement.id)
                            );
                            setSelectedElementId(null);
                          }}
                          className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100"
                          title="Удалить элемент"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Text-specific styling controls */}
                    {selectedElement.type === 'text' && (
                      <>
                        {/* Font Family Grid */}
                        <div>
                          <label className="text-[11px] font-bold text-slate-500 block mb-1.5">
                            Шрифт кириллицы:
                          </label>
                          <div className="grid grid-cols-2 gap-1.5">
                            {FONT_OPTIONS.map((f) => (
                              <button
                                key={f.id}
                                onClick={() =>
                                  updateElement(selectedElement.id, { fontFamily: f.id })
                                }
                                style={{ fontFamily: f.cssFamily }}
                                className={`px-2.5 py-2 rounded-xl border text-left flex items-center justify-between transition ${
                                  selectedElement.fontFamily === f.id
                                    ? 'bg-slate-900 text-amber-300 border-slate-900'
                                    : 'bg-slate-50 text-slate-800 border-slate-200'
                                }`}
                              >
                                <span className="text-xs font-bold truncate">{f.name}</span>
                                <span className="text-[11px] opacity-75">{f.sample}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Font Size & Alignment & Inverted Band */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-600">
                              Размер текста: {selectedElement.fontSize ?? 8}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() =>
                                  updateElement(selectedElement.id, { align: 'left' })
                                }
                                className={`p-1.5 rounded-lg ${
                                  selectedElement.align === 'left'
                                    ? 'bg-slate-900 text-white'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                <AlignLeft className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() =>
                                  updateElement(selectedElement.id, { align: 'center' })
                                }
                                className={`p-1.5 rounded-lg ${
                                  (selectedElement.align ?? 'center') === 'center'
                                    ? 'bg-slate-900 text-white'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                <AlignCenter className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() =>
                                  updateElement(selectedElement.id, { align: 'right' })
                                }
                                className={`p-1.5 rounded-lg ${
                                  selectedElement.align === 'right'
                                    ? 'bg-slate-900 text-white'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                <AlignRight className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() =>
                                  updateElement(selectedElement.id, {
                                    inverted: !selectedElement.inverted,
                                  })
                                }
                                className={`px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                                  selectedElement.inverted
                                    ? 'bg-slate-900 text-amber-300'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                Инверсия Ч/Б
                              </button>
                            </div>
                          </div>

                          <input
                            type="range"
                            min={4}
                            max={24}
                            step={0.5}
                            value={selectedElement.fontSize ?? 8}
                            onChange={(e) =>
                              updateElement(selectedElement.id, {
                                fontSize: parseFloat(e.target.value),
                              })
                            }
                            className="w-full accent-amber-500"
                          />
                        </div>
                      </>
                    )}

                    {/* Icon size control */}
                    {selectedElement.type === 'icon' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                          <span>Размер значка: {selectedElement.iconSize ?? 22}%</span>
                          <button
                            onClick={() => setEditorSubTab('frames')}
                            className="text-amber-700 underline"
                          >
                            Сменить картинку значка →
                          </button>
                        </div>
                        <input
                          type="range"
                          min={10}
                          max={50}
                          value={selectedElement.iconSize ?? 22}
                          onChange={(e) =>
                            updateElement(selectedElement.id, {
                              iconSize: Number(e.target.value),
                            })
                          }
                          className="w-full accent-amber-500"
                        />
                      </div>
                    )}

                    {/* QR size control */}
                    {selectedElement.type === 'qr' && (
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-slate-700 block">
                          Размер QR-кода: {selectedElement.qrSize ?? 38}%
                        </span>
                        <input
                          type="range"
                          min={22}
                          max={65}
                          value={selectedElement.qrSize ?? 38}
                          onChange={(e) =>
                            updateElement(selectedElement.id, {
                              qrSize: Number(e.target.value),
                            })
                          }
                          className="w-full accent-amber-500"
                        />
                      </div>
                    )}

                    {/* Uploaded Photo Thermal Dithering Controls */}
                    {selectedElement.type === 'image' && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                          <span>Режим термопечати фото:</span>
                          <div className="flex gap-1">
                            <button
                              onClick={() =>
                                updateElement(selectedElement.id, { ditherMode: 'atkinson' })
                              }
                              className={`px-2 py-1 rounded text-xs ${
                                (selectedElement.ditherMode ?? 'atkinson') === 'atkinson'
                                  ? 'bg-slate-900 text-amber-300'
                                  : 'bg-slate-100'
                              }`}
                            >
                              Газетный растр (Atkinson)
                            </button>
                            <button
                              onClick={() =>
                                updateElement(selectedElement.id, { ditherMode: 'threshold' })
                              }
                              className={`px-2 py-1 rounded text-xs ${
                                selectedElement.ditherMode === 'threshold'
                                  ? 'bg-slate-900 text-amber-300'
                                  : 'bg-slate-100'
                              }`}
                            >
                              Силуэт / Лого
                            </button>
                          </div>
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-slate-500">
                            Размер фото ({selectedElement.imageSize ?? 48}%):
                          </span>
                          <input
                            type="range"
                            min={18}
                            max={85}
                            value={selectedElement.imageSize ?? 48}
                            onChange={(e) =>
                              updateElement(selectedElement.id, {
                                imageSize: Number(e.target.value),
                              })
                            }
                            className="w-full accent-amber-500"
                          />
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-slate-500">
                            Плотность чёрного ({selectedElement.threshold ?? 135}):
                          </span>
                          <input
                            type="range"
                            min={50}
                            max={220}
                            value={selectedElement.threshold ?? 135}
                            onChange={(e) =>
                              updateElement(selectedElement.id, {
                                threshold: Number(e.target.value),
                              })
                            }
                            className="w-full accent-amber-500"
                          />
                        </div>
                      </div>
                    )}

                    {/* Fine X / Y Position Sliders */}
                    <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">
                          По горизонтали (X: {Math.round(selectedElement.x)}%)
                        </span>
                        <input
                          type="range"
                          min={5}
                          max={95}
                          value={selectedElement.x}
                          onChange={(e) =>
                            updateElement(selectedElement.id, { x: Number(e.target.value) })
                          }
                          className="w-full accent-slate-800"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">
                          По вертикали (Y: {Math.round(selectedElement.y)}%)
                        </span>
                        <input
                          type="range"
                          min={6}
                          max={94}
                          value={selectedElement.y}
                          onChange={(e) =>
                            updateElement(selectedElement.id, { y: Number(e.target.value) })
                          }
                          className="w-full accent-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 text-center text-xs text-slate-500">
                    Коснитесь любого текста или значка на этикетке выше, чтобы изменить его шрифт и размер.
                  </div>
                )}
              </div>
            )}

            {/* SUB-TAB 3: FRAMES & THERMAL VECTOR ICONS (12 РАМОК + 34 ТЕРМО-ИКОНКИ) */}
            {editorSubTab === 'frames' && (
              <div className="p-3.5 space-y-4 pb-8">
                {/* Frame Picker */}
                <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm">
                  <div className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2.5">
                    Рамка этикетки ({FRAME_OPTIONS.length} стилей):
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {FRAME_OPTIONS.map((fr) => {
                      const active = frame === fr.id;
                      return (
                        <button
                          key={fr.id}
                          onClick={() => setFrame(fr.id)}
                          className={`p-2.5 rounded-xl border text-left transition ${
                            active
                              ? 'bg-slate-900 text-amber-300 border-slate-900 shadow-sm'
                              : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <div className="text-xs font-extrabold">{fr.name}</div>
                          <div
                            className={`text-[10px] mt-0.5 line-clamp-1 ${
                              active ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            {fr.description}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Thermal Icons Picker (34 crisp monochrome vector illustrations) */}
                <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                      Ч/Б Термо-рисунки ({THERMAL_ICONS.length} шт.):
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Нажмите для замены или добавления
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {THERMAL_ICONS.map((icon) => {
                      const existingIconEl =
                        elements.find(
                          (e) => e.id === selectedElementId && e.type === 'icon'
                        ) || elements.find((e) => e.type === 'icon');
                      const isCurrent = existingIconEl?.iconId === icon.id;

                      return (
                        <button
                          key={icon.id}
                          onClick={() => {
                            if (existingIconEl) {
                              updateElement(existingIconEl.id, { iconId: icon.id });
                              setSelectedElementId(existingIconEl.id);
                              showToast(`Значок изменён: ${icon.name}`);
                            } else {
                              handleAddIcon(icon.id);
                              showToast(`Добавлен значок: ${icon.name}`);
                            }
                          }}
                          className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition active:scale-95 ${
                            isCurrent
                              ? 'bg-amber-100 border-amber-500 text-slate-950 shadow-sm'
                              : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                          }`}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="w-7 h-7 stroke-current fill-none"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            {icon.paths.map((d, idx) => (
                              <path key={idx} d={d} />
                            ))}
                          </svg>
                          <span className="text-[10px] font-bold text-center leading-tight line-clamp-1">
                            {icon.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: OCHERED PECHATI & MOI SHABLONY (SAVED & BATCH PRINT QUEUE) */}
        {/* ================================================================= */}
        {activeTab === 'saved' && (
          <div className="flex-1 overflow-y-auto p-3.5 space-y-4 bg-slate-100">
            {/* Batch Print Queue */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">
                    Пакетная очередь печати ({printQueue.length})
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Соберите несколько наклеек для разных банок и коробок
                  </p>
                </div>
                {printQueue.length > 0 && (
                  <button
                    onClick={() => setPrintQueue([])}
                    className="text-xs font-bold text-rose-600 hover:underline"
                  >
                    Очистить
                  </button>
                )}
              </div>

              {printQueue.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  Очередь пуста. В конструкторе нажмите «+ В очередь», чтобы собрать партию стикеров для распечатки.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {printQueue.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200"
                    >
                      <img
                        src={item.dataUrl}
                        alt={item.name}
                        className="w-20 h-14 object-contain bg-white rounded border border-slate-300 p-0.5 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-extrabold text-slate-900 truncate">
                          {item.name}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {item.sizePreset.shortName} • Копий: {item.copies} шт.
                        </div>
                      </div>
                      <a
                        href={item.dataUrl}
                        download={`M250_${item.sizePreset.widthMm}x${item.sizePreset.heightMm}mm_${item.name}.png`}
                        className="p-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() =>
                          setPrintQueue((prev) => prev.filter((q) => q.id !== item.id))
                        }
                        className="p-2 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Saved Custom Stickers */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">
                  Мои сохранённые шаблоны ({savedTemplates.length})
                </h2>
                <p className="text-[11px] text-slate-500">
                  Ваши любимые семейные рецепты закруток и подписи коробок
                </p>
              </div>

              {savedTemplates.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  Нажмите кнопку «Сохранить» в конструкторе, чтобы добавить свой шаблон сюда.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {savedTemplates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200"
                    >
                      <div className="w-24 h-16 shrink-0">
                        <TemplateMiniPreview
                          sizeId={tpl.defaultSizeId}
                          frame={tpl.frame}
                          elements={tpl.elements}
                          className="w-full h-full"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-extrabold text-slate-900 truncate">
                          {tpl.name}
                        </div>
                        <div className="text-[11px] text-slate-500">{tpl.description}</div>
                        <button
                          onClick={() => loadTemplate(tpl)}
                          className="mt-1.5 px-3 py-1 rounded-lg bg-slate-900 text-amber-300 text-[11px] font-bold"
                        >
                          Открыть в редакторе
                        </button>
                      </div>
                      <button
                        onClick={() =>
                          setSavedTemplates((prev) => prev.filter((s) => s.id !== tpl.id))
                        }
                        className="p-2 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: PRINTER PHOMEMO M250 GUIDE & BLUETOOTH SETUP               */}
        {/* ================================================================= */}
        {activeTab === 'printer' && (
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 bg-slate-100 pb-8">
            {/* Printer Spec Card matching User's Photo */}
            <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-md space-y-2.5 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-md bg-amber-500 text-slate-950 text-[11px] font-extrabold">
                  Ваше устройство
                </span>
                <span className="text-xs font-mono text-slate-400">IC: 29002-3INCH</span>
              </div>
              <h2 className="text-base font-extrabold">
                Phomemo M250 — Multifunctional Portable Label Maker
              </h2>
              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="bg-slate-800/90 p-2.5 rounded-xl">
                  <div className="text-slate-400 text-[10px]">Ширина этикеток</div>
                  <div className="font-bold text-amber-300 mt-0.5">от 20 до 75 мм (3 дюйма)</div>
                </div>
                <div className="bg-slate-800/90 p-2.5 rounded-xl">
                  <div className="text-slate-400 text-[10px]">Разрешение термоголовки</div>
                  <div className="font-bold text-emerald-300 mt-0.5">203 DPI (8 точек/мм)</div>
                </div>
              </div>
            </div>

            {/* Step-by-Step Guide for iPhone 14 Pro Max */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-sm font-extrabold text-slate-900">
                📱 Как печатать с iPhone 14 Pro Max на Phomemo M250
              </h3>
              <ol className="space-y-2.5 text-xs text-slate-700">
                <li className="flex gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-extrabold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <div>
                    <b>Установите приложение Print Master</b> из App Store (официальное бесплатное приложение для Phomemo M250) и подключите принтер по Bluetooth внутри него.
                  </div>
                </li>
                <li className="flex gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-extrabold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <div>
                    <b>Выберите любой шаблон</b> в нашей студии (для огурцов, варенья, круп или коробки), укажите размер вашего рулона (например, <b>40×30</b>, <b>50×30</b> или <b>70×40 мм</b>).
                  </div>
                </li>
                <li className="flex gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-extrabold flex items-center justify-center shrink-0">
                    3
                  </span>
                  <div>
                    Нажмите кнопку <b>«Печать» → «Отправить в Print Master / Фото»</b>. В открывшемся меню iPhone выберите <b>Print Master</b> (или «Сохранить изображение» и откройте его в Print Master → Изображение).
                  </div>
                </li>
              </ol>
            </div>

            {/* How to calibrate M250 roll */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-2">
              <h3 className="text-sm font-extrabold text-slate-900">
                💡 Полезные советы для Phomemo M250
              </h3>
              <ul className="space-y-2 text-xs text-slate-600 list-disc list-inside">
                <li>
                  <b>Калибровка ленты после замены рулона:</b> включите M250, вставьте рулон этикетками вверх, зафиксируйте направляющие по ширине и <b>один раз коротко нажмите кнопку питания</b> — принтер сам выровняет зазор между наклейками!
                </li>
                <li>
                  <b>Для банок и морозилки:</b> термоэтикетки Phomemo влагостойкие и маслостойкие — они отлично держатся на стеклянных банках в погребе, холодильнике и морозильной камере.
                </li>
                <li>
                  <b>Иконка на экран «Домой» iPhone 14 Pro Max:</b> в Safari нажмите кнопку <b>«Поделиться»</b> внизу экрана и выберите <b>«На экран Домой»</b> — приложение будет открываться во весь экран как родное!
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* BOTTOM NAVIGATION BAR (WITH IPHONE 14 PRO MAX SAFE AREA SUPPORT)  */}
        {/* ================================================================= */}
        <nav className="bg-white border-t border-slate-200 px-2 pt-1.5 pb-3 md:pb-4 grid grid-cols-4 gap-1 shrink-0 z-30">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`py-1.5 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition ${
              activeTab === 'catalog'
                ? 'text-slate-950 font-extrabold bg-amber-500/20'
                : 'text-slate-400 font-semibold hover:text-slate-700'
            }`}
          >
            <LayoutGrid className="w-5 h-5" />
            <span className="text-[11px]">Шаблоны</span>
          </button>

          <button
            onClick={() => setActiveTab('editor')}
            className={`py-1.5 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition ${
              activeTab === 'editor'
                ? 'text-slate-950 font-extrabold bg-amber-500/20'
                : 'text-slate-400 font-semibold hover:text-slate-700'
            }`}
          >
            <PenTool className="w-5 h-5" />
            <span className="text-[11px]">Конструктор</span>
          </button>

          <button
            onClick={() => setActiveTab('saved')}
            className={`py-1.5 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition relative ${
              activeTab === 'saved'
                ? 'text-slate-950 font-extrabold bg-amber-500/20'
                : 'text-slate-400 font-semibold hover:text-slate-700'
            }`}
          >
            <BookmarkCheck className="w-5 h-5" />
            <span className="text-[11px]">Очередь/Мои</span>
            {printQueue.length + savedTemplates.length > 0 && (
              <span className="absolute top-1 right-4 w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black flex items-center justify-center">
                {printQueue.length + savedTemplates.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('printer')}
            className={`py-1.5 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition ${
              activeTab === 'printer'
                ? 'text-slate-950 font-extrabold bg-amber-500/20'
                : 'text-slate-400 font-semibold hover:text-slate-700'
            }`}
          >
            <HelpCircle className="w-5 h-5" />
            <span className="text-[11px]">M250 Гид</span>
          </button>
        </nav>

        {/* Print & Export Modal */}
        <PrintSheetModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          sizePreset={sizePreset}
          frame={frame}
          elements={elements}
          templateName={stickerName}
          onAddToQueue={(copies) => handleAddToPrintQueue(copies)}
        />
      </div>
    </div>
  );
}
export default App;
