import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/format';

/**
 * Supabase chuyển về đây sau khi người dùng bấm link xác nhận email.
 *
 * Hỗ trợ 2 kiểu link:
 *  • ?token_hash=…&type=email  — mở được trên MỌI trình duyệt / điện thoại (khuyên dùng, xem README).
 *  • ?code=…                   — kiểu mặc định (PKCE), CHỈ chạy trên đúng trình duyệt đã bấm đăng ký.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = safeNext(searchParams.get('next'));
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const code = searchParams.get('code');

  const fail = (message: string) =>
    NextResponse.redirect(`${origin}/dang-nhap?next=${encodeURIComponent(next)}&error=${encodeURIComponent(message)}`);

  // Supabase tự gắn lỗi vào link khi link hết hạn / đã dùng
  const remoteError = searchParams.get('error_description') ?? searchParams.get('error');
  if (remoteError) {
    return fail('Link xác nhận đã hết hạn hoặc đã được dùng. Hãy thử đăng nhập — nếu chưa được, đăng ký lại để nhận link mới.');
  }

  const supabase = createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return fail('Link xác nhận không hợp lệ hoặc đã hết hạn. Hãy đăng ký lại để nhận link mới.');
    return NextResponse.redirect(`${origin}${next}`);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // Thường gặp khi mở link trên trình duyệt khác (VD: app Gmail trên điện thoại).
      // Lúc này email THƯỜNG ĐÃ được xác nhận, chỉ là chưa tự đăng nhập được.
      return fail('Email đã được xác nhận nhưng link được mở trên trình duyệt khác. Hãy đăng nhập bằng email và mật khẩu của bạn.');
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  return fail('Link xác nhận thiếu thông tin. Hãy mở lại link trong email.');
}
