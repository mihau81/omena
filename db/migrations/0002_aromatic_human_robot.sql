CREATE TYPE "public"."account_status" AS ENUM('pending_verification', 'pending_approval', 'approved', 'rejected', 'deactivated');--> statement-breakpoint
CREATE TYPE "public"."registration_source" AS ENUM('direct', 'whitelist', 'invitation', 'qr_code');--> statement-breakpoint
CREATE TYPE "public"."token_purpose" AS ENUM('email_verification', 'magic_link', 'password_reset');--> statement-breakpoint
CREATE TABLE "qr_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"max_uses" integer,
	"use_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "qr_registrations_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "user_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"invited_by" uuid NOT NULL,
	"invited_email" varchar(320) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"used_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user_whitelists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"name" text,
	"notes" text,
	"imported_by" uuid,
	"used_at" timestamp with time zone,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_whitelists_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "account_status" "account_status" DEFAULT 'pending_verification' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "registration_source" varchar(30) DEFAULT 'direct' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "approved_by" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "rejected_reason" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "verification_tokens" ADD COLUMN "purpose" "token_purpose" DEFAULT 'email_verification' NOT NULL;--> statement-breakpoint
ALTER TABLE "verification_tokens" ADD COLUMN "used_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "qr_registrations_code_idx" ON "qr_registrations" USING btree ("code");--> statement-breakpoint
CREATE INDEX "qr_registrations_active_idx" ON "qr_registrations" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "user_invitations_token_idx" ON "user_invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "user_invitations_email_idx" ON "user_invitations" USING btree ("invited_email");--> statement-breakpoint
CREATE INDEX "user_whitelists_email_idx" ON "user_whitelists" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_account_status_idx" ON "users" USING btree ("account_status");--> statement-breakpoint
-- Backfill existing users: active+verified → approved, active+unverified → pending_verification, inactive → deactivated
UPDATE "users" SET "account_status" = 'approved' WHERE "is_active" = true AND "email_verified" = true AND "deleted_at" IS NULL;--> statement-breakpoint
UPDATE "users" SET "account_status" = 'pending_verification' WHERE "is_active" = true AND "email_verified" = false AND "deleted_at" IS NULL;--> statement-breakpoint
UPDATE "users" SET "account_status" = 'deactivated' WHERE "is_active" = false AND "deleted_at" IS NULL;