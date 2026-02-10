-- Migration: 008_users_grade_and_master_role
-- Description: users 테이블에 user_grade 컬럼 추가 및 user_role ENUM에 MASTER 추가
-- Purpose: Spring Boot JPA 엔티티(Users.java)와 DB 스키마 불일치 해소
--          - RoleType enum에 MASTER 존재하지만 DB ENUM에 없어 DataInitializer 실패
--          - Users.java에 grade 필드 존재하지만 DB 컬럼 없어 시작 시 SELECT 실패
-- Created: 2026-02-10

-- =====================================================
-- 1. user_grade 컬럼 추가
-- =====================================================
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'user_grade');
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE `users` ADD COLUMN `user_grade` VARCHAR(10) DEFAULT NULL COMMENT ''사용자 등급 (1-5)'' AFTER `user_role`',
    'SELECT ''user_grade column already exists''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================
-- 2. user_role ENUM에 MASTER 추가
-- =====================================================
SET @master_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'user_role'
      AND COLUMN_TYPE LIKE '%MASTER%');
SET @sql = IF(@master_exists = 0,
    'ALTER TABLE `users` MODIFY COLUMN `user_role` ENUM(''USER'', ''ADMIN'', ''MASTER'') NOT NULL DEFAULT ''USER'' COMMENT ''사용자 역할''',
    'SELECT ''MASTER already in user_role enum''');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================
-- 확인 쿼리
-- =====================================================
-- DESCRIBE users;
