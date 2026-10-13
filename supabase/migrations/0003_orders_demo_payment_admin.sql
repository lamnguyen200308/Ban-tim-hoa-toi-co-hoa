-- =====================================================================
--  0003 — Đơn hàng, đặt cọc DEMO, khiếu nại, quản trị viên
--  Chạy SAU 0001_init.sql, seed.sql, 0002_privacy_unlock_quota.sql (và demo_data.sql nếu có)
--  trong Supabase → SQL Editor. Chạy lại nhiều lần không lỗi, KHÔNG xoá dữ liệu cũ.
--
--  ⚠️ THANH TOÁN CHỈ LÀ DEMO:
--   • Không có ngân hàng / cổng thanh toán nào được nối. Mọi khoản "đặt cọc", "phí dịch vụ",
--     "hoàn tiền" ở đây chỉ là số liệu MÔ PHỎNG, được đánh dấu payment_mode = 'demo'.
--   • Đơn tạo khi app_settings.payment_demo = true luôn là đơn demo, kể cả khi sau này tắt demo.
--   • Không ai (kể cả admin) đánh dấu được "đã nhận tiền thật" từ trình duyệt.
--
--  Quy trình đơn hàng (trạng thái đơn và trạng thái thanh toán lưu RIÊNG):
--   Khách chấp nhận báo giá → đơn "Chờ xác nhận" (lưu bản chụp báo giá)
--   → khách bấm "Mô phỏng thanh toán thành công" (payment_status = demo_paid)
--   → shop xác nhận → đang chuẩn bị → đang giao → đã giao → KHÁCH xác nhận hoàn tất.
--   Bất kỳ bên nào cũng mở khiếu nại được khi đơn đang chạy; chỉ admin xử lý khiếu nại.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Quản trị viên
--    Đặt mình làm admin (chạy 1 lần, thay email):
--    update public.profiles set is_admin = true
--     where id = (select id from auth.users where email = 'email-cua-ban@gmail.com');
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists is_admin boolean not null default false;
-- Người dùng KHÔNG tự bật được is_admin: 0001 chỉ cấp UPDATE (display_name, phone).

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- Admin xem được mọi yêu cầu & báo giá (không bị giới hạn số đơn)
create or replace function public.can_view_request(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.requests r
    where r.id = p_id
      and (
        (auth.uid() is not null and r.customer_id = auth.uid())
        or (auth.uid() is not null and exists (
              select 1 from public.bids b where b.request_id = r.id and b.shop_id = auth.uid()))
        or r.id in (
              select w.id from public.requests w
              where w.status = 'open'
              order by w.created_at desc, w.id
              limit public.market_quota())
      )
  );
$$;

-- Nhật ký thay đổi quan trọng (cấu hình, xử lý khiếu nại, can thiệp báo giá)
create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid references public.profiles (id) on delete set null,
  action     text not null,
  target     text,
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
drop policy if exists "audit_admin_read" on public.audit_log;
create policy "audit_admin_read" on public.audit_log for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.audit_log from anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Cấu hình: tỷ lệ đặt cọc, phí dịch vụ (payment_demo đã có từ 0002)
-- ---------------------------------------------------------------------
alter table public.app_settings
  add column if not exists deposit_percent integer not null default 30 check (deposit_percent between 0 and 100),
  add column if not exists service_fee     integer not null default 50000 check (service_fee >= 0);

-- ---------------------------------------------------------------------
-- 3. Yêu cầu: thêm dịp tặng, kích thước, giờ giao, lời nhắn thiệp
--    Địa chỉ giao hàng lưu RIÊNG (request_private) — chỉ khách chủ đơn & admin thấy;
--    shop thắng chỉ thấy sau khi đã thanh toán mở thông tin (get_counterpart_contact).
-- ---------------------------------------------------------------------
alter table public.requests
  add column if not exists occasion     text check (char_length(occasion) <= 80),
  add column if not exists size_note    text check (char_length(size_note) <= 200),
  add column if not exists needed_time  text check (char_length(needed_time) <= 60),
  add column if not exists card_message text check (char_length(card_message) <= 500);
grant update (occasion, size_note, needed_time, card_message) on public.requests to authenticated;

create table if not exists public.request_private (
  request_id       uuid primary key references public.requests (id) on delete cascade,
  delivery_address text check (char_length(delivery_address) <= 300),
  updated_at       timestamptz not null default now()
);
alter table public.request_private enable row level security;
drop policy if exists "rp_select" on public.request_private;
drop policy if exists "rp_insert" on public.request_private;
drop policy if exists "rp_update" on public.request_private;
create policy "rp_select" on public.request_private for select to authenticated using (
  public.is_admin()
  or exists (select 1 from public.requests r where r.id = request_private.request_id and r.customer_id = auth.uid())
);
create policy "rp_insert" on public.request_private for insert to authenticated with check (
  exists (select 1 from public.requests r where r.id = request_private.request_id and r.customer_id = auth.uid())
);
create policy "rp_update" on public.request_private for update to authenticated
  using (exists (select 1 from public.requests r where r.id = request_private.request_id and r.customer_id = auth.uid() and r.status = 'open'))
  with check (exists (select 1 from public.requests r where r.id = request_private.request_id and r.customer_id = auth.uid()));
revoke update on public.request_private from anon, authenticated;
grant  update (delivery_address, updated_at) on public.request_private to authenticated;

-- ---------------------------------------------------------------------
-- 4. Báo giá chi tiết
--    price vẫn là TỔNG GIÁ CUỐI CÙNG. Báo giá mới bắt buộc tổng = hoa + thiết kế + giao hàng.
--    Báo giá cũ (chưa có chi tiết) vẫn hợp lệ.
-- ---------------------------------------------------------------------
alter table public.bids
  add column if not exists flower_cost   integer check (flower_cost >= 0),
  add column if not exists design_fee    integer check (design_fee >= 0),
  add column if not exists delivery_fee  integer check (delivery_fee >= 0),
  add column if not exists flowers_used  text check (char_length(flowers_used) <= 500),
  add column if not exists substitutions text check (char_length(substitutions) <= 500),
  add column if not exists valid_until   date,
  add column if not exists conditions    text check (char_length(conditions) <= 1000),
  add column if not exists image_url     text check (char_length(image_url) <= 500);

do $$ begin
  alter table public.bids add constraint bids_price_breakdown check (
    flower_cost is null
    or price = flower_cost + coalesce(design_fee, 0) + coalesce(delivery_fee, 0)
  );
exception when duplicate_object then null; end $$;

grant update (flower_cost, design_fee, delivery_fee, flowers_used, substitutions, valid_until, conditions, image_url)
  on public.bids to authenticated;

-- Chặn SĐT / email trong cả các ô mới
create or replace function public.guard_no_contact()
returns trigger language plpgsql as $$
begin
  if tg_table_name = 'requests' then
    if public.contains_contact(new.title) or public.contains_contact(new.description)
       or public.contains_contact(new.size_note) or public.contains_contact(new.card_message)
       or public.contains_contact(new.occasion) then
      raise exception 'Vui lòng không ghi số điện thoại / email trong yêu cầu. Thông tin liên hệ được mở sau khi thanh toán.';
    end if;
  elsif tg_table_name = 'bids' then
    if public.contains_contact(new.message) or public.contains_contact(new.delivery_note)
       or public.contains_contact(new.flowers_used) or public.contains_contact(new.substitutions)
       or public.contains_contact(new.conditions) then
      raise exception 'Vui lòng không ghi số điện thoại / email trong báo giá. Thông tin liên hệ được mở sau khi thanh toán.';
    end if;
  end if;
  return new;
end $$;

-- Shop thắng thấy địa chỉ giao hàng (sau khi đã trả phí mở thông tin)
create or replace function public.get_counterpart_contact(p_request_id uuid)
returns table (role text, name text, phone text, address text, district text, city text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_req  public.requests;
  v_shop uuid;
begin
  if not exists (
    select 1 from public.contact_unlocks
    where request_id = p_request_id and viewer_id = auth.uid() and status = 'paid'
  ) then
    return;
  end if;

  select * into v_req from public.requests where id = p_request_id;
  select shop_id into v_shop from public.bids where id = v_req.accepted_bid_id;

  if auth.uid() = v_req.customer_id then
    return query select 'shop'::text, s.name, s.phone, s.address, s.district, s.city
                 from public.shops s where s.id = v_shop;
  elsif auth.uid() = v_shop then
    return query select 'customer'::text, p.display_name, p.phone,
                        (select rp.delivery_address from public.request_private rp where rp.request_id = p_request_id),
                        v_req.district, v_req.city
                 from public.profiles p where p.id = v_req.customer_id;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 5. Mở thông tin: đánh dấu thanh toán demo / thật
--    Chưa từng nối cổng thanh toán → mọi lượt "đã trả" trước đây đều là demo.
-- ---------------------------------------------------------------------
alter table public.contact_unlocks
  add column if not exists paid_via text check (paid_via in ('demo', 'gateway'));
update public.contact_unlocks set paid_via = 'demo' where status = 'paid' and paid_via is null;

create or replace function public.demo_confirm_unlock(p_unlock_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (select payment_demo from public.app_settings) then
    raise exception 'Chế độ giả lập thanh toán đã tắt.';
  end if;
  update public.contact_unlocks set status = 'paid', paid_at = now(), paid_via = 'demo'
   where id = p_unlock_id and viewer_id = auth.uid() and status = 'pending';
end $$;

create or replace function public.confirm_unlock_payment(p_payment_ref text, p_amount integer)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.contact_unlocks
     set status = 'paid', paid_at = now(), paid_via = 'gateway'
   where payment_ref = upper(p_payment_ref) and status = 'pending' and p_amount >= amount;
  return found;
end $$;
revoke execute on function public.confirm_unlock_payment(text, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. Đơn hàng
-- ---------------------------------------------------------------------
create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid not null unique references public.requests (id) on delete cascade,
  bid_id          uuid not null references public.bids (id) on delete cascade,
  customer_id     uuid not null references public.profiles (id) on delete cascade,
  shop_id         uuid not null references public.shops (id) on delete cascade,
  quote           jsonb not null,            -- bản chụp báo giá lúc khách chốt (chống tranh chấp)
  total           integer not null check (total > 0),
  deposit_percent integer not null check (deposit_percent between 0 and 100),
  deposit_amount  integer not null check (deposit_amount >= 0),
  payment_mode    text not null default 'demo' check (payment_mode in ('demo', 'live')),
  payment_status  text not null default 'unpaid'
                  check (payment_status in ('unpaid', 'demo_paid', 'demo_refunded', 'paid')),
  deposit_paid_at timestamptz,
  deposit_note    text,
  status          text not null default 'pending_confirmation'
                  check (status in ('pending_confirmation', 'confirmed', 'preparing', 'delivering',
                                    'delivered', 'completed', 'cancelled', 'disputed')),
  previous_status text,
  service_fee     integer not null default 0 check (service_fee >= 0),   -- chỉ ghi khi đơn hoàn tất
  fee_recorded_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists orders_customer_idx on public.orders (customer_id, created_at desc);
create index if not exists orders_shop_idx     on public.orders (shop_id, created_at desc);
create index if not exists orders_status_idx   on public.orders (status);

create table if not exists public.order_events (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders (id) on delete cascade,
  kind        text not null check (kind in ('status', 'payment', 'dispute')),
  from_status text,
  to_status   text,
  actor_id    uuid references public.profiles (id) on delete set null,
  actor_role  text not null check (actor_role in ('customer', 'shop', 'admin', 'system')),
  note        text check (char_length(note) <= 2000),
  created_at  timestamptz not null default now()
);
create index if not exists order_events_order_idx on public.order_events (order_id, created_at);

alter table public.orders       enable row level security;
alter table public.order_events enable row level security;
drop policy if exists "orders_select" on public.orders;
create policy "orders_select" on public.orders for select to authenticated
  using (customer_id = auth.uid() or shop_id = auth.uid() or public.is_admin());
drop policy if exists "order_events_select" on public.order_events;
create policy "order_events_select" on public.order_events for select to authenticated using (
  public.is_admin()
  or exists (select 1 from public.orders o where o.id = order_events.order_id
             and (o.customer_id = auth.uid() or o.shop_id = auth.uid()))
);
-- Mọi thay đổi đơn hàng đi qua hàm bên dưới (kiểm tra quyền phía máy chủ)
revoke insert, update, delete on public.orders, public.order_events from anon, authenticated;

-- Tạo đơn từ báo giá đã chấp nhận (dùng nội bộ)
create or replace function public.create_order_for_bid(p_bid_id uuid, p_actor uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  b   public.bids;
  r   public.requests;
  s   public.app_settings;
  oid uuid;
begin
  select * into b from public.bids where id = p_bid_id;
  select * into r from public.requests where id = b.request_id;
  select * into s from public.app_settings;

  insert into public.orders (request_id, bid_id, customer_id, shop_id, quote, total,
                             deposit_percent, deposit_amount, payment_mode)
  values (r.id, b.id, r.customer_id, b.shop_id,
          to_jsonb(b) - 'status' || jsonb_build_object('accepted_at', now(), 'request_title', r.title),
          b.price, s.deposit_percent, round(b.price * s.deposit_percent / 100.0)::int,
          case when s.payment_demo then 'demo' else 'live' end)
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

-- Chấp nhận báo giá → tạo đơn hàng. Báo giá hết hạn thì không chấp nhận được.
create or replace function public.accept_bid(p_bid_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_request uuid;
  v_valid   date;
begin
  select b.request_id, b.valid_until into v_request, v_valid
  from public.bids b
  join public.requests r on r.id = b.request_id
  where b.id = p_bid_id
    and b.status = 'pending'
    and r.status = 'open'
    and r.customer_id = auth.uid()
  for update of r;

  if v_request is null then
    raise exception 'Không thể chấp nhận báo giá này (đã xử lý, yêu cầu đã đóng, hoặc bạn không phải chủ yêu cầu).';
  end if;
  if v_valid is not null and v_valid < current_date then
    raise exception 'Báo giá này đã hết hiệu lực. Hãy nhờ shop cập nhật lại báo giá.';
  end if;

  update public.bids set status = 'accepted' where id = p_bid_id;
  update public.bids set status = 'rejected'
   where request_id = v_request and id <> p_bid_id and status = 'pending';
  update public.requests set status = 'accepted', accepted_bid_id = p_bid_id where id = v_request;
  perform public.create_order_for_bid(p_bid_id, auth.uid());
end $$;

-- Đơn đã chốt trước khi có bảng orders (VD: đơn mẫu "Tulip vàng tặng mẹ") → tạo đơn bù
select public.create_order_for_bid(r.accepted_bid_id, null)
from public.requests r
where r.status = 'accepted' and r.accepted_bid_id is not null
  and not exists (select 1 from public.orders o where o.request_id = r.id);

-- Vai trò của người gọi trong đơn
create or replace function public.order_role(o public.orders)
returns text language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() = o.customer_id then 'customer'
    when auth.uid() = o.shop_id then 'shop'
    when public.is_admin() then 'admin'
  end;
$$;
revoke execute on function public.order_role(public.orders) from public, anon, authenticated;

-- Đặt cọc MÔ PHỎNG — không có tiền thật. Chỉ khách chủ đơn, chỉ khi chế độ demo đang bật.
-- Không đổi trạng thái đơn: shop vẫn phải bấm xác nhận.
create or replace function public.demo_pay_deposit(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null or o.customer_id is distinct from auth.uid() then
    raise exception 'Chỉ khách hàng của đơn này mới mô phỏng đặt cọc được.';
  end if;
  if not (select payment_demo from public.app_settings) or o.payment_mode <> 'demo' then
    raise exception 'Chế độ thanh toán demo đang tắt — không mô phỏng được.';
  end if;
  if o.status <> 'pending_confirmation' or o.payment_status <> 'unpaid' then
    raise exception 'Đơn này không ở bước đặt cọc.';
  end if;

  update public.orders
     set payment_status = 'demo_paid', deposit_paid_at = now(), updated_at = now()
   where id = o.id;
  insert into public.order_events (order_id, kind, actor_id, actor_role, note)
  values (o.id, 'payment', auth.uid(), 'customer',
          'MÔ PHỎNG đặt cọc ' || o.deposit_amount || ' ₫ — không có giao dịch ngân hàng thật');
end $$;

-- Chuyển trạng thái đơn theo đúng quy trình
create or replace function public.order_transition(p_order_id uuid, p_to text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  o      public.orders;
  v_role text;
  v_ok   boolean;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
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

  if p_to = 'confirmed' and o.payment_status not in ('demo_paid', 'paid') then
    raise exception 'Khách chưa đặt cọc nên chưa xác nhận đơn được.';
  end if;
  if p_to = 'cancelled' and o.payment_status <> 'unpaid' and v_note is null then
    raise exception 'Vui lòng ghi lý do huỷ (đơn đã đặt cọc).';
  end if;

  update public.orders set
    status          = p_to,
    previous_status = o.status,
    updated_at      = now(),
    -- Huỷ sau khi cọc: KHÔNG mặc định mất cọc — chờ admin xem xét
    deposit_note    = case when p_to = 'cancelled' and o.payment_status <> 'unpaid'
                           then 'Chờ quản trị viên xem xét tiền cọc' ||
                                case when o.payment_mode = 'demo' then ' (mô phỏng)' else '' end
                           else deposit_note end,
    -- Phí dịch vụ chỉ ghi nhận khi đơn hoàn tất
    service_fee     = case when p_to = 'completed' then (select service_fee from public.app_settings) else service_fee end,
    fee_recorded_at = case when p_to = 'completed' then now() else fee_recorded_at end
  where id = o.id;

  insert into public.order_events (order_id, kind, from_status, to_status, actor_id, actor_role, note)
  values (o.id, 'status', o.status, p_to, auth.uid(), v_role, v_note);
end $$;

-- ---------------------------------------------------------------------
-- 7. Khiếu nại
-- ---------------------------------------------------------------------
create table if not exists public.disputes (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders (id) on delete cascade,
  opened_by        uuid references public.profiles (id) on delete set null,
  opener_role      text not null check (opener_role in ('customer', 'shop')),
  reason           text not null check (char_length(reason) between 5 and 2000),
  status           text not null default 'open' check (status in ('open', 'resolved')),
  outcome          text check (outcome in ('completed', 'cancelled', 'resume')),
  deposit_decision text check (deposit_decision in ('refund_customer', 'release_shop', 'split', 'none')),
  decision_note    text check (char_length(decision_note) <= 2000),
  resolved_by      uuid references public.profiles (id) on delete set null,
  resolved_at      timestamptz,
  created_at       timestamptz not null default now()
);
create unique index if not exists disputes_one_open_per_order on public.disputes (order_id) where status = 'open';

create table if not exists public.dispute_messages (
  id             bigint generated always as identity primary key,
  dispute_id     uuid not null references public.disputes (id) on delete cascade,
  author_id      uuid references public.profiles (id) on delete set null,
  author_role    text not null check (author_role in ('customer', 'shop', 'admin')),
  body           text not null check (char_length(body) between 1 and 2000),
  evidence_paths text[] not null default '{}',
  created_at     timestamptz not null default now()
);
create index if not exists dispute_messages_idx on public.dispute_messages (dispute_id, created_at);

create or replace function public.can_access_dispute(p_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and (public.is_admin() or exists (
           select 1 from public.disputes d join public.orders o on o.id = d.order_id
           where d.id = p_id::uuid and (o.customer_id = auth.uid() or o.shop_id = auth.uid())));
$$;
grant execute on function public.can_access_dispute(text) to authenticated;

alter table public.disputes         enable row level security;
alter table public.dispute_messages enable row level security;
drop policy if exists "disputes_select" on public.disputes;
create policy "disputes_select" on public.disputes for select to authenticated
  using (public.can_access_dispute(id::text));
drop policy if exists "dispute_messages_select" on public.dispute_messages;
create policy "dispute_messages_select" on public.dispute_messages for select to authenticated
  using (public.can_access_dispute(dispute_id::text));
revoke insert, update, delete on public.disputes, public.dispute_messages from anon, authenticated;

-- Mở khiếu nại: khách hoặc shop của đơn, khi đơn đang chạy. Không phạt / khoá ai tự động.
create or replace function public.open_dispute(p_order_id uuid, p_reason text)
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
  if v_role is null then raise exception 'Chỉ khách hoặc shop của đơn này mới mở khiếu nại được.'; end if;
  if o.status not in ('confirmed', 'preparing', 'delivering', 'delivered') then
    raise exception 'Đơn ở trạng thái này không mở khiếu nại được.';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Vui lòng mô tả vấn đề (ít nhất 5 ký tự).';
  end if;

  insert into public.disputes (order_id, opened_by, opener_role, reason)
  values (o.id, auth.uid(), v_role, trim(p_reason)) returning id into v_id;
  update public.orders set status = 'disputed', previous_status = o.status, updated_at = now() where id = o.id;
  insert into public.order_events (order_id, kind, from_status, to_status, actor_id, actor_role, note)
  values (o.id, 'dispute', o.status, 'disputed', auth.uid(), v_role, trim(p_reason));
  return v_id;
end $$;

-- Gửi giải trình / bằng chứng (ảnh trong bucket dispute-evidence: <dispute_id>/<user_id>/<file>)
create or replace function public.add_dispute_message(p_dispute_id uuid, p_body text, p_evidence text[] default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare
  d      public.disputes;
  o      public.orders;
  v_role text;
  p      text;
begin
  select * into d from public.disputes where id = p_dispute_id;
  select * into o from public.orders where id = d.order_id;
  v_role := case when d.id is null then null
                 when auth.uid() = o.customer_id then 'customer'
                 when auth.uid() = o.shop_id then 'shop'
                 when public.is_admin() then 'admin' end;
  if v_role is null then raise exception 'Bạn không thuộc khiếu nại này.'; end if;
  if d.status <> 'open' then raise exception 'Khiếu nại đã được xử lý xong.'; end if;
  if coalesce(array_length(p_evidence, 1), 0) > 5 then raise exception 'Tối đa 5 ảnh mỗi lần gửi.'; end if;
  foreach p in array coalesce(p_evidence, '{}') loop
    if p not like p_dispute_id::text || '/' || auth.uid()::text || '/%' then
      raise exception 'Đường dẫn bằng chứng không hợp lệ.';
    end if;
  end loop;

  insert into public.dispute_messages (dispute_id, author_id, author_role, body, evidence_paths)
  values (d.id, auth.uid(), v_role, trim(p_body), coalesce(p_evidence, '{}'));
end $$;

-- Admin xử lý khiếu nại. Mọi khoản hoàn / giữ cọc ở chế độ demo chỉ là ghi chú mô phỏng.
create or replace function public.resolve_dispute(
  p_dispute_id uuid, p_outcome text, p_deposit_decision text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  d    public.disputes;
  o    public.orders;
  v_to text;
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

  update public.disputes
     set status = 'resolved', outcome = p_outcome, deposit_decision = p_deposit_decision,
         decision_note = trim(p_note), resolved_by = auth.uid(), resolved_at = now()
   where id = d.id;

  update public.orders set
    status          = v_to,
    previous_status = 'disputed',
    updated_at      = now(),
    payment_status  = case when p_deposit_decision = 'refund_customer' and payment_status = 'demo_paid'
                           then 'demo_refunded' else payment_status end,
    deposit_note    = case p_deposit_decision
                        when 'refund_customer' then 'Hoàn cọc cho khách'
                        when 'release_shop'    then 'Chuyển cọc cho shop'
                        when 'split'           then 'Chia cọc theo quyết định'
                        else deposit_note end
                      || case when payment_mode = 'demo' and p_deposit_decision <> 'none' then ' (MÔ PHỎNG — không có tiền thật)' else '' end,
    service_fee     = case when v_to = 'completed' then (select service_fee from public.app_settings) else service_fee end,
    fee_recorded_at = case when v_to = 'completed' then now() else fee_recorded_at end
  where id = o.id;

  insert into public.order_events (order_id, kind, from_status, to_status, actor_id, actor_role, note)
  values (o.id, 'dispute', 'disputed', v_to, auth.uid(), 'admin', 'Xử lý khiếu nại: ' || trim(p_note));
  insert into public.audit_log (actor_id, action, target, details)
  values (auth.uid(), 'resolve_dispute', d.id::text,
          jsonb_build_object('order_id', o.id, 'outcome', p_outcome, 'deposit_decision', p_deposit_decision, 'note', trim(p_note)));
end $$;

-- Ảnh bằng chứng: bucket RIÊNG TƯ, chỉ hai bên của đơn và admin xem được
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dispute-evidence', 'dispute-evidence', false, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;
drop policy if exists "evidence_read" on storage.objects;
drop policy if exists "evidence_upload" on storage.objects;
create policy "evidence_read" on storage.objects for select to authenticated
  using (bucket_id = 'dispute-evidence' and public.can_access_dispute((storage.foldername(name))[1]));
create policy "evidence_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'dispute-evidence'
              and (storage.foldername(name))[2] = auth.uid()::text
              and public.can_access_dispute((storage.foldername(name))[1]));

-- ---------------------------------------------------------------------
-- 8. Hàm cho trang quản trị (đều kiểm tra is_admin phía máy chủ)
-- ---------------------------------------------------------------------
create or replace function public.require_admin()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Chỉ quản trị viên mới dùng được chức năng này.'; end if;
end $$;

create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
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
    -- Số liệu DEMO (không phải tiền thật)
    'demo_deposits',   (select coalesce(sum(deposit_amount), 0) from public.orders
                         where payment_mode = 'demo' and payment_status = 'demo_paid'),
    'demo_fees',       (select coalesce(sum(service_fee), 0) from public.orders
                         where payment_mode = 'demo' and fee_recorded_at is not null),
    'demo_unlocks',    (select count(*) from public.contact_unlocks where paid_via = 'demo'),
    -- Phí dự kiến: đơn đang chạy, nếu hoàn tất (chưa phải doanh thu)
    'expected_fees',   (select count(*) from public.orders
                         where status in ('pending_confirmation','confirmed','preparing','delivering','delivered','disputed'))
                       * (select service_fee from public.app_settings),
    -- Doanh thu THẬT: chỉ từ đơn live hoàn tất và lượt mở thông tin qua cổng thanh toán
    'real_fees',       (select coalesce(sum(service_fee), 0) from public.orders
                         where payment_mode = 'live' and fee_recorded_at is not null),
    'real_unlock_revenue', (select coalesce(sum(amount), 0) from public.contact_unlocks where paid_via = 'gateway')
  );
end $$;

create or replace function public.admin_list_users()
returns table (id uuid, email text, role text, display_name text, phone text, is_admin boolean,
               extra_quota integer, created_at timestamptz, shop_name text, shop_district text)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return query
    select p.id, u.email::text, p.role::text, p.display_name, p.phone, p.is_admin, p.extra_quota, p.created_at,
           s.name, s.district
    from public.profiles p
    left join auth.users u on u.id = p.id
    left join public.shops s on s.id = p.id
    order by p.created_at desc;
end $$;

create or replace function public.admin_list_orders()
returns table (id uuid, request_id uuid, request_title text, customer_name text, shop_name text,
               total integer, deposit_amount integer, payment_mode text, payment_status text,
               status text, service_fee integer, deposit_note text, open_dispute uuid,
               created_at timestamptz, updated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return query
    select o.id, o.request_id, r.title, p.display_name, s.name, o.total, o.deposit_amount,
           o.payment_mode, o.payment_status, o.status, o.service_fee, o.deposit_note,
           (select d.id from public.disputes d where d.order_id = o.id and d.status = 'open'),
           o.created_at, o.updated_at
    from public.orders o
    join public.requests r on r.id = o.request_id
    left join public.profiles p on p.id = o.customer_id
    left join public.shops s on s.id = o.shop_id
    order by o.updated_at desc;
end $$;

-- Tên thật của khách & shop trong đơn (admin xem để xử lý khiếu nại)
create or replace function public.admin_order_parties(p_order_id uuid)
returns table (customer_name text, customer_phone text, customer_email text,
               shop_name text, shop_phone text, delivery_address text)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return query
    select p.display_name, p.phone, cu.email::text, s.name, s.phone, rp.delivery_address
    from public.orders o
    left join public.profiles p on p.id = o.customer_id
    left join auth.users cu on cu.id = o.customer_id
    left join public.shops s on s.id = o.shop_id
    left join public.request_private rp on rp.request_id = o.request_id
    where o.id = p_order_id;
end $$;

create or replace function public.admin_update_settings(
  p_deposit_percent integer, p_service_fee integer, p_payment_demo boolean,
  p_unlock_fee_customer integer, p_unlock_fee_shop integer, p_guest_quota integer, p_member_quota integer)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb;
begin
  perform public.require_admin();
  if p_deposit_percent not between 0 and 100 then raise exception 'Tỷ lệ cọc phải từ 0 đến 100%%.'; end if;
  if least(p_service_fee, p_unlock_fee_customer, p_unlock_fee_shop, p_guest_quota, p_member_quota) < 0 then
    raise exception 'Giá trị không được âm.';
  end if;
  select to_jsonb(s) into v_old from public.app_settings s;
  update public.app_settings set
    deposit_percent = p_deposit_percent, service_fee = p_service_fee, payment_demo = p_payment_demo,
    unlock_fee_customer = p_unlock_fee_customer, unlock_fee_shop = p_unlock_fee_shop,
    guest_quota = p_guest_quota, member_quota = p_member_quota
  where id;
  insert into public.audit_log (actor_id, action, target, details)
  values (auth.uid(), 'update_settings', 'app_settings',
          jsonb_build_object('before', v_old, 'after', (select to_jsonb(s) from public.app_settings s)));
end $$;

-- Admin gỡ báo giá vi phạm (VD: spam). Chỉ báo giá đang chờ; có ghi nhật ký.
create or replace function public.admin_withdraw_bid(p_bid_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  if char_length(trim(coalesce(p_note, ''))) < 5 then raise exception 'Vui lòng ghi lý do.'; end if;
  update public.bids set status = 'withdrawn' where id = p_bid_id and status = 'pending';
  if not found then raise exception 'Chỉ gỡ được báo giá đang chờ.'; end if;
  insert into public.audit_log (actor_id, action, target, details)
  values (auth.uid(), 'withdraw_bid', p_bid_id::text, jsonb_build_object('note', trim(p_note)));
end $$;

-- ---------------------------------------------------------------------
-- 9. Quyền truy cập
-- ---------------------------------------------------------------------
-- Người chưa đăng nhập không đọc được dữ liệu đơn hàng / khiếu nại / địa chỉ / nhật ký
revoke all on public.orders, public.order_events, public.disputes, public.dispute_messages,
              public.request_private, public.audit_log from anon;

revoke execute on function public.demo_pay_deposit(uuid)                     from public, anon;
revoke execute on function public.order_transition(uuid, text, text)         from public, anon;
revoke execute on function public.open_dispute(uuid, text)                   from public, anon;
revoke execute on function public.add_dispute_message(uuid, text, text[])    from public, anon;
revoke execute on function public.resolve_dispute(uuid, text, text, text)    from public, anon;
revoke execute on function public.require_admin()                            from public, anon;
revoke execute on function public.admin_overview()                           from public, anon;
revoke execute on function public.admin_list_users()                         from public, anon;
revoke execute on function public.admin_list_orders()                        from public, anon;
revoke execute on function public.admin_order_parties(uuid)                  from public, anon;
revoke execute on function public.admin_update_settings(integer, integer, boolean, integer, integer, integer, integer) from public, anon;
revoke execute on function public.admin_withdraw_bid(uuid, text)             from public, anon;
grant execute on function public.demo_pay_deposit(uuid)                      to authenticated;
grant execute on function public.order_transition(uuid, text, text)          to authenticated;
grant execute on function public.open_dispute(uuid, text)                    to authenticated;
grant execute on function public.add_dispute_message(uuid, text, text[])     to authenticated;
grant execute on function public.resolve_dispute(uuid, text, text, text)     to authenticated;
grant execute on function public.require_admin()                             to authenticated;
grant execute on function public.admin_overview()                            to authenticated;
grant execute on function public.admin_list_users()                          to authenticated;
grant execute on function public.admin_list_orders()                         to authenticated;
grant execute on function public.admin_order_parties(uuid)                   to authenticated;
grant execute on function public.admin_update_settings(integer, integer, boolean, integer, integer, integer, integer) to authenticated;
grant execute on function public.admin_withdraw_bid(uuid, text)              to authenticated;

-- Realtime: trạng thái đơn & khiếu nại cập nhật ngay trên màn hình
do $$ begin
  alter publication supabase_realtime add table public.orders;
exception when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.dispute_messages;
exception when others then null; end $$;
