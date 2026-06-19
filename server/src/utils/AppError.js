class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', metadata = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.metadata = metadata;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ClientError extends Error {
  constructor(message) {
    super(message);
    this.name = "ClientError";
    this.isClientError = true;
    this.statusCode = 400;
  }
}

export default AppError;
