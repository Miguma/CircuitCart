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
  rating?: number;
  review_count?: number;
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

export type DbPaymentMethod =
  | "cash_on_delivery"
  | "cash_on_meetup"
  | "manual_gcash"
  | "manual_maya";

export type DbPaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded";

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
  payment_method: DbPaymentMethod;
  payment_status: DbPaymentStatus;
  payment_reference: string | null;
  courier_name: string | null;
  tracking_number: string | null;
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

// ========================================================
// PHASE 7: REVIEWS & RATINGS TYPES
// ========================================================

export interface DbReview {
  id: string;
  order_item_id: string;
  order_id: string;
  product_id: string;
  buyer_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewAuthor {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface ReviewWithAuthor extends DbReview {
  profiles: ReviewAuthor | null;
}

export interface SubmitReviewInput {
  orderItemId: string;
  rating: number;
  comment?: string | null;
}

// ========================================================
// PHASE 8: PERSISTENT NOTIFICATIONS TYPES
// ========================================================

export type NotificationType =
  | "order_new"
  | "order_status"
  | "order_cancelled"
  | "order_completed"
  | "message"
  | "verification_approved"
  | "verification_rejected";

export interface DbNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
}


