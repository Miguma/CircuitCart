export type DbUserRole = "buyer" | "seller" | "admin";
export type DbShopStatus = "active" | "vacation" | "suspended";
export type DbProductStatus = "draft" | "active" | "sold_out" | "archived";
export type DbProductCondition = "New" | "Like New" | "Good" | "Fair";

export interface DbProfile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  location: string | null;
  bio: string | null;
  role: DbUserRole;
  created_at: string;
  updated_at: string;
}

export interface DbShop {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  location: string | null;
  status: DbShopStatus;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbProduct {
  id: string;
  seller_id: string;
  shop_id: string | null;
  title: string;
  slug: string | null;
  description: string | null;
  specs: string | null;
  category: string;
  condition: DbProductCondition;
  price: number;
  original_price: number | null;
  stock: number;
  status: DbProductStatus;
  location: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface DbProductImage {
  id: string;
  product_id: string;
  storage_path: string;
  sort_order: number;
  created_at: string;
}

export interface ProductWithRelations extends DbProduct {
  product_images?: DbProductImage[];
  shops?: DbShop | null;
  profiles?: DbProfile | null;
}

export interface CreateProductInput {
  title: string;
  category: string;
  condition: DbProductCondition;
  price: number;
  original_price?: number | null;
  stock: number;
  specs?: string;
  description?: string;
  location?: string;
  status?: DbProductStatus;
}

export interface UpdateProductInput extends Partial<CreateProductInput> {
  id: string;
}

export interface DbCartItem {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface CartItemWithProduct extends DbCartItem {
  products?: ProductWithRelations | null;
}

export interface DbFavorite {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
}

export interface FavoriteWithProduct extends DbFavorite {
  products?: ProductWithRelations | null;
}

export type DbOrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "shipped"
  | "completed"
  | "cancelled";

export type DbDeliveryMethod = "delivery" | "meetup";

export interface DbOrder {
  id: string;
  buyer_id: string;
  shop_id: string;
  seller_id: string;
  status: DbOrderStatus;
  subtotal: number;
  shipping_fee: number;
  total: number;
  delivery_method: DbDeliveryMethod;
  shipping_name: string | null;
  shipping_phone: string | null;
  shipping_address: string | null;
  buyer_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbOrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_title: string;
  product_image_path: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
  created_at: string;
}

export interface OrderWithItems extends DbOrder {
  order_items: DbOrderItem[];
  shops?: DbShop | null;
  buyer?: DbProfile | null;
  seller?: DbProfile | null;
}


