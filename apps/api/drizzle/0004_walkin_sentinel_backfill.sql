-- Backfill: 把任何残留的 __WALKIN__* sentinel 标记成 is_walkin=true，
-- 避免它们在 /api/members?type=member 的会员档案里出现。
-- 写得幂等，重复执行安全。
UPDATE `members` SET `is_walkin` = 1 WHERE `uid` LIKE '__WALKIN__%' AND `is_walkin` = 0;
