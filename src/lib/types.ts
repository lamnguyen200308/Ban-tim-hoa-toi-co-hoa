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

export type Role = 'customer' | 'shop';

export type Profile = {
  id: string;
  role: Role;
  display_name: string | null;
  phone: string | null;
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
  created_at: string;
  updated_at: string;
  shop?: Pick<Shop, 'id' | 'name' | 'district' | 'city' | 'phone' | 'address' | 'rating'> | null;
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
