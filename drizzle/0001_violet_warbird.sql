CREATE TABLE "request_rate_limit_buckets" (
	"scope_key" text NOT NULL,
	"scope_type" text NOT NULL,
	"action" text NOT NULL,
	"window_seconds" integer NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "request_rate_limit_buckets_pk" PRIMARY KEY("scope_key","action","window_seconds"),
	CONSTRAINT "request_rate_limit_buckets_scope_type_check" CHECK ("request_rate_limit_buckets"."scope_type" in ('session', 'anonymous_fingerprint')),
	CONSTRAINT "request_rate_limit_buckets_window_seconds_check" CHECK ("request_rate_limit_buckets"."window_seconds" >= 1),
	CONSTRAINT "request_rate_limit_buckets_request_count_check" CHECK ("request_rate_limit_buckets"."request_count" >= 0)
);
--> statement-breakpoint
CREATE INDEX "request_rate_limit_buckets_updated_at_idx" ON "request_rate_limit_buckets" USING btree ("updated_at");