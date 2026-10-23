import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { ReturnItem, MasterProduct, Supplier, StorageLocation } from '../types/inventory';
import {
  Camera,
  RefreshCw,
  X,
  AlertCircle,
  CheckCircle2,
  Search,
  Plus,
  Volume2,
  Database,
  Building2,
  MapPin,
  Package,
  MessageSquare,
  Mail,
  Calendar,
  Layers,
  Phone,
  Clock,
  ExternalLink,
  Image as ImageIcon,
  Check,
} from 'lucide-react';
import { formatIndoDate, getOverdueDetail } from '../utils/notification';

export interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  items?: ReturnItem[];
  masterProducts?: MasterProduct[];
  suppliers?: Supplier[];
  storageLocations?: StorageLocation[];
  onSelectScannedItem?: (item: ReturnItem) => void;
  onBarcodeNotFound?: (barcode: string) => void;
  onMasterProductFound?: (product: MasterProduct) => void;
  onBarcodeDetected?: (barcode: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  items = [],
  masterProducts = [],
  suppliers = [],
  storageLocations = [],
  onSelectScannedItem,
  onBarcodeNotFound,
  onMasterProductFound,
  onBarcodeDetected,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [scannedResult, setScannedResult] = useState<{
    code: string;
    foundItem?: ReturnItem;
    foundMaster?: MasterProduct;
    foundSupplier?: Supplier;
    foundLocation?: StorageLocation;
  } | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isComponentMounted = useRef(true);

  // Play crisp synthetic audio beep
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {
      // AudioContext may be blocked before gesture
    }
  };

  const handleBarcodeDecoded = (decodedText: string) => {
    const cleanCode = decodedText.trim();
    if (!cleanCode) return;

    playBeep();
    if (navigator.vibrate) {
      navigator.vibrate([80, 50, 80]);
    }

    // Stop camera once decoded
    stopCamera();

    const lower = cleanCode.toLowerCase();

    // 1. Check if item exists in active return inventory (by barcode or sku)
    const matchedItem = items.find(
      (item) =>
        item.barcode.toLowerCase() === lower ||
        (item.sku && item.sku.toLowerCase() === lower)
    );

    // 2. Check if item exists in master products database (Consignment or Outright)
    const matchedMaster = masterProducts.find(
      (p) =>
        p.barcode.toLowerCase() === lower ||
        (p.sku && p.sku.toLowerCase() === lower)
    );

    // 3. Check if location exists in storage locations (by barcode or sku)
    const matchedLocation = storageLocations.find(
      (loc) =>
        loc.barcode.toLowerCase() === lower ||
        (loc.sku && loc.sku.toLowerCase() === lower) ||
        (matchedMaster?.sku && loc.sku && loc.sku.toLowerCase() === matchedMaster.sku.toLowerCase()) ||
        (matchedItem?.sku && loc.sku && loc.sku.toLowerCase() === matchedItem.sku.toLowerCase())
    );

    // 4. Check supplier
    const supNameOrId = matchedItem?.supplierId || matchedItem?.supplierName || matchedMaster?.supplierName;
    const matchedSupplier = suppliers.find(
      (s) =>
        (matchedItem?.supplierId && s.id === matchedItem.supplierId) ||
        (supNameOrId && s.name.toLowerCase() === supNameOrId.toLowerCase())
    );

    setScannedResult({
      code: cleanCode,
      foundItem: matchedItem,
      foundMaster: matchedMaster,
      foundSupplier: matchedSupplier,
      foundLocation: matchedLocation,
    });

    if (onBarcodeDetected) {
      onBarcodeDetected(cleanCode);
    }
  };

  const startCamera = async () => {
    setErrorMessage(null);
    setScannedResult(null);

    const element = document.getElementById('barcode-camera-box');
    if (!element) return;

    try {
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch {
          // ignore
        }
      }

      const html5QrCode = new Html5Qrcode('barcode-camera-box', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        verbose: false,
      });

      scannerRef.current = html5QrCode;

      const config = {
        fps: 15,
        qrbox: { width: 280, height: 180 },
        aspectRatio: 1.3333,
      };

      await html5QrCode.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          handleBarcodeDecoded(decodedText);
        },
        () => {
          // Frame error (no barcode detected yet) - ignore normal frames
        }
      );

      if (isComponentMounted.current) {
        setIsScanning(true);
      }
    } catch (err: unknown) {
      if (isComponentMounted.current) {
        setIsScanning(false);
        setErrorMessage(
          'Tidak dapat mengakses kamera. Pastikan izin kamera aktif atau gunakan input barcode / SKU manual di bawah.'
        );
      }
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch {
        // ignore
      }
      scannerRef.current = null;
    }
    if (isComponentMounted.current) {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    isComponentMounted.current = true;
    if (isOpen) {
      // Start camera after DOM modal opens
      const timer = setTimeout(() => {
        startCamera();
      }, 250);
      return () => {
        clearTimeout(timer);
        stopCamera();
      };
    } else {
      stopCamera();
      setScannedResult(null);
      setManualCode('');
    }
    return () => {
      isComponentMounted.current = false;
      stopCamera();
    };
  }, [isOpen]);

  const handleManualSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!manualCode.trim()) return;
    handleBarcodeDecoded(manualCode);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-neutral-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm tracking-tight">
                Pemindai Barcode / SKU Terintegrasi Database
              </h2>
              <p className="text-[11px] text-neutral-400">
                Pindai barang untuk memunculkan detail Produk, Supplier &amp; Lokasi
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* ========================================================= */}
          {/* HASIL PEMINDAIAN: PRODUK, SUPPLIER, DAN LOKASI OTOMATIS */}
          {/* ========================================================= */}
          {scannedResult ? (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Top Banner Status */}
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                  scannedResult.foundItem
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : scannedResult.foundMaster
                    ? 'bg-blue-50 border-blue-300 text-blue-900'
                    : 'bg-amber-50 border-amber-300 text-amber-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {scannedResult.foundItem ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : scannedResult.foundMaster ? (
                    <Database className="w-5 h-5 text-blue-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  )}
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider">
                      {scannedResult.foundItem
                        ? 'Status: Terdaftar di Retur Gudang Aktif'
                        : scannedResult.foundMaster
                        ? `Status: Ditemukan di Database Master (${scannedResult.foundMaster.procurementType === 'CONSIGNMENT' ? 'Konsinyasi' : 'Outright'})`
                        : 'Status: Belum Terdaftar di Master'}
                    </div>
                    <div className="text-sm font-mono font-bold">
                      Barcode: {scannedResult.code}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setScannedResult(null);
                    startCamera();
                  }}
                  className="px-3 py-1.5 bg-white hover:bg-neutral-100 text-neutral-700 rounded-lg text-xs font-semibold border border-neutral-300 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Scan Ulang</span>
                </button>
              </div>

              {/* 3 SEKSI INFORMASI LENGKAP: PRODUK, LOKASI & FOTO, SERTA INFORMASI RETUR */}
              <div className="space-y-4">
                {/* 1. INFORMASI DETAIL BARANG PENTING SAJA */}
                <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-neutral-900">
                      <Package className="w-4 h-4 text-blue-600" />
                      <span>1. Informasi Detail Barang (Penting)</span>
                    </div>
                    {(scannedResult.foundMaster?.procurementType || scannedResult.foundItem?.category) && (
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          scannedResult.foundMaster?.procurementType === 'CONSIGNMENT'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-blue-100 text-blue-800 border border-blue-300'
                        }`}
                      >
                        {scannedResult.foundMaster?.procurementType === 'CONSIGNMENT'
                          ? 'Konsinyasi'
                          : 'Outright (Beli Putus)'}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-neutral-500 text-[11px]">Nama Produk:</div>
                      <div className="font-bold text-neutral-900 text-sm mt-0.5">
                        {scannedResult.foundItem?.itemName ||
                          scannedResult.foundMaster?.itemName ||
                          'Nama Produk Belum Terdaftar'}
                      </div>
                    </div>

                    <div>
                      <div className="text-neutral-500 text-[11px]">Barcode &amp; Nomor SKU:</div>
                      <div className="font-mono text-neutral-900 mt-0.5 flex items-center gap-2 font-medium">
                        <span>Barcode: <strong>{scannedResult.code}</strong></span>
                        <span>·</span>
                        <span>SKU: <strong>{scannedResult.foundItem?.sku || scannedResult.foundMaster?.sku || '-'}</strong></span>
                      </div>
                    </div>

                    <div>
                      <div className="text-neutral-500 text-[11px]">Kategori / Departemen:</div>
                      <div className="font-medium text-neutral-800 mt-0.5">
                        {scannedResult.foundItem?.category || scannedResult.foundMaster?.department || 'Umum'} · Satuan: <strong className="font-mono">{scannedResult.foundItem?.unit || scannedResult.foundMaster?.unit || 'Pcs'}</strong>
                      </div>
                    </div>

                    <div>
                      <div className="text-neutral-500 text-[11px]">Supplier &amp; Kontak Rekanan:</div>
                      <div className="font-semibold text-neutral-900 mt-0.5 flex items-center justify-between gap-2">
                        <span>
                          {scannedResult.foundSupplier?.name ||
                            scannedResult.foundItem?.supplierName ||
                            scannedResult.foundMaster?.supplierName ||
                            'Supplier Belum Ditentukan'}
                        </span>
                        {(scannedResult.foundSupplier?.phone || scannedResult.foundItem?.supplierPhone || scannedResult.foundMaster?.supplierPhone) && (
                          <a
                            href={`https://wa.me/${(scannedResult.foundSupplier?.phone || scannedResult.foundItem?.supplierPhone || scannedResult.foundMaster?.supplierPhone || '').replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-700 hover:text-emerald-800 font-mono text-[11px] flex items-center gap-1 font-bold underline"
                          >
                            <Phone className="w-3 h-3" />
                            <span>WA: {scannedResult.foundSupplier?.phone || scannedResult.foundItem?.supplierPhone || scannedResult.foundMaster?.supplierPhone}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. LOKASI DAN FOTO LOKASI */}
                <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-neutral-900">
                      <MapPin className="w-4 h-4 text-rose-600" />
                      <span>2. Lokasi Penyimpanan &amp; Foto Lokasi</span>
                    </div>
                    {scannedResult.foundLocation ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                        ✓ Terdaftar di Lokasi Gudang
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-100 text-neutral-600">
                        Lokasi Belum Terdaftar
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 text-xs">
                      {scannedResult.foundLocation ? (
                        <>
                          <div className="bg-neutral-50 p-2.5 rounded-lg border border-neutral-200 space-y-1">
                            <div>
                              <span className="text-neutral-500 text-[11px]">Zona Penyimpanan: </span>
                              <strong className="text-neutral-900">{scannedResult.foundLocation.storageZone}</strong>
                            </div>
                            <div>
                              <span className="text-neutral-500 text-[11px]">Aisle &amp; Rak Simpan: </span>
                              <strong className="text-neutral-900">{scannedResult.foundLocation.aisleRack}</strong>
                            </div>
                            {scannedResult.foundLocation.shelfLevel && (
                              <div>
                                <span className="text-neutral-500 text-[11px]">Tingkat / Level Rak: </span>
                                <strong className="text-neutral-800">{scannedResult.foundLocation.shelfLevel}</strong>
                              </div>
                            )}
                            {scannedResult.foundLocation.notes && (
                              <div className="pt-1 text-[11px] text-neutral-600">
                                <em>Catatan: {scannedResult.foundLocation.notes}</em>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-neutral-500 text-[11px]">
                          Belum ada catatan rak penyimpanan toko/gudang untuk barang ini.
                        </div>
                      )}

                      {/* Lokasi Rak Retur jika sedang retur */}
                      {scannedResult.foundItem && (
                        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs space-y-0.5">
                          <span className="text-rose-700 font-bold text-[10px] uppercase">
                            Slot Rak Khusus Retur:
                          </span>
                          <div className="font-mono font-bold text-rose-950 text-sm">
                            {scannedResult.foundItem.locationSlot}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Foto Lokasi Rak Simpan */}
                    <div>
                      {scannedResult.foundLocation?.photoUrl ? (
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-bold text-neutral-700 flex items-center gap-1">
                            <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                            <span>Foto Fisik Rak / Lokasi Penyimpanan:</span>
                          </div>
                          <img
                            src={scannedResult.foundLocation.photoUrl}
                            alt="Foto Rak Fisik"
                            className="w-full h-36 object-cover rounded-lg border border-neutral-300 shadow-2xs hover:scale-102 transition-transform cursor-pointer"
                            onClick={() => {
                              const w = window.open('');
                              w?.document.write(
                                `<img src="${scannedResult.foundLocation?.photoUrl}" style="max-width:100%;height:auto;margin:auto;display:block;" />`
                              );
                            }}
                            title="Klik untuk memperbesar foto lokasi rak"
                          />
                          <div className="text-[10px] text-neutral-400 text-center">
                            Klik foto untuk melihat ukuran penuh
                          </div>
                        </div>
                      ) : (
                        <div className="h-full min-h-[100px] flex flex-col items-center justify-center bg-neutral-50 rounded-lg border border-dashed border-neutral-300 p-3 text-center text-xs text-neutral-400">
                          <ImageIcon className="w-6 h-6 text-neutral-300 mb-1" />
                          <span>Belum ada foto fisik rak lokasi simpan</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. INFORMASI RETURN BARANG JIKA MASUK DATA RETURN */}
                <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-neutral-900">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span>3. Informasi Return Barang</span>
                    </div>

                    {scannedResult.foundItem ? (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          scannedResult.foundItem.status === 'Sudah Diambil'
                            ? 'bg-emerald-100 text-emerald-800'
                            : scannedResult.foundItem.status === 'Lewat Tenggat'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        Status: {scannedResult.foundItem.status}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        Tidak Ada Retur Aktif
                      </span>
                    )}
                  </div>

                  {scannedResult.foundItem ? (
                    /* Jika Masuk Data Return */
                    <div className="space-y-3 text-xs">
                      {/* Overdue deadline calculation */}
                      {(() => {
                        const overdue = getOverdueDetail(
                          scannedResult.foundItem.dueDate,
                          scannedResult.foundItem.finalWarningSentAt
                        );
                        return (
                          <div
                            className={`p-2.5 rounded-lg border flex items-center justify-between ${
                              overdue.isOverdue
                                ? 'bg-rose-50 border-rose-200 text-rose-950 font-semibold'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                            }`}
                          >
                            <span>
                              Tenggat Waktu: <strong>{formatIndoDate(scannedResult.foundItem.dueDate)}</strong> ({overdue.exactDurationLabel})
                            </span>
                            <span className="font-mono text-[11px] font-bold">
                              Qty: {scannedResult.foundItem.quantity} {scannedResult.foundItem.unit}
                            </span>
                          </div>
                        );
                      })()}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                        <div>
                          <span className="text-neutral-500 text-[11px] block">Alasan Retur:</span>
                          <span className="font-bold text-neutral-900">{scannedResult.foundItem.returnReason}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 text-[11px] block">Tanggal Masuk Retur:</span>
                          <span className="font-semibold text-neutral-800">{formatIndoDate(scannedResult.foundItem.receivedDate)}</span>
                        </div>
                        {scannedResult.foundItem.conditionNotes && (
                          <div className="md:col-span-2">
                            <span className="text-neutral-500 text-[11px] block">Catatan Kondisi Fisik:</span>
                            <span className="text-neutral-700">{scannedResult.foundItem.conditionNotes}</span>
                          </div>
                        )}
                        {scannedResult.foundItem.pickedUpBy && (
                          <div className="md:col-span-2 text-emerald-800 font-semibold">
                            ✓ Telah diambil oleh: {scannedResult.foundItem.pickedUpBy} (Tgl: {formatIndoDate(scannedResult.foundItem.pickedUpDate || '')})
                          </div>
                        )}
                      </div>

                      {/* Foto Fisik Barang Retur */}
                      {scannedResult.foundItem.photoUrl && (
                        <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-1.5">
                          <div className="text-[11px] font-bold text-neutral-700 flex items-center gap-1.5">
                            <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Foto Bukti Fisik Barang Retur:</span>
                          </div>
                          <img
                            src={scannedResult.foundItem.photoUrl}
                            alt="Foto Fisik Retur"
                            className="max-h-36 object-contain rounded border border-neutral-300 shadow-2xs hover:scale-102 transition-transform cursor-pointer"
                            onClick={() => {
                              const w = window.open('');
                              w?.document.write(
                                `<img src="${scannedResult.foundItem?.photoUrl}" style="max-width:100%;height:auto;margin:auto;display:block;" />`
                              );
                            }}
                            title="Klik untuk memperbesar foto retur"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Jika TIDAK Masuk Data Return */
                    <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-emerald-900 font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Barang Ini Tidak Ada Dalam Antrean Retur Aktif</span>
                      </div>
                      <p className="text-neutral-600 text-[11px] leading-relaxed">
                        Produk ini berada dalam kondisi persediaan normal dan belum pernah didaftarkan sebagai barang retur yang perlu dikembalikan ke supplier.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="pt-3 border-t border-neutral-200 flex flex-wrap items-center gap-2.5">
                {scannedResult.foundItem ? (
                  <>
                    <button
                      onClick={() => {
                        if (onSelectScannedItem) onSelectScannedItem(scannedResult.foundItem!);
                        onClose();
                      }}
                      className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>Buka Detail Retur &amp; Peringatan WA / Serah Terima</span>
                    </button>
                    <button
                      onClick={() => {
                        if (scannedResult.foundMaster && onMasterProductFound) {
                          onMasterProductFound(scannedResult.foundMaster);
                        } else if (onBarcodeNotFound) {
                          onBarcodeNotFound(scannedResult.code);
                        }
                        onClose();
                      }}
                      className="py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      + Tambah Retur Baru
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      if (scannedResult.foundMaster && onMasterProductFound) {
                        onMasterProductFound(scannedResult.foundMaster);
                      } else if (onBarcodeNotFound) {
                        onBarcodeNotFound(scannedResult.code);
                      }
                      onClose();
                    }}
                    className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Daftarkan Barang Ini ke Formulir Retur Masuk</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Camera Live Viewport */}
              <div className="relative rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-800 flex flex-col items-center justify-center min-h-[250px]">
                <div id="barcode-camera-box" className="w-full h-full min-h-[240px]" />

                {!isScanning && !errorMessage && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/90 text-neutral-300 p-4 text-center">
                    <Camera className="w-8 h-8 text-neutral-400 mb-2 animate-pulse" />
                    <p className="text-sm font-semibold">Menghubungkan ke kamera...</p>
                    <p className="text-xs text-neutral-400 mt-1">
                      Arahkan barcode atau QR Code produk ke dalam kotak scanner
                    </p>
                  </div>
                )}

                {errorMessage && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/95 text-neutral-200 p-6 text-center">
                    <AlertCircle className="w-8 h-8 text-amber-400 mb-2" />
                    <p className="text-xs font-medium text-amber-200">{errorMessage}</p>
                    <button
                      onClick={startCamera}
                      className="mt-3 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-xs font-semibold text-neutral-200 flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Buka Kamera Ulang
                    </button>
                  </div>
                )}

                {isScanning && (
                  <div className="absolute top-2 right-2 bg-neutral-900/80 backdrop-blur-xs text-neutral-200 px-2.5 py-1 rounded-full text-[11px] font-mono flex items-center gap-1.5 border border-neutral-700/50">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Kamera Aktif
                  </div>
                )}
              </div>

              <div className="text-xs text-neutral-500 text-center flex items-center justify-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-neutral-400" />
                <span>Bunyi *beep* otomatis berbunyi saat barcode berhasil terbaca</span>
              </div>
            </>
          )}

          {/* Manual Input Barcode or SKU */}
          <div className="border-t border-neutral-200 pt-4">
            <div className="text-xs font-bold text-neutral-700 mb-2 flex items-center justify-between">
              <span>Input Barcode atau Nomor SKU (Manual / Gun Scanner USB)</span>
              <span className="text-[11px] font-normal text-neutral-500">
                Otomatis cek Master Consignment &amp; Outright
              </span>
            </div>

            <form onSubmit={handleManualSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Ketik Barcode atau SKU (e.g. 8992753210118)..."
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono border border-neutral-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold transition-colors shrink-0 cursor-pointer"
              >
                Cari Produk
              </button>
            </form>

            {/* Quick test buttons */}
            <div className="mt-3">
              <div className="text-[11px] font-medium text-neutral-500 mb-1.5">
                Uji Coba Cepat (Barcode Contoh):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {masterProducts.slice(0, 3).map((prod) => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => {
                      setManualCode(prod.barcode);
                      handleBarcodeDecoded(prod.barcode);
                    }}
                    className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-mono transition-colors text-left truncate max-w-[200px] cursor-pointer"
                    title={`${prod.itemName} (${prod.barcode})`}
                  >
                    {prod.barcode} ({prod.itemName.slice(0, 14)}...)
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-neutral-50 border-t border-neutral-200 flex justify-end">
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-4 py-2 border border-neutral-300 hover:bg-white text-neutral-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
