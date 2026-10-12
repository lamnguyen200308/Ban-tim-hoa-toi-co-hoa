import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Webhook xác nhận thanh toán (PLACEHOLDER — nối với cổng thanh toán / dịch vụ báo biến động số dư của bạn).
 *
 * Nhận JSON: { "content": "<nội dung chuyển khoản>", "amount": 10000 }
 * Header:    x-webhook-secret: <PAYMENT_WEBHOOK_SECRET>
 *
 * Tìm mã BTHxxxxxxxxxx trong nội dung → đánh dấu đã trả → màn hình người mua tự mở thông tin (Realtime).
 * Cần biến môi trường (KHÔNG có tiền tố NEXT_PUBLIC_): SUPABASE_SERVICE_ROLE_KEY, PAYMENT_WEBHOOK_SECRET.
 * Mỗi cổng thanh toán gửi dữ liệu khác nhau — sửa phần đọc body cho khớp.
 */
export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!url || !serviceKey || !secret) {
    return NextResponse.json({ ok: false, error: 'Webhook chưa được cấu hình' }, { status: 501 });
  }

  const given = Buffer.from(req.headers.get('x-webhook-secret') ?? '');
  const expected = Buffer.from(secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { content?: unknown; amount?: unknown } | null;
  const ref = String(body?.content ?? '').toUpperCase().match(/BTH[A-Z0-9]{10}/)?.[0];
  const amount = Number(body?.amount);
  if (!ref || !Number.isFinite(amount)) {
    return NextResponse.json({ ok: false, error: 'Thiếu mã thanh toán hoặc số tiền' }, { status: 400 });
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc('confirm_unlock_payment', { p_payment_ref: ref, p_amount: Math.round(amount) });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, matched: !!data });
}
