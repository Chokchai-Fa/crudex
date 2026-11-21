ALTER TABLE "owner_run_quota" DROP CONSTRAINT "owner_daily_run_limit";--> statement-breakpoint
ALTER TABLE "run_quota" DROP CONSTRAINT "school_daily_run_limit";--> statement-breakpoint
ALTER TABLE "owner_run_quota" ADD CONSTRAINT "owner_daily_run_limit" CHECK ("owner_run_quota"."used"<=100);--> statement-breakpoint
ALTER TABLE "run_quota" ADD CONSTRAINT "school_daily_run_limit" CHECK ("run_quota"."used" <= 300);