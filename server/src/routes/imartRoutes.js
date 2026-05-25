import express from "express";
import { auth } from "../middlewares/auth.js";
import {
  upload,
  uploadImages,
  getCategories,
  getProducts,
  getProductBySlug,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  createCheckout,
  getUserOrders,
  createCategory,
  updateCategory,
  deleteCategory,
  createProduct,
  updateProduct,
  deleteProduct,
  getAdminOrders,
  updateOrderStatus
} from "../controllers/imartController.js";

const router = express.Router();

// ==========================================
// CLIENT-USER CATALOG & WISHLIST & CHECKOUT
// ==========================================

router.get("/categories", getCategories);
router.get("/products", getProducts);
router.get("/products/:slug", getProductBySlug);

router.get("/wishlist", auth, getWishlist);
router.post("/wishlist", auth, addToWishlist);
router.delete("/wishlist/:productId", auth, removeFromWishlist);

router.post("/checkout", auth, createCheckout);
router.get("/orders", auth, getUserOrders);

// ==========================================
// ADMIN PANEL PRODUCT & ORDER MANAGEMENT
// ==========================================

// Note: Because these routes start with /admin or are checked under /api/admin, 
// the auth middleware will verify they are accessed with ADMIN_PANEL tokenType.
router.post("/admin/upload", auth, upload.array("images", 10), uploadImages);

router.post("/admin/categories", auth, createCategory);
router.put("/admin/categories/:id", auth, updateCategory);
router.delete("/admin/categories/:id", auth, deleteCategory);

router.post("/admin/products", auth, createProduct);
router.put("/admin/products/:id", auth, updateProduct);
router.delete("/admin/products/:id", auth, deleteProduct);

router.get("/admin/orders", auth, getAdminOrders);
router.put("/admin/orders/:id/status", auth, updateOrderStatus);

export default router;
