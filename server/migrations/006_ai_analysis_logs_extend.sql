-- Migration: 006_ai_analysis_logs_extend
-- Description: ai_analysis_logs 테이블에 grade, recommendation 컬럼 추가
-- Purpose: 장바구니 분석 요청 시 AI 분석 결과를 저장하여 사용자에게 추천
-- Created: 2026-02-05

-- =====================================================
-- ai_analysis_logs 테이블 확장
-- =====================================================

-- 1. grade 컬럼 추가 (S, A, B, C, D, F 등급)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_analysis_logs' AND COLUMN_NAME = 'grade');
SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE `ai_analysis_logs` ADD COLUMN `grade` VARCHAR(10) DEFAULT NULL COMMENT ''AI 분석 등급 (S/A/B/C/D/F)'' AFTER `score`',
    'SELECT ''grade column already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. recommendation 컬럼 추가 (approve, reject, pending)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_analysis_logs' AND COLUMN_NAME = 'recommendation');
SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE `ai_analysis_logs` ADD COLUMN `recommendation` ENUM(''approve'', ''reject'', ''pending'') DEFAULT ''pending'' COMMENT ''GMS 이동 추천 (approve:승인/reject:거절/pending:보류)'' AFTER `grade`',
    'SELECT ''recommendation column already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. reason 컬럼 추가 (분석 결과 설명)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_analysis_logs' AND COLUMN_NAME = 'reason');
SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE `ai_analysis_logs` ADD COLUMN `reason` TEXT DEFAULT NULL COMMENT ''분석 결과 설명'' AFTER `recommendation`',
    'SELECT ''reason column already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. request_source 컬럼 추가 (요청 출처: cart, playlist, batch)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_analysis_logs' AND COLUMN_NAME = 'request_source');
SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE `ai_analysis_logs` ADD COLUMN `request_source` VARCHAR(50) DEFAULT ''cart'' COMMENT ''분석 요청 출처 (cart/playlist/batch)'' AFTER `reason`',
    'SELECT ''request_source column already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================
-- 인덱스 추가
-- =====================================================

-- recommendation 인덱스 (추천 목록 조회용)
SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_analysis_logs' AND INDEX_NAME = 'idx_recommendation');
SET @sql = IF(@idx_exists = 0, 
    'CREATE INDEX `idx_recommendation` ON `ai_analysis_logs` (`recommendation`)', 
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- grade 인덱스 (등급별 조회용)
SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_analysis_logs' AND INDEX_NAME = 'idx_grade');
SET @sql = IF(@idx_exists = 0, 
    'CREATE INDEX `idx_grade` ON `ai_analysis_logs` (`grade`)', 
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- user_id + recommendation 복합 인덱스 (사용자별 추천 목록)
SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_analysis_logs' AND INDEX_NAME = 'idx_user_recommendation');
SET @sql = IF(@idx_exists = 0, 
    'CREATE INDEX `idx_user_recommendation` ON `ai_analysis_logs` (`user_id`, `recommendation`)', 
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- target_type + target_id 복합 인덱스 (특정 대상 조회용)
SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_analysis_logs' AND INDEX_NAME = 'idx_target');
SET @sql = IF(@idx_exists = 0, 
    'CREATE INDEX `idx_target` ON `ai_analysis_logs` (`target_type`, `target_id`)', 
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================================
-- 확인 쿼리
-- =====================================================
-- DESCRIBE ai_analysis_logs;
-- SELECT * FROM ai_analysis_logs ORDER BY analyzed_at DESC LIMIT 10;
