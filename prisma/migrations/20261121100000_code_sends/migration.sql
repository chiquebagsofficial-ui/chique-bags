-- Log of emailed verification codes, used to allow at most 3 codes per email per hour.
CREATE TABLE "code_sends" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "purpose" "CodePurpose" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "code_sends_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "code_sends_email_purpose_createdAt_idx" ON "code_sends"("email", "purpose", "createdAt");
