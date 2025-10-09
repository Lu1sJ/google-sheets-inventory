CREATE TABLE "google_sheets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"sheet_id" text NOT NULL,
	"sheet_name" text,
	"title" text,
	"url" text,
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sheet_data" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sheet_id" varchar NOT NULL,
	"row_index" integer NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sheet_mappings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sheet_id" varchar NOT NULL,
	"field_name" text NOT NULL,
	"column_letter" text NOT NULL,
	"order" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"queue_id" varchar NOT NULL,
	"target_sheet_id" varchar NOT NULL,
	"target_row_index" integer,
	"synced_fields" jsonb NOT NULL,
	"sync_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_queue" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"source_sheet_id" varchar NOT NULL,
	"source_row_index" integer NOT NULL,
	"item_type" text NOT NULL,
	"item_data" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"picture" text,
	"google_id" text,
	"google_access_token" text,
	"google_refresh_token" text,
	"google_token_expires_at" timestamp,
	"role" text DEFAULT 'user' NOT NULL,
	"technician_email" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_sign_in" timestamp,
	"is_verified" boolean DEFAULT false NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id")
);
--> statement-breakpoint
ALTER TABLE "google_sheets" ADD CONSTRAINT "google_sheets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet_data" ADD CONSTRAINT "sheet_data_sheet_id_google_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."google_sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet_mappings" ADD CONSTRAINT "sheet_mappings_sheet_id_google_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."google_sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_history" ADD CONSTRAINT "sync_history_queue_id_sync_queue_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."sync_queue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_history" ADD CONSTRAINT "sync_history_target_sheet_id_google_sheets_id_fk" FOREIGN KEY ("target_sheet_id") REFERENCES "public"."google_sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_queue" ADD CONSTRAINT "sync_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_queue" ADD CONSTRAINT "sync_queue_source_sheet_id_google_sheets_id_fk" FOREIGN KEY ("source_sheet_id") REFERENCES "public"."google_sheets"("id") ON DELETE cascade ON UPDATE no action;