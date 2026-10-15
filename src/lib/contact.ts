/** Phát hiện SĐT Việt Nam / email trong văn bản (giống hàm contains_contact trong database). */
const PHONE = /(^|[^0-9])(\+?84|0)[ .-]?[35789]([ .-]?[0-9]){8}([^0-9]|$)/i;
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
/** Link Zalo / Facebook / Messenger / Instagram / Telegram / TikTok / WhatsApp / Viber. */
const SOCIAL = /(zalo\.me|facebook\.com|fb\.com|fb\.me|m\.me\/|messenger\.com|instagram\.com|t\.me\/|telegram\.me|tiktok\.com\/@|wa\.me|viber\.com)/i;

export function containsContact(...texts: (string | null | undefined)[]) {
  return texts.some((t) => !!t && (PHONE.test(t) || EMAIL.test(t) || SOCIAL.test(t)));
}

export const CONTACT_WARNING =
  'Vui lòng không ghi số điện thoại, email hay link Zalo/Facebook. Thông tin liên hệ của hai bên chỉ mở khi đơn đã đủ cọc và phí nền tảng.';

/** Tên ẩn danh cho shop theo thứ tự báo giá: Shop A, Shop B, … */
export function anonShopLabel(index: number) {
  let n = index;
  let s = '';
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return `Shop ${s}`;
}
