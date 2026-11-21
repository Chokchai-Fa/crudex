CREATE TABLE "platform_admins" (
	"account_id" uuid PRIMARY KEY NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_admins" ADD CONSTRAINT "platform_admins_account_id_school_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."school_accounts"("id") ON DELETE no action ON UPDATE no action;