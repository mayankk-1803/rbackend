import prisma from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createPaymentOrder } from "../services/paymentService.js";
import { logAction } from "../services/auditService.js";
import { logTransactionEvent } from "../services/transactionEventService.js";
import { recordFinancialEntry } from "../services/ledgerService.js";

// ==========================================
// MULTER IMAGE UPLOAD CONFIGURATION
// ==========================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `product-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp|gif/;
  const mimeType = allowedTypes.test(file.mimetype);
  const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());

  if (mimeType && extName) {
    return cb(null, true);
  }
  cb(new Error("Only images of type jpeg, jpg, png, webp or gif are allowed."));
};

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter
});

// Upload Product Images Controller
export const uploadImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "No files uploaded" });
    }

    const imageUrls = req.files.map(file => `/uploads/${file.filename}`);
    return res.json({
      success: true,
      urls: imageUrls
    });
  } catch (error) {
    console.error("[IMART UPLOAD ERROR]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Helper function to generate slug
const generateSlug = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove all non-word chars
    .replace(/\-\-+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start
    .replace(/-+$/, ""); // Trim - from end
};

// Virtual Attribute Formatting Helper
export const formatProduct = (product) => {
  if (!product) return null;
  let specs = {};
  if (product.specifications) {
    specs = typeof product.specifications === "string"
      ? JSON.parse(product.specifications)
      : product.specifications;
  }
  return {
    ...product,
    tags: specs.tags || ["quantum", "futuristic"],
    rating: specs.rating || 5.0,
    reviewsCount: specs.reviewsCount || 0,
    specifications: specs
  };
};

const IMART_GST_RATE_PERCENT = new Prisma.Decimal(18);
const IMART_GST_RATE = new Prisma.Decimal(0.18);

const money = (value) => new Prisma.Decimal(value || 0).toDecimalPlaces(2);
const moneyNumber = (value) => Number(money(value).toFixed(2));

const calculateIMartTotals = (items) => {
  const subtotal = items.reduce((sum, item) => {
    const price = item.price || item.product?.discountPrice || item.product?.price || 0;
    const quantity = item.quantity || 1;
    return sum.plus(new Prisma.Decimal(price).times(quantity));
  }, new Prisma.Decimal(0));

  const roundedSubtotal = money(subtotal);
  const gstAmount = money(roundedSubtotal.times(IMART_GST_RATE));
  const totalAmount = money(roundedSubtotal.plus(gstAmount));

  return {
    subtotalAmount: roundedSubtotal,
    gstAmount,
    gstRate: IMART_GST_RATE_PERCENT,
    totalAmount
  };
};

const buildOrderInvoiceSnapshot = (order, user, totals, paymentMeta) => ({
  invoiceId: order.invoiceId,
  orderId: order.id,
  orderDate: order.createdAt,
  paidAt: order.paidAt,
  customer: {
    id: user?.id,
    name: user?.name || "Customer",
    email: user?.email || null,
    phone: user?.phone || null
  },
  paymentStatus: order.paymentStatus,
  paymentMethod: paymentMeta.paymentMethod,
  gatewayRef: paymentMeta.gatewayRef,
  items: order.items.map(item => ({
    productId: item.productId,
    name: item.product?.name || "iMart Product",
    quantity: item.quantity,
    unitPrice: moneyNumber(item.price),
    totalPrice: moneyNumber(new Prisma.Decimal(item.price).times(item.quantity))
  })),
  subtotal: moneyNumber(totals.subtotalAmount),
  gstRate: moneyNumber(totals.gstRate),
  gstAmount: moneyNumber(totals.gstAmount),
  grandTotal: moneyNumber(totals.totalAmount)
});

const formatOrder = (order) => {
  const itemSubtotal = order.items
    ? order.items.reduce((sum, item) => sum.plus(new Prisma.Decimal(item.price || 0).times(item.quantity || 1)), new Prisma.Decimal(0))
    : new Prisma.Decimal(0);

  const subtotalAmount = money(order.subtotalAmount && !new Prisma.Decimal(order.subtotalAmount).isZero()
    ? order.subtotalAmount
    : itemSubtotal);
  const gstAmount = money(order.gstAmount || 0);
  const totalAmount = money(order.totalAmount || subtotalAmount.plus(gstAmount));

  return {
    ...order,
    subtotalAmount,
    gstAmount,
    gstRate: order.gstRate || IMART_GST_RATE_PERCENT,
    totalAmount,
    invoiceId: order.invoiceId || `IMART-${String(order.id).padStart(6, "0")}`,
    gatewayRef: order.gatewayRef || order.payment?.gatewayTxnId || null,
    paymentMethod: order.paymentMethod || (order.payment?.upiId ? "UPI" : null),
    items: order.items?.map(item => ({
      ...item,
      product: formatProduct(item.product)
    })) || []
  };
};

// Automatic Seeding System
let isSeeding = false;
export const autoSeedIMart = async () => {
  if (isSeeding) return;
  try {
    isSeeding = true;
    const seedCategories = [
      { name: "Smartphones", slug: "smartphones" },
      { name: "Laptops", slug: "laptops" },
      { name: "Audio", slug: "audio" },
      { name: "Gaming", slug: "gaming" },
      { name: "Accessories", slug: "accessories" },
      { name: "Smart Devices", slug: "smart-devices" }
    ];

    for (const category of seedCategories) {
      await prisma.category.upsert({
        where: { slug: category.slug },
        update: {},
        create: category
      });
    }

    const prodCount = await prisma.product.count();
    if (prodCount === 0) {
      console.log("[SEED] No products found, seeding 24 demo products...");
      const categories = await prisma.category.findMany();
      const catMap = {};
      categories.forEach(c => {
        catMap[c.slug] = c.id;
      });

      const demoProducts = [
        {
          name: "Apex Quantum Phone",
          slug: "apex-quantum-phone",
          description: "Next-gen communication device utilizing quantum superposition to maintain zero-latency interstellar links.",
          price: 89999,
          discountPrice: 79999,
          stock: 15,
          featured: true,
          categorySlug: "smartphones",
          images: [
            "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=600&q=80"
          ],
          specifications: {
            Brand: "Apex",
            Model: "Quantum X-1",
            Processor: "Qubit Core 9",
            RAM: "32GB Super-Conductor",
            Storage: "1TB Holographic",
            tags: ["quantum", "5G", "premium"],
            rating: 4.9,
            reviewsCount: 142
          }
        },
        {
          name: "Nova Horizon Fold",
          slug: "nova-horizon-fold",
          description: "A fluid holographic foldable display with biometric neural synchronization and atomic scratch protection.",
          price: 129999,
          discountPrice: 119999,
          stock: 8,
          featured: true,
          categorySlug: "smartphones",
          images: [
            "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=600&q=80"
          ],
          specifications: {
            Brand: "Nova",
            Model: "Horizon 2",
            Display: "7.8-inch Holographic OLED",
            Battery: "6000mAh Graphene",
            tags: ["foldable", "holographic", "future"],
            rating: 4.7,
            reviewsCount: 88
          }
        },
        {
          name: "Aether Slim 11",
          slug: "aether-slim-11",
          description: "An ultra-thin carbon-graphene smartphone with long-range wireless power transmission up to 10 meters distance.",
          price: 54999,
          discountPrice: 49999,
          stock: 24,
          featured: false,
          categorySlug: "smartphones",
          images: [
            "https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=600&q=80"
          ],
          specifications: {
            Brand: "Aether",
            Model: "Slim 11",
            Thickness: "3.2mm",
            Charging: "Tesla Wireless 3.0",
            tags: ["slim", "graphene", "wireless"],
            rating: 4.5,
            reviewsCount: 201
          }
        },
        {
          name: "Nebula Shift X",
          slug: "nebula-shift-x",
          description: "Features an active-chameleon electro-chromic exterior that dynamically adapts its color to match your surrounding environment.",
          price: 74999,
          discountPrice: null,
          stock: 12,
          featured: false,
          categorySlug: "smartphones",
          images: [
            "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=600&q=80"
          ],
          specifications: {
            Brand: "Nebula",
            Model: "Shift X",
            Shell: "Chameleon Glass v2",
            Camera: "200MP Sub-lux Sensor",
            tags: ["chameleon", "adaptive", "style"],
            rating: 4.6,
            reviewsCount: 56
          }
        },
        {
          name: "Zenith Quark Book",
          slug: "zenith-quark-book",
          description: "Equipped with a micro-fusion cooling loop and a 64-core holographic processing unit for intensive quantum operations.",
          price: 149999,
          discountPrice: 139999,
          stock: 5,
          featured: true,
          categorySlug: "laptops",
          images: [
            "https://images.unsplash.com/photo-1496181130204-7552cc14f1d0?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=600&q=80"
          ],
          specifications: {
            Brand: "Zenith",
            Model: "Quark Book Pro",
            Processor: "64-Core Fusion",
            RAM: "128GB LPDDR9",
            tags: ["laptop", "fusion", "powerhouse"],
            rating: 4.9,
            reviewsCount: 37
          }
        },
        {
          name: "Specter Blade 9",
          slug: "specter-blade-9",
          description: "Liquid-metal cooled gaming beast with a retinal-tracking viewport and carbon fiber exo-chassis.",
          price: 189999,
          discountPrice: 174999,
          stock: 10,
          featured: true,
          categorySlug: "laptops",
          images: [
            "https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=600&q=80"
          ],
          specifications: {
            Brand: "Specter",
            Model: "Blade 9 Extreme",
            GPU: "Quantum Ray Tracer v4",
            Display: "240Hz Micro-LED",
            tags: ["gaming", "beast", "liquid-metal"],
            rating: 4.8,
            reviewsCount: 64
          }
        },
        {
          name: "Cosmo Book Air",
          slug: "cosmo-book-air",
          description: "Eco-friendly synthetic mycelium body laptop with a solar energy harvesting lid and biological RAM.",
          price: 95000,
          discountPrice: 89999,
          stock: 20,
          featured: false,
          categorySlug: "laptops",
          images: [
            "https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1496181130204-7552cc14f1d0?auto=format&fit=crop&w=600&q=80"
          ],
          specifications: {
            Brand: "Cosmo",
            Model: "Book Air Bio",
            Chassis: "Mycelium Composite",
            Battery: "Solar assisted infinite life",
            tags: ["eco", "solar", "biodegradable"],
            rating: 4.4,
            reviewsCount: 112
          }
        },
        {
          name: "Singularity Pro Workstation",
          slug: "singularity-pro-workstation",
          description: "Heavy-duty computational machine built specifically for sub-atomic simulations and enterprise-grade quantum cryptography compiling.",
          price: 249999,
          discountPrice: null,
          stock: 3,
          featured: false,
          categorySlug: "laptops",
          images: [
            "https://images.unsplash.com/photo-1496181130204-7552cc14f1d0?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=600&q=80"
          ],
          specifications: {
            Brand: "Singularity",
            Model: "W-800",
            CORES: "256 Qubits",
            Weight: "4.5 kg",
            tags: ["workstation", "simulation", "cryptography"],
            rating: 5.0,
            reviewsCount: 19
          }
        },
        {
          name: "Pulse Sync Earbuds",
          slug: "pulse-sync-earbuds",
          description: "True-wireless spatial earbuds with real-time AI-powered active frequency dampening and direct cranial resonance.",
          price: 14999,
          discountPrice: 12999,
          stock: 45,
          featured: true,
          categorySlug: "audio",
          images: [
            "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=600&q=80"
          ],
          specifications: {
            Brand: "Pulse",
            Model: "Sync Earbuds v1",
            Battery: "48 Hours (with case)",
            Latency: "0.1 ms",
            tags: ["earbuds", "audio", "spatial"],
            rating: 4.8,
            reviewsCount: 310
          }
        },
        {
          name: "Acoustic Aura Headphones",
          slug: "acoustic-aura-headphones",
          description: "High-fidelity audiophile over-ear headphones with liquid crystal diaphragms and ambient echo-cancellation.",
          price: 29999,
          discountPrice: 24999,
          stock: 30,
          featured: false,
          categorySlug: "audio",
          images: [
            "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=600&q=80"
          ],
          specifications: {
            Brand: "Acoustic",
            Model: "Aura X-5",
            Drivers: "50mm Liquid Crystal",
            ANC: "45dB adaptive noise blocking",
            tags: ["audiophile", "anc", "comfort"],
            rating: 4.7,
            reviewsCount: 154
          }
        },
        {
          name: "Sonic Boom Soundbar",
          slug: "sonic-boom-soundbar",
          description: "Holographic speaker setup projecting spatial sound waves directly into your brain's auditory pathway.",
          price: 39999,
          discountPrice: null,
          stock: 15,
          featured: false,
          categorySlug: "audio",
          images: [
            "https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80"
          ],
          specifications: {
            Brand: "Sonic",
            Model: "Boom Soundbar",
            Channels: "11.1.4 virtual soundstage",
            Power: "600W RMS",
            tags: ["soundbar", "home-theater", "holographic"],
            rating: 4.6,
            reviewsCount: 42
          }
        },
        {
          name: "Vibe Mini Speaker",
          slug: "vibe-mini-speaker",
          description: "A pocket-sized sonic resonator that turns any flat surface into a high-bass room-filling speaker.",
          price: 7999,
          discountPrice: 6999,
          stock: 50,
          featured: false,
          categorySlug: "audio",
          images: [
            "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=600&q=80"
          ],
          specifications: {
            Brand: "Vibe",
            Model: "Mini Resonator",
            Connectivity: "Bluetooth 6.0",
            Battery: "12 Hours",
            tags: ["portable", "speaker", "resonance"],
            rating: 4.3,
            reviewsCount: 89
          }
        },
        {
          name: "Helix Core VR Set",
          slug: "helix-core-vr-set",
          description: "Direct neural-interface VR headset with full-body haptic feedback matrix and ultra-HD retina displays.",
          price: 79999,
          discountPrice: 69999,
          stock: 7,
          featured: true,
          categorySlug: "gaming",
          images: [
            "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=600&q=80"
          ],
          specifications: {
            Brand: "Helix",
            Model: "Core VR v3",
            Resolution: "12K combined",
            Tracking: "Retinal neural matrix",
            tags: ["vr", "gaming", "haptic"],
            rating: 4.9,
            reviewsCount: 77
          }
        },
        {
          name: "Vortex Arcade Console",
          slug: "vortex-arcade-console",
          description: "Multi-dimensional micro-console pre-loaded with classic and modern quantum-native arcade titles.",
          price: 44999,
          discountPrice: 39999,
          stock: 25,
          featured: false,
          categorySlug: "gaming",
          images: [
            "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=600&q=80"
          ],
          specifications: {
            Brand: "Vortex",
            Model: "Arcade Quantum",
            Games: "150 preloaded virtual titles",
            Storage: "2TB warp SSD",
            tags: ["console", "arcade", "quantum-games"],
            rating: 4.6,
            reviewsCount: 145
          }
        },
        {
          name: "Raptor Strike Controller",
          slug: "raptor-strike-controller",
          description: "Pro controller featuring magnetic levitation analog sticks and dynamic haptic tactile triggers.",
          price: 8999,
          discountPrice: 7999,
          stock: 40,
          featured: false,
          categorySlug: "gaming",
          images: [
            "https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=600&q=80"
          ],
          specifications: {
            Brand: "Raptor",
            Model: "Strike Pro",
            Sticks: "Mag-Lev Hall Effect",
            Battery: "30 Hours",
            tags: ["controller", "pro", "hall-effect"],
            rating: 4.8,
            reviewsCount: 220
          }
        },
        {
          name: "Hyperion Throne Cockpit",
          slug: "hyperion-throne-cockpit",
          description: "Zero-gravity suspended gaming chair with integrated panoramic curved displays and automated atmospheric control.",
          price: 199999,
          discountPrice: null,
          stock: 2,
          featured: true,
          categorySlug: "gaming",
          images: [
            "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=600&q=80"
          ],
          specifications: {
            Brand: "Hyperion",
            Model: "Throne Z-G",
            Suspension: "Magnetic Levitating",
            Climate: "Thermo-regulated active shell",
            tags: ["gaming-chair", "zero-g", "luxury"],
            rating: 5.0,
            reviewsCount: 8
          }
        },
        {
          name: "Chronos Titan Strap",
          slug: "chronos-titan-strap",
          description: "Indestructible space-grade titanium strap with built-in NFC transponder and health telemetry bio-sensors.",
          price: 4999,
          discountPrice: null,
          stock: 100,
          featured: false,
          categorySlug: "accessories",
          images: [
            "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=600&q=80"
          ],
          specifications: {
            Brand: "Chronos",
            Model: "Titan",
            Material: "Titanium Alloy Tier 5",
            Sensors: "ECG, SPO2, Heart Rate",
            tags: ["strap", "titanium", "sensors"],
            rating: 4.4,
            reviewsCount: 198
          }
        },
        {
          name: "Nova Charge Hub",
          slug: "nova-charge-hub",
          description: "Multi-port gallium nitride charger distributing up to 300W of clean energy to 6 devices simultaneously.",
          price: 9999,
          discountPrice: 8499,
          stock: 60,
          featured: false,
          categorySlug: "accessories",
          images: [
            "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=600&q=80"
          ],
          specifications: {
            Brand: "Nova",
            Model: "Charge 300W",
            Material: "GaN Pro",
            Ports: "4x USB-C, 2x USB-A",
            tags: ["charger", "gan", "300W"],
            rating: 4.7,
            reviewsCount: 231
          }
        },
        {
          name: "Warp Drive SSD",
          slug: "warp-drive-ssd",
          description: "10TB pocket solid-state drive operating at near-instant lightspeed read/write transfers.",
          price: 18999,
          discountPrice: 16999,
          stock: 35,
          featured: true,
          categorySlug: "accessories",
          images: [
            "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=600&q=80"
          ],
          specifications: {
            Brand: "Warp",
            Model: "Drive 10T",
            Speed: "15,000 MB/s read",
            Capacity: "10TB",
            tags: ["ssd", "storage", "fast"],
            rating: 4.9,
            reviewsCount: 92
          }
        },
        {
          name: "Aether Glass Screen Protector",
          slug: "aether-glass-screen-protector",
          description: "Self-healing smart nano-glass screen protector that repairs micro-scratches within 3 seconds under ambient light.",
          price: 1999,
          discountPrice: 1499,
          stock: 150,
          featured: false,
          categorySlug: "accessories",
          images: [
            "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=600&q=80"
          ],
          specifications: {
            Brand: "Aether",
            Model: "Glass Shield",
            Material: "Self-healing Smart Nano Glass",
            tags: ["screen-protector", "glass", "self-healing"],
            rating: 4.5,
            reviewsCount: 405
          }
        },
        {
          name: "Orbit Drone Spy",
          slug: "orbit-drone-spy",
          description: "Micro-drone utilizing ionic electro-hydrodynamic propulsion for near-silent indoor and outdoor monitoring.",
          price: 24999,
          discountPrice: 21999,
          stock: 18,
          featured: false,
          categorySlug: "smart-devices",
          images: [
            "https://images.unsplash.com/photo-1507646227500-4d389b0012be?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1558089687-f282ffcbd1d5?auto=format&fit=crop&w=600&q=80"
          ],
          specifications: {
            Brand: "Orbit",
            Model: "Spy Drone",
            FlightTime: "60 Minutes",
            Propulsion: "Ionic No-Blade",
            tags: ["drone", "spy", "silent"],
            rating: 4.6,
            reviewsCount: 33
          }
        },
        {
          name: "Helios Solar Lantern",
          slug: "helios-solar-lantern",
          description: "High-intensity outdoor lamp equipped with high-efficiency photovoltaic cells and USB-C powerbank output.",
          price: 5999,
          discountPrice: 4999,
          stock: 70,
          featured: false,
          categorySlug: "smart-devices",
          images: [
            "https://images.unsplash.com/photo-1558089687-f282ffcbd1d5?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80"
          ],
          specifications: {
            Brand: "Helios",
            Model: "Solar L-100",
            Brightness: "2000 Lumens",
            Battery: "10000mAh",
            tags: ["solar", "lantern", "outdoor"],
            rating: 4.5,
            reviewsCount: 76
          }
        },
        {
          name: "Nano Purifier Mask",
          slug: "nano-purifier-mask",
          description: "Active respirator using electro-static smart nano-mesh to filter out 99.99% of airborne particles and pollutants.",
          price: 9999,
          discountPrice: null,
          stock: 40,
          featured: false,
          categorySlug: "smart-devices",
          images: [
            "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1507646227500-4d389b0012be?auto=format&fit=crop&w=600&q=80"
          ],
          specifications: {
            Brand: "NanoPurify",
            Model: "Mask Elite",
            Filter: "Active Electro-static N99.99",
            Battery: "8 Hours",
            tags: ["mask", "purifier", "nano-tech"],
            rating: 4.3,
            reviewsCount: 19
          }
        },
        {
          name: "Omni Hub Station",
          slug: "omni-hub-station",
          description: "Smart home core controlling lighting, temperature, and security via voice and direct neural synchronization.",
          price: 34999,
          discountPrice: 29999,
          stock: 12,
          featured: true,
          categorySlug: "smart-devices",
          images: [
            "https://images.unsplash.com/photo-1507646227500-4d389b0012be?auto=format&fit=crop&w=600&q=80",
            "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80"
          ],
          specifications: {
            Brand: "Omni",
            Model: "Hub Station v2",
            Connectivity: "ZigBee 4.0, Thread, Matter",
            AI: "Omni Assistant Local Mode",
            tags: ["hub", "smart-home", "ai-controlled"],
            rating: 4.8,
            reviewsCount: 154
          }
        }
      ];

      for (const prod of demoProducts) {
        const categoryId = catMap[prod.categorySlug];
        if (!categoryId) continue;

        await prisma.product.upsert({
          where: { slug: prod.slug },
          update: {},
          create: {
            name: prod.name,
            slug: prod.slug,
            description: prod.description,
            price: new Prisma.Decimal(prod.price),
            discountPrice: prod.discountPrice ? new Prisma.Decimal(prod.discountPrice) : null,
            stock: prod.stock,
            featured: prod.featured,
            categoryId: categoryId,
            specifications: prod.specifications,
            images: {
              create: prod.images.map(url => ({ url }))
            }
          }
        });
      }
      console.log("[SEED] Demo products seeded successfully!");
    }
  } catch (err) {
    console.error("[SEED ERROR]:", err);
  } finally {
    isSeeding = false;
  }
};

// ==========================================
// PUBLIC & USER CATALOG APIS
// ==========================================

// Get all categories
export const getCategories = async (req, res) => {
  try {
    await autoSeedIMart();
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" }
    });
    return res.json({ success: true, data: categories });
  } catch (error) {
    console.error("[GET CATEGORIES ERROR]:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch categories" });
  }
};

// Get products (with filters)
export const getProducts = async (req, res) => {
  try {
    await autoSeedIMart();
    const { categorySlug, featured, search } = req.query;

    const where = {};

    if (categorySlug) {
      where.category = { slug: categorySlug };
    }

    if (featured === "true") {
      where.featured = true;
    }

    if (search) {
      where.name = { contains: search };
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        images: true
      },
      orderBy: { createdAt: "desc" }
    });

    return res.json({ success: true, data: products.map(formatProduct) });
  } catch (error) {
    console.error("[GET PRODUCTS ERROR]:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch products" });
  }
};

// Get product details by slug
export const getProductBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        category: true,
        images: true
      }
    });

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    return res.json({ success: true, data: formatProduct(product) });
  } catch (error) {
    console.error("[GET PRODUCT ERROR]:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch product details" });
  }
};


// ==========================================
// WISHLIST MANAGEMENT APIS
// ==========================================

// Get user wishlist
export const getWishlist = async (req, res) => {
  try {
    const userId = req.user.id;

    let wishlist = await prisma.wishlist.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: true
              }
            }
          }
        }
      }
    });

    if (!wishlist) {
      wishlist = await prisma.wishlist.create({
        data: { userId },
        include: {
          items: {
            include: {
              product: {
                include: {
                  images: true
                }
              }
            }
          }
        }
      });
    }

    if (wishlist && wishlist.items) {
      wishlist.items = wishlist.items.map(item => ({
        ...item,
        product: formatProduct(item.product)
      }));
    }

    return res.json({ success: true, data: wishlist });
  } catch (error) {
    console.error("[GET WISHLIST ERROR]:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch wishlist" });
  }
};

// Add product to wishlist
export const addToWishlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, message: "productId is required" });
    }

    let wishlist = await prisma.wishlist.findUnique({
      where: { userId }
    });

    if (!wishlist) {
      wishlist = await prisma.wishlist.create({
        data: { userId }
      });
    }

    await prisma.wishlistItem.upsert({
      where: {
        wishlistId_productId: {
          wishlistId: wishlist.id,
          productId: Number(productId)
        }
      },
      create: {
        wishlistId: wishlist.id,
        productId: Number(productId)
      },
      update: {}
    });

    return res.json({ success: true, message: "Product added to wishlist" });
  } catch (error) {
    console.error("[ADD WISHLIST ERROR]:", error);
    return res.status(500).json({ success: false, message: "Failed to add to wishlist" });
  }
};

// Remove product from wishlist
export const removeFromWishlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({ success: false, message: "productId is required" });
    }

    const wishlist = await prisma.wishlist.findUnique({
      where: { userId }
    });

    if (!wishlist) {
      return res.status(404).json({ success: false, message: "Wishlist not found" });
    }

    await prisma.wishlistItem.deleteMany({
      where: {
        wishlistId: wishlist.id,
        productId: Number(productId)
      }
    });

    return res.json({ success: true, message: "Product removed from wishlist" });
  } catch (error) {
    console.error("[REMOVE WISHLIST ERROR]:", error);
    return res.status(500).json({ success: false, message: "Failed to remove from wishlist" });
  }
};


// ==========================================
// CHECKOUT / ORDER APIS
// ==========================================

export const createCheckout = async (req, res) => {
  try {
    const userId = req.user.id;
    const rawPaymentMethod = String(req.body?.paymentMethod || "UPI").toUpperCase();
    const allowedPaymentMethods = new Set(["UPI", "CARD", "NETBANKING", "WALLET"]);
    const paymentMethod = allowedPaymentMethods.has(rawPaymentMethod) ? rawPaymentMethod : "UPI";

    const wishlist = await prisma.wishlist.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: true
              }
            }
          }
        }
      }
    });

    if (!wishlist || wishlist.items.length === 0) {
      return res.status(400).json({ success: false, message: "Your wishlist/cart is empty" });
    }

    // 1. Validate products, stock, and calculate totals.
    const orderItemsData = [];

    for (const item of wishlist.items) {
      if (!item.product) {
        return res.status(404).json({ success: false, message: "Product not found." });
      }
      if (item.product.stock < 1) {
        return res.status(400).json({
          success: false,
          message: `Product '${item.product.name}' is out of stock`
        });
      }
      const price = item.product.discountPrice || item.product.price;
      if (!price || Number(price) <= 0) {
        return res.status(400).json({ success: false, message: `Product '${item.product.name}' has invalid price` });
      }
      orderItemsData.push({
        productId: item.product.id,
        price: new Prisma.Decimal(price),
        quantity: 1
      });
    }

    const totals = calculateIMartTotals(orderItemsData);
    const amount = totals.totalAmount;

    // Generate idempotency key for payment order
    const randomHex = crypto.randomBytes(4).toString("hex");
    const idempotencyKey = `imart_${Date.now()}_${userId}_${randomHex}`;

    // Create payment order via Nexgate gateway
    const paymentResult = await createPaymentOrder(
      userId,
      Number(amount),
      idempotencyKey,
      null,
      "IMART"
    );

    if (!paymentResult || !paymentResult.success) {
      return res.status(400).json({
        success: false,
        message: paymentResult?.message || "Failed to initialize payment gateway order."
      });
    }

    const paymentId = paymentResult.id || paymentResult.orderId;
    const gatewayRef = paymentResult.gatewayTxnId || "";
    const paymentUrl = paymentResult.paymentUrl || paymentResult.payment_url;

    const invoiceId = `INV-IMART-${Date.now()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

    // Create Order with PENDING_PAYMENT status
    const order = await prisma.order.create({
      data: {
        userId,
        subtotalAmount: totals.subtotalAmount,
        gstAmount: totals.gstAmount,
        gstRate: totals.gstRate,
        totalAmount: totals.totalAmount,
        paymentId: paymentId,
        paymentStatus: "PENDING_PAYMENT",
        status: "PENDING",
        gatewayRef,
        paymentMethod,
        invoiceId,
        items: {
          create: orderItemsData.map(item => ({
            productId: item.productId,
            price: item.price,
            quantity: item.quantity
          }))
        }
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    // Create a pending Transaction Record (User side)
    await prisma.transaction.create({
      data: {
        userId,
        amount: totals.totalAmount,
        type: "IMART_BUY",
        status: "PENDING",
        direction: "DEBIT",
        gatewayTxnId: gatewayRef || null,
        description: `iMart purchase pending | Order: ${order.id}`,
        idempotencyKey: `checkout:${paymentId}`,
        financialSequenceId: `CHKF-${order.id}-${Date.now()}`
      }
    });

    return res.json({
      success: true,
      order: formatOrder(order),
      paymentUrl,
      payment: {
        success: true,
        provider: "NEXGATE",
        status: "PENDING",
        gatewayRef,
        paymentMethod,
        amount: moneyNumber(totals.totalAmount),
        subtotalAmount: moneyNumber(totals.subtotalAmount),
        gstRate: moneyNumber(totals.gstRate),
        gstAmount: moneyNumber(totals.gstAmount),
        paymentUrl
      }
    });
  } catch (error) {
    console.error("[IMART CHECKOUT ERROR]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get user orders list
export const getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const orders = await prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: true
              }
            }
          }
        },
        payment: true
      },
      orderBy: { createdAt: "desc" }
    });

    const formattedOrders = orders.map(formatOrder);

    return res.json({ success: true, data: formattedOrders });
  } catch (error) {
    console.error("[GET USER ORDERS ERROR]:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch orders" });
  }
};


// ==========================================
// ADMIN APIS: CATEGORIES
// ==========================================

export const createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "name is required" });

    const slug = generateSlug(name);

    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) {
      return res.status(400).json({ success: false, message: "A category with this name already exists" });
    }

    const category = await prisma.category.create({
      data: { name, slug }
    });

    return res.json({ success: true, data: category });
  } catch (error) {
    console.error("[CREATE CATEGORY ERROR]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) return res.status(400).json({ success: false, message: "name is required" });

    const slug = generateSlug(name);

    const category = await prisma.category.update({
      where: { id: Number(id) },
      data: { name, slug }
    });

    return res.json({ success: true, data: category });
  } catch (error) {
    console.error("[UPDATE CATEGORY ERROR]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if category contains products
    const productsCount = await prisma.product.count({
      where: { categoryId: Number(id) }
    });

    if (productsCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete category containing products. Reassign the products first."
      });
    }

    await prisma.category.delete({
      where: { id: Number(id) }
    });

    return res.json({ success: true, message: "Category deleted successfully" });
  } catch (error) {
    console.error("[DELETE CATEGORY ERROR]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};


// ==========================================
// ADMIN APIS: PRODUCTS
// ==========================================

export const createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      specifications,
      price,
      discountPrice,
      stock,
      categoryId,
      featured,
      images
    } = req.body;

    if (!name || !description || !price || !categoryId) {
      return res.status(400).json({ success: false, message: "Required fields: name, description, price, categoryId" });
    }

    const slug = generateSlug(name);
    const existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) {
      return res.status(400).json({ success: false, message: "A product with this name already exists" });
    }

    // Create product
    const product = await prisma.product.create({
      data: {
        name,
        slug,
        description,
        specifications: specifications ? specifications : Prisma.DbNull,
        price: new Prisma.Decimal(price),
        discountPrice: discountPrice ? new Prisma.Decimal(discountPrice) : null,
        stock: Number(stock) || 0,
        categoryId: Number(categoryId),
        featured: featured === true || featured === "true",
        images: {
          create: (images || []).map(url => ({ url }))
        }
      },
      include: {
        category: true,
        images: true
      }
    });

    return res.json({ success: true, data: formatProduct(product) });
  } catch (error) {
    console.error("[CREATE PRODUCT ERROR]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      specifications,
      price,
      discountPrice,
      stock,
      categoryId,
      featured,
      images
    } = req.body;

    const slug = name ? generateSlug(name) : undefined;

    // Delete existing images first and recreate if new ones are passed
    if (images) {
      await prisma.productImage.deleteMany({
        where: { productId: Number(id) }
      });
    }

    const updateData = {
      ...(name && { name, slug }),
      ...(description && { description }),
      ...(specifications !== undefined && { specifications: specifications ? specifications : Prisma.DbNull }),
      ...(price && { price: new Prisma.Decimal(price) }),
      ...(discountPrice !== undefined && { discountPrice: discountPrice ? new Prisma.Decimal(discountPrice) : null }),
      ...(stock !== undefined && { stock: Number(stock) }),
      ...(categoryId && { categoryId: Number(categoryId) }),
      ...(featured !== undefined && { featured: featured === true || featured === "true" }),
      ...(images && {
        images: {
          create: images.map(url => ({ url }))
        }
      })
    };

    const product = await prisma.product.update({
      where: { id: Number(id) },
      data: updateData,
      include: {
        category: true,
        images: true
      }
    });

    return res.json({ success: true, data: formatProduct(product) });
  } catch (error) {
    console.error("[UPDATE PRODUCT ERROR]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    // Delete related ProductImages automatically due to Cascade configuration
    await prisma.product.delete({
      where: { id: Number(id) }
    });

    return res.json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    console.error("[DELETE PRODUCT ERROR]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};


// ==========================================
// ADMIN APIS: ORDERS
// ==========================================

export const getAdminOrders = async (req, res) => {
  try {
    const { status } = req.query;

    const where = {};
    if (status) {
      where.status = status;
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        items: {
          include: {
            product: true
          }
        },
        payment: true
      },
      orderBy: { createdAt: "desc" }
    });

    const formattedOrders = orders.map(formatOrder);

    return res.json({ success: true, data: formattedOrders });
  } catch (error) {
    console.error("[GET ADMIN ORDERS ERROR]:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch orders" });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: "status is required" });
    }

    const order = await prisma.order.update({
      where: { id: Number(id) },
      data: { status },
      include: {
        user: true,
        items: {
          include: {
            product: true
          }
        },
        payment: true
      }
    });

    const formattedOrder = formatOrder(order);

    return res.json({ success: true, data: formattedOrder });
  } catch (error) {
    console.error("[UPDATE ORDER STATUS ERROR]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const handleOrderRefund = async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const { action, amount, remarks } = req.body;
    const adminId = req.user.id;

    if (isNaN(orderId)) {
      return res.status(400).json({ success: false, message: "Invalid Order ID" });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true, payment: true }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || "127.0.0.1";
    const userAgent = req.headers['user-agent'] || "admin-terminal";

    // 1. Maker-Checker / Action Router
    if (action === "REQUEST_FULL" || action === "REQUEST_PARTIAL" || action === "REQUEST") {
      const refundAmount = action === "REQUEST_PARTIAL" ? parseFloat(amount) : Number(order.totalAmount);
      if (isNaN(refundAmount) || refundAmount <= 0 || refundAmount > Number(order.totalAmount)) {
        return res.status(400).json({ success: false, message: "Invalid refund amount" });
      }

      await prisma.order.update({
        where: { id: orderId },
        data: { paymentStatus: "REFUND_PENDING" }
      });

      const txn = await prisma.transaction.findFirst({
        where: { userId: order.userId, gatewayTxnId: order.gatewayRef || String(order.paymentId) }
      });

      if (txn) {
        await logTransactionEvent(txn.id, "REFUND_REQUESTED", {
          amount: refundAmount,
          requestedBy: adminId,
          remarks: remarks || "Refund requested by Admin"
        });
      }

      await logAction({
        action: "IMART_REFUND_REQUESTED",
        adminId,
        userId: order.userId,
        entity: "order",
        entityId: orderId,
        details: { orderId, refundAmount, remarks },
        req
      });

      return res.json({ success: true, message: "Refund request submitted successfully. Status updated to REFUND_PENDING." });
    }

    if (action === "REJECT") {
      if (order.paymentStatus !== "REFUND_PENDING") {
        return res.status(400).json({ success: false, message: "Only orders in REFUND_PENDING status can be rejected." });
      }

      await prisma.order.update({
        where: { id: orderId },
        data: { paymentStatus: "PAID" }
      });

      const txn = await prisma.transaction.findFirst({
        where: { userId: order.userId, gatewayTxnId: order.gatewayRef || String(order.paymentId) }
      });

      if (txn) {
        await logTransactionEvent(txn.id, "REFUND_REJECTED", {
          rejectedBy: adminId,
          remarks: remarks || "Refund rejected by Admin"
        });
      }

      await logAction({
        action: "IMART_REFUND_REJECTED",
        adminId,
        userId: order.userId,
        entity: "order",
        entityId: orderId,
        details: { orderId, remarks },
        req
      });

      return res.json({ success: true, message: "Refund request rejected. Status restored to PAID." });
    }

    if (action === "FULL" || action === "PARTIAL" || action === "APPROVE") {
      let refundAmount = 0;

      if (action === "APPROVE") {
        if (order.paymentStatus !== "REFUND_PENDING") {
          return res.status(400).json({ success: false, message: "Only orders in REFUND_PENDING status can be approved." });
        }
        const txn = await prisma.transaction.findFirst({
          where: { userId: order.userId, gatewayTxnId: order.gatewayRef || String(order.paymentId) }
        });
        const timeline = txn?.invoiceSnapshot?.timeline || [];
        // clone and reverse timeline to find the last request event
        const timelineClone = [...timeline];
        const requestEvent = timelineClone.reverse().find(e => e.event === "REFUND_REQUESTED");
        refundAmount = requestEvent?.details?.amount ? parseFloat(requestEvent.details.amount) : Number(order.totalAmount);
      } else {
        refundAmount = action === "PARTIAL" ? parseFloat(amount) : Number(order.totalAmount);
      }

      if (isNaN(refundAmount) || refundAmount <= 0 || refundAmount > Number(order.totalAmount)) {
        return res.status(400).json({ success: false, message: "Invalid refund amount" });
      }

      await prisma.$transaction(async (tx) => {
        const refundTxn = await tx.transaction.create({
          data: {
            userId: order.userId,
            amount: new Prisma.Decimal(refundAmount),
            type: "REFUND",
            status: "SUCCESS",
            direction: "CREDIT",
            gatewayTxnId: `REFUND-${orderId}-${Date.now()}`,
            balanceAfter: new Prisma.Decimal(0),
            description: remarks ? `${remarks} (Order #${orderId})` : `Refund for iMart Order #${orderId}`,
            idempotencyKey: `refund:${orderId}:${Date.now()}`,
            financialSequenceId: `RFND-${orderId}-${Date.now()}`
          }
        });

        const { balanceAfter } = await recordFinancialEntry({
          userId: order.userId,
          amount: refundAmount,
          type: "REFUND_CREDIT",
          transactionId: refundTxn.id,
          description: remarks ? `${remarks} (Order #${orderId})` : `Refund for iMart Order #${orderId}`,
          metadata: {
            source: "IMART_REFUND",
            orderId: String(orderId),
            adminId: String(adminId)
          },
          context: { ipAddress, userAgent, correlationId: `RFND-${orderId}` },
          tx
        });

        await tx.transaction.update({
          where: { id: refundTxn.id },
          data: { balanceAfter }
        });

        const finalPaymentStatus = (refundAmount === Number(order.totalAmount)) ? "REFUNDED" : "PARTIALLY_REFUNDED";
        await tx.order.update({
          where: { id: orderId },
          data: { paymentStatus: finalPaymentStatus, status: "CANCELLED" }
        });
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      });

      const txn = await prisma.transaction.findFirst({
        where: { userId: order.userId, gatewayTxnId: order.gatewayRef || String(order.paymentId) }
      });

      if (txn) {
        await logTransactionEvent(txn.id, "REFUNDED", {
          amount: refundAmount,
          approvedBy: adminId,
          remarks: remarks || "Refund processed successfully"
        });
      }

      await logAction({
        action: "IMART_ORDER_REFUNDED",
        adminId,
        userId: order.userId,
        entity: "order",
        entityId: orderId,
        details: { orderId, refundAmount, remarks },
        req
      });

      return res.json({ success: true, message: `Refund of ₹${refundAmount} processed successfully.` });
    }

    return res.status(400).json({ success: false, message: "Invalid action. Supported actions: REQUEST_FULL, REQUEST_PARTIAL, APPROVE, REJECT, FULL, PARTIAL." });
  } catch (error) {
    console.error("[IMART REFUND ERROR]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
