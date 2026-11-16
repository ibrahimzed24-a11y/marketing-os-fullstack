/**
 * Centralized Error Handling & Fault Tolerance Architecture
 * Marketing OS — Global Engineering Standard
 * Enforces:
 *   1. Standardized Error Categories & Classes
 *   2. Correlation ID generation & tracing
 *   3. Structured logging with error preservation
 *   4. Safe, sanitized client response envelope
 *   5. Automated persistence to error_log in database
 */

const { v4: uuidv4 } = require('uuid');

// Standardized Error Categories
const ErrorCategory = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  CONFLICT_ERROR: 'CONFLICT_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR'
};

// Base Application Error Class
class AppError extends Error {
  constructor(message, category = ErrorCategory.INTERNAL_SERVER_ERROR, statusCode = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.category = category;
    this.code = category;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

// Specialized Subclasses
class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, ErrorCategory.VALIDATION_ERROR, 400, details);
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication required.') {
    super(message, ErrorCategory.AUTHENTICATION_ERROR, 401);
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message, ErrorCategory.AUTHORIZATION_ERROR, 403);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Requested resource not found.') {
    super(message, ErrorCategory.NOT_FOUND_ERROR, 404);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict or duplicate detected.') {
    super(message, ErrorCategory.CONFLICT_ERROR, 409);
  }
}

class ExternalServiceError extends AppError {
  constructor(message, details = null) {
    super(message, ErrorCategory.EXTERNAL_SERVICE_ERROR, 502, details);
  }
}

class DatabaseError extends AppError {
  constructor(message, details = null) {
    super(message, ErrorCategory.DATABASE_ERROR, 500, details);
  }
}

class TimeoutError extends AppError {
  constructor(message = 'Operation timed out.') {
    super(message, ErrorCategory.TIMEOUT_ERROR, 504);
  }
}

// Request Correlation ID Middleware
function correlationMiddleware(req, res, next) {
  const correlationId = req.headers['x-correlation-id'] || `req-${uuidv4().slice(0, 8)}-${Date.now().toString(36)}`;
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  next();
}

// Global Centralized Error Handling Middleware for Express
function errorHandler(err, req, res, next) {
  const correlationId = req.correlationId || `err-${uuidv4().slice(0, 8)}`;
  const timestamp = new Date().toISOString();

  // Normalize error
  let statusCode = err.statusCode || 500;
  let category = err.category || ErrorCategory.INTERNAL_SERVER_ERROR;
  let message = err.message || 'An unexpected internal error occurred.';
  let code = err.code || category;

  // Distinguish SQLite / Database errors
  if (err.name === 'SqliteError' || err.code?.startsWith('SQLITE_')) {
    statusCode = 500;
    category = ErrorCategory.DATABASE_ERROR;
    code = ErrorCategory.DATABASE_ERROR;
    message = 'A database integrity or query error occurred.';
  }

  // Structured Log to stdout
  console.error(`[ERROR] [${timestamp}] [${correlationId}] [${category}] ${err.name || 'Error'}: ${err.message}`);
  if (err.stack) {
    console.error(`[STACK] [${correlationId}] ${err.stack}`);
  }

  // Record critical errors in database error_log if db is accessible
  try {
    const db = require('./db');
    const stmt = db.prepare(`
      INSERT INTO error_log (id, correlation_id, category, code, message, stack_trace, context_json, severity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      uuidv4(),
      correlationId,
      category,
      code,
      err.message || 'Unknown error',
      err.stack || '',
      JSON.stringify({
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        user: req.user ? req.user.id : null,
        details: err.details || null
      }),
      statusCode >= 500 ? 'ERROR' : 'WARN'
    );
  } catch (dbErr) {
    // Fail-safe: Never throw inside error handler
    console.warn(`[WARN] Could not persist error to error_log table: ${dbErr.message}`);
  }

  // Sanitized Response Envelope (Never leak raw stacks or secrets)
  res.status(statusCode).json({
    error: {
      code,
      category,
      message,
      correlation_id: correlationId,
      timestamp,
      details: process.env.NODE_ENV === 'development' ? err.details : undefined
    }
  });
}

// Async route wrapper to catch unhandled rejections automatically
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  ErrorCategory,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  ExternalServiceError,
  DatabaseError,
  TimeoutError,
  correlationMiddleware,
  errorHandler,
  asyncHandler
};
