CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"resource_type" text,
	"resource_id" text,
	"detail" jsonb,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "curricula" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"version" text NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"created_by" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feynman_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text,
	"node_id" text,
	"user_id" text,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"key_terms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pending_questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"self_assessed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"status_filter" text DEFAULT 'all' NOT NULL,
	"source_tag" text DEFAULT 'ai_draft' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_edges" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_node_id" text NOT NULL,
	"to_node_id" text NOT NULL,
	"relationship" text
);
--> statement-breakpoint
CREATE TABLE "knowledge_nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"curriculum_id" text NOT NULL,
	"title" text NOT NULL,
	"chapter" text NOT NULL,
	"sequence" integer NOT NULL,
	"status" text NOT NULL,
	"prerequisites" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"estimated_minutes" integer NOT NULL,
	"capability_goal" text NOT NULL,
	"completion_criteria" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence_coverage" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"scenario" text,
	"curriculum_section" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_path_nodes" (
	"path_id" text NOT NULL,
	"node_id" text NOT NULL,
	"status" text NOT NULL,
	"sort_order" integer NOT NULL,
	"completed_at" timestamp with time zone,
	"is_demo" boolean DEFAULT false NOT NULL,
	CONSTRAINT "learning_path_nodes_path_id_node_id_pk" PRIMARY KEY("path_id","node_id")
);
--> statement-breakpoint
CREATE TABLE "learning_paths" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"curriculum_version" text,
	"goal_summary" text,
	"weekly_hours" integer DEFAULT 0 NOT NULL,
	"deadline" timestamp with time zone,
	"estimated_weeks" integer DEFAULT 0 NOT NULL,
	"completed_count" integer DEFAULT 0 NOT NULL,
	"total_count" integer DEFAULT 0 NOT NULL,
	"current_node_id" text,
	"rationale" jsonb,
	"created_at" timestamp with time zone NOT NULL,
	"last_activity_at" timestamp with time zone NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "node_resources" (
	"node_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "node_resources_node_id_resource_id_pk" PRIMARY KEY("node_id","resource_id")
);
--> statement-breakpoint
CREATE TABLE "onboarding_answers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"answers" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "path_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"path_id" text,
	"snapshot" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "practice_evaluations" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"clear" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"to_add" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"not_covered" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dimensions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"evidence_rounds" integer DEFAULT 0 NOT NULL,
	"provider_label" text,
	"prompt_version" text,
	"generated_at" timestamp with time zone,
	"confidence_notice" text,
	"next_step" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "practice_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"turn_index" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "practice_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"node_id" text,
	"path_id" text,
	"status" text NOT NULL,
	"current_round" integer DEFAULT 1 NOT NULL,
	"total_rounds" integer DEFAULT 5 NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"draft" text DEFAULT '' NOT NULL,
	"draft_saved_at" timestamp with time zone,
	"sync_state" text DEFAULT 'saved' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendation_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"input" jsonb,
	"output" jsonb,
	"model" text,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"domain" text NOT NULL,
	"grade" text NOT NULL,
	"source_type" text NOT NULL,
	"source_name" text NOT NULL,
	"checked_at" timestamp with time zone,
	"retrieved_at" timestamp with time zone,
	"reason" text NOT NULL,
	"url" text NOT NULL,
	"accessibility_status" text NOT NULL,
	"license_note" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"password_hash" text,
	"display_name" text NOT NULL,
	"role" text NOT NULL,
	"avatar_url" text,
	"weekly_hours" integer DEFAULT 0 NOT NULL,
	"goal_summary" text,
	"onboarded_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feynman_notes" ADD CONSTRAINT "feynman_notes_node_id_knowledge_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."knowledge_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feynman_notes" ADD CONSTRAINT "feynman_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_nodes" ADD CONSTRAINT "knowledge_nodes_curriculum_id_curricula_id_fk" FOREIGN KEY ("curriculum_id") REFERENCES "public"."curricula"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_path_nodes" ADD CONSTRAINT "learning_path_nodes_path_id_learning_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."learning_paths"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_path_nodes" ADD CONSTRAINT "learning_path_nodes_node_id_knowledge_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."knowledge_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_resources" ADD CONSTRAINT "node_resources_node_id_knowledge_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."knowledge_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_resources" ADD CONSTRAINT "node_resources_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_answers" ADD CONSTRAINT "onboarding_answers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "path_snapshots" ADD CONSTRAINT "path_snapshots_path_id_learning_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."learning_paths"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_evaluations" ADD CONSTRAINT "practice_evaluations_session_id_practice_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."practice_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_messages" ADD CONSTRAINT "practice_messages_session_id_practice_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."practice_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_node_id_knowledge_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."knowledge_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_path_id_learning_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."learning_paths"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_runs" ADD CONSTRAINT "recommendation_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "knowledge_nodes_curriculum_idx" ON "knowledge_nodes" USING btree ("curriculum_id");--> statement-breakpoint
CREATE INDEX "practice_messages_session_idx" ON "practice_messages" USING btree ("session_id");