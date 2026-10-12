-- =====================================================================
--  Bạn tìm hoa, tôi có hoa — schema khởi tạo
--  Chạy file này trong Supabase Dashboard → SQL Editor (hoặc `supabase db push`)
-- =====================================================================

create extension if not exists pgcrypto;

do $$ begin
  create type public.user_role as enum ('customer', 'shop');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 1. Người dùng & shop
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  role         public.user_role not null default 'customer',
  display_name text,
  phone        text,
  created_at   timestamptz not null default now()
);

create table if not exists public.shops (
  id          uuid primary key references public.profiles (id) on delete cascade,
  name        text not null,
  address     text,
  district    text,
  city        text default 'TP. Hồ Chí Minh',
  phone       text,
  description text,
  rating      numeric(2,1) not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Danh mục cho trình thiết kế 3D (admin quản lý qua Table Editor)
-- ---------------------------------------------------------------------
create table if not exists public.flowers (
  id           text primary key,
  name         text not null,
  kind         text not null check (kind in ('rose','tulip','sunflower','daisy','carnation','hydrangea','baby','orchid','foliage')),
  price        integer not null check (price >= 0),          -- VND / cành
  color        text not null,
  accent_color text not null,
  description  text,
  sort         integer not null default 0,
  active       boolean not null default true
);

create table if not exists public.wrappers (
  id      text primary key,
  name    text not null,
  price   integer not null check (price >= 0),               -- VND / tờ
  color   text not null,
  opacity numeric(3,2) not null default 1 check (opacity > 0 and opacity <= 1),
  sort    integer not null default 0,
  active  boolean not null default true
);

create table if not exists public.wrap_styles (
  id          text primary key,
  name        text not null,
  fee         integer not null check (fee >= 0),             -- VND công gói
  shape       text not null check (shape in ('cone','round','handtied')),
  description text,
  sort        integer not null default 0,
  active      boolean not null default true
);

-- ---------------------------------------------------------------------
-- 3. Thiết kế đã lưu
-- ---------------------------------------------------------------------
create table if not exists public.bouquet_designs (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.profiles (id) on delete cascade,
  name         text not null default 'Bó hoa của tôi',
  wrapper_id   text,
  wrapper_name text,
  style_id     text,
  style_name   text,
  ribbon_color text,
  items        jsonb not null default '[]'::jsonb,   -- [{flowerId,name,qty,price}]
  total_price  integer not null default 0,
  snapshot_url text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. Chợ hoa: yêu cầu & báo giá
-- ---------------------------------------------------------------------
create table if not exists public.requests (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.profiles (id) on delete cascade,
  title           text not null check (char_length(title) between 3 and 140),
  description     text not null check (char_length(description) <= 4000),
  budget_min      integer check (budget_min >= 0),
  budget_max      integer check (budget_max >= 0),
  needed_by       date,
  district        text,
  city            text,
  design_id       uuid references public.bouquet_designs (id) on delete set null,
  image_urls      text[] not null default '{}',
  status          text not null default 'open' check (status in ('open','accepted','closed')),
  accepted_bid_id uuid,
  created_at      timestamptz not null default now()
);

create table if not exists public.bids (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references public.requests (id) on delete cascade,
  shop_id       uuid not null references public.shops (id) on delete cascade,
  price         integer not null check (price > 0),
  message       text check (char_length(message) <= 2000),
  delivery_note text check (char_length(delivery_note) <= 300),
  status        text not null default 'pending' check (status in ('pending','accepted','rejected','withdrawn')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (request_id, shop_id)
);

do $$ begin
  alter table public.requests
    add constraint requests_accepted_bid_fk
    foreign key (accepted_bid_id) references public.bids (id) on delete set null;
exception when duplicate_object then null; end $$;

create index if not exists requests_status_created_idx on public.requests (status, created_at desc);
create index if not exists requests_customer_idx       on public.requests (customer_id);
create index if not exists bids_request_price_idx      on public.bids (request_id, price);
create index if not exists bids_shop_idx               on public.bids (shop_id);

-- Tóm tắt cho trang danh sách
create or replace view public.request_summaries
with (security_invoker = true) as
select r.*,
       coalesce(s.bid_count, 0)::int as bid_count,
       s.lowest_bid
from public.requests r
left join lateral (
  select count(*) as bid_count, min(b.price)::int as lowest_bid
  from public.bids b
  where b.request_id = r.id and b.status in ('pending','accepted')
) s on true;

-- ---------------------------------------------------------------------
-- 5. Hàm & trigger
-- ---------------------------------------------------------------------
create or replace function public.is_shop()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'shop');
$$;

-- Tự tạo profile (và shop) khi đăng ký
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role public.user_role :=
    case when new.raw_user_meta_data ->> 'role' = 'shop' then 'shop'::public.user_role
         else 'customer'::public.user_role end;
begin
  insert into public.profiles (id, role, display_name, phone)
  values (new.id, v_role, new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'phone');

  if v_role = 'shop' then
    insert into public.shops (id, name, district, phone)
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data ->> 'shop_name', ''), 'Shop hoa mới'),
      new.raw_user_meta_data ->> 'district',
      new.raw_user_meta_data ->> 'phone'
    );
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Không cho đổi request/shop của báo giá, tự cập nhật updated_at
create or replace function public.guard_bid_update()
returns trigger language plpgsql as $$
begin
  if new.request_id <> old.request_id or new.shop_id <> old.shop_id then
    raise exception 'Không được đổi yêu cầu hoặc shop của báo giá';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists bids_guard on public.bids;
create trigger bids_guard before update on public.bids
  for each row execute function public.guard_bid_update();

-- Khách chấp nhận một báo giá → các báo giá khác bị từ chối
create or replace function public.accept_bid(p_bid_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_request uuid;
begin
  select b.request_id into v_request
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

  update public.bids set status = 'accepted' where id = p_bid_id;
  update public.bids set status = 'rejected'
   where request_id = v_request and id <> p_bid_id and status = 'pending';
  update public.requests set status = 'accepted', accepted_bid_id = p_bid_id where id = v_request;
end $$;

create or replace function public.reject_bid(p_bid_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.bids b set status = 'rejected'
  from public.requests r
  where b.id = p_bid_id
    and r.id = b.request_id
    and b.status = 'pending'
    and r.status = 'open'
    and r.customer_id = auth.uid();

  if not found then
    raise exception 'Không thể từ chối báo giá này.';
  end if;
end $$;

revoke execute on function public.accept_bid(uuid) from public, anon;
revoke execute on function public.reject_bid(uuid) from public, anon;
grant  execute on function public.accept_bid(uuid) to authenticated;
grant  execute on function public.reject_bid(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.shops           enable row level security;
alter table public.flowers         enable row level security;
alter table public.wrappers        enable row level security;
alter table public.wrap_styles     enable row level security;
alter table public.bouquet_designs enable row level security;
alter table public.requests        enable row level security;
alter table public.bids            enable row level security;

-- profiles: xem của mình; shop thắng thầu được xem liên hệ khách
create policy "profiles_select" on public.profiles for select to authenticated using (
  id = auth.uid()
  or exists (
    select 1 from public.requests r
    join public.bids b on b.id = r.accepted_bid_id
    where r.customer_id = profiles.id and b.shop_id = auth.uid()
  )
);
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from anon, authenticated;
grant  update (display_name, phone) on public.profiles to authenticated;   -- không cho tự đổi role

-- shops: công khai; chủ shop sửa thông tin (không sửa rating)
create policy "shops_select" on public.shops for select to anon, authenticated using (true);
create policy "shops_update_own" on public.shops for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.shops from anon, authenticated;
grant  update (name, address, district, city, phone, description) on public.shops to authenticated;

-- danh mục: ai cũng đọc được
create policy "flowers_read"     on public.flowers     for select to anon, authenticated using (true);
create policy "wrappers_read"    on public.wrappers    for select to anon, authenticated using (true);
create policy "wrap_styles_read" on public.wrap_styles for select to anon, authenticated using (true);

-- thiết kế: chủ sở hữu; thiết kế đã gắn vào yêu cầu thì công khai cho shop xem
create policy "designs_select" on public.bouquet_designs for select to anon, authenticated using (
  customer_id = auth.uid()
  or exists (select 1 from public.requests r where r.design_id = bouquet_designs.id)
);
create policy "designs_insert" on public.bouquet_designs for insert to authenticated
  with check (customer_id = auth.uid());
create policy "designs_delete" on public.bouquet_designs for delete to authenticated
  using (customer_id = auth.uid());

-- yêu cầu: công khai; chủ yêu cầu tạo/sửa/đóng khi còn mở
create policy "requests_select" on public.requests for select to anon, authenticated using (true);
create policy "requests_insert" on public.requests for insert to authenticated
  with check (customer_id = auth.uid() and status = 'open' and accepted_bid_id is null);
create policy "requests_update_own" on public.requests for update to authenticated
  using (customer_id = auth.uid() and status = 'open')
  with check (customer_id = auth.uid() and status in ('open','closed'));
create policy "requests_delete_own" on public.requests for delete to authenticated
  using (customer_id = auth.uid() and status <> 'accepted');
revoke update on public.requests from anon, authenticated;
grant  update (title, description, budget_min, budget_max, needed_by, district, city, image_urls, status)
  on public.requests to authenticated;

-- báo giá: đấu giá công khai (ai cũng thấy giá); chỉ shop đặt & sửa giá của mình
create policy "bids_select" on public.bids for select to anon, authenticated using (true);
create policy "bids_insert_shop" on public.bids for insert to authenticated with check (
  shop_id = auth.uid()
  and public.is_shop()
  and status = 'pending'
  and exists (
    select 1 from public.requests r
    where r.id = bids.request_id and r.status = 'open' and r.customer_id <> auth.uid()
  )
);
create policy "bids_update_shop" on public.bids for update to authenticated
  using (
    shop_id = auth.uid()
    and status in ('pending','withdrawn')
    and exists (select 1 from public.requests r where r.id = bids.request_id and r.status = 'open')
  )
  with check (shop_id = auth.uid() and status in ('pending','withdrawn'));
revoke update on public.bids from anon, authenticated;
grant  update (price, message, delivery_note, status) on public.bids to authenticated;

-- ---------------------------------------------------------------------
-- 7. Storage: ảnh yêu cầu & ảnh chụp thiết kế 3D
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('request-images', 'request-images', true, 5242880,
        array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do nothing;

create policy "request_images_read" on storage.objects for select
  using (bucket_id = 'request-images');
create policy "request_images_upload_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'request-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "request_images_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'request-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------
-- 8. Realtime: báo giá mới hiện ngay cho khách
-- ---------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.bids, public.requests;
exception when others then null; end $$;
