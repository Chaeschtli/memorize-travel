<?php
require_once __DIR__ . '/db.php';
header('Content-Type: application/json');
$action = $_GET['action'] ?? '';
$db = getDb();

if ($action === 'list') {
    $onlyPublished = empty($_SESSION['is_admin']);
    $sql = $onlyPublished
        ? "SELECT * FROM trips WHERE published=1 ORDER BY created_at DESC"
        : "SELECT * FROM trips ORDER BY created_at DESC";
    jsonResponse(['trips' => $db->query($sql)->fetchAll()]);
}

if ($action === 'get') {
    $id = $_GET['id'] ?? $_GET['slug'] ?? '';
    $field = is_numeric($id) ? 'id' : 'slug';
    $stmt = $db->prepare("SELECT * FROM trips WHERE $field=?");
    $stmt->execute([$id]);
    $trip = $stmt->fetch();
    if (!$trip) jsonResponse(['error' => 'Nicht gefunden'], 404);
    $posts = $db->prepare("SELECT * FROM posts WHERE trip_id=? AND published=1 ORDER BY sort_order,id");
    $posts->execute([$trip['id']]);
    $postRows = $posts->fetchAll();
    foreach ($postRows as &$post) {
        $media = $db->prepare("SELECT * FROM post_media WHERE post_id=? ORDER BY id");
        $media->execute([$post['id']]);
        $post['media'] = $media->fetchAll();
        $ptips = $db->prepare("SELECT t.* FROM tips t JOIN post_tips pt ON t.id=pt.tip_id WHERE pt.post_id=? AND t.published=1");
        $ptips->execute([$post['id']]);
        $post['tips'] = $ptips->fetchAll();
    }
    $trip['posts'] = $postRows;
    $tips = $db->prepare("SELECT t.* FROM tips t JOIN trip_tips tt ON t.id=tt.tip_id WHERE tt.trip_id=? AND t.published=1");
    $tips->execute([$trip['id']]);
    $trip['tips'] = $tips->fetchAll();
    jsonResponse(['trip' => $trip]);
}

if ($action === 'save') {
    requireAdmin();
    $body = getBody();
    $title   = trim($body['title'] ?? '');
    $slug    = slugify($title);
    $id      = $body['id'] ?? null;
    if (!$title) jsonResponse(['error' => 'Titel erforderlich'], 400);
    if ($id) {
        $stmt = $db->prepare("UPDATE trips SET title=?,slug=?,summary=?,description=?,country=?,duration=?,highlights=?,card_emoji=?,use_emoji=?,spotify_embed=?,published=?,updated_at=CURRENT_TIMESTAMP WHERE id=?");
        $stmt->execute([$title,$slug,$body['summary']??'',$body['description']??'',$body['country']??'',$body['duration']??'',$body['highlights']??'',$body['card_emoji']??'✈️',$body['use_emoji']??0,$body['spotify_embed']??'',$body['published']??0,$id]);
    } else {
        $stmt = $db->prepare("INSERT INTO trips (title,slug,summary,description,country,duration,highlights,card_emoji,use_emoji,spotify_embed,published,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
        $stmt->execute([$title,$slug,$body['summary']??'',$body['description']??'',$body['country']??'',$body['duration']??'',$body['highlights']??'',$body['card_emoji']??'✈️',$body['use_emoji']??0,$body['spotify_embed']??'',$body['published']??0,$_SESSION['user_id']]);
        $id = $db->lastInsertId();
    }
    jsonResponse(['ok' => true, 'id' => $id, 'slug' => $slug]);
}

if ($action === 'upload_image') {
    requireAdmin();
    $tripId = $_POST['trip_id'] ?? null;
    $type   = $_POST['type'] ?? 'card';
    // Ensure upload dir exists
    $dir = UPLOAD_PATH . 'trips/';
    if (!file_exists($dir)) mkdir($dir, 0755, true);
    $path = handleUpload('image', 'trips');
    if (!$path) {
        $err = $_FILES['image']['error'] ?? 'unknown';
        jsonResponse(['error' => 'Upload fehlgeschlagen', 'code' => $err], 400);
    }
    if ($tripId) {
        $field = $type === 'banner' ? 'banner_image' : 'card_image';
        $db->prepare("UPDATE trips SET $field=? WHERE id=?")->execute([$path, $tripId]);
    }
    jsonResponse(['ok' => true, 'path' => $path]);
}

if ($action === 'delete') {
    requireAdmin();
    $body = getBody();
    $db->prepare("DELETE FROM trips WHERE id=?")->execute([$body['id']]);
    jsonResponse(['ok' => true]);
}

jsonResponse(['error' => 'Unbekannt'], 400);
