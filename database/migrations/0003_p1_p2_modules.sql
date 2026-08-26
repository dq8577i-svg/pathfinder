CREATE TABLE "portfolio_items" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"path_id" text NOT NULL,
	"title" text NOT NULL,
	"type" text DEFAULT 'note' NOT NULL,
	"url" text,
	"description" text DEFAULT '' NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_cards" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"path_id" text NOT NULL,
	"node_id" text,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"source" text DEFAULT 'template' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenarios" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"path_id" text NOT NULL,
	"node_id" text,
	"title" text NOT NULL,
	"situation" text NOT NULL,
	"task" text NOT NULL,
	"ai_role" text NOT NULL,
	"rubric" text NOT NULL,
	"source_type" text DEFAULT 'template' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_path_id_learning_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."learning_paths"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_cards" ADD CONSTRAINT "review_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_cards" ADD CONSTRAINT "review_cards_path_id_learning_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."learning_paths"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_path_id_learning_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."learning_paths"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "portfolio_items_user_path_idx" ON "portfolio_items" USING btree ("user_id","path_id");--> statement-breakpoint
CREATE INDEX "review_cards_user_path_idx" ON "review_cards" USING btree ("user_id","path_id");--> statement-breakpoint
CREATE INDEX "scenarios_user_path_idx" ON "scenarios" USING btree ("user_id","path_id");