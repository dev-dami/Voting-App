export class AppError extends Error {
	readonly status: number;
	readonly code: string;

	constructor(status: number, code: string, message: string) {
		super(message);
		this.name = this.constructor.name;
		this.status = status;
		this.code = code;
	}
}

export class BadRequestError extends AppError {
	constructor(message = "bad request") {
		super(400, "bad_request", message);
	}
}

export class UnauthorizedError extends AppError {
	constructor(message = "authentication required") {
		super(401, "unauthorized", message);
	}
}

export class ForbiddenError extends AppError {
	constructor(message = "forbidden") {
		super(403, "forbidden", message);
	}
}

export class NotFoundError extends AppError {
	constructor(message = "not found") {
		super(404, "not_found", message);
	}
}

export class ConflictError extends AppError {
	constructor(message = "conflict") {
		super(409, "conflict", message);
	}
}

export class PayloadTooLargeError extends AppError {
	constructor(message = "payload too large") {
		super(413, "payload_too_large", message);
	}
}

export class TooManyRequestsError extends AppError {
	readonly retryAfterMs: number;

	constructor(retryAfterMs: number, message = "too many requests") {
		super(429, "rate_limited", message);
		this.retryAfterMs = retryAfterMs;
	}
}

export class ElectionNotRunningError extends AppError {
	constructor(message = "election is not running") {
		super(409, "election_not_running", message);
	}
}
