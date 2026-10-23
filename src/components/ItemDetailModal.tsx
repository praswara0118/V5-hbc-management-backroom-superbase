import React, { useState, useRef } from 'react';
import { ReturnItem, PickupInfo } from '../types/inventory';
import { BarcodeBadge } from './BarcodeBadge';
import { formatIndoDate, getDaysRemaining, getOverdueDetail } from '../utils/notification';
import { savePickupInfoLocally, getLocalPickupInfo } from '../services/localCache';
import {
  X,
  Printer,
  Edit,
  Trash2,
  CheckCircle2,
  MessageSquare,
  Mail,
  Calendar,
  Building2,
  MapPin,
  Clock,
  History,
  AlertTriangle,
  UserCheck,
  Image as ImageIcon,
  Camera,
  Upload,
  Phone,
  FileText,
  Loader2,
} from 'lucide-react';

interface ItemDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ReturnItem | null;
  onOpenWarningModal: (item: ReturnItem) => void;
  onOpenEditModal: (item: ReturnItem) => void;
  onOpenPrintSlip: (item: ReturnItem) => void;
  onMarkAsPickedUp: (itemId: string, pickedUpBy: string, pickupInfo?: PickupInfo) => void;
  onDeleteItem: (itemId: string) => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  isOpen,
  onClose,
  item,
  onOpenWarningModal,
  onOpenEditModal,
  onOpenPrintSlip,
  onMarkAsPickedUp,
  onDeleteItem,
}) => {
  const [showPickupInput, setShowPickupInput] = useState(false);
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [documentNo, setDocumentNo] = useState('');
  const [pickupNotes, setPickupNotes] = useState('');
  const [pickupPhotoUrl, setPickupPhotoUrl] = useState<string | null>(null);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [zoomedPhotoUrl, setZoomedPhotoUrl] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const updatePickupPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const updatePickupCameraInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen || !item) return null;

  const daysLeft = getDaysRemaining(item.dueDate);
  const isCompleted = item.status === 'Sudah Diambil' || item.status === 'Diganti Baru';

  // Multi-tier resolution for pickup info so photo and details are never lost
  const effectivePickupInfo: PickupInfo | undefined =
    item.pickupInfo ||
    getLocalPickupInfo(item.id) ||
    (item.pickedUpBy
      ? {
          receiverName: item.pickedUpBy,
          timestamp: item.pickedUpDate || item.updatedAt || new Date().toISOString(),
        }
      : undefined);

  const handleCompressAndSetPhoto = (file: File) => {
    setIsCompressingPhoto(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 800;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            setPickupPhotoUrl(canvas.toDataURL('image/jpeg', 0.72));
          } else {
            setPickupPhotoUrl(img.src);
          }
        } finally {
          setIsCompressingPhoto(false);
        }
      };
      img.onerror = () => setIsCompressingPhoto(false);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => setIsCompressingPhoto(false);
    reader.readAsDataURL(file);
  };

  const handleConfirmPickup = () => {
    if (isCompressingPhoto) return;
    const finalReceiver = receiverName.trim() || 'Driver / Perwakilan Rekanan';
    const info: PickupInfo = {
      receiverName: finalReceiver,
      receiverPhone: receiverPhone.trim() || undefined,
      documentNo: documentNo.trim() || undefined,
      photoUrl: pickupPhotoUrl || undefined,
      notes: pickupNotes.trim() || undefined,
      timestamp: new Date().toISOString(),
    };

    savePickupInfoLocally(item.id, info);
    onMarkAsPickedUp(item.id, finalReceiver, info);
    setShowPickupInput(false);
    // Reset state
    setReceiverName('');
    setReceiverPhone('');
    setDocumentNo('');
    setPickupNotes('');
    setPickupPhotoUrl(null);
  };

  const handleUpdateReceiverPhoto = (file: File) => {
    setIsCompressingPhoto(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 800;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.72);
            const updatedPickup: PickupInfo = {
              receiverName: effectivePickupInfo?.receiverName || item.pickedUpBy || 'Petugas / Driver',
              receiverPhone: effectivePickupInfo?.receiverPhone,
              documentNo: effectivePickupInfo?.documentNo,
              notes: effectivePickupInfo?.notes,
              photoUrl: compressed,
              timestamp: effectivePickupInfo?.timestamp || new Date().toISOString(),
            };
            savePickupInfoLocally(item.id, updatedPickup);
            onMarkAsPickedUp(item.id, updatedPickup.receiverName, updatedPickup);
          }
        } finally {
          setIsCompressingPhoto(false);
        }
      };
      img.onerror = () => setIsCompressingPhoto(false);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => setIsCompressingPhoto(false);
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-neutral-200 flex flex-col max-h-[92vh]">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-900 text-white">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
              SKU: {item.sku || item.barcode}
            </span>
            <h2 className="font-semibold text-base tracking-tight truncate max-w-sm">
              {item.itemName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-neutral-50 rounded-xl border border-neutral-200">
            <div>
              <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                Label Barcode Scan Fisik:
              </div>
              <BarcodeBadge value={item.barcode} height={48} />
            </div>

            <div className="text-right sm:text-right w-full sm:w-auto">
              <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                Status Saat Ini:
              </div>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold ${
                  item.status === 'Sudah Diambil'
                    ? 'bg-emerald-100 text-emerald-800'
                    : item.status === 'Lewat Tenggat'
                    ? 'bg-rose-100 text-rose-800 animate-pulse'
                    : item.status === 'Mendekati Tenggat'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-sky-100 text-sky-800'
                }`}
              >
                {item.status}
              </span>

              {!isCompleted && (() => {
                const overdue = getOverdueDetail(item.dueDate, item.finalWarningSentAt);
                return (
                  <div className="mt-1 text-xs font-medium">
                    {overdue.isOverdue ? (
                      <span className="text-rose-600 font-bold">{overdue.exactDurationLabel}</span>
                    ) : overdue.isToday ? (
                      <span className="text-amber-600 font-bold">Jatuh tempo HARI INI</span>
                    ) : (
                      <span className="text-neutral-600">{overdue.exactDurationLabel}</span>
                    )}
                    {item.finalWarningSentAt && (
                      <div className="text-[10px] text-rose-700 font-bold mt-0.5">
                        {overdue.isPastFinalDeadline ? '⚠️ Batas 2x24 jam telah berakhir (PA0)' : `⚠️ Sisa toleransi 2x24 jam: ${overdue.finalWarningRemainingHours} jam`}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-neutral-700" />
                <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                  Data Supplier / Rekanan
                </span>
              </div>
              <span className="text-xs text-neutral-500 font-mono">ID: {item.supplierId}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-neutral-500">Nama Supplier:</div>
                <div className="font-semibold text-neutral-900">{item.supplierName}</div>
              </div>
              <div>
                <div className="text-xs text-neutral-500">PIC / Kontak:</div>
                <div className="font-medium text-neutral-800">{item.supplierPic || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-neutral-500">Nomor WhatsApp:</div>
                <div className="font-mono text-neutral-800 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                  {item.supplierPhone || '-'}
                </div>
              </div>
              <div>
                <div className="text-xs text-neutral-500">Gmail / Email:</div>
                <div className="font-mono text-neutral-800 flex items-center gap-1.5 truncate">
                  <Mail className="w-3.5 h-3.5 text-rose-600" />
                  {item.supplierEmail || '-'}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-white border border-neutral-200 rounded-lg">
              <div className="text-[11px] text-neutral-500">Kuantitas</div>
              <div className="text-base font-bold text-neutral-900 font-mono">
                {item.quantity} {item.unit}
              </div>
            </div>

            <div className="p-3 bg-white border border-neutral-200 rounded-lg">
              <div className="text-[11px] text-neutral-500">Kategori</div>
              <div className="text-xs font-semibold text-neutral-800 mt-0.5 truncate">
                {item.category}
              </div>
            </div>

            <div className="p-3 bg-white border border-neutral-200 rounded-lg">
              <div className="text-[11px] text-neutral-500">Lokasi Simpan</div>
              <div className="text-xs font-semibold text-neutral-800 mt-0.5 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-neutral-500 shrink-0" />
                <span className="truncate">{item.locationSlot}</span>
              </div>
            </div>

            <div className="p-3 bg-white border border-neutral-200 rounded-lg">
              <div className="text-[11px] text-neutral-500">Taksiran Nilai</div>
              <div className="text-xs font-bold text-neutral-800 mt-0.5 font-mono">
                {item.estimatedValue ? `Rp ${item.estimatedValue.toLocaleString('id-ID')}` : '-'}
              </div>
            </div>
          </div>

          <div className="p-4 bg-white border border-neutral-200 rounded-xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-neutral-500" />
                <div>
                  <span className="text-neutral-500">Tanggal Masuk: </span>
                  <span className="font-semibold text-neutral-800">{formatIndoDate(item.receivedDate)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-neutral-500" />
                <div>
                  <span className="text-neutral-500">Tenggat Waktu: </span>
                  <span className="font-semibold text-neutral-800">{formatIndoDate(item.dueDate)}</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-100">
              <div className="text-xs text-neutral-500 mb-0.5">Alasan Retur:</div>
              <div className="text-xs font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded inline-block">
                {item.returnReason}
              </div>
            </div>

            {item.conditionNotes && (
              <div>
                <div className="text-xs text-neutral-500 mb-0.5">Catatan Kondisi Fisik:</div>
                <div className="text-xs text-neutral-800 bg-neutral-50 p-2.5 rounded border border-neutral-200 leading-relaxed">
                  {item.conditionNotes}
                </div>
              </div>
            )}

            {item.photoUrl && (
              <div className="pt-2 border-t border-neutral-100">
                <div className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5 mb-2">
                  <ImageIcon className="w-4 h-4 text-emerald-600" />
                  <span>Bukti Foto Fisik Barang Retur:</span>
                </div>
                <div className="bg-neutral-900 rounded-lg p-2 max-w-xs overflow-hidden border border-neutral-800 shadow-xs">
                  <img
                    src={item.photoUrl}
                    alt={item.itemName}
                    className="w-full h-48 object-cover rounded hover:scale-105 transition-transform cursor-pointer"
                    onClick={() => {
                      const w = window.open('');
                      w?.document.write(`<img src="${item.photoUrl}" style="max-width:100%;height:auto;margin:auto;display:block;" />`);
                    }}
                    title="Klik untuk melihat foto ukuran penuh"
                  />
                  <div className="text-[10px] text-neutral-400 text-center mt-1">
                    Klik foto untuk memperbesar
                  </div>
                </div>
              </div>
            )}

            {isCompleted && (
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-xs space-y-3.5 animate-in fade-in">
                {/* Hidden input for attaching or updating receiver photo */}
                <input
                  ref={updatePickupCameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpdateReceiverPhoto(file);
                  }}
                  className="hidden"
                />
                <input
                  ref={updatePickupPhotoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpdateReceiverPhoto(file);
                  }}
                  className="hidden"
                />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>Barang Telah Diambil / Selesai</span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-800 bg-white/90 px-2.5 py-0.5 rounded-md border border-emerald-200 font-semibold">
                    {formatIndoDate(item.pickedUpDate || effectivePickupInfo?.timestamp || '')}
                  </span>
                </div>

                {/* Informasi Lengkap yang Diinputkan */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs bg-white/80 p-3.5 rounded-lg border border-emerald-200">
                  <div>
                    <span className="text-neutral-500 block text-[11px]">Nama Orang yang Mengambil:</span>
                    <strong className="text-neutral-900 text-sm">
                      {effectivePickupInfo?.receiverName || item.pickedUpBy || 'Petugas / Driver Rekanan'}
                    </strong>
                  </div>

                  <div>
                    <span className="text-neutral-500 block text-[11px]">No. Telepon / WhatsApp:</span>
                    {effectivePickupInfo?.receiverPhone ? (
                      <a
                        href={`https://wa.me/${effectivePickupInfo.receiverPhone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-700 hover:text-emerald-800 font-mono font-bold underline flex items-center gap-1 mt-0.5"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{effectivePickupInfo.receiverPhone}</span>
                      </a>
                    ) : (
                      <span className="text-neutral-400 font-mono">-</span>
                    )}
                  </div>

                  <div>
                    <span className="text-neutral-500 block text-[11px]">No. Surat Jalan / Resi Pengambilan:</span>
                    <strong className="text-neutral-800 font-mono">
                      {effectivePickupInfo?.documentNo || '-'}
                    </strong>
                  </div>

                  <div>
                    <span className="text-neutral-500 block text-[11px]">Waktu Serah Terima:</span>
                    <strong className="text-neutral-800 font-mono">
                      {effectivePickupInfo?.timestamp
                        ? new Date(effectivePickupInfo.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
                        : '-'}
                    </strong>
                  </div>

                  {effectivePickupInfo?.notes && (
                    <div className="sm:col-span-2 pt-1 border-t border-neutral-100">
                      <span className="text-neutral-500 block text-[11px]">Catatan Serah Terima:</span>
                      <span className="text-neutral-800">{effectivePickupInfo.notes}</span>
                    </div>
                  )}
                </div>

                {/* Foto Orang yang Mengambil / Bukti Pengambilan */}
                <div className="pt-2 border-t border-emerald-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-emerald-700" />
                      <span>Foto Orang yang Mengambil / Bukti Serah Terima:</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updatePickupCameraInputRef.current?.click()}
                        className="text-[11px] px-2 py-0.5 bg-white border border-emerald-300 text-emerald-800 rounded font-semibold hover:bg-emerald-50 cursor-pointer flex items-center gap-1"
                        title="Ambil foto orang yang mengambil dari kamera"
                      >
                        <Camera className="w-3 h-3 text-emerald-600" />
                        <span>{effectivePickupInfo?.photoUrl ? 'Ganti Foto (Kamera)' : 'Ambil Foto (Kamera)'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => updatePickupPhotoInputRef.current?.click()}
                        className="text-[11px] px-2 py-0.5 bg-white border border-emerald-300 text-emerald-800 rounded font-semibold hover:bg-emerald-50 cursor-pointer flex items-center gap-1"
                        title="Unggah foto dari galeri"
                      >
                        <Upload className="w-3 h-3 text-emerald-600" />
                        <span>{effectivePickupInfo?.photoUrl ? 'Ganti (Galeri)' : 'Pilih Galeri'}</span>
                      </button>
                    </div>
                  </div>

                  {effectivePickupInfo?.photoUrl ? (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white/70 p-3 rounded-lg border border-emerald-200">
                      <img
                        src={effectivePickupInfo.photoUrl}
                        alt="Foto Orang yang Mengambil"
                        className="w-40 h-40 object-cover rounded-lg border border-emerald-300 shadow-2xs hover:scale-105 transition-transform cursor-pointer shrink-0"
                        onClick={() => setZoomedPhotoUrl(effectivePickupInfo.photoUrl!)}
                        title="Klik untuk melihat foto ukuran penuh"
                      />
                      <div className="space-y-1 text-xs">
                        <div className="font-bold text-neutral-900">
                          {effectivePickupInfo?.receiverName || item.pickedUpBy}
                        </div>
                        <div className="text-[11px] text-neutral-500">
                          Foto pihak pengambil/driver atau surat jalan telah tersimpan sebagai bukti serah terima sah barang return.
                        </div>
                        <button
                          type="button"
                          onClick={() => setZoomedPhotoUrl(effectivePickupInfo.photoUrl!)}
                          className="text-[11px] text-emerald-700 hover:text-emerald-800 font-bold underline flex items-center gap-1 pt-1 cursor-pointer"
                        >
                          🔍 Klik untuk memperbesar foto penuh
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-neutral-50 rounded-lg border border-dashed border-neutral-300 text-neutral-500 text-[11px] flex items-center justify-between gap-2">
                      <span>Belum ada foto orang yang mengambil atau tanda terima fisik terlampir.</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Form / Trigger Tandai Barang Sudah Diambil */}
          {!isCompleted && (
            <div className="p-4 bg-emerald-50/80 border border-emerald-300 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-700" />
                  <span className="text-xs font-bold text-emerald-950">
                    Proses Serah Terima &amp; Pengambilan Barang
                  </span>
                </div>
                {!showPickupInput && (
                  <button
                    onClick={() => setShowPickupInput(true)}
                    className="text-xs font-bold px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer shadow-xs"
                  >
                    Tandai Barang Sudah Diambil
                  </button>
                )}
              </div>

              {/* Form Input Detail Pengambilan */}
              {showPickupInput && (
                <div className="space-y-3 pt-3 border-t border-emerald-200 animate-in fade-in">
                  {/* Hidden file inputs for Camera and Gallery */}
                  <input
                    ref={nativeCameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleCompressAndSetPhoto(file);
                    }}
                    className="hidden"
                  />
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleCompressAndSetPhoto(file);
                    }}
                    className="hidden"
                  />

                  <div className="text-xs text-emerald-900 font-semibold">
                    Silakan isi data pihak yang mengambil dan lampirkan foto bukti fisik:
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Nama yang Mengambil */}
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                        Nama yang Mengambil (Driver / PIC / Ekspedisi) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Bpk. Joko (Driver Truk Alfaria B 9812 UI)"
                        value={receiverName}
                        onChange={(e) => setReceiverName(e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                      />
                    </div>

                    {/* Nomor Kontak Driver */}
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                        Nomor HP / WhatsApp yang Mengambil (Opsional)
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: 081298765432"
                        value={receiverPhone}
                        onChange={(e) => setReceiverPhone(e.target.value)}
                        className="w-full text-xs font-mono px-3 py-2 border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                      />
                    </div>

                    {/* No. Surat Jalan / Resi */}
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                        No. Surat Jalan / Tanda Terima (Opsional)
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: SJ-2026/04/001"
                        value={documentNo}
                        onChange={(e) => setDocumentNo(e.target.value)}
                        className="w-full text-xs font-mono px-3 py-2 border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                      />
                    </div>

                    {/* Catatan Serah Terima */}
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                        Catatan Serah Terima / Kondisi Barang Saat Diambil (Opsional)
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Diambil lengkap 10 pcs, diganti nota retur potong tagihan"
                        value={pickupNotes}
                        onChange={(e) => setPickupNotes(e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                      />
                    </div>

                    {/* Foto Bukti Pengambilan */}
                    <div className="sm:col-span-2 space-y-2">
                      <label className="block text-[11px] font-bold text-neutral-700">
                        Foto Bukti Pengambilan / Driver / Surat Jalan
                      </label>

                      {pickupPhotoUrl ? (
                        <div className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-emerald-300">
                          <img
                            src={pickupPhotoUrl}
                            alt="Bukti Pengambilan"
                            className="w-16 h-16 object-cover rounded-md border border-neutral-300"
                          />
                          <div className="space-y-1 flex-1">
                            <div className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span>Foto Bukti Pengambilan Terlampir</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => nativeCameraInputRef.current?.click()}
                                className="text-[11px] text-neutral-700 hover:underline cursor-pointer"
                              >
                                Ganti (Kamera)
                              </button>
                              <span className="text-neutral-400">·</span>
                              <button
                                type="button"
                                onClick={() => galleryInputRef.current?.click()}
                                className="text-[11px] text-neutral-700 hover:underline cursor-pointer"
                              >
                                Ganti (Galeri)
                              </button>
                              <span className="text-neutral-400">·</span>
                              <button
                                type="button"
                                onClick={() => setPickupPhotoUrl(null)}
                                className="text-[11px] text-rose-600 hover:underline font-semibold cursor-pointer"
                              >
                                Hapus Foto
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : isCompressingPhoto ? (
                        <div className="flex items-center justify-center gap-2 p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-xs font-semibold text-emerald-800 animate-pulse">
                          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                          <span>Sedang memproses & mengompres foto...</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => nativeCameraInputRef.current?.click()}
                            className="p-2.5 bg-white hover:bg-neutral-50 border border-dashed border-emerald-400 rounded-lg text-xs font-semibold text-emerald-800 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                          >
                            <Camera className="w-4 h-4 text-emerald-600" />
                            <span>Ambil dari Kamera</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => galleryInputRef.current?.click()}
                            className="p-2.5 bg-white hover:bg-neutral-50 border border-dashed border-emerald-400 rounded-lg text-xs font-semibold text-neutral-700 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                          >
                            <Upload className="w-4 h-4 text-neutral-600" />
                            <span>Unggah dari Galeri</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-emerald-200">
                    <button
                      type="button"
                      onClick={() => setShowPickupInput(false)}
                      className="px-3.5 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 rounded-lg font-medium cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={isCompressingPhoto}
                      onClick={handleConfirmPickup}
                      className="px-4 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
                    >
                      {isCompressingPhoto ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>{isCompressingPhoto ? 'Memproses Foto...' : 'Konfirmasi Barang Sudah Diambil'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {item.warningHistory && item.warningHistory.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-neutral-500" />
                <span>Riwayat Peringatan yang Dikirim ({item.warningHistory.length})</span>
              </div>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {item.warningHistory.map((hist) => (
                  <div
                    key={hist.id}
                    className="p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      {hist.channel === 'whatsapp' ? (
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <Mail className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      )}
                      <div>
                        <div className="font-semibold text-neutral-900">{hist.message}</div>
                        <div className="text-[11px] text-neutral-500 font-mono">Ke: {hist.recipient}</div>
                      </div>
                    </div>
                    <span className="text-[11px] text-neutral-500 font-mono shrink-0">
                      {new Date(hist.timestamp).toLocaleDateString('id-ID')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {confirmDelete && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-800 text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Yakin ingin menghapus data barang return ini?</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-2.5 py-1 text-xs border border-neutral-300 rounded bg-white hover:bg-neutral-50 text-neutral-700"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    onDeleteItem(item.id);
                    onClose();
                  }}
                  className="px-2.5 py-1 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded"
                >
                  Ya, Hapus
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenPrintSlip(item)}
              className="px-3 py-2 border border-neutral-300 hover:bg-white text-neutral-700 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Bukti Retur</span>
            </button>

            <button
              onClick={() => onOpenEditModal(item)}
              className="px-3 py-2 border border-neutral-300 hover:bg-white text-neutral-700 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>

            {!confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-2 text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                title="Hapus Data Barang"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isCompleted && (
              <button
                onClick={() => onOpenWarningModal(item)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Kirim Peringatan WA / Gmail</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 border border-neutral-300 hover:bg-white text-neutral-700 rounded-md text-xs font-medium transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox Modal: Perbesar Foto Penuh Tanpa Window.Open */}
      {zoomedPhotoUrl && (
        <div
          className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in"
          onClick={() => setZoomedPhotoUrl(null)}
        >
          <div
            className="relative max-w-3xl max-h-[90vh] bg-neutral-900 rounded-2xl overflow-hidden shadow-2xl border border-neutral-700 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 bg-neutral-950/80 border-b border-neutral-800 flex items-center justify-between text-white">
              <span className="text-xs font-semibold flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-emerald-400" />
                <span>Foto Orang yang Mengambil / Bukti Serah Terima</span>
              </span>
              <button
                type="button"
                onClick={() => setZoomedPhotoUrl(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                title="Tutup Pratinjau Foto"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 flex items-center justify-center overflow-auto max-h-[80vh] bg-black">
              <img
                src={zoomedPhotoUrl}
                alt="Foto Pengambil Barang"
                className="max-w-full max-h-[75vh] object-contain rounded-lg"
              />
            </div>
            <div className="px-4 py-2 bg-neutral-950 text-neutral-400 text-[11px] text-center">
              Klik di luar foto atau tombol silang untuk kembali
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
