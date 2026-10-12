# 🌸 Bạn tìm hoa, tôi có hoa

Sàn hoa tươi với 2 tính năng chính:

1. **Thiết kế bó hoa 3D** (`/thiet-ke`) — kéo-thả hoa vào bó, chọn giấy gói, kiểu gói, ruy băng; xoay 360° để ngắm; giá cập nhật ngay. Bấm vào một bông để chọn rồi kéo đổi vị trí (chạy cả trên điện thoại), nâng/hạ, trả về vị trí gốc hoặc bỏ riêng bông đó; vị trí được lưu trong bản nháp và hiện trong ảnh chụp bó hoa.
2. **Chợ hoa** (`/cho-hoa`) — khách đăng mô tả + ảnh (hoặc thiết kế 3D) → các shop hoa báo giá công khai, có thể hạ giá để cạnh tranh → khách chấp nhận / từ chối. Báo giá mới hiện ngay (Supabase Realtime).

**Công nghệ:** Next.js 14 (App Router) · React Three Fiber · Tailwind CSS · Supabase (Postgres, Auth, Storage, Realtime) · Vercel.

---

## 1. Chạy thử trên máy

```bash
npm install
cp .env.example .env.local   # điền khoá Supabase (bước 2)
npm run dev                   # http://localhost:3000
```

> Chưa có Supabase? Trang thiết kế 3D vẫn chạy với bảng giá mẫu. Chợ hoa và đăng nhập cần Supabase.

## 2. Cài đặt Supabase

1. Tạo project tại [supabase.com](https://supabase.com) (chọn region **Singapore** cho gần Việt Nam).
2. Vào **SQL Editor**, chạy lần lượt:
   - `supabase/migrations/0001_init.sql` — bảng, phân quyền (RLS), hàm chấp nhận báo giá, bucket ảnh, realtime
   - `supabase/seed.sql` — danh mục hoa / giấy gói / kiểu gói mẫu
3. **Project Settings → API**: copy `Project URL` và `anon public key` vào `.env.local`.
4. **Authentication → URL Configuration**:
   - Site URL: `https://<tên-miền-vercel-của-bạn>`
   - Redirect URLs: thêm `http://localhost:3000/auth/callback` và `https://<tên-miền>/auth/callback`
5. (Tuỳ chọn, khi thử nghiệm) **Authentication → Providers → Email**: tắt *Confirm email* để đăng ký xong vào được ngay.

### Quản lý danh mục & giá
Sửa trực tiếp trong **Table Editor** của Supabase: bảng `flowers` (hoa, giá/cành), `wrappers` (giấy gói, giá/tờ), `wrap_styles` (kiểu gói, công gói). Đặt `active = false` để ẩn. Cột `kind` quyết định hình 3D: `rose, tulip, sunflower, daisy, carnation, hydrangea, baby, orchid, foliage`.

## 3. Deploy lên Vercel

1. Đẩy code lên GitHub.
2. Vercel → **Add New Project** → chọn repo (Framework tự nhận Next.js).
3. **Environment Variables**: thêm `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_ANON_KEY` → **Deploy**.
4. Quay lại Supabase cập nhật Site URL / Redirect URLs bằng tên miền Vercel.

> Biến `NEXT_PUBLIC_*` được nhúng lúc build — đổi giá trị thì cần **Redeploy**.

## 4. Cấu trúc thư mục

```
src/
  app/
    page.tsx                  Trang chủ
    thiet-ke/                 Trình thiết kế 3D
    cho-hoa/                  Danh sách yêu cầu
    cho-hoa/dang-yeu-cau/     Đăng yêu cầu (?design=<id> để đính kèm thiết kế)
    cho-hoa/[id]/             Chi tiết + báo giá realtime
    dang-nhap/                Đăng nhập / đăng ký (khách hoặc shop)
    tai-khoan/                Yêu cầu, thiết kế, báo giá, thông tin shop
    auth/callback/            Xác nhận email
  components/customiser/      Cảnh 3D: hoa, giấy gói, ruy băng, giao diện
  components/market/          Form yêu cầu, form báo giá, thẻ thiết kế
  lib/                        Supabase client, giá, danh mục, kiểu dữ liệu
supabase/
  migrations/0001_init.sql
  seed.sql
```

## 5. Quy tắc nghiệp vụ (đã cài trong database)

| Quy tắc | Cách thực thi |
|---|---|
| Mỗi shop 1 báo giá / yêu cầu, sửa hoặc rút khi còn chờ | `unique(request_id, shop_id)` + RLS |
| Shop không báo giá yêu cầu của chính mình | RLS `bids_insert_shop` |
| Chấp nhận 1 báo giá → các báo giá khác tự bị từ chối | Hàm `accept_bid()` (security definer) |
| Số điện thoại khách chỉ hiện cho shop thắng | RLS `profiles_select` |
| Người dùng không tự đổi role / rating shop | Quyền UPDATE theo cột |
| Ảnh chỉ upload vào thư mục của chính mình | Storage policy theo `auth.uid()` |

**Đấu giá công khai:** mọi người đều thấy giá các shop. Muốn chuyển sang *đấu giá kín* (chỉ khách và shop đó thấy giá), đổi policy `bids_select` thành:
```sql
using (shop_id = auth.uid() or exists (select 1 from requests r where r.id = bids.request_id and r.customer_id = auth.uid()))
```

## 6. Ghi chú

- Hoa 3D được dựng bằng hình học thủ tục (không cần file model). Muốn đẹp hơn có thể thay bằng model `.glb` qua `useGLTF` của drei.
- Kéo-thả HTML5 không chạy trên màn hình cảm ứng — trên điện thoại dùng nút **+**.
- Thiết kế đang làm được tự lưu nháp trong trình duyệt, nên không mất khi phải đăng nhập giữa chừng.
