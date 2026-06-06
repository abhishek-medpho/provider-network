-- Rename "quietHourStart/End" → "activeHourStart/End" to match semantics.
-- The columns hold the ACTIVE sending window (8-21), not the quiet window.
-- Use plain RENAME so existing campaign values are preserved.

ALTER TABLE "Campaign" RENAME COLUMN "quietHourStart" TO "activeHourStart";
ALTER TABLE "Campaign" RENAME COLUMN "quietHourEnd"   TO "activeHourEnd";
