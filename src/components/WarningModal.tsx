import React, { useState, useEffect } from 'react';
import { ReturnItem, WarningLog } from '../types/inventory';
import {
  generateNotificationMessage,
  getWhatsAppUrl,
  getGmailComposeUrl,
  getMailtoUrl,
  formatIndoDate,
  formatIndoDateTime,
  getOverdueDetail,
  WarningTier,
} from '../utils/notification';
import {
  X,
  MessageSquare,
  Mail,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  Calendar,
  User,
  History,
  Clock,
  AlertTriangle,
  Image as ImageIcon,
  Flame,
  Share2,
  Download,
  CheckCircle2,
} from 'lucide-react';

interface WarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ReturnItem | null;
  onLogWarning: (itemId: string, log: WarningLog, finalWarningSentAt?: string) => void;
}

export const WarningModal: React.FC<WarningModalProps> = ({
  isOpen,
  onClose,
  item,
  onLogWarning,
}) => {
  const [tone, setTone] = useState<WarningTier>('urgent');
  const [editableMessage, setEditableMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [copied, setCopied] = useState(false);
  const [customWarehouseName, setCustomWarehouseName] = useState('Logistik Pergudangan Retur HBC');

  useEffect(() => {
    if (item) {
      const overdue = getOverdueDetail(item.dueDate, item.finalWarningSentAt);
      
      let defaultTone: WarningTier = 'urgent';
      if (overdue.isPastFinalDeadline) {
        defaultTone = 'followup';
      } else if (item.finalWarningSentAt || overdue.daysRemaining <= -4) {
        defaultTone = 'final';
      } else if (overdue.daysRemaining < 0) {
        defaultTone = 'urgent';
      } else if (overdue.isToday || overdue.daysRemaining <= 2) {
        defaultTone = 'reminder';
      } else {
        defaultTone = 'gentle';
      }

      setTone(defaultTone);
      const generated = generateNotificationMessage(
        item,
        defaultTone,
        customWarehouseName,
        item.finalWarningSentAt
      );
      setSubject(generated.subject);
      setEditableMessage(generated.message);
    }
  }, [item, customWarehouseName]);

  const handleToneChange = (newTone: WarningTier) => {
    setTone(newTone);
    if (item) {
      const generated = generateNotificationMessage(
        item,
        newTone,
        customWarehouseName,
        item.finalWarningSentAt
      );
      setSubject(generated.subject);
      setEditableMessage(generated.message);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editableMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const [photoCopied, setPhotoCopied] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  // Convert base64 or URL into File object for Web Share API
  const getPhotoFile = async (photoUrl: string, fileName: string): Promise<File | null> => {
    try {
      const res = await fetch(photoUrl);
      const blob = await res.blob();
      return new File([blob], fileName, { type: blob.type || 'image/jpeg' });
    } catch (e) {
      console.warn('Gagal mengubah foto menjadi file:', e);
      return null;
    }
  };

  // Copy image to clipboard for desktop WhatsApp Web (Ctrl+V)
  const handleCopyPhotoToClipboard = async () => {
    if (!item?.photoUrl) return;
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = item.photoUrl;
      await new Promise((resolve, reject) => {
        img.onload = () => resolve(true);
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png')
      );

      if (blob && navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        setPhotoCopied(true);
        setTimeout(() => setPhotoCopied(false), 3000);
        return true;
      }
    } catch (err) {
      console.warn('Gagal menyalin foto ke clipboard:', err);
    }
    return false;
  };

  // Download photo file helper
  const handleDownloadPhoto = () => {
    if (!item?.photoUrl) return;
    const a = document.createElement('a');
    a.href = item.photoUrl;
    a.download = `Retur-${(item.itemName || 'Barang').replace(/[^a-zA-Z0-9]/g, '_')}-${item.barcode}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSendWhatsApp = async () => {
    if (!item || !item.supplierPhone) return;

    // Check if Web Share API with files is available (Supported on modern Android & iOS)
    if (item.photoUrl && navigator.share) {
      try {
        const photoFile = await getPhotoFile(
          item.photoUrl,
          `Retur-${item.barcode}.jpg`
        );
        if (
          photoFile &&
          navigator.canShare &&
          navigator.canShare({ files: [photoFile] })
        ) {
          await navigator.share({
            title: `Peringatan Retur HBC - ${item.itemName}`,
            text: editableMessage,
            files: [photoFile],
          });

          // Log warning
          const newFinalTimestamp =
            tone === 'final'
              ? item.finalWarningSentAt || new Date().toISOString()
              : item.finalWarningSentAt;

          const newLog: WarningLog = {
            id: `log-${Date.now()}`,
            timestamp: new Date().toISOString(),
            channel: 'whatsapp',
            recipient: item.supplierPhone,
            tone: tone,
            message: `Peringatan + Foto (${getToneLabel(tone)}) dikirim via WhatsApp Share ke ${item.supplierPhone}`,
          };
          onLogWarning(item.id, newLog, newFinalTimestamp);
          return;
        }
      } catch (err: any) {
        // If user cancelled share sheet, do nothing
        if (err?.name === 'AbortError') return;
        console.warn('Web Share API error, fallback to WhatsApp URL:', err);
      }
    }

    // Fallback: If image exists, attempt auto-copying to clipboard so user can press Ctrl+V in WhatsApp Web
    if (item.photoUrl) {
      handleCopyPhotoToClipboard();
      setShareNotice(
        '📸 Foto produk telah disalin ke clipboard! Tekan Ctrl+V (Tempel) di chat WhatsApp untuk mengirim foto bersamaan.'
      );
      setTimeout(() => setShareNotice(null), 8000);
    }

    const waUrl = getWhatsAppUrl(item.supplierPhone, editableMessage);
    window.open(waUrl, '_blank', 'noopener,noreferrer');

    const newFinalTimestamp =
      tone === 'final'
        ? item.finalWarningSentAt || new Date().toISOString()
        : item.finalWarningSentAt;

    const newLog: WarningLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      channel: 'whatsapp',
      recipient: item.supplierPhone,
      tone: tone,
      message: `Peringatan (${getToneLabel(tone)}) dikirim via WhatsApp ke ${item.supplierPhone}`,
    };
    onLogWarning(item.id, newLog, newFinalTimestamp);
  };

  const handleSendGmail = () => {
    if (!item || !item.supplierEmail) return;

    const gmailUrl = getGmailComposeUrl(item.supplierEmail, subject, editableMessage);
    window.open(gmailUrl, '_blank', 'noopener,noreferrer');

    const newFinalTimestamp =
      tone === 'final'
        ? item.finalWarningSentAt || new Date().toISOString()
        : item.finalWarningSentAt;

    const newLog: WarningLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      channel: 'gmail',
      recipient: item.supplierEmail,
      tone: tone,
      message: `Pemberitahuan (${getToneLabel(tone)}) dikirim via Gmail ke ${item.supplierEmail}`,
    };
    onLogWarning(item.id, newLog, newFinalTimestamp);
  };

  const handleSendMailto = () => {
    if (!item || !item.supplierEmail) return;

    const mailtoUrl = getMailtoUrl(item.supplierEmail, subject, editableMessage);
    window.location.href = mailtoUrl;

    const newFinalTimestamp =
      tone === 'final'
        ? item.finalWarningSentAt || new Date().toISOString()
        : item.finalWarningSentAt;

    const newLog: WarningLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      channel: 'gmail',
      recipient: item.supplierEmail,
      tone: tone,
      message: `Pemberitahuan via email klien lokal ke ${item.supplierEmail}`,
    };
    onLogWarning(item.id, newLog, newFinalTimestamp);
  };

  const getToneLabel = (t: WarningTier): string => {
    switch (t) {
      case 'gentle':
        return 'Pengingat Ramah';
      case 'reminder':
        return 'Peringatan Keterlambatan';
      case 'urgent':
        return 'Peringatan Mendesak';
      case 'final':
        return 'Peringatan Terakhir (2x24 Jam & PA0)';
      case 'followup':
        return 'Tindak Lanjut PA0';
      default:
        return t;
    }
  };

  if (!isOpen || !item) return null;

  const overdue = getOverdueDetail(item.dueDate, item.finalWarningSentAt);
  const waAvailable = Boolean(item.supplierPhone);
  const emailAvailable = Boolean(item.supplierEmail);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-neutral-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-900 text-white">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="font-semibold text-base tracking-tight">
                Notifikasi Peringatan Supplier Terlalu Lama
              </h2>
              <div className="text-xs text-neutral-400">
                Pemberitahuan tenggat waktu, klausul batas 2x24 jam &amp; proses pemusnahan PA0
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Item & Contact Info */}
          <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                Data Barang Return
              </div>
              <div className="text-sm font-bold text-neutral-900">{item.itemName}</div>
              <div className="text-xs text-neutral-600 mt-1 space-y-0.5">
                <div>
                  Barcode: <span className="font-mono font-medium">{item.barcode}</span>
                </div>
                <div>
                  Qty: <span className="font-semibold">{item.quantity} {item.unit}</span> · Alasan:{' '}
                  <span className="font-medium">{item.returnReason}</span>
                </div>
                <div>
                  Lokasi Simpan: <span className="font-medium text-neutral-800">{item.locationSlot}</span>
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                Kontak Supplier / Rekanan
              </div>
              <div className="text-sm font-bold text-neutral-900">{item.supplierName}</div>
              <div className="text-xs text-neutral-600 mt-1 space-y-1">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-neutral-400" />
                  <span>PIC: {item.supplierPic || 'Logistik / CS'}</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                  <span>WA: {item.supplierPhone || '(Nomor belum diisi)'}</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono">
                  <Mail className="w-3.5 h-3.5 text-rose-600" />
                  <span>Gmail: {item.supplierEmail || '(Email belum diisi)'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Exact Overdue & Deadline Banner */}
          <div
            className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
              overdue.isOverdue
                ? 'bg-rose-50/90 border-rose-300 text-rose-950'
                : overdue.isToday
                ? 'bg-amber-50 border-amber-300 text-amber-950'
                : 'bg-emerald-50 border-emerald-300 text-emerald-950'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <Clock className="w-4 h-4 shrink-0 mt-0.5 text-current" />
              <div className="text-xs space-y-0.5">
                <div className="font-semibold flex items-center gap-1.5">
                  <span>Tenggat Awal: {formatIndoDate(item.dueDate)}</span>
                  <span className="font-mono font-bold px-1.5 py-0.2 rounded bg-white/70">
                    {overdue.exactDurationLabel.toUpperCase()}
                  </span>
                </div>
                {item.finalWarningSentAt && (
                  <div className="text-[11px] font-medium flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>
                      {overdue.isPastFinalDeadline ? (
                        <strong className="text-rose-700">
                          Batas 2x24 jam telah berakhir pada {formatIndoDateTime(overdue.finalDeadlineDate || '')}. Proses PA0 (Pemusnahan) berlaku.
                        </strong>
                      ) : (
                        <span>
                          Sisa toleransi 2x24 jam: <strong>{overdue.finalWarningRemainingHours} jam lagi</strong> (Deadline:{' '}
                          {formatIndoDateTime(overdue.finalDeadlineDate || '')})
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <span
              className={`text-[11px] font-bold px-2.5 py-1 rounded-md self-start sm:self-auto shrink-0 ${
                overdue.isOverdue
                  ? 'bg-rose-600 text-white'
                  : overdue.isToday
                  ? 'bg-amber-500 text-white'
                  : 'bg-emerald-600 text-white'
              }`}
            >
              {item.status}
            </span>
          </div>

          {/* 5-Tier Notification Tone Selector */}
          <div>
            <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
              Tingkat Urgensi Peringatan (5 Tingkatan):
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {/* Tier 1 */}
              <button
                type="button"
                onClick={() => handleToneChange('gentle')}
                className={`p-2.5 text-xs font-medium rounded-lg border text-left transition-all cursor-pointer ${
                  tone === 'gentle'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-600'
                    : 'border-neutral-200 hover:bg-neutral-50 text-neutral-700'
                }`}
              >
                <div className="font-bold text-emerald-800">1. Pengingat Ramah</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">Info barang siap diambil</div>
              </button>

              {/* Tier 2 */}
              <button
                type="button"
                onClick={() => handleToneChange('reminder')}
                className={`p-2.5 text-xs font-medium rounded-lg border text-left transition-all cursor-pointer ${
                  tone === 'reminder'
                    ? 'border-sky-600 bg-sky-50 text-sky-950 ring-1 ring-sky-600'
                    : 'border-neutral-200 hover:bg-neutral-50 text-neutral-700'
                }`}
              >
                <div className="font-bold text-sky-800">2. Peringatan Jatuh Tempo</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">Jatuh tempo / telat 1-3 hari</div>
              </button>

              {/* Tier 3 */}
              <button
                type="button"
                onClick={() => handleToneChange('urgent')}
                className={`p-2.5 text-xs font-medium rounded-lg border text-left transition-all cursor-pointer ${
                  tone === 'urgent'
                    ? 'border-amber-600 bg-amber-50 text-amber-950 ring-1 ring-amber-600'
                    : 'border-neutral-200 hover:bg-neutral-50 text-neutral-700'
                }`}
              >
                <div className="font-bold text-amber-800">3. Peringatan Mendesak</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">Kapasitas retur penuh / telat</div>
              </button>

              {/* Tier 4: Final Warning */}
              <button
                type="button"
                onClick={() => handleToneChange('final')}
                className={`p-2.5 text-xs font-medium rounded-lg border text-left transition-all cursor-pointer sm:col-span-2 lg:col-span-1.5 ${
                  tone === 'final'
                    ? 'border-rose-600 bg-rose-50 text-rose-950 ring-1 ring-rose-600'
                    : 'border-neutral-200 hover:bg-neutral-50 text-neutral-700'
                }`}
              >
                <div className="font-bold text-rose-700 flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-rose-600" />
                  <span>4. Peringatan Terakhir (Batas 2x24 Jam)</span>
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5">
                  Batas waktu 48 jam &amp; klausul pemusnahan PA0
                </div>
              </button>

              {/* Tier 5: Post-Deadline Followup */}
              <button
                type="button"
                onClick={() => handleToneChange('followup')}
                className={`p-2.5 text-xs font-medium rounded-lg border text-left transition-all cursor-pointer ${
                  tone === 'followup'
                    ? 'border-neutral-800 bg-neutral-900 text-white ring-1 ring-neutral-900'
                    : 'border-neutral-200 hover:bg-neutral-50 text-neutral-700'
                }`}
              >
                <div className="font-bold flex items-center gap-1">
                  <span>5. Tindak Lanjut Pasca Batas</span>
                </div>
                <div className={`text-[11px] mt-0.5 ${tone === 'followup' ? 'text-neutral-300' : 'text-neutral-500'}`}>
                  Batas 2x24 jam habis, eksekusi PA0
                </div>
              </button>
            </div>
          </div>

          {/* Photo Attachment Info & Direct Sharing Controls */}
          {item.photoUrl && (
            <div className="p-3 bg-emerald-50/80 border border-emerald-300 rounded-xl space-y-2.5 text-xs animate-in fade-in">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <img
                    src={item.photoUrl}
                    alt={item.itemName}
                    className="w-12 h-12 object-cover rounded-lg border border-emerald-300 shadow-2xs cursor-pointer hover:scale-105 transition-transform"
                    onClick={() => {
                      const w = window.open('');
                      w?.document.write(`<img src="${item.photoUrl}" style="max-width:100%;height:auto;margin:auto;display:block;" />`);
                    }}
                    title="Klik untuk melihat foto ukuran penuh"
                  />
                  <div>
                    <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>Foto Bukti Fisik Barang Tersedia</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-200 text-emerald-900 font-semibold">
                        Ikut Terkirim
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      Di HP: otomatis dilampirkan via WhatsApp Share. Di Laptop: tekan tombol salin foto lalu tempel (Ctrl+V) di chat WhatsApp.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const w = window.open('');
                    w?.document.write(`<img src="${item.photoUrl}" style="max-width:100%;height:auto;margin:auto;display:block;" />`);
                  }}
                  className="text-[11px] text-emerald-800 hover:text-emerald-950 hover:underline font-bold shrink-0 cursor-pointer"
                >
                  Lihat Foto
                </button>
              </div>

              {/* Quick Photo Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-emerald-200/70">
                <button
                  type="button"
                  onClick={handleCopyPhotoToClipboard}
                  className="px-2.5 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-md font-semibold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {photoCopied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-emerald-700" />
                  )}
                  <span>{photoCopied ? 'Foto Disalin ke Clipboard!' : 'Salin Foto (Ctrl+V di WA)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPhoto}
                  className="px-2.5 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-md font-semibold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Unduh Foto Barang</span>
                </button>
              </div>
            </div>
          )}

          {shareNotice && (
            <div className="p-3 bg-blue-50 border border-blue-300 rounded-lg text-xs text-blue-900 flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{shareNotice}</span>
            </div>
          )}

          {/* Sender Customizer */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-600 font-medium">Nama Bagian / Gudang:</span>
            <input
              type="text"
              value={customWarehouseName}
              onChange={(e) => setCustomWarehouseName(e.target.value)}
              placeholder="Contoh: Bagian Gudang Retur HBC"
              className="text-xs px-2.5 py-1.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900 flex-1 max-w-sm"
            />
          </div>

          {/* Message Preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-neutral-700">
                Pratinjau Isi Pesan (Dapat diedit langsung sebelum dikirim):
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs text-neutral-600 hover:text-neutral-900 flex items-center gap-1 font-medium transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Tersalin!' : 'Salin Teks'}</span>
              </button>
            </div>
            <textarea
              rows={9}
              value={editableMessage}
              onChange={(e) => setEditableMessage(e.target.value)}
              className="w-full text-xs font-mono p-3 bg-neutral-900 text-neutral-100 rounded-lg border border-neutral-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed"
            />
          </div>

          {/* History */}
          {item.warningHistory && item.warningHistory.length > 0 && (
            <div className="border-t border-neutral-200 pt-3">
              <div className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5 mb-2">
                <History className="w-3.5 h-3.5 text-neutral-500" />
                <span>Riwayat Notifikasi Sebelumnya ({item.warningHistory.length}):</span>
              </div>
              <div className="space-y-1.5 max-h-24 overflow-y-auto text-xs">
                {item.warningHistory.map((log) => (
                  <div
                    key={log.id}
                    className="p-2 rounded bg-neutral-100 border border-neutral-200 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      {log.channel === 'whatsapp' ? (
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <Mail className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      )}
                      <span className="text-neutral-800 font-medium">{log.message}</span>
                    </div>
                    <span className="text-[11px] text-neutral-500 font-mono shrink-0">
                      {new Date(log.timestamp).toLocaleString('id-ID')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-neutral-300 hover:bg-white text-neutral-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Tutup
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSendWhatsApp}
              disabled={!waAvailable}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                waAvailable
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                  : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>{item.photoUrl ? 'Kirim via WhatsApp (+ Foto)' : 'Kirim via WhatsApp'}</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </button>

            <button
              onClick={handleSendGmail}
              disabled={!emailAvailable}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                emailAvailable
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                  : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
              }`}
            >
              <Mail className="w-4 h-4" />
              <span>Buka Gmail</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
