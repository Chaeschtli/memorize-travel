<?php
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_path', '/');
    ini_set('session.cookie_samesite', 'Lax');
    session_name('travelblog_session');
    session_start();
}
define('DB_PATH', __DIR__ . '/../data/travelblog.db');
define('UPLOAD_PATH', __DIR__ . '/../uploads/');

function getDb(): PDO {
    if (!file_exists(dirname(DB_PATH))) mkdir(dirname(DB_PATH), 0755, true);
    $pdo = new PDO('sqlite:' . DB_PATH);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            avatar TEXT DEFAULT NULL,
            is_admin INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS trips (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            summary TEXT,
            description TEXT,
            country TEXT,
            duration TEXT,
            highlights TEXT,
            banner_image TEXT,
            card_image TEXT,
            card_emoji TEXT DEFAULT '✈️',
            use_emoji INTEGER DEFAULT 0,
            spotify_embed TEXT,
            published INTEGER DEFAULT 0,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trip_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT,
            image TEXT,
            sort_order INTEGER DEFAULT 0,
            published INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS tips (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            content TEXT,
            image TEXT,
            type TEXT DEFAULT 'tip',
            published INTEGER DEFAULT 1,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS trip_tips (
            trip_id INTEGER,
            tip_id INTEGER,
            PRIMARY KEY (trip_id, tip_id),
            FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
            FOREIGN KEY (tip_id) REFERENCES tips(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS tip_likes (
            user_id INTEGER,
            tip_id INTEGER,
            PRIMARY KEY (user_id, tip_id)
        );
        CREATE TABLE IF NOT EXISTS saved_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            ref_id TEXT NOT NULL,
            title TEXT,
            UNIQUE(user_id, type, ref_id)
        );
        CREATE TABLE IF NOT EXISTS site_config (
            key TEXT PRIMARY KEY,
            value TEXT
        );
        INSERT OR IGNORE INTO site_config VALUES ('site_title','Mike Travels');
        INSERT OR IGNORE INTO site_config VALUES ('site_subtitle','Geschichten, Orte und Momente von unterwegs');
        INSERT OR IGNORE INTO site_config VALUES ('banner_color','#1a1a1a');
        CREATE TABLE IF NOT EXISTS post_media (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER NOT NULL,
            path TEXT NOT NULL,
            type TEXT DEFAULT 'image',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS post_tips (
            post_id INTEGER,
            tip_id INTEGER,
            PRIMARY KEY (post_id, tip_id),
            FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
            FOREIGN KEY (tip_id) REFERENCES tips(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS tip_media (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tip_id INTEGER NOT NULL,
            path TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tip_id) REFERENCES tips(id) ON DELETE CASCADE
        );
    ");
    return $pdo;
}

function jsonResponse(array $data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function getBody(): array {
    return json_decode(file_get_contents('php://input'), true) ?? [];
}

function requireAuth(): array {
    if (empty($_SESSION['user_id'])) jsonResponse(['error' => 'Nicht angemeldet'], 401);
    return ['id' => $_SESSION['user_id'], 'username' => $_SESSION['username'], 'is_admin' => $_SESSION['is_admin'] ?? 0];
}

function requireAdmin(): array {
    $user = requireAuth();
    if (!$user['is_admin']) jsonResponse(['error' => 'Kein Zugriff'], 403);
    return $user;
}

function slugify(string $text): string {
    $text = mb_strtolower($text);
    $text = preg_replace_callback('/[äöüÄÖÜ]/u', function($m) {
        return ['ä'=>'ae','ö'=>'oe','ü'=>'ue','Ä'=>'ae','Ö'=>'oe','Ü'=>'ue'][$m[0]] ?? $m[0];
    }, $text);
    $text = preg_replace('/[^a-z0-9]+/', '-', $text);
    return trim($text, '-');
}

function handleUpload(string $field, string $subdir): ?string {
    if (empty($_FILES[$field]['tmp_name'])) return null;
    $ext = strtolower(pathinfo($_FILES[$field]['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, ['jpg','jpeg','png','gif','webp','heic'])) return null;
    $dir = UPLOAD_PATH . $subdir . '/';
    if (!file_exists($dir)) mkdir($dir, 0755, true);
    $filename = uniqid() . '.' . $ext;
    if (move_uploaded_file($_FILES[$field]['tmp_name'], $dir . $filename)) {
        return 'uploads/' . $subdir . '/' . $filename;
    }
    return null;
}

function getSiteConfig(PDO $db): array {
    $rows = $db->query("SELECT key, value FROM site_config")->fetchAll();
    $config = [];
    foreach ($rows as $r) $config[$r['key']] = $r['value'];
    return $config;
}
