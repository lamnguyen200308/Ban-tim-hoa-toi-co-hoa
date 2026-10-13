# 🌸 Bạn tìm hoa, tôi có hoa

Sàn hoa tươi với 2 tính năng chính:

1. **Thiết kế bó hoa 3D** (`/thiet-ke`) — kéo-thả hoa vào bó, chọn giấy gói, kiểu gói, ruy băng; xoay 360° để ngắm; giá cập nhật ngay. Bấm vào một bông để chọn rồi kéo đổi vị trí (chạy cả trên điện thoại), nâng/hạ, trả về vị trí gốc hoặc bỏ riêng bông đó; vị trí được lưu trong bản nháp và hiện trong ảnh chụp bó hoa.
2. **Chợ hoa** (`/cho-hoa`) — khách đăng mô tả + ảnh (hoặc thiết kế 3D) → các shop hoa báo giá (ẩn danh: *Shop A, Shop B…*), có thể hạ giá để cạnh tranh → khách chấp nhận / từ chối. Báo giá mới hiện ngay (Supabase Realtime).
3. **Giữ kín thông tin** — khách và shop không thấy tên / SĐT / địa chỉ của nhau. Sau khi chốt báo giá, mỗi bên **quét QR thanh toán** để mở thông tin liên hệ của bên kia.
4. **Mẫu đã lưu** (`/mau-da-luu`) — chưa đăng nhập vẫn thiết kế và lưu mẫu trên trình duyệt; đăng nhập để đăng lên Chợ hoa.
5. **Đơn hàng** (`/don-hang/<id>`) — khách chấp nhận báo giá → đơn hàng (lưu nguyên báo giá đã chốt) → đặt cọc **DEMO** → shop xác nhận, chuẩn bị, giao → khách xác nhận hoàn tất. Có lịch sử trạng thái và khiếu nại kèm ảnh bằng chứng.
6. **Quản trị** (`/quan-tri`) — tổng quan, đơn hàng, khiếu nại, yêu cầu & báo giá, người dùng, cấu hình (tỷ lệ cọc, phí dịch vụ, bật/tắt demo), nhật ký thay đổi.

> ⚠️ **Thanh toán hiện CHỈ LÀ DEMO.** Mã QR là hình minh hoạ không quét được, không gắn tài khoản ngân hàng nào. Mọi khoản cọc, phí dịch vụ, hoàn tiền đều là số liệu mô phỏng (`payment_mode = 'demo'`, `paid_via = 'demo'`) và không được tính là doanh thu thật.

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
   - `supabase/migrations/0002_privacy_unlock_quota.sql` — ẩn thông tin, mở khoá bằng QR, giới hạn số đơn được xem
   - `supabase/migrations/0003_orders_demo_payment_admin.sql` — đơn hàng, đặt cọc demo, khiếu nại, quản trị viên, báo giá chi tiết
3. **Project Settings → API**: copy `Project URL` và `anon public key` vào `.env.local`.
4. **Authentication → URL Configuration**:
   - Site URL: `https://<tên-miền-vercel-của-bạn>`
   - Redirect URLs: thêm `http://localhost:3000/auth/callback` và `https://<tên-miền>/auth/callback`
5. (Tuỳ chọn, khi thử nghiệm) **Authentication → Providers → Email**: tắt *Confirm email* để đăng ký xong vào được ngay.
6. **Sửa link trong email xác nhận** để mở được trên mọi trình duyệt / điện thoại: **Authentication → Emails → Confirm signup**, thay link trong template bằng:
   ```html
   <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email">Xác nhận email</a>
   ```
   (Link mặc định chỉ chạy trên đúng trình duyệt đã bấm đăng ký, nên mở từ app Gmail trên điện thoại sẽ báo lỗi.)

### Dữ liệu mẫu để thử
Chạy `supabase/demo_data.sql` trong SQL Editor: tạo 2 khách, 1 shop (đã xác nhận email, mật khẩu `Demo@12345`) và 20 đơn hoa. Đăng nhập bằng `khach1@demo.test`, `khach2@demo.test` hoặc `shop1@demo.test`. Đơn *“Tulip vàng tặng mẹ”* của khách 1 đã chốt shop để thử QR. Cuối file có lệnh xoá dữ liệu mẫu.

### Quản trị viên
Sau khi chạy `0003`, đặt tài khoản của bạn làm admin (chạy 1 lần trong SQL Editor):
```sql
update public.profiles set is_admin = true
 where id = (select id from auth.users where email = 'email-cua-ban@gmail.com');
```
Muốn thử nhanh: chạy `supabase/demo_admin.sql` → đăng nhập `admin@demo.test` / `Demo@12345`. Tab **🛠️ Quản trị** chỉ hiện với admin; mọi hàm quản trị đều kiểm tra quyền trong database.

### Thanh toán mở thông tin & giới hạn xem đơn
Sửa trong bảng `app_settings` (1 dòng):

| Cột | Mặc định | Ý nghĩa |
|---|---|---|
| `guest_quota` | 3 | Số đơn mới nhất người chưa đăng nhập được xem |
| `member_quota` | 13 | Đã đăng nhập (3 + 10) |
| `unlock_fee_customer` / `unlock_fee_shop` | 10.000 / 20.000 | Phí mở thông tin liên hệ (giá tạm, đổi tuỳ ý) |
| `payment_demo` | `true` | Chế độ DEMO: hiện QR minh hoạ + nút *Mô phỏng thanh toán thành công*. Tắt thì ẩn nút mô phỏng — nhưng vẫn chưa nhận được tiền thật cho tới khi nối cổng thanh toán. |
| `deposit_percent` | 30 | Tỷ lệ đặt cọc (%) cho đơn mới. VD: đơn 600.000 ₫ → cọc 180.000 ₫ |
| `service_fee` | 50.000 | Phí dịch vụ nền tảng, chỉ ghi nhận khi đơn **hoàn tất** |

Nên sửa các giá trị này ở **Quản trị → Cấu hình** (có ghi nhật ký) thay vì Table Editor.

Muốn cho một tài khoản xem thêm đơn (gói trả phí sau này): tăng `profiles.extra_quota`.

**Mã QR:** `src/components/payment/PaymentQR.tsx` vẽ QR **minh hoạ** (cố ý thiếu 1 ô định vị nên không máy quét nào đọc được) kèm cảnh báo *“QR DEMO – Chỉ dùng để thử nghiệm. Không chuyển tiền thật.”* **Đừng** thay bằng QR ngân hàng khi chưa có cổng thanh toán và chưa tắt demo.
**Xác nhận thanh toán (sau này):** cổng thanh toán gọi `POST /api/payment/webhook` với header `x-webhook-secret` và JSON `{ "content": "...BTH...", "amount": 10000 }`. Cần thêm `SUPABASE_SERVICE_ROLE_KEY` và `PAYMENT_WEBHOOK_SECRET` (không có tiền tố `NEXT_PUBLIC_`) trên Vercel. Sửa phần đọc body cho khớp với cổng bạn dùng.

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
    mau-da-luu/               Mẫu đã lưu (trên máy + trong tài khoản)
    don-hang/[id]/            Chi tiết đơn: tiến trình, đặt cọc DEMO, khiếu nại, lịch sử
    quan-tri/                 Trang quản trị (chỉ admin)
    tai-khoan/                Yêu cầu, thiết kế, báo giá, thông tin shop
    api/payment/webhook/      Nhận xác nhận thanh toán (placeholder)
    auth/callback/            Xác nhận email
  components/customiser/      Cảnh 3D: hoa, giấy gói, ruy băng, giao diện
  components/market/          Form yêu cầu, form báo giá, thẻ thiết kế
  components/payment/         QR DEMO (minh hoạ), khung mở thông tin
  components/orders/          Đặt cọc demo, khiếu nại, danh sách đơn, nhãn trạng thái
  lib/                        Supabase client, giá, danh mục, kiểu dữ liệu
supabase/
  migrations/0001_init.sql
  migrations/0002_privacy_unlock_quota.sql
  migrations/0003_orders_demo_payment_admin.sql
  seed.sql
  demo_data.sql · demo_admin.sql   Dữ liệu & tài khoản mẫu (chỉ để thử)
```

## 5. Quy tắc nghiệp vụ (đã cài trong database)

| Quy tắc | Cách thực thi |
|---|---|
| Mỗi shop 1 báo giá / yêu cầu, sửa hoặc rút khi còn chờ | `unique(request_id, shop_id)` + RLS |
| Shop không báo giá yêu cầu của chính mình | RLS `bids_insert_shop` |
| Chấp nhận 1 báo giá → các báo giá khác tự bị từ chối | Hàm `accept_bid()` (security definer) |
| Khách và shop không thấy thông tin của nhau (shop ẩn danh, chỉ lộ quận/huyện + đánh giá) | Quyền SELECT theo cột trên `shops`, RLS `profiles_select` chỉ xem của mình |
| Mở thông tin bên kia chỉ sau khi chốt đơn **và** đã thanh toán | `start_contact_unlock()`, `get_counterpart_contact()`, bảng `contact_unlocks` |
| Chỉ server (webhook) xác nhận được thanh toán thật | `confirm_unlock_payment()` chỉ cấp cho `service_role` |
| Chưa đăng nhập xem 3 đơn, đăng nhập 13, gói trả phí nhiều hơn | `can_view_request()` trong RLS của `requests` và `bids` |
| Không ghi SĐT / email vào yêu cầu và báo giá | Trigger `guard_no_contact` |
| Người dùng không tự đổi role / rating shop | Quyền UPDATE theo cột |
| Ảnh chỉ upload vào thư mục của chính mình | Storage policy theo `auth.uid()` |
| Báo giá: tổng = giá hoa + thiết kế + giao hàng; báo giá hết hạn không chấp nhận được | Constraint `bids_price_breakdown`, `accept_bid()` |
| Chấp nhận báo giá → tạo đơn, lưu nguyên báo giá đã chốt | `accept_bid()` → `create_order_for_bid()` |
| Đặt cọc demo chỉ do khách bấm, chỉ khi demo bật; không tự xác nhận khi mở trang | `demo_pay_deposit()` |
| Trạng thái đơn chỉ chuyển theo đúng quy trình và vai trò; shop không tự “hoàn tất” | `order_transition()` |
| Trạng thái đơn và thanh toán lưu riêng; người dùng không sửa trực tiếp bảng `orders` | Thu hồi quyền INSERT/UPDATE/DELETE |
| Huỷ sau khi cọc không mặc định mất cọc — chờ admin xem xét | `order_transition()` ghi `deposit_note` |
| Khiếu nại: hai bên gửi giải trình + ảnh (bucket riêng tư); chỉ admin quyết định, lưu lý do & người xử lý | `open_dispute()`, `add_dispute_message()`, `resolve_dispute()` |
| Phí dịch vụ chỉ ghi khi đơn hoàn tất; số liệu demo tách khỏi doanh thu thật | `orders.service_fee`, `admin_overview()` |
| Địa chỉ giao hàng chỉ khách thấy; shop thấy sau khi mở thông tin | Bảng `request_private` + `get_counterpart_contact()` |
| Chỉ admin xem/đổi cấu hình, có nhật ký | `admin_*()` kiểm tra `is_admin()`, bảng `audit_log` |

**Đấu giá công khai:** ai xem được yêu cầu thì thấy giá các shop (nhưng không biết shop là ai).

## 6. Ghi chú

- Hoa 3D được dựng bằng hình học thủ tục (không cần file model). Muốn đẹp hơn có thể thay bằng model `.glb` qua `useGLTF` của drei.
- Kéo-thả HTML5 không chạy trên màn hình cảm ứng — trên điện thoại dùng nút **+**.
- Thiết kế đang làm được tự lưu nháp trong trình duyệt, nên không mất khi phải đăng nhập giữa chừng.
