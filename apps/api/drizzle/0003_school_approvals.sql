CREATE TYPE "public"."claim_channel" AS ENUM('teacher', 'budget_assistant');--> statement-breakpoint
CREATE TYPE "public"."claim_status" AS ENUM('pending', 'approved', 'returned');--> statement-breakpoint
CREATE TABLE "budget_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"client_request_id" uuid NOT NULL,
	"date" date NOT NULL,
	"budget_code" text NOT NULL,
	"purpose" text NOT NULL,
	"items" jsonb NOT NULL,
	"status" "claim_status" DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"reason" text,
	"decided_at" timestamp with time zone,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_claims_teacher_id_client_request_id_unique" UNIQUE("teacher_id","client_request_id")
);
--> statement-breakpoint
CREATE TABLE "claim_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid NOT NULL,
	"channel" "claim_channel" NOT NULL,
	CONSTRAINT "claim_notifications_claim_id_channel_unique" UNIQUE("claim_id","channel")
);
--> statement-breakpoint
ALTER TABLE "budget_claims" ADD CONSTRAINT "budget_claims_school_id_teacher_id_school_memberships_school_id_id_fk" FOREIGN KEY ("school_id","teacher_id") REFERENCES "public"."school_memberships"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_claims" ADD CONSTRAINT "budget_claims_school_id_decided_by_school_memberships_school_id_id_fk" FOREIGN KEY ("school_id","decided_by") REFERENCES "public"."school_memberships"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_notifications" ADD CONSTRAINT "claim_notifications_claim_id_budget_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."budget_claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_claims_school_id_status_submitted_at_index" ON "budget_claims" USING btree ("school_id","status","submitted_at");--> statement-breakpoint
CREATE INDEX "budget_claims_teacher_id_submitted_at_index" ON "budget_claims" USING btree ("teacher_id","submitted_at");