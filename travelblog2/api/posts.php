<?php
require_once __DIR__ . '/db.php';
header('Content-Type: application/json');
$action = $_GET['action'] ?? '';
$db = getDb();

if ($action === 'save') {
    requireAdmin();
    $body = getBody();
    $id = $body['id'] ?? null;
    if ($id) {
        $stmt = $db->prepare("UPDATE posts SET title=?,content=?,sort_order=?,published=? WHERE id=?");
        $stmt->execute([$body['title']??'',$body['content']??'',$body['sort_order']??0,$body['published']??1,$id]);
    } else {
        $stmt = $db->prepare("INSERT INTO posts (trip_id,title,content,sort_order,published) VALUES (?,?,?,?,?)");
        $stmt->execute([$body['trip_id'],$body['title']??'',$body['content']??'',$body['sort_order']??0,$body['published']??1]);
        $id = $db->lastInsertId();
    }
    jsonResponse(['ok' => true, 'id' => $id]);
}

if ($action === 'upload_media') {
    requireAdmin();
    $postId = $_POST['post_id'] ?? null;
    if (empty($_FILES['file']['tmp_name'])) jsonResponse(['error' => 'Keine Datei'], 400);
    $ext = strtolower(pathinfo($_FILES['file']['name'], PATHINFO_EXTENSION));
    $isVideo = in_array($ext, ['mp4','mov','webm','avi']);
    $isImage = in_array($ext, ['jpg','jpeg','png','gif','webp','heic']);
    if (!$isVideo && !$isImage) jsonResponse(['error' => 'Ungültiger Dateityp'], 400);
    $dir = UPLOAD_PATH . 'posts/';
    if (!file_exists($dir)) mkdir($dir, 0755, true);
    $filename = uniqid() . '.' . $ext;
    if (!move_uploaded_file($_FILES['file']['tmp_name'], $dir . $filename)) jsonResponse(['error' => 'Upload fehlgeschlagen'], 500);
    $path = 'uploads/posts/' . $filename;
    $type = $isVideo ? 'video' : 'image';
    if ($postId) {
        $db->prepare("INSERT INTO post_media (post_id, path, type) VALUES (?,?,?)")->execute([$postId, $path, $type]);
        $mediaId = $db->lastInsertId();
    }
    jsonResponse(['ok' => true, 'path' => $path, 'type' => $type, 'id' => $mediaId ?? null]);
}

if ($action === 'delete_media') {
    requireAdmin();
    $body = getBody();
    $row = $db->prepare("SELECT path FROM post_media WHERE id=?");
    $row->execute([$body['id']]);
    $m = $row->fetch();
    if ($m && file_exists(__DIR__ . '/../' . $m['path'])) @unlink(__DIR__ . '/../' . $m['path']);
    $db->prepare("DELETE FROM post_media WHERE id=?")->execute([$body['id']]);
    jsonResponse(['ok' => true]);
}

if ($action === 'delete') {
    requireAdmin();
    $body = getBody();
    $db->prepare("DELETE FROM posts WHERE id=?")->execute([$body['id']]);
    jsonResponse(['ok' => true]);
}

jsonResponse(['error' => 'Unbekannt'], 400);

// Link/unlink tip to post
if ($action === 'link_tip') {
    requireAdmin();
    $body = getBody();
    $db->prepare("INSERT OR IGNORE INTO post_tips (post_id,tip_id) VALUES (?,?)")->execute([$body['post_id'],$body['tip_id']]);
    jsonResponse(['ok' => true]);
}
if ($action === 'unlink_tip') {
    requireAdmin();
    $body = getBody();
    $db->prepare("DELETE FROM post_tips WHERE post_id=? AND tip_id=?")->execute([$body['post_id'],$body['tip_id']]);
    jsonResponse(['ok' => true]);
}