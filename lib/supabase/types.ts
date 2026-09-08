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

export interface DbConversation {
  id: string;
  buyer_id: string;
  seller_id: string;
  shop_id: string | null;
  product_id: string | null;
  order_id: string | null;
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

export interface DbMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export interface MessageWithSender extends DbMessage {
  sender?: DbProfile | null;
}

export interface ConversationWithDetails extends DbConversation {
  buyer?: DbProfile | null;
  seller?: DbProfile | null;
  shops?: DbShop | null;
  products?: (DbProduct & { product_images?: DbProductImage[] }) | null;
  orders?: DbOrder | null;
  messages?: DbMessage[];
  unread_count?: number;
}

export type DbSellerVerificationStatus = "pending" | "approved" | "rejected";
export type DbSellerType = "individual" | "business";
export type DbAutomatedReviewStatus =
  | "queued"
  | "processing"
  | "passed"
  | "manual_review"
  | "failed";

export interface DbSellerVerificationRequest {
  id: string;
  user_id: string;
  status: DbSellerVerificationStatus;
  seller_type: DbSellerType;
  full_name: string;
  date_of_birth: string;
  city_address: string;
  business_name: string | null;
  id_type: string;
  id_front_path: string;
  id_back_path: string | null;
  selfie_path: string;
  contact_email: string;
  contact_phone: string;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  automated_review_status?: DbAutomatedReviewStatus | null;
  automated_score?: number | null;
  automated_flags?: string[] | null;
  extracted_full_name?: string | null;
  extracted_date_of_birth?: string | null;
  extracted_id_type?: string | null;
  automated_review_summary?: string | null;
  automated_reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SellerVerificationWithProfile extends DbSellerVerificationRequest {
  profiles?: DbProfile | null;
}

export interface SubmitSellerVerificationInput {
  seller_type: DbSellerType;
  full_name: string;
  date_of_birth: string;
  city_address: string;
  business_name?: string | null;
  id_type: string;
  id_front_path: string;
  id_back_path?: string | null;
  selfie_path: string;
  contact_email: string;
  contact_phone: string;
}


