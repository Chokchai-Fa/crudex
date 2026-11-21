CREATE TABLE "run_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"text" text NOT NULL,
	"approved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "run_memory" ADD CONSTRAINT "run_memory_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "memory_proposal_key" ON "run_memory" USING btree ("run_id","text");--> statement-breakpoint
CREATE INDEX "memory_owner_idx" ON "run_memory" USING btree ("school_id","owner_id");