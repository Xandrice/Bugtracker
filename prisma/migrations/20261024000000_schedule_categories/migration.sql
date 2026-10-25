ALTER TABLE "Issue" ADD COLUMN "startDate" TIMESTAMP(3);
ALTER TABLE "Release" ADD COLUMN "startDate" TIMESTAMP(3);
CREATE TABLE "ScheduleCategory" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  CONSTRAINT "ScheduleCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ScheduleCategory_name_key" ON "ScheduleCategory"("name");
CREATE TABLE "_IssueToScheduleCategory" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL,
  CONSTRAINT "_IssueToScheduleCategory_AB_pkey" PRIMARY KEY ("A", "B")
);
CREATE INDEX "_IssueToScheduleCategory_B_index" ON "_IssueToScheduleCategory"("B");
ALTER TABLE "_IssueToScheduleCategory" ADD CONSTRAINT "_IssueToScheduleCategory_A_fkey" FOREIGN KEY ("A") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_IssueToScheduleCategory" ADD CONSTRAINT "_IssueToScheduleCategory_B_fkey" FOREIGN KEY ("B") REFERENCES "ScheduleCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "_ReleaseToScheduleCategory" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL,
  CONSTRAINT "_ReleaseToScheduleCategory_AB_pkey" PRIMARY KEY ("A", "B")
);
CREATE INDEX "_ReleaseToScheduleCategory_B_index" ON "_ReleaseToScheduleCategory"("B");
ALTER TABLE "_ReleaseToScheduleCategory" ADD CONSTRAINT "_ReleaseToScheduleCategory_A_fkey" FOREIGN KEY ("A") REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ReleaseToScheduleCategory" ADD CONSTRAINT "_ReleaseToScheduleCategory_B_fkey" FOREIGN KEY ("B") REFERENCES "ScheduleCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_schedule_range_check" CHECK ("startDate" IS NULL OR "dueDate" IS NULL OR "startDate" <= "dueDate");
ALTER TABLE "Release" ADD CONSTRAINT "Release_schedule_range_check" CHECK ("startDate" IS NULL OR "targetDate" IS NULL OR "startDate" <= "targetDate");
