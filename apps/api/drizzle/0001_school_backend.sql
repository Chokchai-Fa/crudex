CREATE TYPE "public"."school_role" AS ENUM('teacher', 'principal', 'student', 'guardian');--> statement-breakpoint
CREATE TABLE "class_assignments" (
	"school_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	CONSTRAINT "class_assignments_membership_id_class_id_pk" PRIMARY KEY("membership_id","class_id")
);
--> statement-breakpoint
CREATE TABLE "guardian_students" (
	"school_id" uuid NOT NULL,
	"guardian_membership_id" uuid NOT NULL,
	"student_membership_id" uuid NOT NULL,
	CONSTRAINT "guardian_students_guardian_membership_id_student_membership_id_pk" PRIMARY KEY("guardian_membership_id","student_membership_id")
);
--> statement-breakpoint
CREATE TABLE "school_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school_classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "school_classes_school_id_id_unique" UNIQUE("school_id","id")
);
--> statement-breakpoint
CREATE TABLE "school_invitations" (
	"digest" text PRIMARY KEY NOT NULL,
	"membership_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"role" "school_role" NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "school_memberships_school_id_id_unique" UNIQUE("school_id","id"),
	CONSTRAINT "school_memberships_school_id_owner_id_role_unique" UNIQUE("school_id","owner_id","role")
);
--> statement-breakpoint
CREATE TABLE "school_sessions" (
	"digest" text PRIMARY KEY NOT NULL,
	"membership_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"school_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"role" text NOT NULL,
	"agent_id" text NOT NULL,
	"class_id" uuid,
	"request_id" uuid NOT NULL,
	"prompt" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempt_id" uuid,
	"credential_hash" text,
	"lease_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"body" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_outbox" (
	"run_id" uuid PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_quota" (
	"day" date PRIMARY KEY NOT NULL,
	"used" integer NOT NULL,
	CONSTRAINT "school_daily_run_limit" CHECK ("run_quota"."used" <= 60)
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"play_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"invocation_id" text NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessments_play_token_unique" UNIQUE("play_token"),
	CONSTRAINT "assessments_run_id_invocation_id_unique" UNIQUE("run_id","invocation_id")
);
--> statement-breakpoint
CREATE TABLE "guardian_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"routine_id" uuid NOT NULL,
	"occurrence" timestamp with time zone NOT NULL,
	"student_id" uuid NOT NULL,
	"guardian_id" uuid NOT NULL,
	"student_name" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guardian_reports_routine_id_occurrence_student_id_guardian_id_unique" UNIQUE("routine_id","occurrence","student_id","guardian_id")
);
--> statement-breakpoint
CREATE TABLE "school_routines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"hour" integer NOT NULL,
	"minute" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"next_run_at" timestamp with time zone NOT NULL,
	CONSTRAINT "school_routines_teacher_id_class_id_hour_minute_unique" UNIQUE("teacher_id","class_id","hour","minute")
);
--> statement-breakpoint
CREATE TABLE "quiz_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"answers" jsonb NOT NULL,
	"score" integer NOT NULL,
	"max_score" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_submissions_assessment_id_student_id_unique" UNIQUE("assessment_id","student_id")
);
--> statement-breakpoint
ALTER TABLE "class_assignments" ADD CONSTRAINT "class_assignments_school_id_membership_id_school_memberships_school_id_id_fk" FOREIGN KEY ("school_id","membership_id") REFERENCES "public"."school_memberships"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_assignments" ADD CONSTRAINT "class_assignments_school_id_class_id_school_classes_school_id_id_fk" FOREIGN KEY ("school_id","class_id") REFERENCES "public"."school_classes"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_students" ADD CONSTRAINT "guardian_students_school_id_guardian_membership_id_school_memberships_school_id_id_fk" FOREIGN KEY ("school_id","guardian_membership_id") REFERENCES "public"."school_memberships"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_students" ADD CONSTRAINT "guardian_students_school_id_student_membership_id_school_memberships_school_id_id_fk" FOREIGN KEY ("school_id","student_membership_id") REFERENCES "public"."school_memberships"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_classes" ADD CONSTRAINT "school_classes_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_invitations" ADD CONSTRAINT "school_invitations_membership_id_school_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."school_memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_memberships" ADD CONSTRAINT "school_memberships_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_memberships" ADD CONSTRAINT "school_memberships_owner_id_school_accounts_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."school_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_sessions" ADD CONSTRAINT "school_sessions_membership_id_school_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."school_memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_events" ADD CONSTRAINT "run_events_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_outbox" ADD CONSTRAINT "run_outbox_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_school_id_class_id_school_classes_school_id_id_fk" FOREIGN KEY ("school_id","class_id") REFERENCES "public"."school_classes"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_reports" ADD CONSTRAINT "guardian_reports_routine_id_school_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."school_routines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_reports" ADD CONSTRAINT "guardian_reports_student_id_school_memberships_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."school_memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_reports" ADD CONSTRAINT "guardian_reports_guardian_id_school_memberships_id_fk" FOREIGN KEY ("guardian_id") REFERENCES "public"."school_memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_routines" ADD CONSTRAINT "school_routines_teacher_id_school_memberships_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."school_memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_routines" ADD CONSTRAINT "school_routines_school_id_class_id_school_classes_school_id_id_fk" FOREIGN KEY ("school_id","class_id") REFERENCES "public"."school_classes"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_submissions" ADD CONSTRAINT "quiz_submissions_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_submissions" ADD CONSTRAINT "quiz_submissions_student_id_school_memberships_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."school_memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "run_request_key" ON "agent_runs" USING btree ("school_id","owner_id","request_id");--> statement-breakpoint
CREATE INDEX "run_history_idx" ON "agent_runs" USING btree ("school_id","owner_id","agent_id","created_at");--> statement-breakpoint
CREATE INDEX "run_replay_idx" ON "run_events" USING btree ("run_id","id");--> statement-breakpoint
CREATE INDEX "assessments_school_id_class_id_index" ON "assessments" USING btree ("school_id","class_id");--> statement-breakpoint
CREATE INDEX "school_routines_enabled_next_run_at_index" ON "school_routines" USING btree ("enabled","next_run_at");