import { Elysia } from "elysia";

// Tightened replacement for the legacy helmet CSP baseline in server.js: no
// wildcard sources, no unsafe-eval, no third-party script/style hosts.
const CSP = [
	"default-src 'self'",
	"script-src 'self'",
	"style-src 'self'",
	"img-src 'self' data:",
	"connect-src 'self'",
	"font-src 'self'",
	"object-src 'none'",
	"frame-ancestors 'self'",
	"base-uri 'self'",
	"form-action 'self'",
].join("; ");

export const securityHeaders = new Elysia({
	name: "security-headers",
}).onRequest(({ set }) => {
	set.headers["content-security-policy"] = CSP;
	set.headers["x-content-type-options"] = "nosniff";
	set.headers["x-frame-options"] = "DENY";
	set.headers["referrer-policy"] = "same-origin";
	if (process.env.NODE_ENV === "production") {
		set.headers["strict-transport-security"] =
			"max-age=31536000; includeSubDomains";
	}
});
