import React, { useEffect, useState } from 'react';
import {
  Bluetooth,
  CheckCircle2,
  Download,
  ExternalLink,
  Minus,
  Plus,
  Printer,
  Share2,
  Sparkles,
  Wifi,
  X,
} from 'lucide-react';
import { DOTS_PER_MM } from '../data/labelSizes';
import { FrameStyle, LabelSizePreset, StickerElement } from '../types/sticker';
import {
  encodeStickerStateForHandoff,
  M250ProtocolMode,
  prepareStickerAssets,
  printDirectBlePhomemoM250,
  printStickerNativeDialog,
  submitPrintViaLocalForm,
  WebBluetoothNotSupportedError,
} from '../utils/phomemoPrinter';

interface PrintSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  sizePreset: LabelSizePreset;
  frame: FrameStyle;
  elements: StickerElement[];
  templateName: string;
  onAddToQueue: (copies: number) => void;
}

export const PrintSheetModal: React.FC<PrintSheetModalProps> = ({
  isOpen,
  onClose,
  sizePreset,
  frame,
  elements,
  templateName,
  onAddToQueue,
}) => {
  const [copies, setCopies] = useState(1);
  const [protocolMode, setProtocolMode] = useState<M250ProtocolMode>('m-series-esc');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showBrowserBleHelp, setShowBrowserBleHelp] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const [serverImageUrl, setServerImageUrl] = useState<string | null>(null);
  const [serverDownloadUrl, setServerDownloadUrl] = useState<string | null>(null);
  const [readyShareFile, setReadyShareFile] = useState<File | null>(null);
  const [readyFileName, setReadyFileName] = useState<string>('sticker.png');
  const [printerBattery, setPrinterBattery] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStatusMsg(null);
    setErrorMsg(null);
    setShowBrowserBleHelp(false);
    prepareStickerAssets(sizePreset, frame, elements, templateName).then((res) => {
      setServerImageUrl(res.imageUrl);
      setServerDownloadUrl(res.downloadUrl);
      setReadyShareFile(res.shareFile);
      setReadyFileName(res.fileName);
    });
    if (location.hostname === 'localhost' || location.hostname.startsWith('192.168.')) {
      fetch('/api/printer-status')
        .then((r) => r.json())
        .then((d) => {
          if (d?.connected && typeof d.battery === 'number') {
            setPrinterBattery(d.battery);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, sizePreset, frame, elements, templateName]);

  if (!isOpen) return null;

  const dotsW = sizePreset.widthMm * DOTS_PER_MM;
  const dotsH = sizePreset.heightMm * DOTS_PER_MM;
  const isAndroid = /Android/i.test(navigator.userAgent);
  const encodedState = encodeStickerStateForHandoff(
    sizePreset.id,
    frame,
    elements,
    templateName
  );
  const baseUrlWithHash = `${window.location.origin}${window.location.pathname}#autoprint=${encodedState}`;
  const cleanHostAndPath = baseUrlWithHash.replace(/^https?:\/\//, '');
  const chromeIntentUrl = `intent://${cleanHostAndPath}#Intent;scheme=https;package=com.android.chrome;end`;
  const bluefyUrl = `bluefy://open?url=${encodeURIComponent(baseUrlWithHash)}`;

  // Synchronous native share handler
  const handleSharePrintMaster = async () => {
    setErrorMsg(null);
    setStatusMsg(null);

    const nav = navigator as Navigator & {
      canShare?: (data?: ShareData) => boolean;
    };

    if (
      readyShareFile &&
      window.isSecureContext &&
      typeof nav.share === 'function' &&
      (!nav.canShare || nav.canShare({ files: [readyShareFile] }))
    ) {
      try {
        await nav.share({
          files: [readyShareFile],
          title: `${templateName} (${sizePreset.widthMm}×${sizePreset.heightMm} мм)`,
        });
        setStatusMsg(
          'Меню телефона открыто! Выберите «Print Master» для мгновенной печати или «Сохранить изображение».'
        );
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
      }
    }

    if (serverDownloadUrl) {
      const a = document.createElement('a');
      a.href = serverDownloadUrl;
      a.download = readyFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    setStatusMsg(
      'Стикер сохранён! Зажмите пальцем белую картинку этикетки сверху (1 сек) → «Поделиться» → Print Master или «Сохранить в Фото».'
    );
  };

  const handleBlePrint = async () => {
    setIsBusy(true);
    setErrorMsg(null);
    setShowBrowserBleHelp(false);
    setStatusMsg('Подключение к Phomemo M250 по Bluetooth...');
    try {
      await printDirectBlePhomemoM250(
        sizePreset,
        frame,
        elements,
        copies,
        (msg) => setStatusMsg(msg),
        protocolMode
      );
    } catch (e) {
      setStatusMsg(null);
      if (e instanceof WebBluetoothNotSupportedError) {
        setShowBrowserBleHelp(true);
        // On Android inside Yandex Browser, automatically launch Chrome with the exact sticker ready to print!
        if (isAndroid) {
          setStatusMsg(
            'Переключаем Bluetooth-печать (или выберите печать по домашнему Wi-Fi ниже)...'
          );
          window.location.href = chromeIntentUrl;
          return;
        }
        setErrorMsg(
          'Выберите удобный способ подключения Bluetooth к Phomemo M250 из этого браузера:'
        );
      } else {
        setErrorMsg(e instanceof Error ? e.message : 'Ошибка Bluetooth-печати');
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleDownloadPng = () => {
    if (!serverDownloadUrl) return;
    const a = document.createElement('a');
    a.href = serverDownloadUrl;
    a.download = readyFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setStatusMsg(
      `Файл ${sizePreset.widthMm}×${sizePreset.heightMm} мм (203 DPI) скачан! Откройте его в приложении Print Master.`
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/75 backdrop-blur-sm p-0 sm:p-4 select-none">
      <div className="w-full max-w-[430px] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Top bar */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Phomemo M250 • 203 DPI
                {printerBattery !== null ? ` • Заряд ${printerBattery}%` : ''}
              </span>
            </div>
            <h3 className="text-base font-bold mt-0.5">Печать этикетки</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-slate-800 text-slate-300 hover:text-white active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3">
          {/* Real PNG Image Preview */}
          <div className="bg-slate-900 rounded-2xl p-3 pt-4 flex flex-col items-center relative overflow-hidden">
            <div className="w-4/5 h-2 bg-slate-950 rounded-full border border-slate-700 mb-1.5 shadow-inner" />
            <div className="animate-print-slide w-full max-w-[260px] flex flex-col items-center">
              {serverImageUrl && (
                <img
                  src={serverImageUrl}
                  alt={templateName}
                  className={`max-h-40 w-auto object-contain bg-white shadow-lg border border-slate-300 select-auto ${
                    sizePreset.shape === 'circle' ? 'rounded-full' : 'rounded-md'
                  }`}
                />
              )}
            </div>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-300 font-mono">
              <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-bold">
                {sizePreset.widthMm} × {sizePreset.heightMm} мм
              </span>
              <span>•</span>
              <span>
                {dotsW} × {dotsH} точек
              </span>
              <span>•</span>
              <span>Зажмите картинку для Фото</span>
            </div>
          </div>

          {/* Copies selector */}
          <div className="flex items-center justify-between bg-slate-100 rounded-2xl p-2.5 px-3">
            <div>
              <div className="text-xs font-bold text-slate-800">Количество копий</div>
              <div className="text-[11px] text-slate-500">Сколько банок / коробок клеим</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCopies((c) => Math.max(1, c - 1))}
                className="w-8 h-8 rounded-xl bg-white border border-slate-300 flex items-center justify-center active:scale-95"
              >
                <Minus className="w-4 h-4 text-slate-700" />
              </button>
              <span className="w-8 text-center font-mono font-bold text-base text-slate-900">
                {copies}
              </span>
              <button
                onClick={() => setCopies((c) => Math.min(50, c + 1))}
                className="w-8 h-8 rounded-xl bg-white border border-slate-300 flex items-center justify-center active:scale-95"
              >
                <Plus className="w-4 h-4 text-slate-700" />
              </button>
            </div>
          </div>

          {/* Status or Helper Banner */}
          {statusMsg && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{statusMsg}</span>
            </div>
          )}

          {(errorMsg || showBrowserBleHelp) && (
            <div className="bg-slate-100 border border-slate-300 rounded-2xl p-3 text-xs text-slate-800 space-y-2 leading-relaxed">
              {errorMsg && <div className="font-bold text-slate-900">{errorMsg}</div>}
              {showBrowserBleHelp && (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() =>
                      submitPrintViaLocalForm(
                        sizePreset,
                        frame,
                        elements,
                        copies,
                        protocolMode,
                        '192.168.18.7:5173'
                      )
                    }
                    className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-95"
                  >
                    <Wifi className="w-4 h-4" />
                    <span>Печать по домашнему Wi-Fi → M250 (из Яндекс Браузера)</span>
                  </button>

                  {isAndroid ? (
                    <a
                      href={chromeIntentUrl}
                      className="w-full py-2.5 px-3 rounded-xl bg-blue-600 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Прямой Bluetooth без ПК (Открыть в Chrome)</span>
                    </a>
                  ) : (
                    <a
                      href={bluefyUrl}
                      className="w-full py-2.5 px-3 rounded-xl bg-blue-600 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Прямой Bluetooth без ПК (Открыть в Bluefy)</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Main Action Buttons */}
          <div className="space-y-2">
            <button
              onClick={handleBlePrint}
              disabled={isBusy}
              className="w-full py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-slate-950 font-extrabold text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2.5 transition"
            >
              <Bluetooth className="w-5 h-5 stroke-[2.3]" />
              <span>Подключить Bluetooth-печать на M250</span>
            </button>

            <button
              onClick={handleSharePrintMaster}
              disabled={isBusy}
              className="w-full py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-slate-950 font-extrabold text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 transition"
            >
              <Share2 className="w-4 h-4 stroke-[2.3]" />
              <span>Отправить в Print Master / Фото (Без ПК)</span>
            </button>

            {/* Bluetooth Protocol Mode Selector for M250 */}
            <div className="flex items-center justify-between gap-1 bg-slate-100 p-1 rounded-xl text-[10px] font-bold">
              <button
                onClick={() => setProtocolMode('m-series-esc')}
                className={`flex-1 py-1 rounded-lg transition ${
                  protocolMode === 'm-series-esc'
                    ? 'bg-slate-900 text-amber-300'
                    : 'text-slate-600'
                }`}
              >
                Режим 1: M250 Стандарт
              </button>
              <button
                onClick={() => setProtocolMode('m250-72byte')}
                className={`flex-1 py-1 rounded-lg transition ${
                  protocolMode === 'm250-72byte'
                    ? 'bg-slate-900 text-amber-300'
                    : 'text-slate-600'
                }`}
              >
                Режим 2: M220 (72б)
              </button>
              <button
                onClick={() => setProtocolMode('m220-exact')}
                className={`flex-1 py-1 rounded-lg transition ${
                  protocolMode === 'm220-exact'
                    ? 'bg-slate-900 text-amber-300'
                    : 'text-slate-600'
                }`}
              >
                Режим 3: Узкий ({sizePreset.widthMm}б)
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-0.5">
              <button
                onClick={handleDownloadPng}
                disabled={isBusy}
                className="py-2.5 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] flex items-center justify-center gap-1 active:scale-95"
              >
                <Download className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Скачать PNG</span>
              </button>

              <button
                onClick={() => {
                  onAddToQueue(copies);
                  setStatusMsg(`Добавлено в очередь печати (${copies} шт.)!`);
                }}
                className="py-2.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] flex items-center justify-center gap-1 active:scale-95 border border-slate-300"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>+ В очередь</span>
              </button>

              <button
                onClick={() => printStickerNativeDialog(sizePreset, frame, elements, copies)}
                className="py-2.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] flex items-center justify-center gap-1 active:scale-95"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                <span>AirPrint / ПК</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
