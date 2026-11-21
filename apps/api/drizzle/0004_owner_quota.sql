CREATE TABLE "owner_run_quota" (
	"day" date NOT NULL,
	"owner_id" uuid NOT NULL,
	"used" integer NOT NULL,
	CONSTRAINT "owner_daily_run_limit" CHECK ("owner_run_quota"."used"<=20)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "owner_run_quota_day" ON "owner_run_quota" USING btree ("day","owner_id");