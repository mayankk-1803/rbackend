import AppError from "../utils/AppError.js";

/**
 * Global error handling middleware.
 */
/**
 * Global error handling middleware.
 */
export const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.code = err.code || 'INTERNAL_ERROR';

  // Production vs Development error response
  const isDev = process.env.NODE_ENV === 'development';

  console.error(`[ERROR][${err.code}] ${err.message}`, {
    path: req.originalUrl,
    method: req.method,
    stack: isDev ? err.stack : undefined,
    metadata: err.metadata
  });

  // Prisma unique constraint error
  if (err.code === 'P2002') {
    return res.status(400).json({
      success: false,
      code: 'DUPLICATE_ENTRY',
      message: `A record with this ${err.meta?.target || 'value'} already exists.`,
      data: isDev ? err.meta : {}
    });
  }

  // Axios/Network errors from providers
  if (err.isAxiosError) {
    return res.status(err.response?.status || 502).json({
      success: false,
      code: 'PROVIDER_ERROR',
      message: isDev ? err.message : 'Downstream provider is currently unreachable',
      data: isDev ? { providerResponse: err.response?.data } : {}
    });
  }

  // Handle operational vs programming errors
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
      data: err.metadata || {}
    });
  }

  return res.status(err.statusCode).json({
    success: false,
    code: err.code,
    message: isDev ? err.message : 'An unexpected error occurred. Please try again later.',
    data: isDev ? { stack: err.stack } : {}
  });
};
