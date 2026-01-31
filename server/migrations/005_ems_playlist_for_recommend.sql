-- Migration: 005_ems_playlist_for_recommend
-- Description: GMS용 EMS 플레이리스트 추천 테이블 생성
-- Created: 2026-01-31

CREATE TABLE IF NOT EXISTS ems_playlist_for_recommend (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '고유 ID',
    playlist_id BIGINT NOT NULL COMMENT '플레이리스트 ID (playlists 테이블 참조)',
    user_id BIGINT NOT NULL COMMENT '사용자 ID',
    status ENUM('valid', 'invalid') NOT NULL DEFAULT 'valid' COMMENT '추천 유효 상태',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',

    FOREIGN KEY (playlist_id) REFERENCES playlists(playlist_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_user_status (user_id, status),
    INDEX idx_playlist (playlist_id)
) ENGINE=InnoDB COMMENT='GMS용 EMS 플레이리스트 추천 테이블';
