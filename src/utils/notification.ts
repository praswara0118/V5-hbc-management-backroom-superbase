import { ReturnItem, Supplier, WarningTone } from '../types/inventory';

/**
 * Format Indonesian telephone number into WhatsApp international format without leading zero
 * Example: 0812-3456-7890 -> 6281234567890
 */
export function formatPhoneForWhatsApp(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  } else if (!cleaned.startsWith('62')) {
    cleaned = '62' + cleaned;
  }
  return cleaned;
}

/**
 * Calculate days remaining until due date
 * Positive = remaining days
 * 0 = today
 * Negative = overdue days
 */
export function getDaysRemaining(dueDateStr: string): number {
  if (!dueDateStr) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(dueDateStr);
  dueDate.setHours(0, 0, 0, 0);

  const diffTime = dueDate.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Format date into readable Indonesian string: e.g. "12 Oktober 2026"
 */
export function formatIndoDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateStr;
  }
}

/**
 * Format date & time into readable Indonesian string: e.g. "23 Oktober 2026, pukul 14.30 WIB"
 */
export function formatIndoDateTime(date: Date | string): string {
  if (!date) return '-';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    const dateFormatted = new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
    const timeFormatted = new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
    return `${dateFormatted}, pukul ${timeFormatted} WIB`;
  } catch {
    return String(date);
  }
}

export interface OverdueDetail {
  isOverdue: boolean;
  daysRemaining: number;
  exactDurationLabel: string;
  isToday: boolean;
  isUpcoming: boolean;
  finalWarningRemainingHours?: number;
  finalDeadlineDate?: Date;
  isPastFinalDeadline?: boolean;
}

/**
 * Hitung kalkulasi durasi keterlambatan secara akurat
 * - Jika < 24 jam: dihitung dalam satuan jam pasti (contoh: "Terlambat 14 jam")
 * - Jika >= 24 jam: dihitung dalam satuan hari dan jam (contoh: "Terlambat 3 hari (72 jam)")
 * - Menghitung batas waktu 2 x 24 jam (48 jam) untuk peringatan terakhir
 */
export function getOverdueDetail(dueDateStr: string, finalWarningSentAt?: string): OverdueDetail {
  const now = new Date();
  const due = new Date(dueDateStr);
  // Tenggat dihitung sampai akhir hari operasional (pukul 17.00)
  due.setHours(17, 0, 0, 0);

  const diffMs = now.getTime() - due.getTime();
  const daysRemaining = getDaysRemaining(dueDateStr);

  let isOverdue = false;
  let exactDurationLabel = '';
  let isToday = false;
  let isUpcoming = false;

  if (diffMs > 0) {
    isOverdue = true;
    const totalHours = Math.floor(diffMs / (3600 * 1000));
    if (totalHours < 24) {
      exactDurationLabel = `Terlambat ${Math.max(1, totalHours)} jam`;
    } else {
      const days = Math.floor(totalHours / 24);
      exactDurationLabel = `Terlambat ${days} hari (${totalHours} jam)`;
    }
  } else if (daysRemaining === 0) {
    isToday = true;
    exactDurationLabel = 'Jatuh tempo HARI INI';
  } else {
    isUpcoming = true;
    exactDurationLabel = `Sisa ${daysRemaining} hari lagi`;
  }

  // 48-Hour (2x24 Jam) Final Warning Deadline Calculation
  let finalWarningRemainingHours: number | undefined;
  let finalDeadlineDate: Date | undefined;
  let isPastFinalDeadline: boolean | undefined;

  if (finalWarningSentAt) {
    const sentTime = new Date(finalWarningSentAt).getTime();
    const deadlineTime = sentTime + 48 * 3600 * 1000; // 2 x 24 jam
    finalDeadlineDate = new Date(deadlineTime);
    const msLeft = deadlineTime - now.getTime();
    if (msLeft > 0) {
      finalWarningRemainingHours = Math.ceil(msLeft / (3600 * 1000));
      isPastFinalDeadline = false;
    } else {
      finalWarningRemainingHours = 0;
      isPastFinalDeadline = true;
    }
  }

  return {
    isOverdue,
    daysRemaining,
    exactDurationLabel,
    isToday,
    isUpcoming,
    finalWarningRemainingHours,
    finalDeadlineDate,
    isPastFinalDeadline,
  };
}

/**
 * Determine dynamic status based on due date if not marked as completed
 */
export function calculateReturnStatus(item: ReturnItem): ReturnItem['status'] {
  if (item.status === 'Sudah Diambil' || item.status === 'Diganti Baru') {
    return item.status;
  }

  const daysLeft = getDaysRemaining(item.dueDate);
  if (daysLeft < 0) {
    return 'Lewat Tenggat';
  } else if (daysLeft <= 2) {
    return 'Mendekati Tenggat';
  }
  return 'Menunggu Pengambilan';
}

export type WarningTier = 'gentle' | 'reminder' | 'urgent' | 'final' | 'followup';

/**
 * Build 5-tier professional WhatsApp / Email message for a specific return item
 * 1. gentle: Pengingat Ramah (sebelum jatuh tempo / info kedatangan)
 * 2. reminder: Peringatan Keterlambatan (saat jatuh tempo / telat 1-3 hari)
 * 3. urgent: Peringatan Mendesak (telat > 3 hari)
 * 4. final: Peringatan Terakhir (Batas waktu maksimal 2 x 24 jam & klausul pemusnahan PA0)
 * 5. followup: Tindak Lanjut Pasca Batas Akhir (setelah 2x24 jam terlewati: eksekusi PA0 pemusnahan)
 */
export function generateNotificationMessage(
  item: ReturnItem,
  tone: WarningTier = 'urgent',
  senderWarehouse: string = 'Bagian Gudang & Retur Logistik HBC',
  finalSentTimestamp?: string
): { subject: string; message: string; deadlineDate?: Date } {
  const overdueInfo = getOverdueDetail(item.dueDate, finalSentTimestamp || item.finalWarningSentAt);
  const formattedDueDate = formatIndoDate(item.dueDate);
  const formattedReceivedDate = formatIndoDate(item.receivedDate);

  // Hitung batas 2x24 jam dari sekarang jika belum pernah dikirim, atau dari waktu kirim sebelumnya
  const finalBaseTime = finalSentTimestamp || item.finalWarningSentAt || new Date().toISOString();
  const deadline48h = new Date(new Date(finalBaseTime).getTime() + 48 * 3600 * 1000);
  const formatted48hDeadline = formatIndoDateTime(deadline48h);

  let statusSentence = '';
  let urgencyNotice = '';
  let subject = '';

  switch (tone) {
    case 'gentle':
      subject = `[PEMBERITAHUAN RETUR] Barang Siap Diambil - ${item.itemName} (${item.barcode})`;
      statusSentence = `ℹ️ Tenggat waktu pengambilan: ${formattedDueDate} (${overdueInfo.exactDurationLabel})`;
      urgencyNotice = `Mohon dicatat dalam jadwal kunjungan armada/sales rekanan untuk pengambilan barang return saat pengiriman berikutnya.`;
      break;

    case 'reminder':
      subject = `[PERINGATAN JATUH TEMPO] Jadwal Pengambilan Retur - ${item.itemName} (${item.barcode})`;
      statusSentence = `⚠️ STATUS: ${overdueInfo.exactDurationLabel.toUpperCase()} (Tenggat: ${formattedDueDate})`;
      urgencyNotice = `Mengingat barang telah memasuki masa jatuh tempo, mohon konfirmasi estimasi jadwal armada rekanan untuk mengambil fisik barang di gudang kami.`;
      break;

    case 'urgent':
      subject = `[MENDESAK / OVERDUE] Keterlambatan Pengambilan Retur - ${item.itemName} (${item.barcode})`;
      statusSentence = `🚨 PERINGATAN MENDESAK: ${overdueInfo.exactDurationLabel.toUpperCase()} (Tenggat awal: ${formattedDueDate})`;
      urgencyNotice = `Kapasitas area karantina retur gudang kami saat ini telah melebihi batas. Mohon prioritas penjemputan barang hari ini atau selambat-lambatnya 1x24 jam ke depan agar tidak menghambat operasional penerimaan barang baru.`;
      break;

    case 'final':
      subject = `[PERINGATAN TERAKHIR - BATAS 2x24 JAM] Instruksi Pengambilan Retur / Proses Pemusnahan PA0 - ${item.itemName} (${item.barcode})`;
      statusSentence = `⛔ STATUS: TELAH MELAMPAUI BATAS MAKSIMAL (${overdueInfo.exactDurationLabel.toUpperCase()})`;
      urgencyNotice = `⚠️ PENEGASAN BATAS AKHIR (2 x 24 JAM / 48 JAM):
Sesuai Standard Operating Procedure (SOP) Manajemen Pergudangan HBC, kami memberikan batas toleransi penjemputan terakhir maksimal 2 x 24 JAM (48 Jam):
⏰ BATAS AKHIR PENJEMPUTAN: ${formatted48hDeadline}

Apabila hingga batas waktu di atas barang BELUM DIAMBIL dan tidak ada konfirmasi resmi tertulis, maka pihak toko/gudang akan langsung memproses barang tersebut ke status "PA0" (PEMUSNAHAN / PEMBUANGAN BARANG RUSAK).

Catatan Penting: Segala kerugian nilai barang akibat proses PA0 setelah batas waktu terlewati sepenuhnya berada di luar tanggung jawab pihak manajemen toko/gudang.`;
      break;

    case 'followup':
      subject = `[TINDAK LANJUT PA0] Batas Waktu 2x24 Jam Terlewati - Eksekusi Pemusnahan Retur ${item.itemName} (${item.barcode})`;
      statusSentence = `❌ BATAS WAKTU 2x24 JAM TELAH BERAKHIR PADA: ${formatted48hDeadline}`;
      urgencyNotice = `Diberitahukan bahwa masa tenggang toleransi 2x24 jam yang telah kami berikan telah habis tanpa ada penjemputan fisik barang oleh pihak supplier.

Oleh karena itu, sesuai ketentuan SOP Pergudangan yang berlaku, barang return ini secara resmi dialihkan ke STATUS PA0 (PROSES PEMUSNAHAN BARANG) dan dikeluarkan dari slot penyimpanan retur aktif demi menjaga kapasitas dan sanitasi area gudang.`;
      break;

    default:
      subject = `[PERINGATAN RETUR] Pengambilan Barang Return - ${item.itemName} (${item.barcode})`;
      statusSentence = `Status: ${overdueInfo.exactDurationLabel}`;
      urgencyNotice = `Mohon bantuan untuk segera menjadwalkan pengambilan barang retur.`;
      break;
  }

  const recipientGreeting = item.supplierPic
    ? `Yth. Bpk/Ibu ${item.supplierPic} / Tim Logistik ${item.supplierName},`
    : `Yth. Tim Logistik ${item.supplierName},`;

  let photoLine = '';
  if (item.photoUrl) {
    if (item.photoUrl.startsWith('http')) {
      photoLine = `• *Bukti Foto Fisik:* ${item.photoUrl}\n`;
    } else {
      photoLine = `• *Bukti Foto Fisik:* Tersedia di sistem database Returku (Barcode: ${item.barcode})\n`;
    }
  }

  const message = `Halo, Selamat Siang.
${recipientGreeting}

Kami dari *${senderWarehouse}* menginformasikan status barang return/klaim supplier yang tersimpan di gudang kami:

📦 *RINCIAN BARANG RETURN:*
• *Nama Barang:* ${item.itemName}
• *Kode / Barcode:* ${item.barcode}
• *SKU:* ${item.sku || '-'}
• *Jumlah (Qty):* ${item.quantity} ${item.unit}
• *Alasan Return:* ${item.returnReason}
• *Catatan Kondisi:* ${item.conditionNotes || 'Sesuai fisik barang'}
• *Lokasi Simpan Gudang:* ${item.locationSlot || 'Area Retur'}
• *Tanggal Masuk Gudang:* ${formattedReceivedDate}
${photoLine}
📅 *STATUS & DURASI TENGGAT WAKTU:*
${statusSentence}

${urgencyNotice}

📋 *PETUNJUK PENGAMBILAN:*
1. Harap membawa Surat Penarikan/Pengambilan Barang Retur saat tiba di gudang.
2. Petugas gudang kami dapat langsung memverifikasi fisik barang menggunakan Barcode: *${item.barcode}*.
3. Jam operasional gudang retur: Senin - Sabtu (08.00 - 15.00 WIB).

Konfirmasi jadwal armada penjemputan dapat langsung membalas pesan ini. Terima kasih atas perhatian dan kerja samanya.

Salam Hormat,
*${senderWarehouse}*`;

  return { subject, message, deadlineDate: deadline48h };
}

/**
 * Generate consolidated summary message for a supplier who has multiple return items
 */
export function generateConsolidatedSupplierMessage(
  supplier: Supplier,
  items: ReturnItem[],
  senderWarehouse: string = 'Bagian Gudang & Retur Logistik HBC'
): { subject: string; message: string } {
  const activeItems = items.filter(
    (i) => i.status !== 'Sudah Diambil' && i.status !== 'Diganti Baru'
  );

  const subject = `[REKAP RETUR GUDANG] ${activeItems.length} Barang Return Siap Diambil - ${supplier.name}`;

  const itemsListText = activeItems
    .map((item, idx) => {
      const overdueInfo = getOverdueDetail(item.dueDate, item.finalWarningSentAt);
      const daysStatus = overdueInfo.isOverdue
        ? `[TERLAMBAT: ${overdueInfo.exactDurationLabel.toUpperCase()}]`
        : overdueInfo.isToday
        ? `[JATUH TEMPO HARI INI]`
        : `[Batas: ${formatIndoDate(item.dueDate)} - ${overdueInfo.exactDurationLabel}]`;

      return `${idx + 1}. *${item.itemName}* (${item.quantity} ${item.unit})
   • Barcode: ${item.barcode} | Alasan: ${item.returnReason}
   • Tenggat: ${daysStatus} | Lokasi: ${item.locationSlot || 'Rak Retur'}`;
    })
    .join('\n\n');

  const message = `Halo, Selamat Siang.
Yth. Bpk/Ibu ${supplier.picName || 'Tim Rekanan'} (${supplier.name}),

Kami dari *${senderWarehouse}* menyampaikan rekapitulasi data barang return yang saat ini tersimpan di gudang kami dan menunggu pengambilan/penukaran:

📊 *TOTAL BARANG RETURN MENUNGGU:* ${activeItems.length} Item

📦 *DAFTAR RINCIAN BARANG:*
${itemsListText}

Mohon segera dijadwalkan pengambilan atau penjemputan barang-barang tersebut oleh armada/ekspedisi rekanan.

Saat tiba di gudang, petugas kami siap memindai barcode masing-masing kardus/barang untuk serah terima yang cepat dan akurat.

Terima kasih atas kerja samanya.

Salam Hormat,
*${senderWarehouse}*`;

  return { subject, message };
}

/**
 * Build WhatsApp click URL
 */
export function getWhatsAppUrl(phone: string, text: string): string {
  const cleanPhone = formatPhoneForWhatsApp(phone);
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}

/**
 * Build Gmail web compose URL
 */
export function getGmailComposeUrl(email: string, subject: string, body: string): string {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
    email
  )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Build standard mailto link
 */
export function getMailtoUrl(email: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
}
