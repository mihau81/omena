CREATE TYPE "public"."admin_role" AS ENUM('super_admin', 'admin', 'cataloguer', 'auctioneer', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."auction_status" AS ENUM('draft', 'preview', 'live', 'reconciliation', 'archive');--> statement-breakpoint
CREATE TYPE "public"."bid_type" AS ENUM('online', 'phone', 'floor', 'absentee', 'system');--> statement-breakpoint
CREATE TYPE "public"."lot_status" AS ENUM('draft', 'catalogued', 'published', 'active', 'sold', 'passed', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('image', 'youtube');--> statement-breakpoint
CREATE TYPE "public"."visibility_level" AS ENUM('0', '1', '2');--> statement-breakpoint
CREATE TABLE "absentee_bids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lot_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"max_amount" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" "admin_role" DEFAULT 'viewer' NOT NULL,
	"totp_secret" text,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	CONSTRAINT "admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auctions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(255) NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" varchar(50) DEFAULT 'mixed' NOT NULL,
	"cover_image_id" uuid,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"curator" text DEFAULT '' NOT NULL,
	"status" "auction_status" DEFAULT 'draft' NOT NULL,
	"visibility_level" "visibility_level" DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"buyers_premium_rate" numeric(5, 4) DEFAULT '0.2000' NOT NULL,
	"notes" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "auctions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"table_name" varchar(100) NOT NULL,
	"record_id" uuid NOT NULL,
	"action" varchar(10) NOT NULL,
	"old_data" jsonb,
	"new_data" jsonb,
	"changed_fields" jsonb,
	"performed_by" uuid,
	"performed_by_type" varchar(10),
	"ip_address" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bid_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"auction_id" uuid NOT NULL,
	"paddle_number" integer NOT NULL,
	"is_approved" boolean DEFAULT false NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"deposit_paid" boolean DEFAULT false NOT NULL,
	"notes" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bid_retractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bid_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"retracted_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bid_retractions_bid_id_unique" UNIQUE("bid_id")
);
--> statement-breakpoint
CREATE TABLE "bids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lot_id" uuid NOT NULL,
	"user_id" uuid,
	"registration_id" uuid,
	"amount" integer NOT NULL,
	"bid_type" "bid_type" DEFAULT 'online' NOT NULL,
	"paddle_number" integer,
	"is_winning" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" varchar(50) NOT NULL,
	"user_id" uuid NOT NULL,
	"auction_id" uuid NOT NULL,
	"lot_id" uuid NOT NULL,
	"hammer_price" integer NOT NULL,
	"buyers_premium" integer NOT NULL,
	"total_amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'PLN' NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"due_date" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"notes" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auction_id" uuid NOT NULL,
	"lot_number" integer NOT NULL,
	"title" text NOT NULL,
	"artist" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"medium" text DEFAULT '' NOT NULL,
	"dimensions" text DEFAULT '' NOT NULL,
	"year" integer,
	"estimate_min" integer DEFAULT 0 NOT NULL,
	"estimate_max" integer DEFAULT 0 NOT NULL,
	"reserve_price" integer,
	"starting_bid" integer,
	"hammer_price" integer,
	"status" "lot_status" DEFAULT 'draft' NOT NULL,
	"visibility_override" "visibility_level",
	"sort_order" integer DEFAULT 0 NOT NULL,
	"provenance" jsonb DEFAULT '[]' NOT NULL,
	"exhibitions" jsonb DEFAULT '[]' NOT NULL,
	"literature" jsonb DEFAULT '[]' NOT NULL,
	"condition_notes" text DEFAULT '',
	"notes" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lot_id" uuid,
	"auction_id" uuid,
	"media_type" "media_type" DEFAULT 'image' NOT NULL,
	"url" text NOT NULL,
	"thumbnail_url" text,
	"medium_url" text,
	"large_url" text,
	"original_filename" text,
	"mime_type" varchar(100),
	"file_size" integer,
	"width" integer,
	"height" integer,
	"alt_text" text DEFAULT '',
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"uploaded_by" uuid
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"metadata" jsonb DEFAULT '{}',
	"is_read" boolean DEFAULT false NOT NULL,
	"email_sent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_token" text NOT NULL,
	"user_id" uuid NOT NULL,
	"user_type" varchar(10) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"password_hash" text,
	"name" text NOT NULL,
	"phone" varchar(30) DEFAULT '',
	"address" text DEFAULT '',
	"city" varchar(100) DEFAULT '',
	"postal_code" varchar(20) DEFAULT '',
	"country" varchar(100) DEFAULT 'Poland',
	"visibility_level" "visibility_level" DEFAULT '0' NOT NULL,
	"referrer_id" uuid,
	"notes" text DEFAULT '',
	"email_verified" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" varchar(320) NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token"),
	CONSTRAINT "verification_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "watched_lots" (
	"user_id" uuid NOT NULL,
	"lot_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watched_lots_user_id_lot_id_pk" PRIMARY KEY("user_id","lot_id")
);
--> statement-breakpoint
ALTER TABLE "absentee_bids" ADD CONSTRAINT "absentee_bids_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "absentee_bids" ADD CONSTRAINT "absentee_bids_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_registrations" ADD CONSTRAINT "bid_registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_registrations" ADD CONSTRAINT "bid_registrations_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_registrations" ADD CONSTRAINT "bid_registrations_approved_by_admins_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_retractions" ADD CONSTRAINT "bid_retractions_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_retractions" ADD CONSTRAINT "bid_retractions_retracted_by_admins_id_fk" FOREIGN KEY ("retracted_by") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_registration_id_bid_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."bid_registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watched_lots" ADD CONSTRAINT "watched_lots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watched_lots" ADD CONSTRAINT "watched_lots_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "absentee_bids_lot_idx" ON "absentee_bids" USING btree ("lot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "absentee_bids_lot_user_idx" ON "absentee_bids" USING btree ("lot_id","user_id");--> statement-breakpoint
CREATE INDEX "admins_email_idx" ON "admins" USING btree ("email");--> statement-breakpoint
CREATE INDEX "admins_role_idx" ON "admins" USING btree ("role");--> statement-breakpoint
CREATE INDEX "auctions_status_idx" ON "auctions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "auctions_visibility_idx" ON "auctions" USING btree ("visibility_level");--> statement-breakpoint
CREATE INDEX "auctions_sort_order_idx" ON "auctions" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "auctions_deleted_at_idx" ON "auctions" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "audit_log_table_record_idx" ON "audit_log" USING btree ("table_name","record_id");--> statement-breakpoint
CREATE INDEX "audit_log_performed_by_idx" ON "audit_log" USING btree ("performed_by");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE UNIQUE INDEX "bid_reg_user_auction_idx" ON "bid_registrations" USING btree ("user_id","auction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bid_reg_paddle_auction_idx" ON "bid_registrations" USING btree ("paddle_number","auction_id");--> statement-breakpoint
CREATE INDEX "bids_lot_id_idx" ON "bids" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "bids_user_id_idx" ON "bids" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bids_created_at_idx" ON "bids" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "bids_amount_idx" ON "bids" USING btree ("lot_id","amount");--> statement-breakpoint
CREATE INDEX "lots_auction_id_idx" ON "lots" USING btree ("auction_id");--> statement-breakpoint
CREATE INDEX "lots_status_idx" ON "lots" USING btree ("status");--> statement-breakpoint
CREATE INDEX "lots_sort_order_idx" ON "lots" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "lots_artist_idx" ON "lots" USING btree ("artist");--> statement-breakpoint
CREATE UNIQUE INDEX "lots_auction_lot_number_idx" ON "lots" USING btree ("auction_id","lot_number");--> statement-breakpoint
CREATE INDEX "lots_deleted_at_idx" ON "lots" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "media_lot_id_idx" ON "media" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "media_auction_id_idx" ON "media" USING btree ("auction_id");--> statement-breakpoint
CREATE INDEX "media_sort_order_idx" ON "media" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sessions_token_idx" ON "sessions" USING btree ("session_token");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_visibility_idx" ON "users" USING btree ("visibility_level");--> statement-breakpoint
CREATE INDEX "users_referrer_idx" ON "users" USING btree ("referrer_id");--> statement-breakpoint
CREATE INDEX "users_deleted_at_idx" ON "users" USING btree ("deleted_at");