export const DEMO_CATEGORIES = [
  { id: 101, name: "Smartphones", slug: "smartphones" },
  { id: 102, name: "Laptops", slug: "laptops" },
  { id: 103, name: "Gaming", slug: "gaming" },
  { id: 104, name: "Audio", slug: "audio" },
  { id: 105, name: "Accessories", slug: "accessories" },
  { id: 106, name: "Smart Devices", slug: "smart-devices" }
];

const imageFor = (query) =>
  `https://source.unsplash.com/900x700/?${encodeURIComponent(query)}`;

const product = (id, category, name, slug, price, discountPrice, stock, featured, image, specs) => ({
  id,
  name,
  slug,
  description: specs.description,
  price,
  discountPrice,
  stock,
  featured,
  category: DEMO_CATEGORIES.find((item) => item.slug === category),
  categoryId: DEMO_CATEGORIES.find((item) => item.slug === category)?.id,
  images: [{ url: imageFor(image) }],
  tags: specs.tags,
  rating: specs.rating,
  reviewsCount: specs.reviewsCount,
  specifications: specs
});

export const DEMO_PRODUCTS = [
  product(1001, "smartphones", "Apex Quantum Phone", "apex-quantum-phone", 89999, 79999, 15, true, "premium smartphone", {
    description: "Flagship 5G smartphone with titanium body, adaptive AI camera, and all-day graphene battery.",
    Brand: "Apex", Processor: "Qubit Core 9", RAM: "16GB", Storage: "1TB", tags: ["5G", "premium", "ai-camera"], rating: 4.9, reviewsCount: 142
  }),
  product(1002, "smartphones", "Nova Horizon Fold", "nova-horizon-fold", 129999, 119999, 8, true, "foldable phone", {
    description: "Foldable AMOLED workstation phone with seamless multitasking, satellite standby, and pro-grade camera tuning.",
    Brand: "Nova", Display: "7.8 inch Fold OLED", Battery: "6000mAh", Charging: "80W", tags: ["foldable", "satellite", "amoled"], rating: 4.7, reviewsCount: 88
  }),
  product(1003, "smartphones", "Aether Slim 11", "aether-slim-11", 54999, 49999, 24, false, "thin smartphone", {
    description: "Ultra-slim carbon phone with strong battery endurance, crisp display, and enterprise secure enclave.",
    Brand: "Aether", Thickness: "6.2mm", Camera: "108MP", Security: "Secure Enclave", tags: ["slim", "secure", "lightweight"], rating: 4.5, reviewsCount: 201
  }),
  product(1004, "smartphones", "Nebula Shift X", "nebula-shift-x", 74999, null, 12, false, "colorful smartphone", {
    description: "Premium performance phone with color-shift glass, studio portrait imaging, and bright outdoor display.",
    Brand: "Nebula", Shell: "Chameleon Glass", Camera: "200MP", Display: "2K LTPO", tags: ["camera", "ltpo", "style"], rating: 4.6, reviewsCount: 56
  }),
  product(1005, "laptops", "Zenith Quark Book", "zenith-quark-book", 149999, 139999, 5, true, "premium laptop", {
    description: "Creator laptop with high-core CPU, calibrated display, silent vapor cooling, and encrypted storage.",
    Brand: "Zenith", Processor: "64-Core Fusion", RAM: "64GB", Storage: "2TB SSD", tags: ["creator", "workstation", "oled"], rating: 4.9, reviewsCount: 37
  }),
  product(1006, "laptops", "Specter Blade 9", "specter-blade-9", 189999, 174999, 10, true, "gaming laptop", {
    description: "High-refresh gaming laptop with advanced cooling, ray tracing graphics, and tactile mechanical keyboard.",
    Brand: "Specter", GPU: "RTX Quantum", Display: "240Hz Mini LED", Cooling: "Liquid Metal", tags: ["gaming", "240hz", "rtx"], rating: 4.8, reviewsCount: 64
  }),
  product(1007, "laptops", "Cosmo Book Air", "cosmo-book-air", 95000, 89999, 20, false, "ultrabook laptop", {
    description: "Thin executive ultrabook with long battery life, magnesium shell, and privacy-first conferencing.",
    Brand: "Cosmo", Battery: "22 Hours", Weight: "1.1 kg", Webcam: "4K PrivacyCam", tags: ["ultrabook", "business", "battery"], rating: 4.4, reviewsCount: 112
  }),
  product(1008, "laptops", "Singularity Pro Workstation", "singularity-pro-workstation", 249999, null, 3, false, "mobile workstation", {
    description: "Heavy-duty mobile workstation for rendering, analytics, simulation, and secure enterprise development.",
    Brand: "Singularity", CPU: "32-Core Pro", GPU: "Studio Max", RAM: "128GB ECC", tags: ["workstation", "studio", "ecc"], rating: 5, reviewsCount: 19
  }),
  product(1009, "audio", "Pulse Sync Earbuds", "pulse-sync-earbuds", 14999, 12999, 45, true, "wireless earbuds", {
    description: "Spatial audio earbuds with adaptive ANC, low-latency gaming mode, and clear voice pickup.",
    Brand: "Pulse", Battery: "48 Hours", ANC: "Adaptive", Latency: "45ms", tags: ["earbuds", "anc", "spatial"], rating: 4.8, reviewsCount: 310
  }),
  product(1010, "audio", "Acoustic Aura Headphones", "acoustic-aura-headphones", 29999, 24999, 30, false, "premium headphones", {
    description: "High-fidelity over-ear headphones with plush memory foam, lossless wireless, and travel-grade ANC.",
    Brand: "Acoustic", Drivers: "50mm Crystal", Codec: "Lossless", ANC: "45dB", tags: ["audiophile", "lossless", "comfort"], rating: 4.7, reviewsCount: 154
  }),
  product(1011, "audio", "Sonic Boom Soundbar", "sonic-boom-soundbar", 39999, null, 15, false, "soundbar home theater", {
    description: "Compact home theater soundbar with virtual surround, wireless subwoofer pairing, and voice clarity mode.",
    Brand: "Sonic", Channels: "7.1 Virtual", Power: "600W", HDMI: "eARC", tags: ["soundbar", "home-theater", "earc"], rating: 4.6, reviewsCount: 42
  }),
  product(1012, "audio", "Vibe Mini Speaker", "vibe-mini-speaker", 7999, 6999, 50, false, "portable speaker", {
    description: "Pocket wireless speaker with rugged shell, punchy bass, and stereo pairing for travel setups.",
    Brand: "Vibe", Battery: "16 Hours", WaterProof: "IP67", Connectivity: "Bluetooth 6", tags: ["portable", "speaker", "ip67"], rating: 4.3, reviewsCount: 89
  }),
  product(1013, "gaming", "Helix Core VR Set", "helix-core-vr-set", 79999, 69999, 7, true, "vr headset", {
    description: "Immersive VR headset with inside-out tracking, high resolution panels, and precise controllers.",
    Brand: "Helix", Resolution: "6K Combined", Tracking: "Inside-out", Refresh: "120Hz", tags: ["vr", "gaming", "immersive"], rating: 4.9, reviewsCount: 77
  }),
  product(1014, "gaming", "Vortex Arcade Console", "vortex-arcade-console", 44999, 39999, 25, false, "gaming console", {
    description: "Compact console with fast SSD, cloud sync, crisp 4K output, and a curated game library.",
    Brand: "Vortex", Storage: "2TB SSD", Output: "4K HDR", Library: "150 Titles", tags: ["console", "4k", "arcade"], rating: 4.6, reviewsCount: 145
  }),
  product(1015, "gaming", "Raptor Strike Controller", "raptor-strike-controller", 8999, 7999, 40, false, "game controller", {
    description: "Pro controller with hall-effect sticks, remappable paddles, and precise haptic triggers.",
    Brand: "Raptor", Sticks: "Hall Effect", Battery: "30 Hours", Triggers: "Adaptive", tags: ["controller", "pro", "haptic"], rating: 4.8, reviewsCount: 220
  }),
  product(1016, "gaming", "Hyperion Throne Cockpit", "hyperion-throne-cockpit", 199999, null, 2, true, "gaming chair cockpit", {
    description: "Premium gaming cockpit with ergonomic recline, integrated lighting, and modular monitor mounts.",
    Brand: "Hyperion", Frame: "Aluminum", Lighting: "RGB Matrix", Mounts: "Triple Display", tags: ["cockpit", "sim", "luxury"], rating: 5, reviewsCount: 8
  }),
  product(1017, "accessories", "Chronos Titan Strap", "chronos-titan-strap", 4999, null, 100, false, "smartwatch strap", {
    description: "Space-grade titanium watch strap with quick release links and embedded NFC accessory profile.",
    Brand: "Chronos", Material: "Titanium", Fit: "Universal 22mm", NFC: "Enabled", tags: ["strap", "titanium", "watch"], rating: 4.4, reviewsCount: 198
  }),
  product(1018, "accessories", "Nova Charge Hub", "nova-charge-hub", 6999, 5999, 60, true, "charging hub", {
    description: "Compact GaN charging hub with multi-device fast charging, thermal control, and travel plug kit.",
    Brand: "Nova", Output: "140W", Ports: "4 USB-C", Safety: "Thermal Guard", tags: ["charger", "gan", "travel"], rating: 4.8, reviewsCount: 253
  }),
  product(1019, "accessories", "Warp Drive SSD", "warp-drive-ssd", 12999, 10999, 35, false, "external ssd", {
    description: "Portable encrypted SSD for fast backups, media editing, and secure daily carry storage.",
    Brand: "Warp", Capacity: "2TB", Speed: "2200MB/s", Security: "AES 256", tags: ["ssd", "storage", "encrypted"], rating: 4.7, reviewsCount: 120
  }),
  product(1020, "accessories", "Aether Glass Screen Protector", "aether-glass-screen-protector", 1999, 1499, 150, false, "screen protector", {
    description: "Premium matte glass screen protector with anti-glare coating, privacy layer, and easy alignment tray.",
    Brand: "Aether", Hardness: "9H", Coating: "Anti-glare", Pack: "2 Units", tags: ["glass", "protector", "privacy"], rating: 4.5, reviewsCount: 412
  }),
  product(1021, "smart-devices", "Orbit Drone Spy", "orbit-drone-spy", 59999, 52999, 9, true, "camera drone", {
    description: "Foldable camera drone with obstacle sensing, long flight time, and cinematic stabilized capture.",
    Brand: "Orbit", Camera: "8K Gimbal", Flight: "42 Minutes", Sensors: "Omni Avoidance", tags: ["drone", "camera", "8k"], rating: 4.8, reviewsCount: 91
  }),
  product(1022, "smart-devices", "Helios Solar Lantern", "helios-solar-lantern", 5999, 4999, 80, false, "solar lantern smart", {
    description: "Smart solar lantern with emergency power bank, adaptive brightness, and rugged outdoor housing.",
    Brand: "Helios", Runtime: "72 Hours", Charging: "Solar USB-C", Rating: "IP65", tags: ["solar", "lantern", "outdoor"], rating: 4.6, reviewsCount: 177
  }),
  product(1023, "smart-devices", "Nano Purifier Mask", "nano-purifier-mask", 9999, null, 40, false, "smart purifier mask", {
    description: "Active air purifier mask with replaceable filters, airflow assist, and companion app telemetry.",
    Brand: "NanoPurify", Filter: "N99", Battery: "8 Hours", App: "Air Quality Sync", tags: ["mask", "purifier", "health"], rating: 4.3, reviewsCount: 19
  }),
  product(1024, "smart-devices", "Omni Hub Station", "omni-hub-station", 34999, 29999, 12, true, "smart home hub", {
    description: "Smart home hub for lights, climate, cameras, and automations with local-first privacy controls.",
    Brand: "Omni", Connectivity: "Matter Thread Zigbee", AI: "Local Assistant", Security: "Private Core", tags: ["smart-home", "matter", "hub"], rating: 4.8, reviewsCount: 154
  })
];

export const getDemoProductBySlug = (slug) =>
  DEMO_PRODUCTS.find((item) => item.slug === slug);
