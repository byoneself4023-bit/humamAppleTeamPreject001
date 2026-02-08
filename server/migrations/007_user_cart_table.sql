-- User Cart 테이블 생성
CREATE TABLE IF NOT EXISTS user_cart (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    track_id BIGINT NULL,
    title VARCHAR(500) NOT NULL,
    artist VARCHAR(500) NOT NULL,
    album VARCHAR(500) NULL,
    artwork VARCHAR(1000) NULL,
    preview_url VARCHAR(1000) NULL,
    external_id VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_cart_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT uq_user_cart_track UNIQUE (user_id, title, artist)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 인덱스
CREATE INDEX idx_user_cart_user_id ON user_cart(user_id);
CREATE INDEX idx_user_cart_created_at ON user_cart(created_at);
