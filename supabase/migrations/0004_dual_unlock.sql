-- =====================================================================
--  0004 — Mở thông tin liên hệ theo 2 điều kiện: CỌC + PHÍ NỀN TẢNG
--  Chạy SAU 0003_orders_demo_payment_admin.sql (và demo_admin.sql nếu có)
--  trong Supabase → SQL Editor. Chạy lại nhiều lần không lỗi, KHÔNG xoá dữ liệu.
--
--  Quy tắc mới:
--   contact_unlocked = điều kiện CỌC hợp lệ  VÀ  điều kiện PHÍ NỀN TẢNG hợp lệ
--
--   • Điều kiện A — Cọc: khách chuyển cọc cho shop (hiện là MÔ PHỎNG) → shop tải ảnh
--     bằng chứng → shop hoặc admin bấm "xác nhận cọc (demo)".
--   • Điều kiện B — Phí nền tảng (mặc định 50.000 ₫/đơn, shop trả): shop bấm
--     "Mô phỏng thanh toán phí nền tảng".
--   • Chỉ khi CẢ HAI hợp lệ mới mở liên hệ cho đúng khách + đúng shop thắng của đơn.
--     Từ chối / tranh chấp / còn chờ ở bất kỳ điều kiện nào → vẫn khoá.
--   • Shop chỉ xác nhận đơn (bắt đầu làm hoa) sau khi đã mở liên hệ.
--   • Mở liên hệ KHÔNG đánh dấu đơn đã giao / hoàn tất / đã thanh toán đủ.
--   • Phí mở thông tin cũ (khách 10.000 ₫, shop 20.000 ₫) NGỪNG dùng. Bảng
--     contact_unlocks được giữ lại làm lịch sử, không còn mở được liên hệ.
--   • Phí nền tảng thu trước khi mở liên hệ; hoàn tất đơn KHÔNG ghi phí lần nữa.
--
--  ⚠️ VẪN CHỈ LÀ DEMO: không có ngân hàng / cổng thanh toán. Trạng thái '*_demo'
--     nghĩa là đã MÔ PHỎNG, không phải đã nhận tiền thật. Trạng thái 'verified'
--     (tiền thật) KHÔNG đặt được từ trình duyệt — để dành cho đối soát thật sau này.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Cấu hình: thời gian xem xét điều kiện (chỉ để nhắc admin, không tự xử phạt)
-- ---------------------------------------------------------------------
alter table public.app_settings
  add column if not exists condition_review_hours integer not null default 48
    check (condition_review_hours between 1 and 720);

-- ---------------------------------------------------------------------
-- 2. Đơn hàng: trạng thái cọc / phí nền tảng / mở liên hệ lưu RIÊNG
-- ---------------------------------------------------------------------
alter table public.orders
  add column if not exists remaining_amount integer generated always as (total - deposit_amount) stored,
  -- Điều kiện A: cọc
  add column if not exists deposit_status text not null default 'pending'
    check (deposit_status in ('pending', 'pending_verification', 'verified_demo', 'verified', 'rejected', 'disputed')),
  add column if not exists deposit_customer_marked_at timestamptz,  -- khách báo "đã chuyển cọc" (mô phỏng)
  add column if not exists deposit_evidence_at        timestamptz,  -- lần gửi bằng chứng gần nhất
  add column if not exists deposit_verified_at        timestamptz,
  add column if not exists deposit_verified_by        uuid references public.profiles (id) on delete set null,
  add column if not exists deposit_verification_method text
    check (deposit_verification_method in ('demo_shop', 'demo_admin', 'legacy_demo', 'reconciliation')),
  add column if not exists deposit_status_note text check (char_length(deposit_status_note) <= 2000),
  -- Điều kiện B: phí nền tảng
  add column if not exists platform_fee_amount integer check (platform_fee_amount >= 0),
  add column if not exists platform_fee_mode   text check (platform_fee_mode in ('demo', 'live')),
  add column if not exists platform_fee_status text not null default 'pending'
    check (platform_fee_status in ('pending', 'verified_demo', 'verified', 'rejected', 'disputed')),
  add column if not exists platform_fee_verified_at timestamptz,
  add column if not exists platform_fee_verified_by uuid references public.profiles (id) on delete set null,
  add column if not exists platform_fee_verification_method text
    check (platform_fee_verification_method in ('demo_simulation', 'demo_admin', 'legacy_completion', 'gateway')),
  add column if not exists platform_fee_note text check (char_length(platform_fee_note) <= 2000),
  -- Mở liên hệ
  add column if not exists contact_unlocked_at    timestamptz,
  add column if not exists contact_unlocked_by    uuid references public.profiles (id) on delete set null,
  add column if not exists contact_unlock_trigger text check (char_length(contact_unlock_trigger) <= 200);

create index if not exists orders_conditions_idx on public.orders (deposit_status, platform_fee_status)
  where contact_unlocked_at is null;

-- Nhật ký đơn: thêm loại sự kiện mới
alter table public.order_events drop constraint if exists order_events_kind_check;
alter table public.order_events add constraint order_events_kind_check
  check (kind in ('status', 'payment', 'dispute', 'evidence', 'platform_fee', 'unlock'));

-- Khiếu nại có thể gắn với một điều kiện cụ thể
alter table public.disputes
  add column if not exists condition text check (condition in ('deposit', 'platform_fee'));

-- ---------------------------------------------------------------------
-- 3. Chuyển đơn cũ sang mô hình mới (chỉ chạy cho đơn chưa có platform_fee_amount)
--    • Đơn đã cọc demo và đã qua bước xác nhận → cọc coi như đã xác minh (legacy_demo)
--      để đơn đang chạy không bị kẹt. Đơn còn ở "Chờ xác nhận" phải đi lại quy trình mới.
--    • Đơn đã hoàn tất và đã ghi phí → phí coi như đã thu (legacy_completion).
-- ---------------------------------------------------------------------
update public.orders o set
  platform_fee_amount = coalesce(nullif(o.service_fee, 0), (select service_fee from public.app_settings)),
  platform_fee_mode   = o.payment_mode,
  deposit_customer_marked_at = case when o.payment_status in ('demo_paid', 'paid') then o.deposit_paid_at end,
  deposit_status = case
    when o.payment_status = 'demo_paid' and o.status <> 'pending_confirmation' then 'verified_demo'
    when o.payment_status = 'paid'      and o.status <> 'pending_confirmation' then 'verified'
    else 'pending' end,
  deposit_verified_at = case when o.payment_status in ('demo_paid', 'paid') and o.status <> 'pending_confirmation'
                             then o.deposit_paid_at end,
  deposit_verification_method = case when o.payment_status in ('demo_paid', 'paid') and o.status <> 'pending_confirmation'
                                     then 'legacy_demo' end,
  payment_status = case when o.payment_status = 'demo_paid' and o.status = 'pending_confirmation'
                        then 'unpaid' else o.payment_status end,
  platform_fee_status = case
    when o.fee_recorded_at is not null and o.payment_mode = 'demo' then 'verified_demo'
    when o.fee_recorded_at is not null and o.payment_mode = 'live' then 'verified'
    else 'pending' end,
  platform_fee_verified_at = o.fee_recorded_at,
  platform_fee_verification_method = case when o.fee_recorded_at is not null then 'legacy_completion' end
where o.platform_fee_amount is null;

update public.orders set
  contact_unlocked_at = now(),
  contact_unlock_trigger = 'migration_0004'
where contact_unlocked_at is null
  and status <> 'cancelled'
  and ((payment_mode = 'demo' and deposit_status = 'verified_demo' and platform_fee_status = 'verified_demo')
    or (payment_mode = 'live' and deposit_status = 'verified'      and platform_fee_status = 'verified'));

-- ---------------------------------------------------------------------
-- 4. Bằng chứng cọc (shop tải lên). Không ai sửa / xoá được từ trình duyệt.
-- ---------------------------------------------------------------------
create table if not exists public.deposit_evidence (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  uploaded_by   uuid references public.profiles (id) on delete set null,
  uploader_role text not null check (uploader_role in ('shop')),
  storage_path  text not null unique check (char_length(storage_path) <= 300),
  evidence_type text not null default 'deposit_screenshot' check (evidence_type in ('deposit_screenshot')),
  is_demo       boolean not null default true,
  note          text check (char_length(note) <= 500),
  status        text not null default 'submitted' check (status in ('submitted', 'accepted', 'rejected')),
  reviewed_by   uuid references public.profiles (id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists deposit_evidence_order_idx on public.deposit_evidence (order_id, created_at desc);

-- Ai được xem dữ liệu của một đơn (khách, shop của đơn, admin). Dùng cho bảng & ảnh.
create or replace function public.can_access_order(p_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and (public.is_admin() or exists (
           select 1 from public.orders o
           where o.id = p_id::uuid and (o.customer_id = auth.uid() or o.shop_id = auth.uid())));
$$;
revoke execute on function public.can_access_order(text) from public, anon;
grant  execute on function public.can_access_order(text) to authenticated;

alter table public.deposit_evidence enable row level security;
drop policy if exists "deposit_evidence_select" on public.deposit_evidence;
create policy "deposit_evidence_select" on public.deposit_evidence for select to authenticated
  using (public.can_access_order(order_id::text));
revoke all on public.deposit_evidence from anon;
revoke insert, update, delete on public.deposit_evidence from authenticated;

-- Ảnh bằng chứng cọc: bucket RIÊNG TƯ, đường dẫn <order_id>/<shop_id>/<file>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('deposit-evidence', 'deposit-evidence', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

drop policy if exists "deposit_evidence_read"   on storage.objects;
drop policy if exists "deposit_evidence_upload" on storage.objects;
create policy "deposit_evidence_read" on storage.objects for select to authenticated
  using (bucket_id = 'deposit-evidence' and public.can_access_order((storage.foldername(name))[1]));
-- Chỉ shop của đơn tải lên, vào đúng thư mục của mình. Không có quyền update/delete → không ai xoá được.
create policy "deposit_evidence_upload" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'deposit-evidence'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.can_access_order((storage.foldername(name))[1])
    and exists (select 1 from public.orders o
                where o.id::text = (storage.foldername(name))[1] and o.shop_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- 5. Chặn liên hệ ngoài sàn: thêm link mạng xã hội / chat
--    (chỉ chặn lưu nội dung, KHÔNG khoá hay phạt tài khoản)
-- ---------------------------------------------------------------------
create or replace function public.contains_contact(t text)
returns boolean language sql immutable as $$
  select coalesce(t, '') ~* '(^|[^0-9])(\+?84|0)[ .-]?[35789]([ .-]?[0-9]){8}([^0-9]|$)'
      or coalesce(t, '') ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'
      or coalesce(t, '') ~* '(zalo\.me|facebook\.com|fb\.com|fb\.me|m\.me/|messenger\.com|instagram\.com|t\.me/|telegram\.me|tiktok\.com/@|wa\.me|viber\.com)';
$$;

create or replace function public.guard_no_contact()
returns trigger language plpgsql as $$
begin
  if tg_table_name = 'requests' then
    if public.contains_contact(new.title) or public.contains_contact(new.description)
       or public.contains_contact(new.size_note) or public.contains_contact(new.card_message)
       or public.contains_contact(new.occasion) then
      raise exception 'Vui lòng không ghi số điện thoại, email hay link Zalo/Facebook trong yêu cầu. Thông tin liên hệ được mở khi đơn đủ điều kiện.';
    end if;
  elsif tg_table_name = 'bids' then
    if public.contains_contact(new.message) or public.contains_contact(new.delivery_note)
       or public.contains_contact(new.flowers_used) or public.contains_contact(new.substitutions)
       or public.contains_contact(new.conditions) then
      raise exception 'Vui lòng không ghi số điện thoại, email hay link Zalo/Facebook trong báo giá. Thông tin liên hệ được mở khi đơn đủ điều kiện.';
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 6. Tạo đơn: lưu luôn phí nền tảng áp dụng cho đơn (đổi cấu hình sau không ảnh hưởng)
-- ---------------------------------------------------------------------
create or replace function public.create_order_for_bid(p_bid_id uuid, p_actor uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  b   public.bids;
  r   public.requests;
  s   public.app_settings;
  oid uuid;
  v_mode text;
begin
  select * into b from public.bids where id = p_bid_id;
  select * into r from public.requests where id = b.request_id;
  select * into s from public.app_settings;
  v_mode := case when s.payment_demo then 'demo' else 'live' end;

  insert into public.orders (request_id, bid_id, customer_id, shop_id, quote, total,
                             deposit_percent, deposit_amount, payment_mode,
                             platform_fee_amount, platform_fee_mode)
  values (r.id, b.id, r.customer_id, b.shop_id,
          to_jsonb(b) - 'status' || jsonb_build_object('accepted_at', now(), 'request_title', r.title),
          b.price, s.deposit_percent, round(b.price * s.deposit_percent / 100.0)::int, v_mode,
          s.service_fee, v_mode)
  on conflict (request_id) do nothing
  returning id into oid;

  if oid is not null then
    insert into public.order_events (order_id, kind, to_status, actor_id, actor_role, note)
    values (oid, 'status', 'pending_confirmation', p_actor,
            case when p_actor is null then 'system' else 'customer' end,
            'Khách chấp nhận báo giá ' || b.price || ' ₫');
  end if;
  return oid;
end $$;
revoke execute on function public.create_order_for_bid(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. Quy tắc mở liên hệ — MỘT chỗ duy nhất, chạy phía database
-- ---------------------------------------------------------------------
-- Điều kiện hợp lệ theo đúng chế độ của đơn: đơn demo cần '*_demo', đơn thật cần 'verified'
create or replace function public.condition_valid(p_mode text, p_status text)
returns boolean language sql immutable as $$
  select case p_mode when 'demo' then p_status = 'verified_demo'
                     when 'live' then p_status = 'verified'
                     else false end;
$$;

-- Các trạng thái đơn còn xử lý điều kiện được (đơn cũ đang chạy cũng được bổ sung phí)
create or replace function public.order_open_for_conditions(o public.orders)
returns boolean language sql immutable as $$
  select o.contact_unlocked_at is null
     and o.status in ('pending_confirmation', 'confirmed', 'preparing', 'delivering', 'delivered');
$$;

create or replace function public.try_unlock_contact(p_order_id uuid, p_actor uuid, p_role text, p_via text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then return false; end if;
  if o.contact_unlocked_at is not null then return true; end if;
  if o.status in ('cancelled', 'disputed', 'completed') then return false; end if;
  if not (public.condition_valid(o.payment_mode, o.deposit_status)
          and public.condition_valid(coalesce(o.platform_fee_mode, o.payment_mode), o.platform_fee_status)) then
    return false;
  end if;

  update public.orders
     set contact_unlocked_at = now(), contact_unlocked_by = p_actor,
         contact_unlock_trigger = p_via, updated_at = now()
   where id = o.id;

  insert into public.order_events (order_id, kind, actor_id, actor_role, note)
  values (o.id, 'unlock', p_actor, coalesce(p_role, 'system'),
          'Mở thông tin liên hệ: cọc ' || o.deposit_status || ' + phí nền tảng ' || o.platform_fee_status ||
          case when o.payment_mode = 'demo' then ' (MÔ PHỎNG — không có tiền thật)' else '' end);
  insert into public.audit_log (actor_id, action, target, details)
  values (p_actor, 'contact_unlock', o.id::text,
          jsonb_build_object('deposit_status', o.deposit_status, 'platform_fee_status', o.platform_fee_status,
                             'payment_mode', o.payment_mode, 'via', p_via));
  return true;
end $$;
revoke execute on function public.try_unlock_contact(uuid, uuid, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 8. Điều kiện A — Cọc
-- ---------------------------------------------------------------------
-- Khách báo "đã chuyển cọc" (MÔ PHỎNG). Chỉ là thông báo cho shop — KHÔNG làm điều kiện hợp lệ.
create or replace function public.demo_pay_deposit(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null or o.customer_id is distinct from auth.uid() then
    raise exception 'Chỉ khách hàng của đơn này mới mô phỏng chuyển cọc được.';
  end if;
  if not (select payment_demo from public.app_settings) or o.payment_mode <> 'demo' then
    raise exception 'Chế độ thanh toán demo đang tắt — không mô phỏng được.';
  end if;
  if not public.order_open_for_conditions(o) or o.deposit_status not in ('pending', 'rejected', 'pending_verification') then
    raise exception 'Đơn này không ở bước đặt cọc.';
  end if;
  if o.deposit_customer_marked_at is not null then
    raise exception 'Bạn đã báo chuyển cọc (mô phỏng) rồi. Đang chờ shop gửi bằng chứng.';
  end if;

  update public.orders set deposit_customer_marked_at = now(), updated_at = now() where id = o.id;
  insert into public.order_events (order_id, kind, actor_id, actor_role, note)
  values (o.id, 'payment', auth.uid(), 'customer',
          'Khách báo đã chuyển cọc ' || o.deposit_amount || ' ₫ (MÔ PHỎNG — không có giao dịch ngân hàng thật). Chờ shop gửi bằng chứng.');
end $$;

-- Shop gửi ảnh bằng chứng cọc (ảnh đã tải lên bucket deposit-evidence trước đó)
create or replace function public.submit_deposit_evidence(p_order_id uuid, p_path text, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  o    public.orders;
  v_id uuid;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null or o.shop_id is distinct from auth.uid() then
    raise exception 'Chỉ shop của đơn này mới gửi bằng chứng cọc được.';
  end if;
  if not public.order_open_for_conditions(o) then
    raise exception 'Đơn này không còn ở bước xác minh cọc.';
  end if;
  if o.deposit_status not in ('pending', 'pending_verification', 'rejected') then
    raise exception 'Cọc đang ở trạng thái "%" nên chưa gửi thêm bằng chứng được.', o.deposit_status;
  end if;
  if p_path is null or p_path not like o.id::text || '/' || auth.uid()::text || '/%' then
    raise exception 'Đường dẫn ảnh bằng chứng không hợp lệ.';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'deposit-evidence' and name = p_path) then
    raise exception 'Chưa tìm thấy ảnh đã tải lên. Vui lòng tải lại.';
  end if;
  if (select count(*) from public.deposit_evidence where order_id = o.id) >= 10 then
    raise exception 'Đã đạt tối đa 10 ảnh bằng chứng cho đơn này. Hãy liên hệ quản trị viên.';
  end if;
  if public.contains_contact(v_note) then
    raise exception 'Vui lòng không ghi số điện thoại / email / link liên hệ trong ghi chú.';
  end if;

  insert into public.deposit_evidence (order_id, uploaded_by, uploader_role, storage_path, is_demo, note)
  values (o.id, auth.uid(), 'shop', p_path, o.payment_mode = 'demo', v_note)
  returning id into v_id;

  update public.orders
     set deposit_status = 'pending_verification', deposit_evidence_at = now(),
         deposit_status_note = null, updated_at = now()
   where id = o.id;
  insert into public.order_events (order_id, kind, actor_id, actor_role, note)
  values (o.id, 'evidence', auth.uid(), 'shop',
          'Shop gửi bằng chứng cọc' || case when o.payment_mode = 'demo' then ' (DEMO)' else '' end ||
          '. Ảnh chụp màn hình không phải bằng chứng tiền đã về tài khoản.');
  return v_id;
end $$;

-- Xác nhận cọc (MÔ PHỎNG): shop của đơn hoặc admin, sau khi đã có bằng chứng
create or replace function public.demo_verify_deposit(p_order_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  o      public.orders;
  v_role text;
begin
  select * into o from public.orders where id = p_order_id for update;
  v_role := case when o.id is null then null
                 when auth.uid() = o.shop_id then 'shop'
                 when public.is_admin() then 'admin' end;
  if v_role is null then raise exception 'Chỉ shop của đơn hoặc quản trị viên mới xác nhận cọc được.'; end if;
  if not (select payment_demo from public.app_settings) or o.payment_mode <> 'demo' then
    raise exception 'Chế độ demo đang tắt — không xác nhận cọc mô phỏng được.';
  end if;
  if not public.order_open_for_conditions(o) then raise exception 'Đơn này không còn ở bước xác minh cọc.'; end if;
  if o.deposit_status <> 'pending_verification'
     or not exists (select 1 from public.deposit_evidence e where e.order_id = o.id and e.status = 'submitted') then
    raise exception 'Cần có ảnh bằng chứng cọc đang chờ xác minh trước khi xác nhận.';
  end if;

  update public.orders set
    deposit_status = 'verified_demo',
    deposit_verified_at = now(),
    deposit_verified_by = auth.uid(),
    deposit_verification_method = case v_role when 'admin' then 'demo_admin' else 'demo_shop' end,
    deposit_status_note = null,
    payment_status = 'demo_paid',
    deposit_paid_at = coalesce(deposit_paid_at, now()),
    updated_at = now()
  where id = o.id;
  update public.deposit_evidence set status = 'accepted', reviewed_by = auth.uid(), reviewed_at = now()
   where order_id = o.id and status = 'submitted';

  insert into public.order_events (order_id, kind, actor_id, actor_role, note)
  values (o.id, 'payment', auth.uid(), v_role,
          'Xác nhận cọc ' || o.deposit_amount || ' ₫ ở chế độ MÔ PHỎNG — không có tiền thật được ghi nhận.');
  insert into public.audit_log (actor_id, action, target, details)
  values (auth.uid(), 'demo_verify_deposit', o.id::text, jsonb_build_object('role', v_role, 'amount', o.deposit_amount));

  return public.try_unlock_contact(o.id, auth.uid(), v_role, 'demo_verify_deposit');
end $$;

-- ---------------------------------------------------------------------
-- 9. Điều kiện B — Phí nền tảng (shop trả)
-- ---------------------------------------------------------------------
create or replace function public.demo_pay_platform_fee(p_order_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null or o.shop_id is distinct from auth.uid() then
    raise exception 'Chỉ shop của đơn này mới thanh toán phí nền tảng.';
  end if;
  if not (select payment_demo from public.app_settings) or coalesce(o.platform_fee_mode, o.payment_mode) <> 'demo' then
    raise exception 'Chế độ demo đang tắt — không mô phỏng phí nền tảng được.';
  end if;
  if not public.order_open_for_conditions(o) then raise exception 'Đơn này không còn ở bước thanh toán phí nền tảng.'; end if;
  if o.platform_fee_status not in ('pending', 'rejected') then
    raise exception 'Phí nền tảng đang ở trạng thái "%".', o.platform_fee_status;
  end if;

  update public.orders set
    platform_fee_status = 'verified_demo',
    platform_fee_verified_at = now(),
    platform_fee_verified_by = auth.uid(),
    platform_fee_verification_method = 'demo_simulation',
    platform_fee_note = null,
    updated_at = now()
  where id = o.id;

  insert into public.order_events (order_id, kind, actor_id, actor_role, note)
  values (o.id, 'platform_fee', auth.uid(), 'shop',
          'MÔ PHỎNG thanh toán phí nền tảng ' || coalesce(o.platform_fee_amount, 0) || ' ₫ — không phải doanh thu thật, không có hoá đơn.');
  insert into public.audit_log (actor_id, action, target, details)
  values (auth.uid(), 'demo_pay_platform_fee', o.id::text, jsonb_build_object('amount', o.platform_fee_amount));

  return public.try_unlock_contact(o.id, auth.uid(), 'shop', 'demo_pay_platform_fee');
end $$;

-- ---------------------------------------------------------------------
-- 10. Tranh chấp một điều kiện (khi đơn đang chờ xác nhận) — không phạt / khoá ai tự động
-- ---------------------------------------------------------------------
create or replace function public.dispute_condition(p_order_id uuid, p_condition text, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  o      public.orders;
  v_role text;
  v_id   uuid;
begin
  select * into o from public.orders where id = p_order_id for update;
  v_role := case when o.id is null then null
                 when auth.uid() = o.customer_id then 'customer'
                 when auth.uid() = o.shop_id then 'shop' end;
  if v_role is null then raise exception 'Chỉ khách hoặc shop của đơn này mới báo tranh chấp được.'; end if;
  if p_condition not in ('deposit', 'platform_fee') then raise exception 'Điều kiện không hợp lệ.'; end if;
  if o.status <> 'pending_confirmation' or o.contact_unlocked_at is not null then
    raise exception 'Chỉ báo tranh chấp điều kiện khi đơn đang chờ và chưa mở liên hệ. Đơn đang chạy hãy dùng mục khiếu nại.';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'Vui lòng mô tả vấn đề (ít nhất 5 ký tự).'; end if;
  if public.contains_contact(p_reason) then
    raise exception 'Vui lòng không ghi số điện thoại / email / link liên hệ trong nội dung.';
  end if;

  insert into public.disputes (order_id, opened_by, opener_role, reason, condition)
  values (o.id, auth.uid(), v_role, trim(p_reason), p_condition) returning id into v_id;

  update public.orders set
    status = 'disputed', previous_status = o.status, updated_at = now(),
    deposit_status = case when p_condition = 'deposit' then 'disputed' else deposit_status end,
    deposit_status_note = case when p_condition = 'deposit' then trim(p_reason) else deposit_status_note end,
    platform_fee_status = case when p_condition = 'platform_fee' then 'disputed' else platform_fee_status end,
    platform_fee_note = case when p_condition = 'platform_fee' then trim(p_reason) else platform_fee_note end
  where id = o.id;
  insert into public.order_events (order_id, kind, from_status, to_status, actor_id, actor_role, note)
  values (o.id, 'dispute', o.status, 'disputed', auth.uid(), v_role,
          'Tranh chấp ' || case p_condition when 'deposit' then 'tiền cọc' else 'phí nền tảng' end || ': ' || trim(p_reason));
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- 11. Admin xem xét thủ công một điều kiện (có lý do, có nhật ký)
--     p_status: 'verified_demo' (chỉ đơn demo) | 'rejected' | 'pending' (mở lại)
-- ---------------------------------------------------------------------
create or replace function public.admin_set_condition(
  p_order_id uuid, p_condition text, p_status text, p_note text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  o      public.orders;
  v_note text := trim(coalesce(p_note, ''));
  v_old  text;
  v_new  text := p_status;
begin
  perform public.require_admin();
  if p_condition not in ('deposit', 'platform_fee') then raise exception 'Điều kiện không hợp lệ.'; end if;
  if p_status not in ('verified_demo', 'rejected', 'pending') then raise exception 'Trạng thái không hợp lệ.'; end if;
  if char_length(v_note) < 5 then raise exception 'Vui lòng ghi lý do quyết định (ít nhất 5 ký tự).'; end if;

  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then raise exception 'Không tìm thấy đơn hàng.'; end if;
  if o.contact_unlocked_at is not null then
    raise exception 'Đơn đã mở liên hệ — không đổi điều kiện được nữa. Hãy xử lý qua khiếu nại.';
  end if;
  if o.status in ('cancelled', 'completed') then raise exception 'Đơn đã đóng.'; end if;
  if o.status = 'disputed' then
    raise exception 'Đơn đang có khiếu nại mở — hãy xử lý khiếu nại trước.';
  end if;
  if p_status = 'verified_demo' and (not (select payment_demo from public.app_settings) or o.payment_mode <> 'demo') then
    raise exception 'Chỉ xác nhận mô phỏng được khi đơn ở chế độ demo và demo đang bật.';
  end if;

  if p_condition = 'deposit' then
    v_old := o.deposit_status;
    if p_status = 'verified_demo' and not exists (select 1 from public.deposit_evidence e where e.order_id = o.id) then
      raise exception 'Chưa có ảnh bằng chứng cọc nào để xác nhận.';
    end if;
    if p_status = 'pending' and exists (select 1 from public.deposit_evidence e where e.order_id = o.id and e.status = 'submitted') then
      v_new := 'pending_verification';
    end if;
    update public.orders set
      deposit_status = v_new,
      deposit_status_note = v_note,
      deposit_verified_at = case when v_new = 'verified_demo' then now() else null end,
      deposit_verified_by = case when v_new = 'verified_demo' then auth.uid() else null end,
      deposit_verification_method = case when v_new = 'verified_demo' then 'demo_admin' else null end,
      payment_status = case when v_new = 'verified_demo' then 'demo_paid'
                            when payment_status = 'demo_paid' then 'unpaid' else payment_status end,
      updated_at = now()
    where id = o.id;
    update public.deposit_evidence
       set status = case when v_new = 'verified_demo' then 'accepted' else 'rejected' end,
           reviewed_by = auth.uid(), reviewed_at = now()
     where order_id = o.id and status = 'submitted' and v_new in ('verified_demo', 'rejected');
  else
    v_old := o.platform_fee_status;
    update public.orders set
      platform_fee_status = v_new,
      platform_fee_note = v_note,
      platform_fee_verified_at = case when v_new = 'verified_demo' then now() else null end,
      platform_fee_verified_by = case when v_new = 'verified_demo' then auth.uid() else null end,
      platform_fee_verification_method = case when v_new = 'verified_demo' then 'demo_admin' else null end,
      updated_at = now()
    where id = o.id;
  end if;

  insert into public.order_events (order_id, kind, actor_id, actor_role, note)
  values (o.id, case p_condition when 'deposit' then 'payment' else 'platform_fee' end, auth.uid(), 'admin',
          'Quản trị viên đổi ' || case p_condition when 'deposit' then 'cọc' else 'phí nền tảng' end ||
          ': ' || v_old || ' → ' || v_new || ' (' || v_note || ')' ||
          case when v_new = 'verified_demo' then ' — MÔ PHỎNG, không có tiền thật' else '' end);
  insert into public.audit_log (actor_id, action, target, details)
  values (auth.uid(), 'set_condition', o.id::text,
          jsonb_build_object('condition', p_condition, 'from', v_old, 'to', v_new, 'note', v_note));

  return public.try_unlock_contact(o.id, auth.uid(), 'admin', 'admin_set_condition');
end $$;

-- ---------------------------------------------------------------------
-- 12. Liên hệ bên kia — CHỈ trả về khi đơn đã mở liên hệ, và chỉ cho khách / shop của đơn đó
-- ---------------------------------------------------------------------
create or replace function public.get_counterpart_contact(p_request_id uuid)
returns table (role text, name text, phone text, address text, district text, city text)
language plpgsql stable security definer set search_path = public as $$
declare
  o public.orders;
  r public.requests;
begin
  select * into o from public.orders where request_id = p_request_id;
  if o.id is null or o.contact_unlocked_at is null or auth.uid() is null then
    return;
  end if;
  select * into r from public.requests where id = p_request_id;

  if auth.uid() = o.customer_id then
    return query select 'shop'::text, s.name, s.phone, s.address, s.district, s.city
                 from public.shops s where s.id = o.shop_id;
  elsif auth.uid() = o.shop_id then
    return query select 'customer'::text, p.display_name, p.phone,
                        (select rp.delivery_address from public.request_private rp where rp.request_id = p_request_id),
                        r.district, r.city
                 from public.profiles p where p.id = o.customer_id;
  end if;
end $$;

-- Phí mở thông tin cũ: ngừng cho gọi (bảng contact_unlocks giữ làm lịch sử)
revoke execute on function public.start_contact_unlock(uuid) from public, anon, authenticated;
revoke execute on function public.demo_confirm_unlock(uuid)  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 13. Chuyển trạng thái đơn: xác nhận đơn cần ĐÃ MỞ LIÊN HỆ (đủ 2 điều kiện).
--     Hoàn tất đơn KHÔNG ghi phí nữa (phí đã thu ở bước mở liên hệ).
-- ---------------------------------------------------------------------
create or replace function public.order_transition(p_order_id uuid, p_to text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  o      public.orders;
  v_role text;
  v_ok   boolean;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_money boolean;
begin
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then raise exception 'Không tìm thấy đơn hàng.'; end if;
  v_role := public.order_role(o);
  if v_role is null then raise exception 'Bạn không thuộc đơn hàng này.'; end if;

  v_ok := case
    when o.status = 'pending_confirmation' and p_to = 'confirmed'  then v_role in ('shop', 'admin')
    when o.status = 'pending_confirmation' and p_to = 'cancelled'  then true
    when o.status = 'confirmed'            and p_to = 'preparing'  then v_role in ('shop', 'admin')
    when o.status = 'confirmed'            and p_to = 'cancelled'  then true
    when o.status = 'preparing'            and p_to = 'delivering' then v_role in ('shop', 'admin')
    when o.status = 'delivering'           and p_to = 'delivered'  then v_role in ('shop', 'admin')
    when o.status = 'delivered'            and p_to = 'completed'  then v_role in ('customer', 'admin')
    else false
  end;
  if not v_ok then
    raise exception 'Không thể chuyển đơn từ "%" sang "%" với vai trò của bạn.', o.status, p_to;
  end if;

  if p_to = 'confirmed' and o.contact_unlocked_at is null then
    raise exception 'Chưa thể xác nhận đơn: cần đủ 2 điều kiện (cọc: %, phí nền tảng: %).',
      o.deposit_status, o.platform_fee_status;
  end if;

  v_money := o.deposit_status <> 'pending' or o.deposit_customer_marked_at is not null
             or o.platform_fee_status <> 'pending';
  if p_to = 'cancelled' and v_money and v_note is null then
    raise exception 'Vui lòng ghi lý do huỷ (đơn đã có bước cọc / phí).';
  end if;

  update public.orders set
    status          = p_to,
    previous_status = o.status,
    updated_at      = now(),
    -- Huỷ sau khi cọc: KHÔNG mặc định mất cọc — chờ admin xem xét
    deposit_note    = case when p_to = 'cancelled' and v_money
                           then 'Chờ quản trị viên xem xét tiền cọc / phí' ||
                                case when o.payment_mode = 'demo' then ' (mô phỏng)' else '' end
                           else deposit_note end
  where id = o.id;

  insert into public.order_events (order_id, kind, from_status, to_status, actor_id, actor_role, note)
  values (o.id, 'status', o.status, p_to, auth.uid(), v_role, v_note);
end $$;

-- ---------------------------------------------------------------------
-- 14. Xử lý khiếu nại: nếu khiếu nại gắn với một điều kiện thì đưa điều kiện đó về
--     chờ xem xét (admin quyết định tiếp bằng admin_set_condition). Không ghi phí khi hoàn tất.
-- ---------------------------------------------------------------------
create or replace function public.resolve_dispute(
  p_dispute_id uuid, p_outcome text, p_deposit_decision text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  d    public.disputes;
  o    public.orders;
  v_to text;
  v_has_evidence boolean;
begin
  if not public.is_admin() then raise exception 'Chỉ quản trị viên mới xử lý khiếu nại.'; end if;
  select * into d from public.disputes where id = p_dispute_id for update;
  if d.id is null or d.status <> 'open' then raise exception 'Khiếu nại không tồn tại hoặc đã xử lý.'; end if;
  if p_outcome not in ('completed', 'cancelled', 'resume') then raise exception 'Kết quả không hợp lệ.'; end if;
  if p_deposit_decision not in ('refund_customer', 'release_shop', 'split', 'none') then
    raise exception 'Quyết định tiền cọc không hợp lệ.';
  end if;
  if char_length(trim(coalesce(p_note, ''))) < 5 then raise exception 'Vui lòng ghi lý do quyết định.'; end if;

  select * into o from public.orders where id = d.order_id for update;
  v_to := case p_outcome when 'resume' then coalesce(o.previous_status, 'confirmed') else p_outcome end;
  if v_to = 'completed' and o.contact_unlocked_at is null then
    raise exception 'Đơn chưa mở liên hệ (chưa đủ 2 điều kiện) nên không đánh dấu hoàn tất được.';
  end if;
  v_has_evidence := exists (select 1 from public.deposit_evidence e where e.order_id = o.id and e.status = 'submitted');

  update public.disputes
     set status = 'resolved', outcome = p_outcome, deposit_decision = p_deposit_decision,
         decision_note = trim(p_note), resolved_by = auth.uid(), resolved_at = now()
   where id = d.id;

  update public.orders set
    status          = v_to,
    previous_status = 'disputed',
    updated_at      = now(),
    deposit_status  = case when deposit_status = 'disputed'
                           then case when v_has_evidence then 'pending_verification' else 'pending' end
                           else deposit_status end,
    platform_fee_status = case when platform_fee_status = 'disputed' then 'pending' else platform_fee_status end,
    payment_status  = case when p_deposit_decision = 'refund_customer' and payment_status = 'demo_paid'
                           then 'demo_refunded' else payment_status end,
    deposit_note    = case p_deposit_decision
                        when 'refund_customer' then 'Hoàn cọc cho khách'
                        when 'release_shop'    then 'Chuyển cọc cho shop'
                        when 'split'           then 'Chia cọc theo quyết định'
                        else deposit_note end
                      || case when payment_mode = 'demo' and p_deposit_decision <> 'none' then ' (MÔ PHỎNG — không có tiền thật)' else '' end
  where id = o.id;

  insert into public.order_events (order_id, kind, from_status, to_status, actor_id, actor_role, note)
  values (o.id, 'dispute', 'disputed', v_to, auth.uid(), 'admin', 'Xử lý khiếu nại: ' || trim(p_note));
  insert into public.audit_log (actor_id, action, target, details)
  values (auth.uid(), 'resolve_dispute', d.id::text,
          jsonb_build_object('order_id', o.id, 'outcome', p_outcome, 'deposit_decision', p_deposit_decision,
                             'condition', d.condition, 'note', trim(p_note)));
end $$;

-- ---------------------------------------------------------------------
-- 15. Trang quản trị
-- ---------------------------------------------------------------------
create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_hours integer := (select condition_review_hours from public.app_settings);
begin
  perform public.require_admin();
  return jsonb_build_object(
    'customers',       (select count(*) from public.profiles where role = 'customer'),
    'shops',           (select count(*) from public.shops),
    'requests_open',   (select count(*) from public.requests where status = 'open'),
    'requests_total',  (select count(*) from public.requests),
    'bids_total',      (select count(*) from public.bids),
    'orders_by_status',(select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                          from (select status, count(*) n from public.orders group by status) x),
    'disputes_open',   (select count(*) from public.disputes where status = 'open'),
    -- Chờ xử lý điều kiện
    'awaiting_deposit_verification', (select count(*) from public.orders
                         where deposit_status = 'pending_verification' and contact_unlocked_at is null),
    'awaiting_platform_fee', (select count(*) from public.orders
                         where platform_fee_status in ('pending', 'rejected') and contact_unlocked_at is null
                           and status not in ('cancelled', 'completed')),
    'conditions_overdue', (select count(*) from public.orders
                         where contact_unlocked_at is null and status = 'pending_confirmation'
                           and created_at < now() - make_interval(hours => v_hours)),
    'contacts_unlocked', (select count(*) from public.orders where contact_unlocked_at is not null),
    -- Số liệu DEMO (không phải tiền thật)
    'demo_deposits',   (select coalesce(sum(deposit_amount), 0) from public.orders
                         where payment_mode = 'demo' and deposit_status = 'verified_demo'),
    'demo_fees',       (select coalesce(sum(platform_fee_amount), 0) from public.orders
                         where platform_fee_mode = 'demo' and platform_fee_status = 'verified_demo'),
    'demo_unlocks',    (select count(*) from public.orders
                         where contact_unlocked_at is not null and payment_mode = 'demo'),
    -- Phí dự kiến: đơn còn chạy chưa thu phí (chưa phải doanh thu)
    'expected_fees',   (select coalesce(sum(platform_fee_amount), 0) from public.orders
                         where platform_fee_status in ('pending', 'rejected', 'disputed')
                           and status not in ('cancelled', 'completed')),
    -- Doanh thu THẬT: chỉ phí nền tảng 'verified' của đơn live + phí mở thông tin cũ qua cổng thanh toán
    'real_fees',       (select coalesce(sum(platform_fee_amount), 0) from public.orders
                         where platform_fee_mode = 'live' and platform_fee_status = 'verified'),
    'real_unlock_revenue', (select coalesce(sum(amount), 0) from public.contact_unlocks where paid_via = 'gateway')
  );
end $$;

drop function if exists public.admin_list_orders();
create function public.admin_list_orders()
returns table (id uuid, request_id uuid, request_title text, customer_name text, shop_name text,
               total integer, deposit_amount integer, payment_mode text, payment_status text,
               status text, service_fee integer, deposit_note text, open_dispute uuid,
               created_at timestamptz, updated_at timestamptz,
               deposit_status text, platform_fee_amount integer, platform_fee_status text,
               contact_unlocked_at timestamptz, evidence_count integer, needs_attention boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  v_hours integer := (select condition_review_hours from public.app_settings);
begin
  perform public.require_admin();
  return query
    select o.id, o.request_id, r.title, p.display_name, s.name, o.total, o.deposit_amount,
           o.payment_mode, o.payment_status, o.status, o.service_fee, o.deposit_note,
           (select d.id from public.disputes d where d.order_id = o.id and d.status = 'open'),
           o.created_at, o.updated_at,
           o.deposit_status, o.platform_fee_amount, o.platform_fee_status, o.contact_unlocked_at,
           (select count(*)::int from public.deposit_evidence e where e.order_id = o.id),
           (o.contact_unlocked_at is null and o.status = 'pending_confirmation'
            and coalesce(o.deposit_evidence_at, o.created_at) < now() - make_interval(hours => v_hours))
    from public.orders o
    join public.requests r on r.id = o.request_id
    left join public.profiles p on p.id = o.customer_id
    left join public.shops s on s.id = o.shop_id
    order by o.updated_at desc;
end $$;

-- Cấu hình: thêm thời gian xem xét (hàm cũ 7 tham số giữ nguyên để không vỡ giao diện cũ)
create or replace function public.admin_update_review_hours(p_hours integer)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_old integer;
begin
  perform public.require_admin();
  if p_hours not between 1 and 720 then raise exception 'Thời gian xem xét phải từ 1 đến 720 giờ.'; end if;
  select condition_review_hours into v_old from public.app_settings;
  update public.app_settings set condition_review_hours = p_hours where id;
  insert into public.audit_log (actor_id, action, target, details)
  values (auth.uid(), 'update_settings', 'app_settings',
          jsonb_build_object('condition_review_hours', jsonb_build_object('before', v_old, 'after', p_hours)));
end $$;

-- ---------------------------------------------------------------------
-- 16. Quyền gọi hàm
-- ---------------------------------------------------------------------
revoke execute on function public.condition_valid(text, text)                 from public, anon;
revoke execute on function public.order_open_for_conditions(public.orders)    from public, anon, authenticated;
revoke execute on function public.demo_pay_deposit(uuid)                      from public, anon;
revoke execute on function public.submit_deposit_evidence(uuid, text, text)   from public, anon;
revoke execute on function public.demo_verify_deposit(uuid)                   from public, anon;
revoke execute on function public.demo_pay_platform_fee(uuid)                 from public, anon;
revoke execute on function public.dispute_condition(uuid, text, text)         from public, anon;
revoke execute on function public.admin_set_condition(uuid, text, text, text) from public, anon;
revoke execute on function public.get_counterpart_contact(uuid)               from public, anon;
revoke execute on function public.order_transition(uuid, text, text)          from public, anon;
revoke execute on function public.resolve_dispute(uuid, text, text, text)     from public, anon;
revoke execute on function public.admin_overview()                            from public, anon;
revoke execute on function public.admin_list_orders()                         from public, anon;
revoke execute on function public.admin_update_review_hours(integer)          from public, anon;

grant execute on function public.condition_valid(text, text)                 to authenticated;
grant execute on function public.demo_pay_deposit(uuid)                      to authenticated;
grant execute on function public.submit_deposit_evidence(uuid, text, text)   to authenticated;
grant execute on function public.demo_verify_deposit(uuid)                   to authenticated;
grant execute on function public.demo_pay_platform_fee(uuid)                 to authenticated;
grant execute on function public.dispute_condition(uuid, text, text)         to authenticated;
grant execute on function public.admin_set_condition(uuid, text, text, text) to authenticated;
grant execute on function public.get_counterpart_contact(uuid)               to authenticated;
grant execute on function public.order_transition(uuid, text, text)          to authenticated;
grant execute on function public.resolve_dispute(uuid, text, text, text)     to authenticated;
grant execute on function public.admin_overview()                            to authenticated;
grant execute on function public.admin_list_orders()                         to authenticated;
grant execute on function public.admin_update_review_hours(integer)          to authenticated;
