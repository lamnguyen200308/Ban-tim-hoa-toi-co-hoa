-- =====================================================================
--  TÀI KHOẢN QUẢN TRỊ MẪU (chỉ để thử) — chạy SAU 0003_orders_demo_payment_admin.sql
--    admin@demo.test / Demo@12345
--
--  Muốn dùng tài khoản thật của bạn làm admin thì KHÔNG cần file này, chỉ chạy:
--    update public.profiles set is_admin = true
--     where id = (select id from auth.users where email = 'email-cua-ban@gmail.com');
--
--  ⚠️ Nhớ xoá tài khoản mẫu trước khi chạy thật (lệnh ở cuối file).
-- =====================================================================

set search_path = public, extensions;

do $$
declare
  v_admin uuid := 'd0000000-0000-4000-8000-0000000000ad';
begin
  if not exists (select 1 from auth.users where id = v_admin or email = 'admin@demo.test') then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', v_admin, 'authenticated', 'authenticated', 'admin@demo.test',
      crypt('Demo@12345', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{"role":"customer","display_name":"Quản trị (demo)"}', now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_admin, v_admin::text, 'email',
            jsonb_build_object('sub', v_admin::text, 'email', 'admin@demo.test', 'email_verified', true),
            now(), now(), now());
  end if;
  update public.profiles set is_admin = true where id = v_admin;
end $$;

select email, p.is_admin from auth.users u join public.profiles p on p.id = u.id where email = 'admin@demo.test';

-- XOÁ: delete from auth.users where email = 'admin@demo.test';
