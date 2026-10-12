const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

export function formatVnd(n: number | null | undefined) {
  return vnd.format(Math.round(n ?? 0));
}

export function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('vi-VN');
}

export function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} ngày trước`;
  return formatDate(iso);
}

export function budgetText(min: number | null, max: number | null) {
  if (min && max) return `${formatVnd(min)} – ${formatVnd(max)}`;
  if (max) return `Tối đa ${formatVnd(max)}`;
  if (min) return `Từ ${formatVnd(min)}`;
  return 'Thương lượng';
}

export function errMsg(e: unknown) {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return 'Đã có lỗi xảy ra';
}

/** Chỉ cho phép chuyển hướng nội bộ (chống open redirect). */
export function safeNext(n: string | null | undefined) {
  return n && n.startsWith('/') && !n.startsWith('//') ? n : '/';
}
