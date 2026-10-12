-- =====================================================================
--  0002 — Giữ kín thông tin, mở khoá bằng thanh toán (QR), giới hạn xem đơn
--  Chạy SAU 0001_init.sql trong Supabase → SQL Editor.
--
--  Quy tắc:
--   • Khách và shop KHÔNG thấy thông tin của nhau (tên shop, SĐT, địa chỉ,
--     tên/SĐT khách). Shop hiện ẩn danh trong danh sách báo giá.
--   • Sau khi khách chấp nhận một báo giá, mỗi bên quét QR thanh toán
--     để mở thông tin liên hệ của bên kia (mỗi bên trả riêng).
--   • Xem Chợ hoa: chưa đăng nhập 3 đơn mới nhất; đăng nhập +10 (= 13);
--     muốn hơn nữa → profiles.extra_quota (gói trả phí, làm sau).
--   • Không được ghi SĐT / email vào tiêu đề, mô tả, lời nhắn báo giá.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Cấu hình (1 dòng duy nhất) — sửa trong Table Editor
-- ---------------------------------------------------------------------
create table if not exists public.app_settings (
  id                  boolean primary key default true check (id),
  guest_quota         integer not null default 3,      -- chưa đăng nhập
  member_quota        integer not null default 13,     -- đã đăng nhập (3 + 10)
  unlock_fee_customer integer not null default 10000,  -- VND khách trả để xem liên hệ shop
  unlock_fee_shop     integer not null default 20000,  -- VND shop trả để xem liên hệ khách
  payment_demo        boolean not null default true    -- true = hiện nút "giả lập đã thanh toán". TẮT khi chạy thật!
);
insert into public.app_settings (id) values (true) on conflict (id) do nothing;

alter table public.app_settings enable row level security;
drop policy if exists "app_settings_read" on public.app_settings;
create policy "app_settings_read" on public.app_settings for select to anon, authenticated using (true);
revoke insert, update, delete on public.app_settings from anon, authenticated;

-- Số đơn được xem thêm nhờ gói trả phí (người dùng không tự sửa được — chỉ display_name, phone được cấp quyền UPDATE)
alter table public.profiles add column if not exists extra_quota integer not null default 0 check (extra_quota >= 0);

-- ---------------------------------------------------------------------
-- 2. Che thông tin shop & khách
-- ---------------------------------------------------------------------
-- shops: chỉ lộ khu vực + điểm đánh giá. Tên, SĐT, địa chỉ, giới thiệu bị ẩn.
revoke select on public.shops from anon, authenticated;
grant  select (id, district, city, rating, created_at) on public.shops to anon, authenticated;

-- Chủ shop đọc đầy đủ shop của mình qua hàm này
create or replace function public.get_my_shop()
returns setof public.shops language sql stable security definer set search_path = public as $$
  select * from public.shops where id = auth.uid();
$$;
revoke execute on function public.get_my_shop() from public, anon;
grant  execute on function public.get_my_shop() to authenticated;

-- profiles: chỉ xem của chính mình (bỏ quyền "shop thắng thầu xem khách" cũ)
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select to authenticated using (id = auth.uid());

-- ---------------------------------------------------------------------
-- 3. Giới hạn số đơn được xem
-- ---------------------------------------------------------------------
create or replace function public.market_quota()
returns integer language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then s.guest_quota
    else s.member_quota + coalesce((select p.extra_quota from public.profiles p where p.id = auth.uid()), 0)
  end
  from public.app_settings s;
$$;

-- Được xem yêu cầu này không? (chủ yêu cầu / shop đã báo giá / nằm trong N đơn mở mới nhất)
create or replace function public.can_view_request(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
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

drop policy if exists "requests_select" on public.requests;
create policy "requests_select" on public.requests for select to anon, authenticated
  using ((auth.uid() is not null and customer_id = auth.uid()) or public.can_view_request(id));

drop policy if exists "bids_select" on public.bids;
create policy "bids_select" on public.bids for select to anon, authenticated
  using ((auth.uid() is not null and shop_id = auth.uid()) or public.can_view_request(request_id));

-- Tổng số đơn đang mở (để hiện "Bạn đang xem 3 / 27 đơn") + hạn mức của người xem
create or replace function public.market_stats()
returns table (open_total integer, quota integer)
language sql stable security definer set search_path = public as $$
  select (select count(*)::int from public.requests where status = 'open'), public.market_quota();
$$;

grant execute on function public.market_quota()          to anon, authenticated;
grant execute on function public.can_view_request(uuid)  to anon, authenticated;
grant execute on function public.market_stats()          to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Chặn để lại SĐT / email trong nội dung (tránh giao dịch ngoài sàn)
-- ---------------------------------------------------------------------
create or replace function public.contains_contact(t text)
returns boolean language sql immutable as $$
  select coalesce(t, '') ~* '(^|[^0-9])(\+?84|0)[ .-]?[35789]([ .-]?[0-9]){8}([^0-9]|$)'
      or coalesce(t, '') ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}';
$$;

create or replace function public.guard_no_contact()
returns trigger language plpgsql as $$
begin
  if tg_table_name = 'requests' then
    if public.contains_contact(new.title) or public.contains_contact(new.description) then
      raise exception 'Vui lòng không ghi số điện thoại / email trong yêu cầu. Thông tin liên hệ được mở sau khi thanh toán.';
    end if;
  elsif tg_table_name = 'bids' then
    if public.contains_contact(new.message) or public.contains_contact(new.delivery_note) then
      raise exception 'Vui lòng không ghi số điện thoại / email trong báo giá. Thông tin liên hệ được mở sau khi thanh toán.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists requests_no_contact on public.requests;
create trigger requests_no_contact before insert or update on public.requests
  for each row execute function public.guard_no_contact();
drop trigger if exists bids_no_contact on public.bids;
create trigger bids_no_contact before insert or update on public.bids
  for each row execute function public.guard_no_contact();

-- ---------------------------------------------------------------------
-- 5. Mở khoá thông tin bằng thanh toán
-- ---------------------------------------------------------------------
create table if not exists public.contact_unlocks (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.requests (id) on delete cascade,
  viewer_id   uuid not null references public.profiles (id) on delete cascade,
  viewer_role public.user_role not null,
  amount      integer not null check (amount >= 0),
  -- Mã nội dung chuyển khoản, in trong QR. Webhook ngân hàng dùng mã này để xác nhận.
  payment_ref text not null unique default ('BTH' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  status      text not null default 'pending' check (status in ('pending', 'paid')),
  created_at  timestamptz not null default now(),
  paid_at     timestamptz,
  unique (request_id, viewer_id)
);

alter table public.contact_unlocks enable row level security;
drop policy if exists "unlocks_select_own" on public.contact_unlocks;
create policy "unlocks_select_own" on public.contact_unlocks for select to authenticated using (viewer_id = auth.uid());
revoke insert, update, delete on public.contact_unlocks from anon, authenticated;

-- Bắt đầu mở khoá: chỉ khi yêu cầu đã chốt, và người gọi là khách chủ yêu cầu hoặc shop thắng
create or replace function public.start_contact_unlock(p_request_id uuid)
returns public.contact_unlocks language plpgsql security definer set search_path = public as $$
declare
  v_req   public.requests;
  v_shop  uuid;
  v_role  public.user_role;
  v_fee   integer;
  v_row   public.contact_unlocks;
begin
  if auth.uid() is null then
    raise exception 'Vui lòng đăng nhập để thanh toán.';
  end if;

  select * into v_req from public.requests where id = p_request_id;
  if v_req.id is null or v_req.status <> 'accepted' or v_req.accepted_bid_id is null then
    raise exception 'Yêu cầu chưa chốt báo giá nên chưa thể mở thông tin.';
  end if;
  select shop_id into v_shop from public.bids where id = v_req.accepted_bid_id;

  if auth.uid() = v_req.customer_id then
    v_role := 'customer';
    select unlock_fee_customer into v_fee from public.app_settings;
  elsif auth.uid() = v_shop then
    v_role := 'shop';
    select unlock_fee_shop into v_fee from public.app_settings;
  else
    raise exception 'Bạn không thuộc giao dịch này.';
  end if;

  insert into public.contact_unlocks (request_id, viewer_id, viewer_role, amount)
  values (p_request_id, auth.uid(), v_role, v_fee)
  on conflict (request_id, viewer_id) do nothing;

  select * into v_row from public.contact_unlocks where request_id = p_request_id and viewer_id = auth.uid();
  return v_row;
end $$;

-- Xác nhận thanh toán THẬT: chỉ gọi từ server (webhook) bằng service_role
create or replace function public.confirm_unlock_payment(p_payment_ref text, p_amount integer)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.contact_unlocks
     set status = 'paid', paid_at = now()
   where payment_ref = upper(p_payment_ref) and status = 'pending' and p_amount >= amount;
  return found;
end $$;

-- Giả lập thanh toán khi đang thử nghiệm (app_settings.payment_demo = true)
create or replace function public.demo_confirm_unlock(p_unlock_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (select payment_demo from public.app_settings) then
    raise exception 'Chế độ giả lập thanh toán đã tắt.';
  end if;
  update public.contact_unlocks set status = 'paid', paid_at = now()
   where id = p_unlock_id and viewer_id = auth.uid() and status = 'pending';
end $$;

-- Lấy thông tin bên kia — chỉ trả về khi người gọi đã thanh toán
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
    return query select 'customer'::text, p.display_name, p.phone, null::text, v_req.district, v_req.city
                 from public.profiles p where p.id = v_req.customer_id;
  end if;
end $$;

revoke execute on function public.start_contact_unlock(uuid)            from public, anon;
revoke execute on function public.demo_confirm_unlock(uuid)             from public, anon;
revoke execute on function public.get_counterpart_contact(uuid)         from public, anon;
revoke execute on function public.confirm_unlock_payment(text, integer) from public, anon, authenticated;
grant  execute on function public.start_contact_unlock(uuid)            to authenticated;
grant  execute on function public.demo_confirm_unlock(uuid)             to authenticated;
grant  execute on function public.get_counterpart_contact(uuid)         to authenticated;
grant  execute on function public.confirm_unlock_payment(text, integer) to service_role;

-- Realtime: vừa thanh toán xong là màn hình tự mở thông tin
do $$ begin
  alter publication supabase_realtime add table public.contact_unlocks;
exception when others then null; end $$;
