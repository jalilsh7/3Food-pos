<?php
// Route module loaded in the API dispatcher scope to preserve shared request context.
if ($method === 'GET' && $path === '/appearance') {
    $defaults = ['primary'=>'#c2410c','secondary'=>'#1f6b4a','mode'=>'light','fontFamily'=>'byekan','fontSize'=>15,'cardRadius'=>16,'buttonRadius'=>12,'logoUrl'=>null];
    $stored = $pdo->query('SELECT settings FROM app_appearance_settings WHERE id = 1')->fetchColumn();
    $settings = is_string($stored) ? json_decode($stored, true) : null;
    if (!is_array($settings)) $settings = $defaults;
    $settings = array_merge($defaults,$settings);
    $settings['fontFamily'] = 'byekan';
    json_response(['ok'=>true,'settings'=>$settings]);
}
if ($method === 'POST' && $path === '/appearance') {
    $actor = require_role($pdo, ['manager']); require_csrf(); $body = request_json(); $input = $body['settings'] ?? null;
    if (!is_array($input)) json_response(['ok'=>false,'error'=>'invalid_appearance'],422);
    $primary=strtolower((string)($input['primary']??'')); $secondary=strtolower((string)($input['secondary']??''));
    $mode=(string)($input['mode']??''); $font=(string)($input['fontFamily']??'');
    $fontSize=filter_var($input['fontSize']??null,FILTER_VALIDATE_INT); $cardRadius=filter_var($input['cardRadius']??null,FILTER_VALIDATE_INT);
    $buttonRadius=filter_var($input['buttonRadius']??null,FILTER_VALIDATE_INT); $logoUrl=$input['logoUrl']??null;
    if (!preg_match('/^#[0-9a-f]{6}$/D',$primary)||!preg_match('/^#[0-9a-f]{6}$/D',$secondary)||
        !in_array($mode,['light','dark'],true)||!in_array($font,['byekan'],true)||
        $fontSize===false||$fontSize<13||$fontSize>20||$cardRadius===false||$cardRadius<8||$cardRadius>28||
        $buttonRadius===false||$buttonRadius<6||$buttonRadius>24||
        !($logoUrl===null||(is_string($logoUrl)&&preg_match('#^/uploads/appearance/[a-f0-9]{32}\.(png|jpg|webp)$#D',$logoUrl)))) {
        json_response(['ok'=>false,'error'=>'invalid_appearance','message'=>'یکی از مقادیر ظاهر معتبر نیست'],422);
    }
    $settings=['primary'=>$primary,'secondary'=>$secondary,'mode'=>$mode,'fontFamily'=>$font,'fontSize'=>$fontSize,'cardRadius'=>$cardRadius,'buttonRadius'=>$buttonRadius,'logoUrl'=>$logoUrl];
    $encoded=json_encode($settings,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    $stmt=$pdo->prepare('INSERT INTO app_appearance_settings (id,settings,updated_by) VALUES (1,?,?) ON DUPLICATE KEY UPDATE settings=VALUES(settings),updated_by=VALUES(updated_by)');
    $stmt->execute([$encoded,(int)$actor['id']]);
    audit($pdo,(int)$actor['id'],'appearance_updated','appearance','1',['mode'=>$mode,'fontFamily'=>$font]);
    json_response(['ok'=>true,'settings'=>$settings]);
}
if ($method === 'POST' && $path === '/appearance/reset') {
    $actor=require_role($pdo,['manager']); require_csrf(); $pdo->exec('DELETE FROM app_appearance_settings WHERE id=1');
    audit($pdo,(int)$actor['id'],'appearance_reset','appearance','1');
    json_response(['ok'=>true,'settings'=>['primary'=>'#c2410c','secondary'=>'#1f6b4a','mode'=>'light','fontFamily'=>'byekan','fontSize'=>15,'cardRadius'=>16,'buttonRadius'=>12,'logoUrl'=>null]]);
}
if ($method === 'POST' && $path === '/appearance/logo') {
    $actor=require_role($pdo,['manager']); require_csrf();
    if ((int)($_SERVER['CONTENT_LENGTH']??0)>800000) json_response(['ok'=>false,'error'=>'logo_too_large'],413);
    $body=request_json(); $encodedImage=$body['image']??'';
    if (!is_string($encodedImage)||$encodedImage===''||strlen($encodedImage)>700000) json_response(['ok'=>false,'error'=>'invalid_logo'],422);
    $binary=base64_decode($encodedImage,true);
    if (!is_string($binary)||strlen($binary)<1||strlen($binary)>524288) json_response(['ok'=>false,'error'=>'invalid_logo','message'=>'فایل لوگو معتبر یا در محدوده حجم مجاز نیست'],422);
    $imageInfo=@getimagesizefromstring($binary); $finfo=new finfo(FILEINFO_MIME_TYPE); $mime=$finfo->buffer($binary);
    $extensions=['image/png'=>'png','image/jpeg'=>'jpg','image/webp'=>'webp'];
    if (!is_array($imageInfo)||!isset($extensions[$mime])||($imageInfo['mime']??'')!==$mime||
        (int)$imageInfo[0]<1||(int)$imageInfo[1]<1||(int)$imageInfo[0]>2000||(int)$imageInfo[1]>2000) {
        json_response(['ok'=>false,'error'=>'invalid_logo','message'=>'فقط تصویر سالم PNG، JPG یا WebP تا ابعاد ۲۰۰۰ پیکسل پذیرفته می‌شود'],422);
    }
    $uploadDir=dirname(__DIR__).'/uploads/appearance';
    if (!is_dir($uploadDir)&&!mkdir($uploadDir,0755,true)&&!is_dir($uploadDir)) json_response(['ok'=>false,'error'=>'logo_storage_unavailable'],500);
    $filename=bin2hex(random_bytes(16)).'.'.$extensions[$mime]; $target=$uploadDir.'/'.$filename;
    if (file_put_contents($target,$binary,LOCK_EX)===false) json_response(['ok'=>false,'error'=>'logo_storage_failed'],500);
    @chmod($target,0644); $url='/uploads/appearance/'.$filename;
    audit($pdo,(int)$actor['id'],'appearance_logo_uploaded','appearance',null,['mime'=>$mime,'bytes'=>strlen($binary)]);
    json_response(['ok'=>true,'logo_url'=>$url],201);
}

