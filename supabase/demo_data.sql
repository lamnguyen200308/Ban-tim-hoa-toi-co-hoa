-- =====================================================================
--  DỮ LIỆU MẪU ĐỂ THỬ: 2 khách hàng, 1 shop hoa, 20 đơn hoa, vài báo giá
--  Chạy SAU 0001_init.sql, seed.sql, 0002_privacy_unlock_quota.sql
--  (Supabase → SQL Editor → dán toàn bộ file → Run). Chạy lại nhiều lần không bị trùng.
--
--  Tài khoản (đã xác nhận email sẵn, đăng nhập được ngay):
--    khach1@demo.test   / Demo@12345   — Khách: Lan Anh   (10 đơn, 1 đơn đã chốt để thử QR)
--    khach2@demo.test   / Demo@12345   — Khách: Minh Tuấn (10 đơn)
--    shop1@demo.test    / Demo@12345   — Shop:  Tiệm Hoa Mộc Lan
--
--  ⚠️ Chỉ dùng để thử nghiệm. Xoá dữ liệu mẫu: xem cuối file.
-- =====================================================================

set search_path = public, extensions;

do $$
declare
  v_instance uuid := '00000000-0000-0000-0000-000000000000';
  v_c1   uuid := 'd0000000-0000-4000-8000-000000000001';
  v_c2   uuid := 'd0000000-0000-4000-8000-000000000002';
  v_shop uuid := 'd0000000-0000-4000-8000-0000000000a1';
  v_pw   text := crypt('Demo@12345', gen_salt('bf'));
  u record;
begin
  -- 1. Tài khoản đăng nhập (trigger handle_new_user tự tạo profiles + shops)
  for u in
    select * from (values
      (v_c1,   'khach1@demo.test', '{"role":"customer","display_name":"Lan Anh","phone":"0901234567"}'::jsonb),
      (v_c2,   'khach2@demo.test', '{"role":"customer","display_name":"Minh Tuấn","phone":"0912345678"}'::jsonb),
      (v_shop, 'shop1@demo.test',  '{"role":"shop","display_name":"Chị Mộc Lan","shop_name":"Tiệm Hoa Mộc Lan","phone":"0987654321","district":"Quận 3"}'::jsonb)
    ) as t(id, email, meta)
  loop
    if not exists (select 1 from auth.users where id = u.id or email = u.email) then
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new
      ) values (
        v_instance, u.id, 'authenticated', 'authenticated', u.email, v_pw, now(),
        '{"provider":"email","providers":["email"]}', u.meta, now(), now(),
        '', '', '', ''
      );
      insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), u.id, u.id::text, 'email',
              jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
              now(), now(), now());
    end if;
  end loop;

  update public.shops
     set address = '12 Lê Thánh Tôn', city = 'TP. Hồ Chí Minh', rating = 4.8,
         description = 'Hoa tươi nhập sáng từ Đà Lạt, gói theo yêu cầu.'
   where id = v_shop;

  -- 2. 20 đơn hoa (đơn số 1 là mới nhất)
  insert into public.requests (id, customer_id, title, description, budget_min, budget_max, needed_by, district, city, created_at)
  select
    ('e0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
    case when n % 2 = 1 then v_c1 else v_c2 end,
    r.title, r.descr, r.bmin, r.bmax,
    current_date + r.days, r.district, 'TP. Hồ Chí Minh',
    now() - make_interval(hours => n * 3)
  from (values
    ( 1, 'Bó hồng đỏ 20 bông kỷ niệm 5 năm',        'Hồng đỏ Ecuador nếu có, giấy gói đen nhám, ruy băng đỏ nhung. Kèm thiệp viết tay.', 450000,  650000, 3, 'Quận 1'),
    ( 2, 'Lẵng hoa khai trương tông trắng xanh',     'Lẵng 2 tầng, lan hồ điệp trắng + cẩm tú cầu xanh, băng rôn chúc mừng khai trương.', 1200000, 1800000, 5, 'Quận 7'),
    ( 3, 'Tulip vàng tặng mẹ',                         '15 bông tulip vàng, gói giấy Hàn màu kem, phong cách nhẹ nhàng.',                   500000,  700000, 2, 'Thủ Đức'),
    ( 4, 'Hoa cưới cầm tay cô dâu',                    'Hồng trắng + baby trắng + lá bạc, kiểu tròn, cần thử mẫu trước 1 tuần.',          800000, 1200000, 14, 'Quận 3'),
    ( 5, 'Hướng dương tốt nghiệp',                     '5 bông hướng dương, giấy kraft, ruy băng vàng. Giao tận cổng trường.',            250000,  350000, 4, 'Quận 5'),
    ( 6, 'Bó cúc họa mi mini',                         'Bó nhỏ xinh cầm tay, cúc họa mi + baby, gói giấy lưới trắng.',                    150000,  250000, 1, 'Bình Thạnh'),
    ( 7, 'Hoa chia buồn tông trắng',                   'Kệ hoa chia buồn, hoa trắng chủ đạo, băng chữ thành kính phân ưu.',              1000000, 1500000, 1, 'Tân Bình'),
    ( 8, 'Bó hồng phấn sinh nhật bạn gái',             '30 bông hồng phấn, giấy Hàn hồng pastel, thêm đèn led nhỏ nếu được.',              600000,  900000, 6, 'Phú Nhuận'),
    ( 9, 'Giỏ hoa tặng sếp 20/10',                     'Giỏ hoa sang trọng, lan hồ điệp tím + hồng trắng, có thiệp công ty.',             900000, 1300000, 8, 'Quận 1'),
    (10, 'Cẩm tú cầu xanh để bàn',                     '3 bông cẩm tú cầu xanh cắm bình thủy tinh thấp, để bàn tiếp khách.',              400000,  600000, 3, 'Quận 2'),
    (11, 'Hoa cầu hôn',                                '99 bông hồng đỏ xếp hình trái tim, giao tối thứ 7 tại nhà hàng.',                 2500000, 3500000, 10, 'Quận 1'),
    (12, 'Bó hoa tốt nghiệp đại học',                  'Hồng + cẩm chướng tông cam vàng, khoảng 20 cành, gói kiểu hình nón.',             350000,  500000, 7, 'Thủ Đức'),
    (13, 'Hoa văn phòng thay hàng tuần',               'Cần shop giao bình hoa để quầy lễ tân mỗi thứ 2, ngân sách theo tuần.',           300000,  450000, 2, 'Quận 3'),
    (14, 'Bó lan hồ điệp trắng',                       '2 cành lan hồ điệp trắng gói giấy kính trong, tối giản.',                          500000,  750000, 4, 'Quận 10'),
    (15, 'Hoa tặng cô giáo',                           'Bó vừa phải, hoa tươi màu sáng, không cần quá cầu kỳ.',                            200000,  300000, 9, 'Gò Vấp'),
    (16, 'Hoa trang trí tiệc sinh nhật bé',            'Hoa tông pastel cắm 5 bình nhỏ trên bàn tiệc, kèm bóng bay nếu có.',              800000, 1100000, 12, 'Quận 7'),
    (17, 'Bó tulip tím Hà Lan',                        '10 bông tulip tím, giấy đen nhám, phong cách hiện đại.',                          450000,  600000, 5, 'Bình Thạnh'),
    (18, 'Kệ hoa chúc mừng sự kiện',                   'Kệ hoa 1m6 tông đỏ vàng chúc mừng khai trương chi nhánh.',                        1500000, 2000000, 6, 'Tân Phú'),
    (19, 'Hoa hồng trắng xin lỗi',                     'Bó hồng trắng 11 bông, gói đơn giản tinh tế, kèm thiệp.',                         300000,  450000, 1, 'Quận 4'),
    (20, 'Bó hoa mix theo mùa',                        'Để shop tự chọn hoa đẹp nhất trong ngày, tông tươi sáng, cỡ trung.',              350000,  550000, 3, 'Quận 3')
  ) as r(n, title, descr, bmin, bmax, days, district)
  on conflict (id) do nothing;

  -- 3. Báo giá của shop cho vài đơn
  insert into public.bids (id, request_id, shop_id, price, message, delivery_note, created_at, updated_at)
  values
    ('f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', v_shop, 520000,  'Hồng Ecuador về sáng nay, tặng thiệp viết tay.', 'Giao trong 2 giờ, miễn phí nội thành', now() - interval '2 hours', now() - interval '2 hours'),
    ('f0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002', v_shop, 1450000, 'Lẵng 2 tầng, có băng rôn in sẵn.',               'Giao trước giờ khai trương 1 tiếng',     now() - interval '5 hours', now() - interval '5 hours'),
    ('f0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000003', v_shop, 590000,  'Tulip Hà Lan, giấy Hàn kem đúng yêu cầu.',        'Giao buổi sáng',                          now() - interval '8 hours', now() - interval '8 hours'),
    ('f0000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000005', v_shop, 290000,  'Hướng dương to, ruy băng vàng.',                  'Giao tận cổng trường',                    now() - interval '14 hours', now() - interval '14 hours'),
    ('f0000000-0000-4000-8000-000000000008', 'e0000000-0000-4000-8000-000000000008', v_shop, 780000,  'Có đèn led dây tặng kèm.',                        'Giao giờ hành chính',                     now() - interval '23 hours', now() - interval '23 hours')
  on conflict (id) do nothing;

  -- 4. Đơn số 3 (của Lan Anh) đã chốt shop → dùng để thử "Lấy mã QR" / mở thông tin
  update public.bids set status = 'accepted' where id = 'f0000000-0000-4000-8000-000000000003';
  update public.requests
     set status = 'accepted', accepted_bid_id = 'f0000000-0000-4000-8000-000000000003'
   where id = 'e0000000-0000-4000-8000-000000000003';
end $$;

-- Kiểm tra nhanh
select (select count(*) from public.requests where id::text like 'e0000000-%')  as don_hoa,
       (select count(*) from public.bids     where id::text like 'f0000000-%')  as bao_gia,
       (select count(*) from auth.users      where email like '%@demo.test')    as tai_khoan;

-- ---------------------------------------------------------------------
-- XOÁ DỮ LIỆU MẪU: bỏ dấu -- ở dòng dưới rồi chạy riêng (xoá tài khoản → xoá luôn đơn, báo giá)
-- delete from auth.users where email in ('khach1@demo.test', 'khach2@demo.test', 'shop1@demo.test');
