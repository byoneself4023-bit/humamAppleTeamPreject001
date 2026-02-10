-- =====================================================
-- MusicSpace DB Schema - 현행화 버전
-- 최종 업데이트: 2026-02-10
-- 실제 DB 기준 (docker exec musicspace-db mariadb로 확인)
-- =====================================================
-- 적용된 마이그레이션:
--   001 (장르 테이블), 002 부분 (scoring tables - 복합 PK 버전),
--   003 (track extended metadata), stats (daily_stats_log 등),
--   008 (user_grade 컬럼 + user_role MASTER)
-- 미적용 마이그레이션 (파일 존재하나 DB에 반영 안됨):
--   004 (tracks.youtube_id - 코드에서 external_metadata JSON으로 대체 사용, 무해)
--   006 (ai_analysis_logs: grade/recommendation/reason/request_source - 엔티티에 필드 없어 무해)
-- 미문서화 테이블: user_profiles (FastAPI AI 학습 프로필)
-- 현재 DB 테이블 (20개):
--   ai_analysis_logs, artist_stats, artists, content_stats, daily_stats_log,
--   ems_playlist_for_recommend, genre_categories, music_genres,
--   playlist_scored_id, playlist_tracks, playlists, track_scored_id,
--   track_tags, tracks, user_cart, user_genres, user_platforms,
--   user_profiles, user_track_ratings, users
-- =====================================================

CREATE DATABASE IF NOT EXISTS music_space_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE music_space_db;

-- =====================================================
-- 1. 회원정보 테이블 (users)
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    user_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '사용자 고유 ID',
    email VARCHAR(255) NOT NULL UNIQUE COMMENT '이메일 (로그인 ID)',
    password_hash VARCHAR(255) NOT NULL COMMENT '비밀번호 해시',
    nickname VARCHAR(100) NOT NULL COMMENT '사용자 닉네임',
    user_role ENUM('USER', 'ADMIN', 'MASTER') NOT NULL DEFAULT 'USER' COMMENT '사용자 역할',
    streaming_services LONGTEXT DEFAULT NULL COMMENT '연결된 스트리밍 서비스 목록 (JSON)',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '가입일시',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
    user_grade VARCHAR(10) DEFAULT NULL COMMENT '사용자 등급 (1-5, migration 008)'
) ENGINE=InnoDB COMMENT='사용자 회원가입 및 로그인 정보';

-- =====================================================
-- 2. 사용자 프로필 테이블 (user_profiles) [미문서화]
-- AI 모델 학습용 프로필 데이터 저장
-- =====================================================
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id INT NOT NULL,
    profile_data LONGTEXT COMMENT 'AI 모델 학습용 프로필 데이터 (JSON)',
    model_version VARCHAR(20) DEFAULT 'v1.0' COMMENT '모델 버전',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
    PRIMARY KEY (user_id)
) ENGINE=InnoDB COMMENT='사용자 AI 학습 프로필 (FastAPI 연동)';

-- =====================================================
-- 3. 외부 스트리밍 플랫폼 연결 정보 (user_platforms)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_platforms (
    platform_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '플랫폼 연결 고유 ID',
    user_id BIGINT NOT NULL COMMENT '사용자 ID',
    platform_name ENUM('Tidal', 'YouTube Music', 'Apple Music') NOT NULL COMMENT '플랫폼 명',
    access_token TEXT COMMENT '액세스 토큰',
    refresh_token TEXT COMMENT '리프레시 토큰',
    connected_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '연동일시',
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY uk_user_platform (user_id, platform_name)
) ENGINE=InnoDB COMMENT='사용자별 연동된 외부 스트리밍 플랫폼 정보';

-- =====================================================
-- 4. 장르 카테고리 테이블 (genre_categories) [migration 001]
-- =====================================================
CREATE TABLE IF NOT EXISTS genre_categories (
    category_id INT NOT NULL AUTO_INCREMENT COMMENT '카테고리 ID',
    category_code VARCHAR(50) NOT NULL COMMENT '카테고리 코드',
    category_name_ko VARCHAR(100) NOT NULL COMMENT '카테고리명 (한국어)',
    category_name_en VARCHAR(100) NOT NULL COMMENT '카테고리명 (영어)',
    category_icon VARCHAR(10) DEFAULT NULL COMMENT '카테고리 아이콘',
    display_order INT DEFAULT 0 COMMENT '표시 순서',
    is_active TINYINT(1) DEFAULT 1 COMMENT '활성화 여부',
    PRIMARY KEY (category_id),
    UNIQUE KEY uk_category_code (category_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='장르 카테고리 테이블';

-- =====================================================
-- 5. 음악 장르 마스터 테이블 (music_genres) [migration 001]
-- =====================================================
CREATE TABLE IF NOT EXISTS music_genres (
    genre_id INT NOT NULL AUTO_INCREMENT COMMENT '장르 고유 ID',
    category_id INT DEFAULT NULL COMMENT '카테고리 ID',
    genre_code VARCHAR(50) NOT NULL COMMENT '장르 코드 (Spotify seed)',
    genre_name_ko VARCHAR(100) NOT NULL COMMENT '장르명 (한국어)',
    genre_name_en VARCHAR(100) NOT NULL COMMENT '장르명 (영어)',
    genre_icon VARCHAR(10) DEFAULT NULL COMMENT '장르 아이콘 (이모지)',
    genre_color VARCHAR(50) DEFAULT NULL COMMENT '장르 대표 색상 (Tailwind gradient)',
    display_order INT DEFAULT 0 COMMENT '표시 순서',
    is_active TINYINT(1) DEFAULT 1 COMMENT '활성화 여부',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
    PRIMARY KEY (genre_id),
    UNIQUE KEY uk_genre_code (genre_code),
    KEY idx_category (category_id),
    CONSTRAINT fk_genre_category FOREIGN KEY (category_id) REFERENCES genre_categories(category_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Spotify 기반 음악 장르 마스터 테이블';

-- =====================================================
-- 6. 사용자-장르 선호도 매핑 테이블 (user_genres) [migration 001]
-- =====================================================
CREATE TABLE IF NOT EXISTS user_genres (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT '매핑 ID',
    user_id BIGINT NOT NULL COMMENT '사용자 ID',
    genre_id INT NOT NULL COMMENT '장르 ID',
    preference_level TINYINT DEFAULT 1 COMMENT '선호도 레벨 (1: 기본, 2: 좋아함, 3: 매우좋아함)',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '등록일시',
    PRIMARY KEY (id),
    UNIQUE KEY uk_user_genre (user_id, genre_id),
    KEY idx_user_id (user_id),
    KEY idx_genre_id (genre_id),
    CONSTRAINT fk_user_genres_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_user_genres_genre FOREIGN KEY (genre_id) REFERENCES music_genres(genre_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='사용자별 선호 장르 매핑';

-- =====================================================
-- 7. 플레이리스트 테이블 (playlists)
-- space_type: PMS(개인)/EMS(외부공유)/GMS(AI추천)
-- status_flag: PTP(임시)/PRP(정규)/PFP(필터링됨)
-- source_type: Platform/Upload/System
-- =====================================================
CREATE TABLE IF NOT EXISTS playlists (
    playlist_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '플레이리스트 고유 ID',
    user_id BIGINT NOT NULL COMMENT '사용자 ID',
    title VARCHAR(200) NOT NULL COMMENT '플레이리스트 제목',
    description TEXT COMMENT '플레이리스트 설명',
    space_type ENUM('PMS', 'EMS', 'GMS') NOT NULL DEFAULT 'EMS' COMMENT '공간 타입',
    status_flag ENUM('PTP', 'PRP', 'PFP') NOT NULL DEFAULT 'PTP' COMMENT '상태 플래그',
    source_type ENUM('Platform', 'Upload', 'System') NOT NULL DEFAULT 'Platform' COMMENT '출처 타입',
    external_id VARCHAR(255) COMMENT '외부 플랫폼 플레이리스트 ID',
    cover_image VARCHAR(500) COMMENT '커버 이미지 URL',
    ai_score DECIMAL(5,2) DEFAULT 0.00 COMMENT 'AI 추천 점수 (0-100)',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_playlists_space_type (space_type),
    INDEX idx_playlists_user_space (user_id, space_type)
) ENGINE=InnoDB COMMENT='플레이리스트 정보 (PMS, EMS, GMS 통합 관리)';

-- =====================================================
-- 8. 트랙(음원) 정보 테이블 (tracks)
-- base + migration 002(일부), 003 컬럼 통합
-- NOTE: youtube_id 컬럼 없음 (migration 004 미적용)
-- NOTE: artwork 컬럼 있음 (미문서화, DB에 존재)
-- =====================================================
CREATE TABLE IF NOT EXISTS tracks (
    track_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '트랙 고유 ID',
    title VARCHAR(255) NOT NULL COMMENT '곡 제목',
    artist VARCHAR(255) NOT NULL COMMENT '아티스트',
    album VARCHAR(255) COMMENT '앨범명',
    duration INT COMMENT '재생 시간(초)',
    isrc VARCHAR(50) COMMENT '국제 표준 녹음 코드',
    external_metadata LONGTEXT COMMENT '외부 플랫폼별 메타데이터 (JSON)',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '등록일시',
    genre VARCHAR(500) COMMENT '음악 장르 (쉼표로 구분)',
    audio_features LONGTEXT COMMENT '오디오 특성 (JSON)',
    artwork VARCHAR(500) COMMENT '앨범 아트 이미지 URL',

    -- Spotify Track Info (migration 003)
    popularity TINYINT UNSIGNED DEFAULT NULL COMMENT 'Spotify 인기도 (0-100)',
    explicit TINYINT(1) DEFAULT 0 COMMENT '성인 컨텐츠 여부',
    release_date DATE DEFAULT NULL COMMENT '발매일',
    track_number SMALLINT UNSIGNED DEFAULT NULL COMMENT '앨범 내 트랙 번호',
    spotify_id VARCHAR(22) DEFAULT NULL COMMENT 'Spotify Track ID',

    -- Last.fm Stats (migration 003)
    playcount BIGINT UNSIGNED DEFAULT NULL COMMENT 'Last.fm 총 재생 횟수',
    listeners INT UNSIGNED DEFAULT NULL COMMENT 'Last.fm 청취자 수',
    mbid VARCHAR(36) DEFAULT NULL COMMENT 'MusicBrainz ID (UUID)',

    -- Spotify Audio Features (migration 003)
    tempo DECIMAL(6,3) DEFAULT NULL COMMENT 'BPM',
    music_key TINYINT DEFAULT NULL COMMENT '조성 (0=C ~ 11=B)',
    mode TINYINT(1) DEFAULT NULL COMMENT '0=Minor, 1=Major',
    time_signature TINYINT DEFAULT NULL COMMENT '박자',
    danceability DECIMAL(4,3) DEFAULT NULL COMMENT '춤추기 좋은 정도 (0.0-1.0)',
    energy DECIMAL(4,3) DEFAULT NULL COMMENT '에너지 레벨 (0.0-1.0)',
    valence DECIMAL(4,3) DEFAULT NULL COMMENT '긍정적 분위기 (0.0-1.0)',
    acousticness DECIMAL(4,3) DEFAULT NULL COMMENT '어쿠스틱 정도 (0.0-1.0)',
    instrumentalness DECIMAL(4,3) DEFAULT NULL COMMENT '보컬 없는 정도 (0.0-1.0)',
    liveness DECIMAL(4,3) DEFAULT NULL COMMENT '라이브 느낌 (0.0-1.0)',
    speechiness DECIMAL(4,3) DEFAULT NULL COMMENT '말하는 정도 (0.0-1.0)',
    loudness DECIMAL(5,2) DEFAULT NULL COMMENT '음량 dB',

    INDEX idx_tracks_artist (artist),
    INDEX idx_tracks_genre (genre),
    INDEX idx_tracks_popularity (popularity DESC),
    INDEX idx_tracks_release_date (release_date),
    INDEX idx_tracks_spotify_id (spotify_id),
    INDEX idx_tracks_mbid (mbid),
    INDEX idx_tracks_tempo (tempo),
    INDEX idx_tracks_energy (energy),
    INDEX idx_tracks_valence (valence)
) ENGINE=InnoDB COMMENT='전체 트랙 메타데이터 저장소';

-- =====================================================
-- 9. 플레이리스트-트랙 매핑 테이블 (playlist_tracks)
-- =====================================================
CREATE TABLE IF NOT EXISTS playlist_tracks (
    map_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '매핑 ID',
    playlist_id BIGINT NOT NULL COMMENT '플레이리스트 ID',
    track_id BIGINT NOT NULL COMMENT '트랙 ID',
    order_index INT NOT NULL DEFAULT 0 COMMENT '플레이리스트 내 정렬 순서',
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '추가된 일시',
    FOREIGN KEY (playlist_id) REFERENCES playlists(playlist_id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES tracks(track_id) ON DELETE CASCADE,
    INDEX idx_playlist_order (playlist_id, order_index)
) ENGINE=InnoDB COMMENT='플레이리스트와 트랙 간의 관계 정의';

-- =====================================================
-- 10. 사용자 트랙 평가 테이블 (user_track_ratings)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_track_ratings (
    rating_id BIGINT NOT NULL AUTO_INCREMENT COMMENT '평가 ID',
    user_id BIGINT NOT NULL COMMENT '사용자 ID',
    track_id BIGINT NOT NULL COMMENT '트랙 ID',
    rating TINYINT NOT NULL COMMENT '평점 (1: 좋아요, -1: 싫어요, 0: 중립)',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '평가일시',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
    PRIMARY KEY (rating_id),
    UNIQUE KEY uk_user_track (user_id, track_id),
    KEY idx_user_id (user_id),
    KEY idx_track_id (track_id),
    CONSTRAINT fk_rating_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_rating_track FOREIGN KEY (track_id) REFERENCES tracks(track_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='사용자 트랙 평가 (좋아요/싫어요)';

-- =====================================================
-- 11. AI 분석 로그 테이블 (ai_analysis_logs)
-- NOTE: migration 006 미적용 (grade/recommendation/reason/request_source 없음)
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_analysis_logs (
    log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    target_type ENUM('Playlist', 'Track') NOT NULL,
    target_id BIGINT NOT NULL,
    score DECIMAL(5, 2),
    analysis_result LONGTEXT COMMENT '상세 분석 결과 (JSON)',
    analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='AI 취향 분석 및 검증 로그';

-- =====================================================
-- 12. 플레이리스트 AI 점수 테이블 (playlist_scored_id)
-- NOTE: base 버전 (composite PK) - migration 002 확장 미적용
-- =====================================================
CREATE TABLE IF NOT EXISTS playlist_scored_id (
    playlist_id BIGINT NOT NULL COMMENT '플레이리스트 ID',
    user_id BIGINT NOT NULL COMMENT '사용자 ID',
    ai_score DECIMAL(5, 2) DEFAULT 0.00 COMMENT 'AI 추천/검증 점수',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
    PRIMARY KEY (playlist_id, user_id),
    FOREIGN KEY (playlist_id) REFERENCES playlists(playlist_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='사용자별 플레이리스트 평가 점수';

-- =====================================================
-- 13. 트랙 AI 점수 테이블 (track_scored_id)
-- NOTE: base 버전 (composite PK) - migration 002 확장 미적용
-- =====================================================
CREATE TABLE IF NOT EXISTS track_scored_id (
    track_id BIGINT NOT NULL COMMENT '트랙 ID',
    user_id BIGINT NOT NULL COMMENT '사용자 ID',
    ai_score DECIMAL(5, 2) DEFAULT 0.00 COMMENT 'AI 추천/검증 점수',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
    PRIMARY KEY (track_id, user_id),
    FOREIGN KEY (track_id) REFERENCES tracks(track_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='사용자별 트랙 평가 점수';

-- =====================================================
-- 14. 트랙 태그 테이블 (track_tags) [migration 002]
-- =====================================================
CREATE TABLE IF NOT EXISTS track_tags (
    id BIGINT NOT NULL AUTO_INCREMENT COMMENT 'ID',
    track_id BIGINT NOT NULL COMMENT '트랙 ID',
    tag VARCHAR(100) NOT NULL COMMENT '태그명',
    source VARCHAR(50) DEFAULT 'lastfm' COMMENT '태그 출처 (lastfm, spotify, user)',
    weight INT DEFAULT 100 COMMENT '태그 가중치 (0-100)',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
    PRIMARY KEY (id),
    UNIQUE KEY uk_track_tag_source (track_id, tag, source),
    KEY idx_track_id (track_id),
    KEY idx_tag (tag),
    CONSTRAINT fk_tag_track FOREIGN KEY (track_id) REFERENCES tracks(track_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='트랙 태그 정보';

-- =====================================================
-- 15. 아티스트 테이블 (artists) [migration 003]
-- =====================================================
CREATE TABLE IF NOT EXISTS artists (
    artist_id BIGINT NOT NULL AUTO_INCREMENT COMMENT '아티스트 ID',
    name VARCHAR(255) NOT NULL COMMENT '아티스트명',
    spotify_id VARCHAR(22) DEFAULT NULL COMMENT 'Spotify Artist ID',
    mbid VARCHAR(36) DEFAULT NULL COMMENT 'MusicBrainz ID',
    genres JSON DEFAULT NULL COMMENT '장르 목록 (JSON 배열)',
    popularity TINYINT UNSIGNED DEFAULT NULL COMMENT 'Spotify 인기도',
    followers INT UNSIGNED DEFAULT NULL COMMENT 'Spotify 팔로워 수',
    image_url VARCHAR(500) DEFAULT NULL COMMENT '아티스트 이미지 URL',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (artist_id),
    UNIQUE KEY uk_spotify_id (spotify_id),
    KEY idx_name (name),
    KEY idx_mbid (mbid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='아티스트 정보 테이블';

-- =====================================================
-- 16. 콘텐츠 통계 테이블 (content_stats) [create_stats_tables]
-- =====================================================
CREATE TABLE IF NOT EXISTS content_stats (
    stat_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '통계 ID',
    content_type ENUM('playlist', 'track', 'album') NOT NULL COMMENT '콘텐츠 타입',
    content_id BIGINT NOT NULL COMMENT '콘텐츠 ID',
    view_count INT DEFAULT 0 COMMENT '조회수',
    play_count INT DEFAULT 0 COMMENT '재생수',
    like_count INT DEFAULT 0 COMMENT '좋아요 수',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
    UNIQUE KEY uk_content (content_type, content_id),
    INDEX idx_view_count (content_type, view_count DESC),
    INDEX idx_play_count (content_type, play_count DESC)
) ENGINE=InnoDB COMMENT='콘텐츠별 조회/재생 통계';

-- =====================================================
-- 17. 아티스트 통계 테이블 (artist_stats) [create_stats_tables]
-- =====================================================
CREATE TABLE IF NOT EXISTS artist_stats (
    stat_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '통계 ID',
    artist_name VARCHAR(255) NOT NULL COMMENT '아티스트 이름',
    view_count INT DEFAULT 0 COMMENT '조회수',
    play_count INT DEFAULT 0 COMMENT '재생수',
    like_count INT DEFAULT 0 COMMENT '좋아요 수',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
    UNIQUE KEY uk_artist (artist_name),
    INDEX idx_play_count (play_count DESC)
) ENGINE=InnoDB COMMENT='아티스트별 통계';

-- =====================================================
-- 18. 일별 통계 로그 (daily_stats_log) [create_stats_tables]
-- =====================================================
CREATE TABLE IF NOT EXISTS daily_stats_log (
    log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    log_date DATE NOT NULL COMMENT '날짜',
    content_type ENUM('playlist', 'track', 'album', 'artist') NOT NULL,
    content_id BIGINT COMMENT '콘텐츠 ID (아티스트는 NULL)',
    artist_name VARCHAR(255) COMMENT '아티스트 이름 (아티스트일 때만)',
    view_count INT DEFAULT 0,
    play_count INT DEFAULT 0,
    UNIQUE KEY uk_daily (log_date, content_type, content_id, artist_name),
    INDEX idx_date (log_date DESC)
) ENGINE=InnoDB COMMENT='일별 통계 로그';

-- =====================================================
-- [미적용 마이그레이션 - 필요 시 수동 실행]
-- 004: tracks.youtube_id 컬럼 추가
-- 005: ems_playlist_for_recommend 테이블 생성
-- 006: ai_analysis_logs.grade/recommendation/reason/request_source 추가
-- 007: user_cart 테이블 생성
-- 파일 위치: server/migrations/
-- =====================================================

-- =====================================================
-- 장르 초기 데이터 (migration 001)
-- =====================================================
INSERT INTO genre_categories (category_code, category_name_ko, category_name_en, category_icon, display_order) VALUES
('popular', '인기 장르', 'Popular', '🎵', 1),
('electronic', '일렉트로닉', 'Electronic', '🎛️', 2),
('rock_metal', '락/메탈', 'Rock & Metal', '🎸', 3),
('urban', '어반/힙합', 'Urban & Hip-Hop', '🎤', 4),
('acoustic', '어쿠스틱/포크', 'Acoustic & Folk', '🪕', 5),
('world', '월드뮤직', 'World Music', '🌍', 6),
('mood', '분위기/무드', 'Mood & Vibes', '✨', 7)
ON DUPLICATE KEY UPDATE category_name_ko = VALUES(category_name_ko), category_name_en = VALUES(category_name_en);

INSERT INTO music_genres (category_id, genre_code, genre_name_ko, genre_name_en, genre_icon, genre_color, display_order) VALUES
((SELECT category_id FROM genre_categories WHERE category_code = 'popular'), 'k-pop', 'K-POP', 'K-POP', '🇰🇷', 'from-pink-500 to-purple-500', 1),
((SELECT category_id FROM genre_categories WHERE category_code = 'popular'), 'pop', '팝', 'Pop', '🎶', 'from-blue-400 to-cyan-400', 2),
((SELECT category_id FROM genre_categories WHERE category_code = 'popular'), 'j-pop', 'J-POP', 'J-POP', '🇯🇵', 'from-red-400 to-pink-400', 3),
((SELECT category_id FROM genre_categories WHERE category_code = 'popular'), 'indie', '인디', 'Indie', '🌿', 'from-green-400 to-teal-500', 4),
((SELECT category_id FROM genre_categories WHERE category_code = 'popular'), 'indie-pop', '인디팝', 'Indie Pop', '🌸', 'from-emerald-400 to-cyan-400', 5),
((SELECT category_id FROM genre_categories WHERE category_code = 'popular'), 'anime', '애니메이션', 'Anime', '🎌', 'from-violet-400 to-purple-500', 6),
((SELECT category_id FROM genre_categories WHERE category_code = 'popular'), 'soundtracks', 'OST/사운드트랙', 'Soundtracks', '🎬', 'from-amber-400 to-orange-400', 7),
((SELECT category_id FROM genre_categories WHERE category_code = 'popular'), 'disney', '디즈니', 'Disney', '🏰', 'from-blue-500 to-indigo-500', 8)
ON DUPLICATE KEY UPDATE genre_name_ko = VALUES(genre_name_ko);

INSERT INTO music_genres (category_id, genre_code, genre_name_ko, genre_name_en, genre_icon, genre_color, display_order) VALUES
((SELECT category_id FROM genre_categories WHERE category_code = 'electronic'), 'edm', 'EDM', 'EDM', '⚡', 'from-cyan-400 to-blue-500', 10),
((SELECT category_id FROM genre_categories WHERE category_code = 'electronic'), 'house', '하우스', 'House', '🏠', 'from-purple-500 to-pink-500', 11),
((SELECT category_id FROM genre_categories WHERE category_code = 'electronic'), 'deep-house', '딥하우스', 'Deep House', '🌊', 'from-indigo-500 to-purple-500', 12),
((SELECT category_id FROM genre_categories WHERE category_code = 'electronic'), 'progressive-house', '프로그레시브 하우스', 'Progressive House', '🔮', 'from-blue-500 to-violet-500', 13),
((SELECT category_id FROM genre_categories WHERE category_code = 'electronic'), 'techno', '테크노', 'Techno', '🤖', 'from-gray-600 to-gray-800', 14),
((SELECT category_id FROM genre_categories WHERE category_code = 'electronic'), 'trance', '트랜스', 'Trance', '🌀', 'from-cyan-500 to-blue-600', 15),
((SELECT category_id FROM genre_categories WHERE category_code = 'electronic'), 'dubstep', '덥스텝', 'Dubstep', '💥', 'from-purple-600 to-indigo-600', 16),
((SELECT category_id FROM genre_categories WHERE category_code = 'electronic'), 'drum-and-bass', '드럼앤베이스', 'Drum and Bass', '🥁', 'from-orange-500 to-red-500', 17),
((SELECT category_id FROM genre_categories WHERE category_code = 'electronic'), 'electronic', '일렉트로닉', 'Electronic', '🎛️', 'from-violet-500 to-purple-600', 18),
((SELECT category_id FROM genre_categories WHERE category_code = 'electronic'), 'electro', '일렉트로', 'Electro', '⚡', 'from-yellow-400 to-orange-500', 19),
((SELECT category_id FROM genre_categories WHERE category_code = 'electronic'), 'synth-pop', '신스팝', 'Synth Pop', '🎹', 'from-pink-400 to-rose-500', 20),
((SELECT category_id FROM genre_categories WHERE category_code = 'electronic'), 'disco', '디스코', 'Disco', '🪩', 'from-fuchsia-500 to-pink-500', 21)
ON DUPLICATE KEY UPDATE genre_name_ko = VALUES(genre_name_ko);

INSERT INTO music_genres (category_id, genre_code, genre_name_ko, genre_name_en, genre_icon, genre_color, display_order) VALUES
((SELECT category_id FROM genre_categories WHERE category_code = 'rock_metal'), 'rock', '락', 'Rock', '🎸', 'from-red-500 to-orange-500', 30),
((SELECT category_id FROM genre_categories WHERE category_code = 'rock_metal'), 'alt-rock', '얼터너티브 락', 'Alternative Rock', '🔊', 'from-slate-500 to-gray-600', 31),
((SELECT category_id FROM genre_categories WHERE category_code = 'rock_metal'), 'hard-rock', '하드락', 'Hard Rock', '🔥', 'from-red-600 to-red-800', 32),
((SELECT category_id FROM genre_categories WHERE category_code = 'rock_metal'), 'punk', '펑크', 'Punk', '✊', 'from-lime-500 to-green-600', 33),
((SELECT category_id FROM genre_categories WHERE category_code = 'rock_metal'), 'punk-rock', '펑크락', 'Punk Rock', '🤘', 'from-green-500 to-emerald-600', 34),
((SELECT category_id FROM genre_categories WHERE category_code = 'rock_metal'), 'grunge', '그런지', 'Grunge', '☁️', 'from-stone-500 to-stone-700', 35),
((SELECT category_id FROM genre_categories WHERE category_code = 'rock_metal'), 'metal', '메탈', 'Metal', '⚙️', 'from-gray-700 to-gray-900', 36),
((SELECT category_id FROM genre_categories WHERE category_code = 'rock_metal'), 'heavy-metal', '헤비메탈', 'Heavy Metal', '💀', 'from-zinc-700 to-black', 37),
((SELECT category_id FROM genre_categories WHERE category_code = 'rock_metal'), 'metalcore', '메탈코어', 'Metalcore', '🦅', 'from-red-700 to-gray-800', 38),
((SELECT category_id FROM genre_categories WHERE category_code = 'rock_metal'), 'emo', '이모', 'Emo', '🖤', 'from-gray-600 to-purple-700', 39),
((SELECT category_id FROM genre_categories WHERE category_code = 'rock_metal'), 'goth', '고스', 'Goth', '🦇', 'from-purple-800 to-gray-900', 40)
ON DUPLICATE KEY UPDATE genre_name_ko = VALUES(genre_name_ko);

INSERT INTO music_genres (category_id, genre_code, genre_name_ko, genre_name_en, genre_icon, genre_color, display_order) VALUES
((SELECT category_id FROM genre_categories WHERE category_code = 'urban'), 'hip-hop', '힙합', 'Hip-Hop', '🎤', 'from-orange-500 to-red-500', 50),
((SELECT category_id FROM genre_categories WHERE category_code = 'urban'), 'r-n-b', 'R&B', 'R&B', '🎵', 'from-purple-500 to-pink-500', 51),
((SELECT category_id FROM genre_categories WHERE category_code = 'urban'), 'soul', '소울', 'Soul', '💫', 'from-amber-500 to-orange-500', 52),
((SELECT category_id FROM genre_categories WHERE category_code = 'urban'), 'funk', '펑크', 'Funk', '🕺', 'from-yellow-500 to-orange-500', 53),
((SELECT category_id FROM genre_categories WHERE category_code = 'urban'), 'gospel', '가스펠', 'Gospel', '🙏', 'from-yellow-400 to-amber-500', 54),
((SELECT category_id FROM genre_categories WHERE category_code = 'urban'), 'reggae', '레게', 'Reggae', '🌴', 'from-green-500 to-yellow-400', 55),
((SELECT category_id FROM genre_categories WHERE category_code = 'urban'), 'reggaeton', '레게톤', 'Reggaeton', '💃', 'from-red-500 to-yellow-500', 56),
((SELECT category_id FROM genre_categories WHERE category_code = 'urban'), 'dancehall', '댄스홀', 'Dancehall', '🎊', 'from-green-400 to-lime-500', 57)
ON DUPLICATE KEY UPDATE genre_name_ko = VALUES(genre_name_ko);

INSERT INTO music_genres (category_id, genre_code, genre_name_ko, genre_name_en, genre_icon, genre_color, display_order) VALUES
((SELECT category_id FROM genre_categories WHERE category_code = 'acoustic'), 'acoustic', '어쿠스틱', 'Acoustic', '🪕', 'from-amber-400 to-yellow-500', 60),
((SELECT category_id FROM genre_categories WHERE category_code = 'acoustic'), 'folk', '포크', 'Folk', '🌾', 'from-orange-400 to-amber-500', 61),
((SELECT category_id FROM genre_categories WHERE category_code = 'acoustic'), 'singer-songwriter', '싱어송라이터', 'Singer-Songwriter', '✍️', 'from-rose-400 to-pink-500', 62),
((SELECT category_id FROM genre_categories WHERE category_code = 'acoustic'), 'country', '컨트리', 'Country', '🤠', 'from-amber-600 to-orange-500', 63),
((SELECT category_id FROM genre_categories WHERE category_code = 'acoustic'), 'bluegrass', '블루그래스', 'Bluegrass', '🌿', 'from-green-600 to-teal-600', 64),
((SELECT category_id FROM genre_categories WHERE category_code = 'acoustic'), 'blues', '블루스', 'Blues', '🎷', 'from-blue-600 to-indigo-600', 65),
((SELECT category_id FROM genre_categories WHERE category_code = 'acoustic'), 'jazz', '재즈', 'Jazz', '🎺', 'from-amber-500 to-yellow-400', 66),
((SELECT category_id FROM genre_categories WHERE category_code = 'acoustic'), 'classical', '클래식', 'Classical', '🎻', 'from-slate-400 to-gray-500', 67),
((SELECT category_id FROM genre_categories WHERE category_code = 'acoustic'), 'piano', '피아노', 'Piano', '🎹', 'from-gray-400 to-slate-500', 68),
((SELECT category_id FROM genre_categories WHERE category_code = 'acoustic'), 'guitar', '기타', 'Guitar', '🎸', 'from-orange-500 to-amber-600', 69),
((SELECT category_id FROM genre_categories WHERE category_code = 'acoustic'), 'opera', '오페라', 'Opera', '🎭', 'from-red-700 to-rose-800', 70)
ON DUPLICATE KEY UPDATE genre_name_ko = VALUES(genre_name_ko);

INSERT INTO music_genres (category_id, genre_code, genre_name_ko, genre_name_en, genre_icon, genre_color, display_order) VALUES
((SELECT category_id FROM genre_categories WHERE category_code = 'world'), 'latin', '라틴', 'Latin', '🌶️', 'from-red-500 to-orange-400', 80),
((SELECT category_id FROM genre_categories WHERE category_code = 'world'), 'salsa', '살사', 'Salsa', '💃', 'from-red-500 to-yellow-500', 81),
((SELECT category_id FROM genre_categories WHERE category_code = 'world'), 'tango', '탱고', 'Tango', '🌹', 'from-red-600 to-rose-600', 82),
((SELECT category_id FROM genre_categories WHERE category_code = 'world'), 'samba', '삼바', 'Samba', '🥁', 'from-green-500 to-yellow-400', 83),
((SELECT category_id FROM genre_categories WHERE category_code = 'world'), 'brazil', '브라질', 'Brazil', '🇧🇷', 'from-green-500 to-yellow-500', 84),
((SELECT category_id FROM genre_categories WHERE category_code = 'world'), 'bossanova', '보사노바', 'Bossa Nova', '🎶', 'from-teal-400 to-cyan-500', 85),
((SELECT category_id FROM genre_categories WHERE category_code = 'world'), 'afrobeat', '아프로비트', 'Afrobeat', '🌍', 'from-orange-500 to-yellow-500', 86),
((SELECT category_id FROM genre_categories WHERE category_code = 'world'), 'indian', '인디안', 'Indian', '🪘', 'from-orange-500 to-red-500', 87),
((SELECT category_id FROM genre_categories WHERE category_code = 'world'), 'turkish', '터키', 'Turkish', '🌙', 'from-red-500 to-rose-500', 88),
((SELECT category_id FROM genre_categories WHERE category_code = 'world'), 'french', '프렌치', 'French', '🇫🇷', 'from-blue-500 to-red-500', 89),
((SELECT category_id FROM genre_categories WHERE category_code = 'world'), 'british', '브리티시', 'British', '🇬🇧', 'from-blue-600 to-red-600', 90),
((SELECT category_id FROM genre_categories WHERE category_code = 'world'), 'world-music', '월드뮤직', 'World Music', '🌏', 'from-teal-500 to-emerald-500', 91)
ON DUPLICATE KEY UPDATE genre_name_ko = VALUES(genre_name_ko);

INSERT INTO music_genres (category_id, genre_code, genre_name_ko, genre_name_en, genre_icon, genre_color, display_order) VALUES
((SELECT category_id FROM genre_categories WHERE category_code = 'mood'), 'chill', '칠', 'Chill', '😌', 'from-cyan-400 to-blue-400', 100),
((SELECT category_id FROM genre_categories WHERE category_code = 'mood'), 'ambient', '앰비언트', 'Ambient', '🌫️', 'from-slate-400 to-blue-400', 101),
((SELECT category_id FROM genre_categories WHERE category_code = 'mood'), 'new-age', '뉴에이지', 'New Age', '🔮', 'from-purple-400 to-indigo-400', 102),
((SELECT category_id FROM genre_categories WHERE category_code = 'mood'), 'romance', '로맨스', 'Romance', '💕', 'from-pink-400 to-rose-400', 103),
((SELECT category_id FROM genre_categories WHERE category_code = 'mood'), 'sad', '감성', 'Sad', '🌧️', 'from-blue-500 to-indigo-500', 104),
((SELECT category_id FROM genre_categories WHERE category_code = 'mood'), 'happy', '해피', 'Happy', '☀️', 'from-yellow-400 to-orange-400', 105),
((SELECT category_id FROM genre_categories WHERE category_code = 'mood'), 'party', '파티', 'Party', '🎉', 'from-fuchsia-500 to-pink-500', 106),
((SELECT category_id FROM genre_categories WHERE category_code = 'mood'), 'dance', '댄스', 'Dance', '💃', 'from-pink-500 to-purple-500', 107),
((SELECT category_id FROM genre_categories WHERE category_code = 'mood'), 'club', '클럽', 'Club', '🎰', 'from-violet-500 to-purple-600', 108),
((SELECT category_id FROM genre_categories WHERE category_code = 'mood'), 'groove', '그루브', 'Groove', '🎵', 'from-orange-400 to-red-400', 109),
((SELECT category_id FROM genre_categories WHERE category_code = 'mood'), 'sleep', '수면', 'Sleep', '🌙', 'from-indigo-400 to-purple-500', 110),
((SELECT category_id FROM genre_categories WHERE category_code = 'mood'), 'study', '공부', 'Study', '📚', 'from-green-400 to-teal-400', 111),
((SELECT category_id FROM genre_categories WHERE category_code = 'mood'), 'work-out', '운동', 'Work Out', '💪', 'from-red-500 to-orange-500', 112)
ON DUPLICATE KEY UPDATE genre_name_ko = VALUES(genre_name_ko);

-- =====================================================
-- 접속 권한 설정
-- =====================================================
ALTER USER 'musicspace'@'%' IDENTIFIED WITH mysql_native_password BY 'musicspace123';

CREATE USER IF NOT EXISTS 'musicspace'@'175.195.36.16' IDENTIFIED BY 'musicspace123';
GRANT ALL PRIVILEGES ON music_space_db.* TO 'musicspace'@'175.195.36.16';

FLUSH PRIVILEGES;
