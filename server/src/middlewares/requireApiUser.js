export const requireApiUser = (req, res, next) => {
  if (
    !req.user ||
    !["API_USER", "ADMIN", "SUPER_ADMIN"].includes(req.user.role)
  ) {
    return res.status(403).json({
      success: false,
      message: "API access required"
    });
  }

  next();
};
