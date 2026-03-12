const ERROR_BASE_URL = "https://api.loyalshy.com/errors"

export class ApiError extends Error {
  constructor(
    public readonly type: string,
    public readonly title: string,
    public readonly status: number,
    public readonly detail: string,
    public readonly errors?: Array<{ field: string; message: string }>
  ) {
    super(detail)
    this.name = "ApiError"
  }

  toJSON(instance?: string) {
    return {
      type: `${ERROR_BASE_URL}/${this.type}`,
      title: this.title,
      status: this.status,
      detail: this.detail,
      ...(instance && { instance }),
      ...(this.errors && { errors: this.errors }),
    }
  }
}

export class BadRequestError extends ApiError {
  constructor(detail = "The request was malformed or invalid.") {
    super("bad-request", "Bad Request", 400, detail)
  }
}

export class ValidationError extends ApiError {
  constructor(errors: Array<{ field: string; message: string }>) {
    super(
      "validation",
      "Validation Error",
      400,
      "Request body failed validation.",
      errors
    )
  }
}

export class UnauthorizedError extends ApiError {
  constructor(detail = "Missing or invalid API key.") {
    super("unauthorized", "Unauthorized", 401, detail)
  }
}

export class ForbiddenError extends ApiError {
  constructor(detail = "Your current plan does not include API access.") {
    super("forbidden", "Forbidden", 403, detail)
  }
}

export class NotFoundError extends ApiError {
  constructor(detail = "The requested resource was not found.") {
    super("not-found", "Not Found", 404, detail)
  }
}

export class ConflictError extends ApiError {
  constructor(detail = "A resource with the given identifier already exists.") {
    super("conflict", "Conflict", 409, detail)
  }
}

export class UnsupportedMediaTypeError extends ApiError {
  constructor() {
    super(
      "unsupported-media-type",
      "Unsupported Media Type",
      415,
      "Expected Content-Type: application/json"
    )
  }
}

export class UnprocessableError extends ApiError {
  constructor(detail: string) {
    super("unprocessable", "Unprocessable Entity", 422, detail)
  }
}

export class RateLimitError extends ApiError {
  constructor(
    public readonly retryAfter: number
  ) {
    super(
      "rate-limit-exceeded",
      "Too Many Requests",
      429,
      "Rate limit exceeded. Please retry later."
    )
  }
}

export class InternalError extends ApiError {
  constructor() {
    super(
      "internal",
      "Internal Server Error",
      500,
      "An unexpected error occurred."
    )
  }
}
