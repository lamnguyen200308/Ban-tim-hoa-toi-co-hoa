export type FlowerKind =
  | 'rose'
  | 'tulip'
  | 'sunflower'
  | 'daisy'
  | 'carnation'
  | 'hydrangea'
  | 'baby'
  | 'orchid'
  | 'foliage';

export type Flower = {
  id: string;
  name: string;
  kind: FlowerKind;
  price: number;
  color: string;
  accent_color: string;
  description?: string | null;
};

export type Wrapper = {
  id: string;
  name: string;
  price: number;
  color: string;
  opacity: number;
};

export type WrapShape = 'cone' | 'round' | 'handtied';

export type WrapStyle = {
  id: string;
  name: string;
  fee: number;
  shape: WrapShape;
  description?: string | null;
};

export type Catalogue = {
  flowers: Flower[];
  wrappers: Wrapper[];
  styles: WrapStyle[];
};

export type BouquetItem = { flowerId: string; qty: number };

/** Vị trí bông hoa do khách tự đặt: [x, y, z] trong toạ độ của bó hoa. Khoá = `${flowerId}#${thứ tự}`. */
export type HeadPos = [number, number, number];
export type FlowerPositions = Record<string, HeadPos>;

export type Role = 'customer' | 'shop';

export type Profile = {
  id: string;
  role: Role;
  display_name: string | null;
  phone: string | null;
  /** Quản trị viên — chỉ bật được bằng SQL, người dùng không tự sửa. */
  is_admin?: boolean;
};

export type Shop = {
  id: string;
  name: string;
  address: string | null;
  district: string | null;
  city: string | null;
  phone: string | null;
  description: string | null;
  rating: number | null;
};

/** Phần thông tin shop ai cũng thấy (shop ẩn danh). */
export type PublicShop = Pick<Shop, 'id' | 'district' | 'city' | 'rating'>;

export type ContactUnlock = {
  id: string;
  request_id: string;
  viewer_id: string;
  viewer_role: Role;
  amount: number;
  payment_ref: string;
  status: 'pending' | 'paid';
  /** 'demo' = thanh toán MÔ PHỎNG, không có tiền thật. */
  paid_via: 'demo' | 'gateway' | null;
  created_at: string;
  paid_at: string | null;
};

/** Thông tin bên kia — chỉ trả về sau khi đã thanh toán. */
export type Counterpart = {
  role: 'shop' | 'customer';
  name: string | null;
  phone: string | null;
  address: string | null;
  district: string | null;
  city: string | null;
};

export type RequestStatus = 'open' | 'accepted' | 'closed';

export type FlowerRequest = {
  id: string;
  customer_id: string;
  title: string;
  description: string;
  budget_min: number | null;
  budget_max: number | null;
  needed_by: string | null;
  district: string | null;
  city: string | null;
  design_id: string | null;
  image_urls: string[];
  status: RequestStatus;
  accepted_bid_id: string | null;
  occasion: string | null;
  size_note: string | null;
  needed_time: string | null;
  card_message: string | null;
  created_at: string;
};

export type RequestSummary = FlowerRequest & {
  bid_count: number;
  lowest_bid: number | null;
};

export type BidStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

export type Bid = {
  id: string;
  request_id: string;
  shop_id: string;
  price: number;
  message: string | null;
  delivery_note: string | null;
  status: BidStatus;
  /** Chi tiết báo giá (báo giá cũ có thể để trống). price = flower_cost + design_fee + delivery_fee. */
  flower_cost: number | null;
  design_fee: number | null;
  delivery_fee: number | null;
  flowers_used: string | null;
  substitutions: string | null;
  valid_until: string | null;
  conditions: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  /** Chỉ các cột công khai — tên, SĐT, địa chỉ shop bị ẩn cho tới khi thanh toán. */
  shop?: PublicShop | null;
};

export type DesignLine = { flowerId: string; name: string; qty: number; price: number };

export type BouquetDesign = {
  id: string;
  customer_id: string;
  name: string;
  wrapper_id: string | null;
  wrapper_name: string | null;
  style_id: string | null;
  style_name: string | null;
  ribbon_color: string | null;
  items: DesignLine[];
  total_price: number;
  snapshot_url: string | null;
  created_at: string;
};

export type AppSettings = {
  guest_quota: number;
  member_quota: number;
  unlock_fee_customer: number;
  unlock_fee_shop: number;
  /** true = chế độ DEMO: không có giao dịch thật. */
  payment_demo: boolean;
  deposit_percent: number;
  service_fee: number;
  /** Số giờ trước khi nhắc admin xem đơn đang kẹt điều kiện (không tự xử lý gì). */
  condition_review_hours?: number;
};

export type OrderStatus =
  | 'pending_confirmation'
  | 'confirmed'
  | 'preparing'
  | 'delivering'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'disputed';

/** Trạng thái thanh toán lưu RIÊNG với trạng thái đơn. demo_* = mô phỏng, không có tiền thật. */
export type PaymentStatus = 'unpaid' | 'demo_paid' | 'demo_refunded' | 'paid';

export type Order = {
  id: string;
  request_id: string;
  bid_id: string;
  customer_id: string;
  shop_id: string;
  /** Bản chụp báo giá lúc khách chốt. */
  quote: Partial<Bid> & { accepted_at?: string; request_title?: string };
  total: number;
  deposit_percent: number;
  deposit_amount: number;
  payment_mode: 'demo' | 'live';
  payment_status: PaymentStatus;
  deposit_paid_at: string | null;
  deposit_note: string | null;
  status: OrderStatus;
  previous_status: OrderStatus | null;
  service_fee: number;
  fee_recorded_at: string | null;
  created_at: string;
  updated_at: string;
  /** Còn lại dự kiến = tổng − cọc (cột tính sẵn trong database). */
  remaining_amount: number;
  /** Điều kiện A — Cọc. */
  deposit_status: DepositStatus;
  deposit_customer_marked_at: string | null;
  deposit_evidence_at: string | null;
  deposit_verified_at: string | null;
  deposit_verification_method: 'demo_shop' | 'demo_admin' | 'legacy_demo' | 'reconciliation' | null;
  deposit_status_note: string | null;
  /** Điều kiện B — Phí nền tảng (shop trả). */
  platform_fee_amount: number | null;
  platform_fee_mode: 'demo' | 'live' | null;
  platform_fee_status: PlatformFeeStatus;
  platform_fee_verified_at: string | null;
  platform_fee_verification_method: 'demo_simulation' | 'demo_admin' | 'legacy_completion' | 'gateway' | null;
  platform_fee_note: string | null;
  /** Chỉ có giá trị khi CẢ HAI điều kiện hợp lệ. */
  contact_unlocked_at: string | null;
  contact_unlock_trigger: string | null;
};

/** *_demo = đã MÔ PHỎNG, không phải đã nhận tiền thật. 'verified' chỉ dành cho đối soát thật sau này. */
export type DepositStatus = 'pending' | 'pending_verification' | 'verified_demo' | 'verified' | 'rejected' | 'disputed';
export type PlatformFeeStatus = 'pending' | 'verified_demo' | 'verified' | 'rejected' | 'disputed';

export type DepositEvidence = {
  id: string;
  order_id: string;
  uploaded_by: string | null;
  uploader_role: 'shop';
  storage_path: string;
  evidence_type: 'deposit_screenshot';
  is_demo: boolean;
  note: string | null;
  status: 'submitted' | 'accepted' | 'rejected';
  reviewed_at: string | null;
  created_at: string;
};

export type OrderEvent = {
  id: number;
  order_id: string;
  kind: 'status' | 'payment' | 'dispute' | 'evidence' | 'platform_fee' | 'unlock';
  from_status: string | null;
  to_status: string | null;
  actor_role: 'customer' | 'shop' | 'admin' | 'system';
  note: string | null;
  created_at: string;
};

export type Dispute = {
  id: string;
  order_id: string;
  opener_role: 'customer' | 'shop';
  reason: string;
  /** Khiếu nại gắn với một điều kiện mở liên hệ (nếu có). */
  condition?: 'deposit' | 'platform_fee' | null;
  status: 'open' | 'resolved';
  outcome: 'completed' | 'cancelled' | 'resume' | null;
  deposit_decision: 'refund_customer' | 'release_shop' | 'split' | 'none' | null;
  decision_note: string | null;
  resolved_at: string | null;
  created_at: string;
};

export type DisputeMessage = {
  id: number;
  dispute_id: string;
  author_role: 'customer' | 'shop' | 'admin';
  body: string;
  evidence_paths: string[];
  created_at: string;
};
