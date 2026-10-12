-- Danh mục mẫu (giá tham khảo, VND). Chạy sau 0001_init.sql.
insert into public.flowers (id, name, kind, price, color, accent_color, sort) values
  ('hong-do',     'Hồng đỏ',             'rose',      25000,  '#c8102e', '#8a0b20', 10),
  ('hong-phan',   'Hồng phấn',           'rose',      25000,  '#f4a6b8', '#e07a95', 20),
  ('hong-trang',  'Hồng trắng',          'rose',      28000,  '#f8f4ec', '#e8dcc8', 30),
  ('tulip-vang',  'Tulip vàng',          'tulip',     45000,  '#f6c945', '#e0a520', 40),
  ('tulip-tim',   'Tulip tím',           'tulip',     45000,  '#8e5bb5', '#6a3f8c', 50),
  ('huong-duong', 'Hướng dương',         'sunflower', 35000,  '#f7b500', '#5a3a1a', 60),
  ('cuc-hoa-mi',  'Cúc họa mi',          'daisy',      8000,  '#ffffff', '#f3c623', 70),
  ('cam-chuong',  'Cẩm chướng',          'carnation', 15000,  '#e8587a', '#c23a5c', 80),
  ('cam-tu-cau',  'Cẩm tú cầu',          'hydrangea', 65000,  '#8fb3e8', '#b9a5e0', 90),
  ('lan-ho-diep', 'Lan hồ điệp',         'orchid',   120000,  '#f2e6f7', '#b03a7a', 100),
  ('baby-trang',  'Baby trắng (nhánh)',  'baby',      15000,  '#ffffff', '#e9f2e4', 110),
  ('la-bac',      'Lá bạc (eucalyptus)', 'foliage',   10000,  '#8fae9b', '#6d8f7b', 120)
on conflict (id) do update set
  name = excluded.name, kind = excluded.kind, price = excluded.price,
  color = excluded.color, accent_color = excluded.accent_color, sort = excluded.sort;

insert into public.wrappers (id, name, price, color, opacity, sort) values
  ('kraft',      'Giấy kraft nâu',       12000, '#b98b5e', 1.00, 10),
  ('han-hong',   'Giấy Hàn hồng pastel', 18000, '#f6c9d4', 1.00, 20),
  ('han-kem',    'Giấy Hàn màu kem',     18000, '#f3e6cf', 1.00, 30),
  ('den-nham',   'Giấy đen nhám',        20000, '#2b2b2e', 1.00, 40),
  ('luoi-trang', 'Giấy lưới trắng',      15000, '#ffffff', 0.55, 50),
  ('kinh-trong', 'Giấy kính trong',       8000, '#dff3f7', 0.35, 60)
on conflict (id) do update set
  name = excluded.name, price = excluded.price, color = excluded.color,
  opacity = excluded.opacity, sort = excluded.sort;

insert into public.wrap_styles (id, name, fee, shape, description, sort) values
  ('non',      'Gói hình nón',      30000, 'cone',     'Kiểu cổ điển, gọn tay',            10),
  ('tron-han', 'Gói tròn kiểu Hàn', 50000, 'round',    'Nhiều lớp giấy xòe, sang trọng',   20),
  ('bo-tay',   'Bó tay buộc nơ',    20000, 'handtied', 'Mộc mạc, lộ cuống hoa',            30)
on conflict (id) do update set
  name = excluded.name, fee = excluded.fee, shape = excluded.shape,
  description = excluded.description, sort = excluded.sort;
