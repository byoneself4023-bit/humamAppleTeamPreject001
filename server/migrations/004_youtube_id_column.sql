-- Add youtube_id column to tracks table
-- YouTube Video ID는 11자리 문자열

ALTER TABLE `tracks`
ADD COLUMN IF NOT EXISTS `youtube_id` VARCHAR(11) DEFAULT NULL COMMENT 'YouTube Video ID';

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS `idx_tracks_youtube_id` ON `tracks` (`youtube_id`);
