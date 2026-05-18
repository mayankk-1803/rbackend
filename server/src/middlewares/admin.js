export const isAdmin = (req, res, next) => {
  const role = (req.user?.role || '').toUpperCase();
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") return res.status(403).json({ success: false, message: "Admin access required" });
  next();
};