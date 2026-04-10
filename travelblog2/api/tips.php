<?php
require_once __DIR__ . '/db.php';
header('Content-Type: application/json');
$action = $_GET['action'] ?? '';
$db = getDb();

if ($action === 'list') {
    $q = '%' . ($_GET['q'] ?? '') . '%';
    $tripId = $_GET['trip_id'] ?? null;
    if ($tripId) {
        $stmt = $db->prepare("SELECT t.* FROM tips t JOIN trip_tips tt ON t.id=tt.tip_id WHERE tt.trip_id=? AND t.published=1 AND (t.title LIKE ? OR t.description LIKE ?) ORDER BY t.created_at DESC");
        $stmt->execute([$tripId, $q, $q]);
    } else {
        $stmt = $db->prepare("SELECT t.*, GROUP_CONCAT(tt.trip_id) as trip_ids FROM tips t LEFT JOIN trip_tips tt ON t.id=tt.tip_id WHERE t.published=1 AND (t.title LIKE ? OR t.description LIKE ?) GROUP BY t.id ORDER BY t.created_at DESC");
        $stmt->execute([$q, $q]);
    }
    jsonResponse(['tips' => $stmt->fetchAll()]);
}

if ($action === 'get') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonResponse(['error' => 'ID fehlt'], 400);
    $stmt = $db->prepare("SELECT * FROM tips WHERE id=?");
    $stmt->execute([$id]);
    $tip = $stmt->fetch();
    if (!$tip) jsonResponse(['error' => 'Nicht gefunden'], 404);
    $media = $db->prepare("SELECT * FROM tip_media WHERE tip_id=? ORDER BY id");
    $media->execute([$id]);
    $tip['media'] = $media->fetchAll();
    jsonResponse(['tip' => $tip]);
}

if ($action === 'save') {
    requireAdmin();
    $body = getBody();
    $id = $body['id'] ?? null;
    if ($id) {
        $stmt = $db->prepare("UPDATE tips SET title=?,description=?,content=?,type=?,published=? WHERE id=?");
        $stmt->execute([$body['title']??'',$body['description']??'',$body['content']??'',$body['type']??'tip',$body['published']??1,$id]);
    } else {
        $stmt = $db->prepare("INSERT INTO tips (title,description,content,type,published,created_by) VALUES (?,?,?,?,?,?)");
        $stmt->execute([$body['title']??'',$body['description']??'',$body['content']??'',$body['type']??'tip',$body['published']??1,$_SESSION['user_id']??null]);
        $id = $db->lastInsertId();
    }
    if (isset($body['trip_ids'])) {
        $db->prepare("DELETE FROM trip_tips WHERE tip_id=?")->execute([$id]);
        foreach ((array)$body['trip_ids'] as $tid) {
            if ($tid) $db->prepare("INSERT OR IGNORE INTO trip_tips (trip_id,tip_id) VALUES (?,?)")->execute([$tid,$id]);
        }
    }
    jsonResponse(['ok' => true, 'id' => $id]);
}

if ($action === 'upload_media') {
    requireAdmin();
    $tipId = $_POST['tip_id'] ?? null;
    if (empty($_FILES['file']['tmp_name'])) jsonResponse(['error' => 'Keine Datei'], 400);
    $ext = strtolower(pathinfo($_FILES['file']['name'], PATHINFO_EXTENSION));
    $isImage = in_array($ext, ['jpg','jpeg','png','gif','webp','heic']);
    if (!$isImage) jsonResponse(['error' => 'Nur Bilder erlaubt'], 400);
    $dir = UPLOAD_PATH . 'tips/';
    if (!file_exists($dir)) mkdir($dir, 0755, true);
    $filename = uniqid() . '.' . $ext;
    if (!move_uploaded_file($_FILES['file']['tmp_name'], $dir . $filename)) jsonResponse(['error' => 'Upload fehlgeschlagen'], 500);
    $path = 'uploads/tips/' . $filename;
    if ($tipId) {
        $db->prepare("INSERT INTO tip_media (tip_id, path) VALUES (?,?)")->execute([$tipId, $path]);
        $mediaId = $db->lastInsertId();
    }
    jsonResponse(['ok' => true, 'path' => $path, 'id' => $mediaId ?? null]);
}

if ($action === 'like') {
    $user = requireAuth();
    $body = getBody();
    $tipId = $body['tip_id'];
    $exists = $db->prepare("SELECT 1 FROM tip_likes WHERE user_id=? AND tip_id=?");
    $exists->execute([$user['id'],$tipId]);
    if ($exists->fetch()) {
        $db->prepare("DELETE FROM tip_likes WHERE user_id=? AND tip_id=?")->execute([$user['id'],$tipId]);
        jsonResponse(['liked' => false]);
    } else {
        $db->prepare("INSERT INTO tip_likes (user_id,tip_id) VALUES (?,?)")->execute([$user['id'],$tipId]);
        jsonResponse(['liked' => true]);
    }
}

if ($action === 'likes') {
    if (empty($_SESSION['user_id'])) jsonResponse(['likes' => []]);
    $stmt = $db->prepare("SELECT tip_id FROM tip_likes WHERE user_id=?");
    $stmt->execute([$_SESSION['user_id']]);
    jsonResponse(['likes' => array_column($stmt->fetchAll(), 'tip_id')]);
}

if ($action === 'delete') {
    requireAdmin();
    $body = getBody();
    $db->prepare("DELETE FROM tips WHERE id=?")->execute([$body['id']]);
    jsonResponse(['ok' => true]);
}

jsonResponse(['error' => 'Unbekannt'], 400);
