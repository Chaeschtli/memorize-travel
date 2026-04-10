<?php
require_once __DIR__ . '/db.php';
header('Content-Type: application/json');
$action = $_GET['action'] ?? '';
$body = getBody();
$db = getDb();

if ($action === 'register') {
    $username = trim($body['username'] ?? '');
    $email    = trim($body['email'] ?? '');
    $password = $body['password'] ?? '';
    if (!$username || !$email || !$password) jsonResponse(['error' => 'Alle Felder ausfüllen'], 400);
    if (strlen($password) < 6) jsonResponse(['error' => 'Passwort mind. 6 Zeichen'], 400);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) jsonResponse(['error' => 'Ungültige E-Mail'], 400);
    $isFirstUser = $db->query("SELECT COUNT(*) FROM users")->fetchColumn() == 0;
    try {
        $stmt = $db->prepare("INSERT INTO users (username,email,password_hash,is_admin) VALUES (?,?,?,?)");
        $stmt->execute([$username, $email, password_hash($password, PASSWORD_DEFAULT), $isFirstUser ? 1 : 0]);
        $id = $db->lastInsertId();
        $_SESSION['user_id']  = $id;
        $_SESSION['username'] = $username;
        $_SESSION['is_admin'] = $isFirstUser ? 1 : 0;
        jsonResponse(['ok' => true, 'username' => $username, 'is_admin' => $isFirstUser]);
    } catch (PDOException $e) {
        if (str_contains($e->getMessage(), 'UNIQUE')) jsonResponse(['error' => 'Benutzername oder E-Mail bereits vergeben'], 409);
        jsonResponse(['error' => 'Fehler'], 500);
    }
}

if ($action === 'login') {
    $login    = trim($body['login'] ?? '');
    $password = $body['password'] ?? '';
    $stmt = $db->prepare("SELECT * FROM users WHERE (username=? OR email=?) AND is_active=1");
    $stmt->execute([$login, $login]);
    $user = $stmt->fetch();
    if (!$user || !password_verify($password, $user['password_hash'])) jsonResponse(['error' => 'Falsche Zugangsdaten'], 401);
    $_SESSION['user_id']  = $user['id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['is_admin'] = $user['is_admin'];
    jsonResponse(['ok' => true, 'username' => $user['username'], 'is_admin' => (bool)$user['is_admin']]);
}

if ($action === 'logout') {
    session_destroy();
    jsonResponse(['ok' => true]);
}

if ($action === 'me') {
    if (empty($_SESSION['user_id'])) jsonResponse(['loggedIn' => false]);
    $stmt = $db->prepare("SELECT id,username,email,avatar,is_admin,is_active FROM users WHERE id=?");
    $stmt->execute([$_SESSION['user_id']]);
    $u = $stmt->fetch();
    jsonResponse(['loggedIn' => true, 'user' => $u]);
}

jsonResponse(['error' => 'Unbekannt'], 400);
