import { DUMMY_PRODUCTS, type Product } from "@/components/marketplace/marketplace-data";

export type OrderStatus =
  | "Pending"
  | "Confirmed"
  | "Packed"
  | "Shipped"
  | "Ready for Meetup"
  | "Delivered"
  | "Completed"
  | "Cancelled"
  | "Refund Requested"
  | "Refunded";

export type FulfillmentMethod = "Delivery" | "Meetup";
export type PaymentStatus = "Paid" | "Pending" | "Refunded";
export type ListingStatus = "Active" | "Draft" | "Sold Out" | "Archived" | "Reserved";

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  image?: string;
  condition: Product["condition"];
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  specs: string;
}

export interface BuyerProfile {
  name: string;
  avatar?: string;
  rating: number;
  reviewCount: number;
  memberSince: string;
  phone?: string;
  location: string;
}

export interface SellerOrder {
  id: string;
  orderNumber: string;
  buyer: BuyerProfile;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  total: number;
  fulfillmentMethod: FulfillmentMethod;
  deliveryDetails?: {
    recipient: string;
    phone: string;
    address: string;
    courier?: string;
    trackingNumber?: string;
    estimatedDelivery?: string;
  };
  meetupDetails?: {
    location: string;
    preferredDate: string;
    preferredTime: string;
    buyerNotes?: string;
  };
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  placedAt: string;
  confirmedAt?: string;
  packedAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
}

export interface SellerProductItem {
  id: string;
  name: string;
  category: Product["category"];
  price: number;
  stock: number;
  status: ListingStatus;
  views: number;
  soldCount: number;
  updatedAt: string;
  condition: Product["condition"];
  image?: string;
  specs: string;
}

export interface SellerStats {
  totalSales: number;
  salesGrowth: number;
  activeListings: number;
  pendingOrders: number;
  lowStockCount: number;
  sellerRating: number;
  reviewCount: number;
  completedOrdersCount: number;
  responseRate: number;
  isVerified: boolean;
  shopName: string;
  shopHandle: string;
  location: string;
  defaultMeetupArea: string;
  handlingTime: string;
}

export interface SellerShopProfile {
  id: string;
  shopName: string;
  slug: string;
  description: string;
  logo?: string;
  banner?: string;
  location: string;
  contactPreference: "CircuitCart Chat" | "Phone & SMS" | "Email";
  businessType: "Individual Tech Seller" | "Registered Hardware Shop" | "Refurbisher";
  memberSince: string;
  rating: number;
  reviewCount: number;
  completedOrders: number;
  responseRate: number;
  isVerified: boolean;
  shopStatus: "Active" | "Vacation Mode";
  fulfillmentPreference: "Both" | "Delivery" | "Meetup";
  defaultMeetupArea: string;
  handlingTime: string;
}

export type VerificationStatus =
  | "Not Started"
  | "In Progress"
  | "Under Review"
  | "Verified"
  | "Rejected";

export interface SellerVerificationData {
  status: VerificationStatus;
  fullName: string;
  dateOfBirth: string;
  sellerType: "Individual" | "Business";
  cityAddress: string;
  businessName?: string;
  idType: string;
  idFrontImage?: string;
  idBackImage?: string;
  selfieImage?: string;
  email: string;
  isEmailVerified: boolean;
  phone: string;
  isPhoneVerified: boolean;
  submittedAt?: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderRole: "buyer" | "seller";
  senderName: string;
  content: string;
  createdAt: string;
  dateGroup: string; // e.g. "Today", "Yesterday", "Sep 3"
  readAt?: string;
}

export interface Conversation {
  id: string;
  buyer: {
    id: string;
    name: string;
    avatar?: string;
    location: string;
    memberSince: string;
    activeStatus: string;
    rating: number;
    reviewCount: number;
    phoneVerified: boolean;
  };
  sellerId: string;
  productId: string;
  product: {
    id: string;
    name: string;
    price: number;
    originalPrice?: number;
    condition: Product["condition"];
    image?: string;
    status: ListingStatus;
    category: Product["category"];
    specs: string;
    shopName: string;
  };
  associatedOrder?: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    total: number;
    fulfillmentMethod: FulfillmentMethod;
  };
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  messages: ChatMessage[];
}

export const DEMO_CONVERSATIONS: Conversation[] = [
  {
    id: "conv-1",
    buyer: {
      id: "buyer-1",
      name: "John Dexter",
      location: "Cebu City, Lahug",
      memberSince: "2024",
      activeStatus: "Active 5m ago",
      rating: 4.9,
      reviewCount: 14,
      phoneVerified: true,
    },
    sellerId: "shop-1",
    productId: "prod-1",
    product: {
      id: "prod-1",
      name: "Asus ROG Strix G16 Gaming Laptop",
      price: 42500,
      originalPrice: 49990,
      condition: "Like New",
      image: "/images/macbook-air.png",
      status: "Active",
      category: "Laptops",
      specs: "Intel i7-13650HX, RTX 4060 8GB, 16GB DDR5, 512GB SSD",
      shopName: "TechVault Cebu",
    },
    associatedOrder: {
      id: "ord-1",
      orderNumber: "CC-1024",
      status: "Pending",
      total: 42500,
      fulfillmentMethod: "Delivery",
    },
    lastMessage: "Sounds great! Just placed order #CC-1024 with Delivery option.",
    lastMessageAt: "2m ago",
    unreadCount: 1,
    messages: [
      {
        id: "msg-1",
        conversationId: "conv-1",
        senderRole: "buyer",
        senderName: "John Dexter",
        content: "Hi! Interested in the Asus ROG Strix G16. Is the original charger and box included?",
        createdAt: "9:40 PM",
        dateGroup: "Today",
      },
      {
        id: "msg-2",
        conversationId: "conv-1",
        senderRole: "seller",
        senderName: "TechVault Cebu",
        content: "Hello John! Yes, original 280W ROG power adapter and factory packaging are all included. Thermal paste was also recently repasted with Kryonaut.",
        createdAt: "9:42 PM",
        dateGroup: "Today",
      },
      {
        id: "msg-3",
        conversationId: "conv-1",
        senderRole: "buyer",
        senderName: "John Dexter",
        content: "Awesome! Can we meet at Cebu IT Park or do delivery via Grab/Lalamove?",
        createdAt: "9:45 PM",
        dateGroup: "Today",
      },
      {
        id: "msg-4",
        conversationId: "conv-1",
        senderRole: "seller",
        senderName: "TechVault Cebu",
        content: "Both work great! If delivery, I will pack it with extra honeycomb bubble wrap and dispatch right away.",
        createdAt: "9:48 PM",
        dateGroup: "Today",
      },
      {
        id: "msg-5",
        conversationId: "conv-1",
        senderRole: "buyer",
        senderName: "John Dexter",
        content: "Sounds great! Just placed order #CC-1024 with Delivery option.",
        createdAt: "9:50 PM",
        dateGroup: "Today",
      },
    ],
  },
  {
    id: "conv-2",
    buyer: {
      id: "buyer-2",
      name: "Maria Santos",
      location: "Mandaue City, Tipolo",
      memberSince: "2023",
      activeStatus: "Active 1h ago",
      rating: 5.0,
      reviewCount: 28,
      phoneVerified: true,
    },
    sellerId: "shop-1",
    productId: "prod-4",
    product: {
      id: "prod-4",
      name: "Samsung Galaxy S23 Ultra 256GB",
      price: 28500,
      originalPrice: 34990,
      condition: "Good",
      image: "/images/macbook-air.png",
      status: "Reserved",
      category: "Mobile",
      specs: "256GB Phantom Black, Snapdragon 8 Gen 2, 200MP Camera",
      shopName: "TechVault Cebu",
    },
    associatedOrder: {
      id: "ord-2",
      orderNumber: "CC-1023",
      status: "Packed",
      total: 28680,
      fulfillmentMethod: "Delivery",
    },
    lastMessage: "Thank you so much! Looking forward to receiving it.",
    lastMessageAt: "Yesterday",
    unreadCount: 0,
    messages: [
      {
        id: "msg-201",
        conversationId: "conv-2",
        senderRole: "buyer",
        senderName: "Maria Santos",
        content: "Hello! Has the phone screen ever been replaced or repaired?",
        createdAt: "11:15 AM",
        dateGroup: "Yesterday",
      },
      {
        id: "msg-202",
        conversationId: "conv-2",
        senderRole: "seller",
        senderName: "TechVault Cebu",
        content: "Hi Maria! No repairs at all, 100% original AMOLED with zero burn-in or scratches. S-Pen works flawlessly.",
        createdAt: "11:20 AM",
        dateGroup: "Yesterday",
      },
      {
        id: "msg-203",
        conversationId: "conv-2",
        senderRole: "buyer",
        senderName: "Maria Santos",
        content: "Great, ordered! Please pack securely with bubble wrap.",
        createdAt: "12:00 PM",
        dateGroup: "Yesterday",
      },
      {
        id: "msg-204",
        conversationId: "conv-2",
        senderRole: "seller",
        senderName: "TechVault Cebu",
        content: "Your order #CC-1023 has been packed with heavy-duty padding and fragile markers. Ready for courier dispatch!",
        createdAt: "12:30 PM",
        dateGroup: "Yesterday",
      },
      {
        id: "msg-205",
        conversationId: "conv-2",
        senderRole: "buyer",
        senderName: "Maria Santos",
        content: "Thank you so much! Looking forward to receiving it.",
        createdAt: "12:45 PM",
        dateGroup: "Yesterday",
      },
    ],
  },
  {
    id: "conv-3",
    buyer: {
      id: "buyer-3",
      name: "Alex Rivera",
      location: "Lapu-Lapu City, Mactan",
      memberSince: "2024",
      activeStatus: "Online",
      rating: 4.8,
      reviewCount: 9,
      phoneVerified: true,
    },
    sellerId: "shop-1",
    productId: "prod-2",
    product: {
      id: "prod-2",
      name: "NVIDIA GeForce RTX 4070 Dual Fan OC 12GB",
      price: 18900,
      originalPrice: 22500,
      condition: "Like New",
      image: "/images/macbook-air.png",
      status: "Active",
      category: "Components",
      specs: "12GB GDDR6X, DLSS 3, Dual BIOS, 2-Slot Compact",
      shopName: "TechVault Cebu",
    },
    associatedOrder: {
      id: "ord-3",
      orderNumber: "CC-1022",
      status: "Shipped",
      total: 18900,
      fulfillmentMethod: "Delivery",
    },
    lastMessage: "Sent tracking details for J&T Express! Tracking #JT98342019PH.",
    lastMessageAt: "Sep 3",
    unreadCount: 1,
    messages: [
      {
        id: "msg-301",
        conversationId: "conv-3",
        senderRole: "buyer",
        senderName: "Alex Rivera",
        content: "Hi, what are the benchmark temps under FurMark load on this 4070?",
        createdAt: "3:10 PM",
        dateGroup: "Sep 3",
      },
      {
        id: "msg-302",
        conversationId: "conv-3",
        senderRole: "seller",
        senderName: "TechVault Cebu",
        content: "Max temperature reaches around 64°C in 26°C ambient room. Fans are whisper quiet and coil whine is non-existent.",
        createdAt: "3:22 PM",
        dateGroup: "Sep 3",
      },
      {
        id: "msg-303",
        conversationId: "conv-3",
        senderRole: "buyer",
        senderName: "Alex Rivera",
        content: "Super clean. I just purchased it, please ship as soon as possible!",
        createdAt: "3:30 PM",
        dateGroup: "Sep 3",
      },
      {
        id: "msg-304",
        conversationId: "conv-3",
        senderRole: "seller",
        senderName: "TechVault Cebu",
        content: "Sent tracking details for J&T Express! Tracking #JT98342019PH. Estimated delivery is tomorrow afternoon.",
        createdAt: "4:15 PM",
        dateGroup: "Sep 3",
      },
    ],
  },
  {
    id: "conv-4",
    buyer: {
      id: "buyer-4",
      name: "Patricia Lim",
      location: "Cebu City, Banilad",
      memberSince: "2023",
      activeStatus: "Active 3h ago",
      rating: 5.0,
      reviewCount: 31,
      phoneVerified: true,
    },
    sellerId: "shop-1",
    productId: "prod-6",
    product: {
      id: "prod-6",
      name: "Apple MacBook Air 13\" M2 (2022)",
      price: 38900,
      originalPrice: 44990,
      condition: "Like New",
      image: "/images/macbook-air.png",
      status: "Active",
      category: "Laptops",
      specs: "M2 8-core CPU, 8-core GPU, 8GB Unified RAM, 256GB SSD",
      shopName: "TechVault Cebu",
    },
    associatedOrder: {
      id: "ord-4",
      orderNumber: "CC-1021",
      status: "Ready for Meetup",
      total: 38900,
      fulfillmentMethod: "Meetup",
    },
    lastMessage: "Confirmed! See you tomorrow at Starbucks Ayala.",
    lastMessageAt: "Sep 2",
    unreadCount: 0,
    messages: [
      {
        id: "msg-401",
        conversationId: "conv-4",
        senderRole: "buyer",
        senderName: "Patricia Lim",
        content: "Hi! What is the current battery health cycle count on the M2 Air?",
        createdAt: "1:10 PM",
        dateGroup: "Sep 2",
      },
      {
        id: "msg-402",
        conversationId: "conv-4",
        senderRole: "seller",
        senderName: "TechVault Cebu",
        content: "Battery cycle count is only 42 cycles with 99% maximum capacity. Space Gray body with no dents or scratches.",
        createdAt: "1:15 PM",
        dateGroup: "Sep 2",
      },
      {
        id: "msg-403",
        conversationId: "conv-4",
        senderRole: "buyer",
        senderName: "Patricia Lim",
        content: "Perfect! Can we do meetup testing at Ayala Center Starbucks tomorrow 2 PM?",
        createdAt: "1:20 PM",
        dateGroup: "Sep 2",
      },
      {
        id: "msg-404",
        conversationId: "conv-4",
        senderRole: "seller",
        senderName: "TechVault Cebu",
        content: "Confirmed! See you tomorrow at Starbucks Ayala. You can run diagnostics on battery and display before releasing payment.",
        createdAt: "1:25 PM",
        dateGroup: "Sep 2",
      },
    ],
  },
  {
    id: "conv-5",
    buyer: {
      id: "buyer-5",
      name: "Dave Ramirez",
      location: "Talisay City, Tabunok",
      memberSince: "2024",
      activeStatus: "Active yesterday",
      rating: 4.7,
      reviewCount: 5,
      phoneVerified: true,
    },
    sellerId: "shop-1",
    productId: "prod-3",
    product: {
      id: "prod-3",
      name: "Sony WH-1000XM5 Wireless Headphones",
      price: 8990,
      originalPrice: 11500,
      condition: "Like New",
      image: "/images/macbook-air.png",
      status: "Sold Out",
      category: "Audio",
      specs: "Industry-leading ANC, 30-hour battery, Speak-to-Chat",
      shopName: "TechVault Cebu",
    },
    associatedOrder: {
      id: "ord-5",
      orderNumber: "CC-1020",
      status: "Completed",
      total: 9140,
      fulfillmentMethod: "Delivery",
    },
    lastMessage: "Received! Sound quality is amazing. Left you a 5-star review!",
    lastMessageAt: "Aug 30",
    unreadCount: 0,
    messages: [
      {
        id: "msg-501",
        conversationId: "conv-5",
        senderRole: "buyer",
        senderName: "Dave Ramirez",
        content: "Is the price still negotiable down to ₱8,500?",
        createdAt: "8:00 AM",
        dateGroup: "Aug 29",
      },
      {
        id: "msg-502",
        conversationId: "conv-5",
        senderRole: "seller",
        senderName: "TechVault Cebu",
        content: "I can do ₱8,800 lowest with free delivery included if you order today!",
        createdAt: "8:10 AM",
        dateGroup: "Aug 29",
      },
      {
        id: "msg-503",
        conversationId: "conv-5",
        senderRole: "buyer",
        senderName: "Dave Ramirez",
        content: "Deal! Order #CC-1020 placed.",
        createdAt: "8:15 AM",
        dateGroup: "Aug 29",
      },
      {
        id: "msg-504",
        conversationId: "conv-5",
        senderRole: "seller",
        senderName: "TechVault Cebu",
        content: "Package delivered and order marked completed. Thanks Dave!",
        createdAt: "2:00 PM",
        dateGroup: "Aug 30",
      },
      {
        id: "msg-505",
        conversationId: "conv-5",
        senderRole: "buyer",
        senderName: "Dave Ramirez",
        content: "Received! Sound quality is amazing. Left you a 5-star review!",
        createdAt: "3:30 PM",
        dateGroup: "Aug 30",
      },
    ],
  },
];

export const DEMO_SHOP_PROFILE: SellerShopProfile = {
  id: "shop-1",
  shopName: "TechVault Cebu",
  slug: "techvault-cebu",
  description: "Trusted pre-owned and brand-new technology from Cebu. Specialized in gaming laptops, GPU upgrades, and custom peripherals with in-person testing at Cebu IT Park.",
  logo: "",
  banner: "",
  location: "Cebu City, Central Visayas",
  contactPreference: "CircuitCart Chat",
  businessType: "Individual Tech Seller",
  memberSince: "2024",
  rating: 4.9,
  reviewCount: 148,
  completedOrders: 36,
  responseRate: 98,
  isVerified: true,
  shopStatus: "Active",
  fulfillmentPreference: "Both",
  defaultMeetupArea: "Cebu IT Park, Lahug / Ayala Center Cebu",
  handlingTime: "1–2 days",
};

export const DEMO_VERIFICATION_DATA: SellerVerificationData = {
  status: "Verified",
  fullName: "Juan Dela Cruz",
  dateOfBirth: "1998-05-14",
  sellerType: "Individual",
  cityAddress: "Cebu IT Park, Lahug, Cebu City 6000",
  businessName: "TechVault Cebu Hardware",
  idType: "Philippine National ID (PhilID)",
  idFrontImage: "/images/macbook-air.png",
  idBackImage: "/images/macbook-air.png",
  selfieImage: "/images/macbook-air.png",
  email: "demo.seller@circuitcart.test",
  isEmailVerified: true,
  phone: "+63 900 000 0000",
  isPhoneVerified: true,
  submittedAt: "Aug 15, 2026 · 10:30 AM",
  reviewedAt: "Aug 16, 2026 · 2:15 PM",
  reviewNotes: "Identity documents verified with biometric facial match.",
};

export const DEMO_SELLER_STATS: SellerStats = {
  totalSales: 84250,
  salesGrowth: 14.5,
  activeListings: 12,
  pendingOrders: 3,
  lowStockCount: 2,
  sellerRating: 4.9,
  reviewCount: 148,
  completedOrdersCount: 36,
  responseRate: 98,
  isVerified: true,
  shopName: "TechVault Cebu",
  shopHandle: "@techvault",
  location: "Cebu City, Central Visayas",
  defaultMeetupArea: "IT Park / Ayala Center Cebu",
  handlingTime: "Ships or meets within 24 hours",
};

export const DEMO_SELLER_ORDERS: SellerOrder[] = [
  {
    id: "ord-1",
    orderNumber: "#CC-1024",
    buyer: {
      name: "John D.",
      avatar: "J",
      rating: 4.9,
      reviewCount: 18,
      memberSince: "2024",
      phone: "+63 917 555 0192",
      location: "Banilad, Cebu City",
    },
    items: [
      {
        id: "item-1",
        productId: "prod-1",
        name: "Asus ROG Strix G16 Gaming Laptop",
        image: "/images/macbook-air.png",
        condition: "Like New",
        quantity: 1,
        unitPrice: 42500,
        totalPrice: 42500,
        specs: "Intel i7-13650HX, RTX 4060 8GB, 16GB DDR5, 512GB SSD",
      },
    ],
    subtotal: 42500,
    shippingFee: 250,
    total: 42750,
    fulfillmentMethod: "Delivery",
    deliveryDetails: {
      recipient: "John Doe",
      phone: "+63 917 555 0192",
      address: "Unit 804, Grand Residences, Gov. Cuenco Ave, Banilad, Cebu City 6000",
      courier: "Lalamove Tech Care",
      estimatedDelivery: "Today by 6:00 PM",
    },
    paymentMethod: "GCash Escrow",
    paymentStatus: "Paid",
    status: "Pending",
    placedAt: "Sep 5, 2026 · 2:15 PM",
  },
  {
    id: "ord-2",
    orderNumber: "#CC-1023",
    buyer: {
      name: "Maria S.",
      avatar: "M",
      rating: 5.0,
      reviewCount: 32,
      memberSince: "2023",
      phone: "+63 928 555 3841",
      location: "Mandaue City, Cebu",
    },
    items: [
      {
        id: "item-2",
        productId: "prod-4",
        name: "Samsung Galaxy S23 Ultra 256GB Phantom Black",
        image: "/images/macbook-air.png",
        condition: "Like New",
        quantity: 1,
        unitPrice: 24990,
        totalPrice: 24990,
        specs: "Snapdragon 8 Gen 2, 200MP, S-Pen included",
      },
    ],
    subtotal: 24990,
    shippingFee: 0,
    total: 24990,
    fulfillmentMethod: "Meetup",
    meetupDetails: {
      location: "Starbucks, Cebu IT Park (Skyrise 4)",
      preferredDate: "Sep 6, 2026",
      preferredTime: "5:30 PM",
      buyerNotes: "I will inspect the camera lenses and battery health upon meetup.",
    },
    paymentMethod: "Maya Escrow",
    paymentStatus: "Paid",
    status: "Packed",
    placedAt: "Sep 4, 2026 · 6:40 PM",
    confirmedAt: "Sep 4, 2026 · 7:10 PM",
    packedAt: "Sep 5, 2026 · 9:30 AM",
  },
  {
    id: "ord-3",
    orderNumber: "#CC-1022",
    buyer: {
      name: "Alex R.",
      avatar: "A",
      rating: 4.8,
      reviewCount: 14,
      memberSince: "2025",
      phone: "+63 908 555 7721",
      location: "Lapu-Lapu City, Cebu",
    },
    items: [
      {
        id: "item-3",
        productId: "prod-3",
        name: "Keychron Q1 Pro Wireless Mechanical Keyboard",
        image: "/images/macbook-air.png",
        condition: "Like New",
        quantity: 1,
        unitPrice: 3250,
        totalPrice: 3250,
        specs: "75% Layout, Hot-swappable, RGB Backlight",
      },
    ],
    subtotal: 3250,
    shippingFee: 150,
    total: 3400,
    fulfillmentMethod: "Delivery",
    deliveryDetails: {
      recipient: "Alex Reyes",
      phone: "+63 908 555 7721",
      address: "Punta Engaño Road, Mactan, Lapu-Lapu City 6015",
      courier: "J&T Express",
      trackingNumber: "JT-PH-884920194",
      estimatedDelivery: "Tomorrow",
    },
    paymentMethod: "Cash on Delivery",
    paymentStatus: "Pending",
    status: "Shipped",
    placedAt: "Sep 3, 2026 · 11:20 AM",
    confirmedAt: "Sep 3, 2026 · 11:45 AM",
    packedAt: "Sep 3, 2026 · 3:15 PM",
    shippedAt: "Sep 4, 2026 · 10:00 AM",
  },
  {
    id: "ord-4",
    orderNumber: "#CC-1021",
    buyer: {
      name: "Dennis M.",
      avatar: "D",
      rating: 4.9,
      reviewCount: 45,
      memberSince: "2023",
      phone: "+63 919 555 9931",
      location: "Talisay City, Cebu",
    },
    items: [
      {
        id: "item-4",
        productId: "prod-5",
        name: "Sony WH-1000XM5 Wireless Noise Cancelling",
        image: "/images/macbook-air.png",
        condition: "Like New",
        quantity: 1,
        unitPrice: 16500,
        totalPrice: 16500,
        specs: "Auto NC Optimizer, 30-hour battery, LDAC Hi-Res",
      },
    ],
    subtotal: 16500,
    shippingFee: 180,
    total: 16680,
    fulfillmentMethod: "Delivery",
    deliveryDetails: {
      recipient: "Dennis Morales",
      phone: "+63 919 555 9931",
      address: "Dumlog, Talisay City, Cebu 6045",
      courier: "LBC Express",
      trackingNumber: "LBC-CEB-3918201",
      estimatedDelivery: "Delivered",
    },
    paymentMethod: "Bank Transfer",
    paymentStatus: "Paid",
    status: "Completed",
    placedAt: "Sep 2, 2026 · 1:40 PM",
    confirmedAt: "Sep 2, 2026 · 2:00 PM",
    packedAt: "Sep 2, 2026 · 4:30 PM",
    shippedAt: "Sep 3, 2026 · 9:00 AM",
    deliveredAt: "Sep 4, 2026 · 11:30 AM",
    completedAt: "Sep 4, 2026 · 1:00 PM",
  },
  {
    id: "ord-5",
    orderNumber: "#CC-1020",
    buyer: {
      name: "Patricia K.",
      avatar: "P",
      rating: 5.0,
      reviewCount: 29,
      memberSince: "2024",
      phone: "+63 922 555 4120",
      location: "Lahug, Cebu City",
    },
    items: [
      {
        id: "item-5",
        productId: "prod-2",
        name: "NVIDIA GeForce RTX 4070 Dual Fan OC 12GB",
        image: "/images/macbook-air.png",
        condition: "Good",
        quantity: 1,
        unitPrice: 18900,
        totalPrice: 18900,
        specs: "12GB GDDR6X, DLSS 3, Ray Tracing Gen 3",
      },
    ],
    subtotal: 18900,
    shippingFee: 0,
    total: 18900,
    fulfillmentMethod: "Meetup",
    meetupDetails: {
      location: "Ayala Center Cebu (Near Bo's Coffee Ground Level)",
      preferredDate: "Sep 1, 2026",
      preferredTime: "4:00 PM",
      buyerNotes: "Tested stress bench on laptop GPU dock before final handover.",
    },
    paymentMethod: "GCash Escrow",
    paymentStatus: "Paid",
    status: "Completed",
    placedAt: "Aug 31, 2026 · 10:15 AM",
    confirmedAt: "Aug 31, 2026 · 10:30 AM",
    packedAt: "Aug 31, 2026 · 1:00 PM",
    completedAt: "Sep 1, 2026 · 4:45 PM",
  },
  {
    id: "ord-6",
    orderNumber: "#CC-1019",
    buyer: {
      name: "Christian B.",
      avatar: "C",
      rating: 4.7,
      reviewCount: 11,
      memberSince: "2025",
      phone: "+63 916 555 8820",
      location: "Mabolo, Cebu City",
    },
    items: [
      {
        id: "item-6",
        productId: "prod-7",
        name: "AMD Ryzen 7 7800X3D Desktop Processor",
        image: "/images/macbook-air.png",
        condition: "New",
        quantity: 1,
        unitPrice: 14200,
        totalPrice: 14200,
        specs: "8 Cores, 16 Threads, 3D V-Cache, AM5",
      },
    ],
    subtotal: 14200,
    shippingFee: 0,
    total: 14200,
    fulfillmentMethod: "Meetup",
    meetupDetails: {
      location: "Robinsons Galleria Cebu (Tech Hub Entrance)",
      preferredDate: "Sep 6, 2026",
      preferredTime: "2:00 PM",
    },
    paymentMethod: "Cash on Meetup",
    paymentStatus: "Pending",
    status: "Ready for Meetup",
    placedAt: "Sep 4, 2026 · 4:10 PM",
    confirmedAt: "Sep 4, 2026 · 4:25 PM",
    packedAt: "Sep 5, 2026 · 11:00 AM",
  },
  {
    id: "ord-7",
    orderNumber: "#CC-1018",
    buyer: {
      name: "Gerald V.",
      avatar: "G",
      rating: 4.6,
      reviewCount: 8,
      memberSince: "2025",
      phone: "+63 933 555 1948",
      location: "Carcar City, Cebu",
    },
    items: [
      {
        id: "item-7",
        productId: "prod-6",
        name: "Apple MacBook Air 13.6\" M2 Chip 256GB Midnight",
        image: "/images/macbook-air.png",
        condition: "Like New",
        quantity: 1,
        unitPrice: 38900,
        totalPrice: 38900,
        specs: "M2 8-core CPU, 8-core GPU, 8GB RAM, 256GB SSD",
      },
    ],
    subtotal: 38900,
    shippingFee: 350,
    total: 39250,
    fulfillmentMethod: "Delivery",
    deliveryDetails: {
      recipient: "Gerald Villamor",
      phone: "+63 933 555 1948",
      address: "Poblacion I, Carcar City, Cebu 6019",
      courier: "LBC Express",
    },
    paymentMethod: "GCash Escrow",
    paymentStatus: "Paid",
    status: "Confirmed",
    placedAt: "Sep 5, 2026 · 1:00 PM",
    confirmedAt: "Sep 5, 2026 · 1:20 PM",
  },
  {
    id: "ord-8",
    orderNumber: "#CC-1017",
    buyer: {
      name: "Ramon T.",
      avatar: "R",
      rating: 4.8,
      reviewCount: 22,
      memberSince: "2024",
      phone: "+63 915 555 3302",
      location: "Guadalupe, Cebu City",
    },
    items: [
      {
        id: "item-8",
        productId: "prod-8",
        name: "Logitech G Pro X Superlight Wireless Mouse",
        image: "/images/macbook-air.png",
        condition: "Good",
        quantity: 1,
        unitPrice: 4100,
        totalPrice: 4100,
        specs: "<63g Ultra Lightweight, HERO 25K Sensor",
      },
    ],
    subtotal: 4100,
    shippingFee: 120,
    total: 4220,
    fulfillmentMethod: "Delivery",
    deliveryDetails: {
      recipient: "Ramon Tan",
      phone: "+63 915 555 3302",
      address: "Guadalupe, Cebu City 6000",
    },
    paymentMethod: "GCash",
    paymentStatus: "Refunded",
    status: "Cancelled",
    placedAt: "Aug 29, 2026 · 8:00 AM",
    cancelledAt: "Aug 29, 2026 · 9:30 AM",
    cancelReason: "Buyer requested cancellation due to duplicate order.",
  },
];

export const DEMO_RECENT_ORDERS = DEMO_SELLER_ORDERS.slice(0, 5);

export const DEMO_SELLER_PRODUCTS: SellerProductItem[] = [
  {
    id: "prod-1",
    name: "Asus ROG Strix G16 Gaming Laptop",
    category: "Laptops",
    price: 42500,
    stock: 3,
    status: "Active",
    views: 245,
    soldCount: 4,
    updatedAt: "Today",
    condition: "Like New",
    image: "/images/macbook-air.png",
    specs: "i7-13650HX, RTX 4060 8GB, 16GB DDR5, 512GB SSD",
  },
  {
    id: "prod-4",
    name: "Samsung Galaxy S23 Ultra 256GB Phantom Black",
    category: "Mobile",
    price: 24990,
    stock: 2,
    status: "Active",
    views: 310,
    soldCount: 7,
    updatedAt: "Yesterday",
    condition: "Like New",
    image: "/images/macbook-air.png",
    specs: "Snapdragon 8 Gen 2, 200MP Camera, S-Pen included",
  },
  {
    id: "prod-2",
    name: "NVIDIA GeForce RTX 4070 Dual Fan OC 12GB",
    category: "Components",
    price: 18900,
    stock: 4,
    status: "Active",
    views: 188,
    soldCount: 3,
    updatedAt: "2 days ago",
    condition: "Good",
    image: "/images/macbook-air.png",
    specs: "12GB GDDR6X, DLSS 3, Ray Tracing Gen 3",
  },
  {
    id: "prod-3",
    name: "Keychron Q1 Pro Wireless Mechanical Keyboard",
    category: "Accessories",
    price: 3250,
    stock: 8,
    status: "Active",
    views: 142,
    soldCount: 11,
    updatedAt: "3 days ago",
    condition: "Like New",
    image: "/images/macbook-air.png",
    specs: "75% Layout, Hot-swappable, RGB Backlight",
  },
  {
    id: "prod-5",
    name: "Sony WH-1000XM5 Wireless Noise Cancelling",
    category: "Audio",
    price: 16500,
    stock: 1,
    status: "Active",
    views: 215,
    soldCount: 5,
    updatedAt: "4 days ago",
    condition: "Like New",
    image: "/images/macbook-air.png",
    specs: "Auto NC Optimizer, 30-hour battery, LDAC Hi-Res",
  },
  {
    id: "prod-6",
    name: "Apple MacBook Air 13.6\" M2 Chip 256GB Midnight",
    category: "Laptops",
    price: 38900,
    stock: 1,
    status: "Active",
    views: 420,
    soldCount: 6,
    updatedAt: "5 days ago",
    condition: "Like New",
    image: "/images/macbook-air.png",
    specs: "M2 8-core CPU, 8-core GPU, 8GB Unified RAM, 256GB SSD",
  },
  {
    id: "prod-7",
    name: "AMD Ryzen 7 7800X3D Desktop Processor",
    category: "Components",
    price: 14200,
    stock: 5,
    status: "Active",
    views: 198,
    soldCount: 8,
    updatedAt: "1 week ago",
    condition: "New",
    image: "/images/macbook-air.png",
    specs: "8 Cores, 16 Threads, 3D V-Cache, AM5 Socket",
  },
  {
    id: "prod-8",
    name: "Logitech G Pro X Superlight Wireless Mouse",
    category: "Gaming",
    price: 4100,
    stock: 0,
    status: "Sold Out",
    views: 280,
    soldCount: 14,
    updatedAt: "1 week ago",
    condition: "Good",
    image: "/images/macbook-air.png",
    specs: "<63g Ultra Lightweight, HERO 25K Sensor",
  },
  {
    id: "prod-9",
    name: "Corsair Vengeance RGB DDR5 32GB (2x16GB) 6000MHz",
    category: "Components",
    price: 5400,
    stock: 0,
    status: "Draft",
    views: 45,
    soldCount: 0,
    updatedAt: "2 weeks ago",
    condition: "New",
    image: "/images/macbook-air.png",
    specs: "CL30 Intel XMP 3.0 & AMD EXPO compatible",
  },
  {
    id: "prod-10",
    name: "SteelSeries Arctis Nova Pro Wireless Headset",
    category: "Audio",
    price: 12500,
    stock: 0,
    status: "Archived",
    views: 110,
    soldCount: 2,
    updatedAt: "3 weeks ago",
    condition: "Fair",
    image: "/images/macbook-air.png",
    specs: "Infinity Power System, Multi-System Connect",
  },
];
