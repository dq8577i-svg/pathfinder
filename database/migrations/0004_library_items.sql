CREATE TABLE "library_items" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"path_id" text NOT NULL,
	"source_type" text DEFAULT 'link' NOT NULL,
	"resource_id" text,
	"node_id" text,
	"title" text NOT NULL,
	"url" text,
	"source_name" text DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"memo" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'verified' NOT NULL,
	"object_key" text,
	"size" text,
	"license_note" text DEFAULT '' NOT NULL,
	"checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "library_items" ADD CONSTRAINT "library_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_items" ADD CONSTRAINT "library_items_path_id_learning_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."learning_paths"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_items" ADD CONSTRAINT "library_items_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "library_items_user_path_idx" ON "library_items" USING btree ("user_id","path_id");--> statement-breakpoint
CREATE UNIQUE INDEX "library_items_user_resource_idx" ON "library_items" USING btree ("user_id","resource_id") WHERE "library_items"."resource_id" IS NOT NULL;