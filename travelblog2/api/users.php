<?php
require_once __DIR__ . '/db.php';
header('Content-Type: application/json');
$action = $_GET['action'] ?? '';
$db = getDb();

if ($action === 'profile') {
    $user = requireAuth();
    $body = getBody();
    $fields = []; $params = [];
    if (!empty($body['username'])) { $fields[] = 'username=?'; $params[] = $body['username']; }
    if (!empty($body['email']))    { $fields[] = 'email=?';    $params[] = $body['email']; }
    if (!empty($body['password'])) { $fields[] = 'password_hash=?'; $params[] = password_hash($body['password'], PASSWORD_DEFAULT); }
    if (!empty($fields)) {
        $params[] = $user['id'];
        $db->prepare("UPDATE users SET ".implode(',',$fields)." WHERE id=?")->execute($params);
        if (!empty($body['username'])) $_SESSION['username'] = $body['username'];
    }
    jsonResponse(['ok' => true]);
}

if ($action === 'upload_avatar') {
    $user = requireAuth();
    $path = handleUpload('avatar', 'avatars');
    if (!$path) jsonResponse(['error' => 'Upload fehlgeschlagen'], 400);
    $db->prepare("UPDATE users SET avatar=? WHERE id=?")->execute([$path, $user['id']]);
    jsonResponse(['ok' => true, 'path' => $path]);
}

if ($action === 'liked_tips') {
    $user = requireAuth();
    $stmt = $db->prepare("SELECT t.* FROM tips t JOIN tip_likes tl ON t.id=tl.tip_id WHERE tl.user_id=?");
    $stmt->execute([$user['id']]);
    jsonResponse(['tips' => $stmt->fetchAll()]);
}

if ($action === 'list') {
    requireAdmin();
    $users = $db->query("SELECT id,username,email,avatar,is_admin,is_active,created_at FROM users ORDER BY created_at DESC")->fetchAll();
    jsonResponse(['users' => $users]);
}

if ($action === 'update_user') {
    requireAdmin();
    $body = getBody();
    $db->prepare("UPDATE users SET is_admin=?,is_active=? WHERE id=?")->execute([$body['is_admin']??0,$body['is_active']??1,$body['id']]);
    jsonResponse(['ok' => true]);
}

if ($action === 'delete_user') {
    requireAdmin();
    $body = getBody();
    if ($body['id'] == $_SESSION['user_id']) jsonResponse(['error' => 'Eigenen Account nicht löschen'], 400);
    $db->prepare("DELETE FROM users WHERE id=?")->execute([$body['id']]);
    jsonResponse(['ok' => true]);
}

if ($action === 'get_config') {
    requireAdmin();
    jsonResponse(['config' => getSiteConfig($db)]);
}

if ($action === 'save_config') {
    requireAdmin();
    $body = getBody();
    foreach ($body as $key => $value) {
        $db->prepare("INSERT OR REPLACE INTO site_config (key,value) VALUES (?,?)")->execute([$key,$value]);
    }
    jsonResponse(['ok' => true]);
}

jsonResponse(['error' => 'Unbekannt'], 400);
