CREATE TABLE "replies" (
	"handle" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"received_seq" bigint NOT NULL,
	"reply_blob" "bytea" NOT NULL,
	CONSTRAINT "replies_handle_received_seq_pk" PRIMARY KEY("handle","received_seq")
);
--> statement-breakpoint
CREATE TABLE "wyrds" (
	"handle" text PRIMARY KEY NOT NULL,
	"k_origin_pub" "bytea" NOT NULL,
	"envelope" "bytea" NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"replies_enabled" boolean DEFAULT false NOT NULL,
	"gone_at" timestamp with time zone,
	"gone_reason" text
);
--> statement-breakpoint
ALTER TABLE "replies" ADD CONSTRAINT "replies_handle_wyrds_handle_fk" FOREIGN KEY ("handle") REFERENCES "public"."wyrds"("handle") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "replies_received_at_idx" ON "replies" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "wyrds_expires_at_idx" ON "wyrds" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "wyrds_k_origin_pub_idx" ON "wyrds" USING btree ("k_origin_pub");--> statement-breakpoint
CREATE INDEX "wyrds_gone_at_idx" ON "wyrds" USING btree ("gone_at");