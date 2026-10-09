CREATE DATABASE IF NOT EXISTS short_auth_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON short_auth_test.* TO 'auth_owner'@'%';
