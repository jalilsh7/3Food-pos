<?php
// Route module loaded in the API dispatcher scope to preserve shared request context.
if ($method === 'GET' && $path === '/terminal-agents') {
    require_role($pdo,['manager']);
    $rows=$pdo->query('SELECT id,name,enabled,agent_version,last_seen_at,created_at FROM app_terminal_agents ORDER BY created_at DESC')->fetchAll();
    json_response(['ok'=>true,'items'=>$rows]);
}
if ($method === 'POST' && $path === '/terminal-agents') {
    $actor=require_role($pdo,['manager']); require_csrf(); $body=request_json();
    $name=trim((string)($body['name']??''));
    if($name===''||utf8_length($name)>120) json_response(['ok'=>false,'error'=>'invalid_agent_name','message'=>'نام کامپیوتر صندوق معتبر نیست'],422);
    $id=sprintf('%s-%s-%s-%s-%s',bin2hex(random_bytes(4)),bin2hex(random_bytes(2)),sprintf('%04x',(hexdec(bin2hex(random_bytes(2)))&0x0fff)|0x4000),sprintf('%04x',(hexdec(bin2hex(random_bytes(2)))&0x3fff)|0x8000),bin2hex(random_bytes(6)));
    $token=bin2hex(random_bytes(32));
    $stmt=$pdo->prepare('INSERT INTO app_terminal_agents (id,name,token_hash,created_by) VALUES (?,?,?,?)');
    $stmt->execute([$id,$name,hash('sha256',$token),(int)$actor['id']]);
    audit($pdo,(int)$actor['id'],'terminal_agent_created','terminal_agent',$id);
    json_response(['ok'=>true,'agent'=>['id'=>$id,'name'=>$name,'enabled'=>true],'token'=>$token],201);
}
if (preg_match('#^/terminal-agents/([a-f0-9-]{36})/disable$#iD',$path,$m) && $method==='POST') {
    $actor=require_role($pdo,['manager']); require_csrf();
    $stmt=$pdo->prepare('UPDATE app_terminal_agents SET enabled=0 WHERE id=?'); $stmt->execute([$m[1]]);
    if($stmt->rowCount()===0) json_response(['ok'=>false,'error'=>'agent_not_found','message'=>'عامل محلی پیدا نشد یا قبلاً غیرفعال شده است'],404);
    audit($pdo,(int)$actor['id'],'terminal_agent_disabled','terminal_agent',$m[1]);
    json_response(['ok'=>true]);
}
if ($method==='GET' && $path==='/terminals/available') {
    require_role($pdo,['manager','cashier']);
    $rows=$pdo->query("SELECT t.id,t.name,t.provider_code,t.model_name,t.driver_code,t.is_default,a.last_seen_at FROM pos_payment_terminals t JOIN app_terminal_agents a ON a.id=t.agent_id WHERE t.enabled=1 AND a.enabled=1 AND t.driver_code<>'unconfigured' AND a.last_seen_at >= (UTC_TIMESTAMP() - INTERVAL 90 SECOND) ORDER BY t.is_default DESC,t.name ASC")->fetchAll();
    foreach($rows as &$row){$row['is_default']=(bool)$row['is_default'];} unset($row);
    json_response(['ok'=>true,'items'=>$rows]);
}
if ($method==='GET' && $path==='/terminals') {
    require_role($pdo,['manager']);
    $rows=$pdo->query('SELECT t.id,t.agent_id,t.local_terminal_key,t.name,t.provider_code,t.model_name,t.driver_code,t.connection_type,t.host,t.port,t.enabled,t.is_default,t.last_seen_at,a.name AS agent_name,a.enabled AS agent_enabled FROM pos_payment_terminals t JOIN app_terminal_agents a ON a.id=t.agent_id ORDER BY t.is_default DESC,t.name ASC')->fetchAll();
    foreach($rows as &$row){$row['enabled']=(bool)$row['enabled'];$row['is_default']=(bool)$row['is_default'];$row['agent_enabled']=(bool)$row['agent_enabled'];$row['port']=(int)$row['port'];} unset($row);
    json_response(['ok'=>true,'items'=>$rows]);
}
if ($method==='POST' && $path==='/terminals') {
    $actor=require_role($pdo,['manager']); require_csrf(); $body=request_json();
    $id=trim((string)($body['id']??'')); $agentId=strtolower(trim((string)($body['agentId']??'')));
    $localKey=trim((string)($body['localTerminalKey']??'')); $name=trim((string)($body['name']??''));
    $provider=preg_replace('/[^a-z0-9_-]/','',strtolower(trim((string)($body['providerCode']??'unknown'))));
    $driver=preg_replace('/[^a-z0-9_-]/','',strtolower(trim((string)($body['driverCode']??'unconfigured'))));
    $connection=(string)($body['connectionType']??'lan'); $host=trim((string)($body['host']??'')); $port=filter_var($body['port']??null,FILTER_VALIDATE_INT);
    $model=trim((string)($body['modelName']??'')); $enabled=($body['enabled']??true)===true?1:0; $isDefault=($body['isDefault']??false)===true?1:0;
    if(!preg_match('/^[A-Za-z0-9_-]{1,100}$/D',$id)||!valid_uuid($agentId)||!preg_match('/^[A-Za-z0-9_-]{1,100}$/D',$localKey)||
       $name===''||utf8_length($name)>120||$provider===''||strlen($provider)>64||$driver===''||strlen($driver)>80||
       !in_array($connection,['lan','wifi'],true)||(filter_var($host,FILTER_VALIDATE_IP)===false||!is_private_terminal_ip($host))||$port===false||$port<1||$port>65535||utf8_length($model)>120) {
        json_response(['ok'=>false,'error'=>'invalid_terminal','message'=>'مشخصات کارتخوان معتبر نیست'],422);
    }
    $agentStmt=$pdo->prepare('SELECT id FROM app_terminal_agents WHERE id=? AND enabled=1 LIMIT 1');$agentStmt->execute([$agentId]);
    if(!$agentStmt->fetchColumn()) json_response(['ok'=>false,'error'=>'terminal_agent_unavailable','message'=>'عامل محلی فعال پیدا نشد'],409);
    try {
        $pdo->beginTransaction();
        if($isDefault===1) $pdo->exec('UPDATE pos_payment_terminals SET is_default=0');
        $stmt=$pdo->prepare('INSERT INTO pos_payment_terminals (id,agent_id,local_terminal_key,name,provider_code,model_name,driver_code,connection_type,host,port,enabled,is_default,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE agent_id=VALUES(agent_id),local_terminal_key=VALUES(local_terminal_key),name=VALUES(name),provider_code=VALUES(provider_code),model_name=VALUES(model_name),driver_code=VALUES(driver_code),connection_type=VALUES(connection_type),host=VALUES(host),port=VALUES(port),enabled=VALUES(enabled),is_default=VALUES(is_default)');
        $stmt->execute([$id,$agentId,$localKey,$name,$provider,$model!==''?$model:null,$driver,$connection,$host,$port,$enabled,$isDefault,(int)$actor['id']]);
        audit($pdo,(int)$actor['id'],'terminal_saved','payment_terminal',$id,['provider'=>$provider,'driver'=>$driver,'enabled'=>$enabled===1]);
        $pdo->commit();
        json_response(['ok'=>true,'terminal'=>['id'=>$id,'agentId'=>$agentId,'name'=>$name,'providerCode'=>$provider,'driverCode'=>$driver,'connectionType'=>$connection,'host'=>$host,'port'=>$port,'enabled'=>$enabled===1,'isDefault'=>$isDefault===1]],201);
    } catch(Throwable $e) {
        if($pdo->inTransaction())$pdo->rollBack();
        error_log('[3Food POS] Terminal save failed: '.$e->getMessage());
        json_response(['ok'=>false,'error'=>'terminal_save_failed','message'=>'ذخیره کارتخوان انجام نشد'],500);
    }
}
if (preg_match('#^/terminals/([A-Za-z0-9_-]{1,100})/disable$#D',$path,$m) && $method==='POST') {
    $actor=require_role($pdo,['manager']); require_csrf();
    $stmt=$pdo->prepare('UPDATE pos_payment_terminals SET enabled=0,is_default=0 WHERE id=?');$stmt->execute([$m[1]]);
    if($stmt->rowCount()===0) json_response(['ok'=>false,'error'=>'terminal_not_found','message'=>'کارتخوان پیدا نشد یا غیرفعال است'],404);
    audit($pdo,(int)$actor['id'],'terminal_disabled','payment_terminal',$m[1]);
    json_response(['ok'=>true]);
}
if ($method==='POST' && $path==='/terminal-payments') {
    $actor=require_role($pdo,['manager','cashier']); require_csrf(); $body=request_json();
    $terminalId=trim((string)($body['terminalId']??''));$amount=filter_var($body['amount']??null,FILTER_VALIDATE_INT);
    $key=strtolower(trim((string)($body['idempotencyKey']??'')));
    if(!preg_match('/^[A-Za-z0-9_-]{1,100}$/D',$terminalId)||$amount===false||$amount<1||$amount>100000000000||!valid_uuid($key))
        json_response(['ok'=>false,'error'=>'invalid_terminal_payment','message'=>'مبلغ یا شناسه پرداخت معتبر نیست'],422);
    $existing=$pdo->prepare('SELECT id,terminal_id,amount,status,created_by FROM pos_terminal_payments WHERE idempotency_key=? LIMIT 1');$existing->execute([$key]);$old=$existing->fetch();
    if(is_array($old)){
        if((int)$old['created_by']!==(int)$actor['id']||($old['terminal_id']!==$terminalId||(int)$old['amount']!==$amount)) json_response(['ok'=>false,'error'=>'terminal_payment_idempotency_conflict','message'=>'شناسه تکراری برای پرداخت دیگری استفاده شده است'],409);
        json_response(['ok'=>true,'payment'=>['id'=>$old['id'],'status'=>$old['status'],'amount'=>(int)$old['amount']]]);
    }

    try {
        $pdo->beginTransaction();
        $device=$pdo->prepare('SELECT t.id,t.driver_code,t.enabled,a.enabled AS agent_enabled,a.last_seen_at FROM pos_payment_terminals t JOIN app_terminal_agents a ON a.id=t.agent_id WHERE t.id=? FOR UPDATE');
        $device->execute([$terminalId]);$terminal=$device->fetch();
        if(!is_array($terminal)||(int)$terminal['enabled']!==1||(int)$terminal['agent_enabled']!==1){
            $pdo->rollBack();json_response(['ok'=>false,'error'=>'terminal_unavailable','message'=>'کارتخوان فعال یا متصل نیست'],409);
        }
        if($terminal['driver_code']==='unconfigured'){
            $pdo->rollBack();json_response(['ok'=>false,'error'=>'terminal_driver_unconfigured','message'=>'برای این مدل کارتخوان هنوز درایور تأییدشده نصب نشده است'],409);
        }
        if(!$terminal['last_seen_at']||strtotime((string)$terminal['last_seen_at'])<time()-90){
            $pdo->rollBack();json_response(['ok'=>false,'error'=>'terminal_agent_offline','message'=>'برنامه اتصال کارتخوان روی کامپیوتر صندوق آنلاین نیست'],409);
        }
        $pdo->prepare("UPDATE pos_terminal_payments SET status='unknown',completed_at=UTC_TIMESTAMP() WHERE terminal_id=? AND status='processing' AND requested_at < (UTC_TIMESTAMP() - INTERVAL 120 SECOND)")->execute([$terminalId]);
        $unresolved=$pdo->prepare("SELECT id,status FROM pos_terminal_payments WHERE terminal_id=? AND (status IN ('processing','unknown') OR (status='approved' AND order_id IS NULL)) ORDER BY requested_at DESC LIMIT 1 FOR UPDATE");
        $unresolved->execute([$terminalId]);$unresolvedPayment=$unresolved->fetch();
        if(is_array($unresolvedPayment)){
            $pdo->rollBack();json_response(['ok'=>false,'error'=>'terminal_payment_reconciliation_required','message'=>'تراکنش قبلی نتیجه قطعی ندارد؛ پیش از پرداخت جدید باید وضعیت آن از بانک یا کارتخوان استعلام شود','payment_id'=>$unresolvedPayment['id'],'status'=>$unresolvedPayment['status']],409);
        }
        $queuedByActor=$pdo->prepare("SELECT id FROM pos_terminal_payments WHERE terminal_id=? AND created_by=? AND status='queued' LIMIT 1 FOR UPDATE");
        $queuedByActor->execute([$terminalId,(int)$actor['id']]);
        if($queuedByActor->fetchColumn()){
            $pdo->rollBack();json_response(['ok'=>false,'error'=>'terminal_payment_already_queued','message'=>'برای این صندوق یک درخواست پرداخت در صف وجود دارد؛ همان درخواست را پیگیری یا لغو کنید'],409);
        }
        $paymentId=sprintf('%s-%s-%s-%s-%s',bin2hex(random_bytes(4)),bin2hex(random_bytes(2)),sprintf('%04x',(hexdec(bin2hex(random_bytes(2)))&0x0fff)|0x4000),sprintf('%04x',(hexdec(bin2hex(random_bytes(2)))&0x3fff)|0x8000),bin2hex(random_bytes(6)));
        $insert=$pdo->prepare("INSERT INTO pos_terminal_payments (id,idempotency_key,terminal_id,amount,currency,status,created_by) VALUES (?,?,?,?,'IRT','queued',?)");
        $insert->execute([$paymentId,$key,$terminalId,$amount,(int)$actor['id']]);
        audit($pdo,(int)$actor['id'],'terminal_payment_queued','terminal_payment',$paymentId,['terminal_id'=>$terminalId,'amount'=>$amount]);
        $pdo->commit();
        json_response(['ok'=>true,'payment'=>['id'=>$paymentId,'status'=>'queued','amount'=>$amount]],201);
    } catch(Throwable $e) {
        if($pdo->inTransaction())$pdo->rollBack();
        error_log('[3Food POS] Terminal payment queue failed: '.$e->getMessage());
        json_response(['ok'=>false,'error'=>'terminal_payment_queue_failed','message'=>'درخواست پرداخت ایجاد نشد'],500);
    }
}

if (preg_match('#^/terminal-payments/([a-f0-9-]{36})$#iD',$path,$m) && $method==='GET') {
    $actor=require_role($pdo,['manager','cashier']);
    $stmt=$pdo->prepare('SELECT p.id,p.terminal_id,p.order_id,p.amount,p.currency,p.status,p.external_transaction_id,p.trace_number,p.retrieval_reference_number,p.response_code,p.response_message,p.requested_at,p.completed_at,p.created_by,t.name AS terminal_name FROM pos_terminal_payments p JOIN pos_payment_terminals t ON t.id=p.terminal_id WHERE p.id=? LIMIT 1');
    $stmt->execute([$m[1]]);
    $payment=$stmt->fetch();
    if(!is_array($payment)||($actor['role']!=='manager'&&(int)$payment['created_by']!==(int)$actor['id'])) {
        json_response(['ok'=>false,'error'=>'terminal_payment_not_found','message'=>'تراکنش کارتخوان پیدا نشد'],404);
    }
    unset($payment['created_by']);
    $payment['amount']=(int)$payment['amount'];
    $payment['order_id']=$payment['order_id']===null?null:(int)$payment['order_id'];
    json_response(['ok'=>true,'payment'=>$payment]);
}

if (preg_match('#^/terminal-payments/([a-f0-9-]{36})/attach-order$#iD',$path,$m) && $method==='POST') {
    $actor=require_role($pdo,['manager','cashier']);require_csrf();$body=request_json();
    $orderId=filter_var($body['orderId']??null,FILTER_VALIDATE_INT);
    if($orderId===false||$orderId<1) json_response(['ok'=>false,'error'=>'invalid_order_id'],422);
    try {
        $pdo->beginTransaction();
        $paymentStmt=$pdo->prepare('SELECT id,amount,status,order_id,created_by FROM pos_terminal_payments WHERE id=? FOR UPDATE');$paymentStmt->execute([$m[1]]);$payment=$paymentStmt->fetch();
        if(!is_array($payment)||($actor['role']!=='manager'&&(int)$payment['created_by']!==(int)$actor['id'])){$pdo->rollBack();json_response(['ok'=>false,'error'=>'payment_not_found'],404);}
        if($payment['status']!=='approved'){$pdo->rollBack();json_response(['ok'=>false,'error'=>'payment_not_approved','message'=>'فقط تراکنش تأییدشده قابل اتصال به سفارش است'],409);}
        $orderStmt=$pdo->prepare('SELECT id,payment_method,totals,created_by FROM pos_orders WHERE id=? LIMIT 1');$orderStmt->execute([$orderId]);$order=$orderStmt->fetch();
        $totals=is_array($order)?json_decode((string)$order['totals'],true):null;
        if(!is_array($order)||(string)$order['payment_method']!=='card'||(int)($totals['total']??-1)!==(int)$payment['amount']||(int)$order['created_by']!==(int)$payment['created_by']){
            $pdo->rollBack();json_response(['ok'=>false,'error'=>'payment_order_mismatch','message'=>'مبلغ یا مالک سفارش با تراکنش کارتخوان مطابقت ندارد'],409);
        }
        if($payment['order_id']!==null&&(int)$payment['order_id']!==$orderId){$pdo->rollBack();json_response(['ok'=>false,'error'=>'payment_already_linked'],409);}
        $update=$pdo->prepare('UPDATE pos_terminal_payments SET order_id=? WHERE id=? AND order_id IS NULL');$update->execute([$orderId,$m[1]]);
        audit($pdo,(int)$actor['id'],'terminal_payment_linked','terminal_payment',$m[1],['order_id'=>$orderId]);
        $pdo->commit();
        json_response(['ok'=>true,'order_id'=>$orderId]);
    } catch(Throwable $e) {
        if($pdo->inTransaction())$pdo->rollBack();
        error_log('[3Food POS] Terminal payment linking failed: '.$e->getMessage());
        json_response(['ok'=>false,'error'=>'terminal_payment_link_failed','message'=>'اتصال تراکنش به سفارش انجام نشد'],500);
    }
}


if ($method==='GET' && $path==='/terminal-payments/pending') {
    $actor=require_role($pdo,['manager','cashier']);
    $stmt=$pdo->prepare("SELECT p.id,p.terminal_id,p.amount,p.currency,p.status,p.requested_at,p.completed_at,t.name AS terminal_name FROM pos_terminal_payments p JOIN pos_payment_terminals t ON t.id=p.terminal_id WHERE p.created_by=? AND (p.status IN ('queued','processing','unknown') OR (p.status='approved' AND p.order_id IS NULL)) ORDER BY p.requested_at DESC LIMIT 10");
    $stmt->execute([(int)$actor['id']]);
    $rows=$stmt->fetchAll();
    foreach($rows as &$row)$row['amount']=(int)$row['amount'];unset($row);
    json_response(['ok'=>true,'items'=>$rows]);
}
if (preg_match('#^/terminal-payments/([a-f0-9-]{36})/cancel$#iD',$path,$m) && $method==='POST') {
    $actor=require_role($pdo,['manager','cashier']);require_csrf();
    $stmt=$pdo->prepare("UPDATE pos_terminal_payments SET status='cancelled',completed_at=UTC_TIMESTAMP() WHERE id=? AND status='queued' AND (created_by=? OR ?='manager')");
    $stmt->execute([$m[1],(int)$actor['id'],$actor['role']]);
    if($stmt->rowCount()!==1) json_response(['ok'=>false,'error'=>'payment_cannot_be_cancelled','message'=>'این تراکنش در حال اجرا یا تعیین‌تکلیف است؛ وضعیت آن را بررسی کنید'],409);
    audit($pdo,(int)$actor['id'],'terminal_payment_cancelled','terminal_payment',$m[1]);
    json_response(['ok'=>true,'status'=>'cancelled']);
}
if ($method==='GET' && $path==='/terminal-agent/next') {
    $agent=require_terminal_agent($pdo);
    try {
        $pdo->beginTransaction();
        $agentVersion=substr(trim((string)($_SERVER['HTTP_X_TERMINAL_AGENT_VERSION']??'')),0,40);
        $heartbeat=$pdo->prepare('UPDATE app_terminal_agents SET last_seen_at=UTC_TIMESTAMP(),agent_version=COALESCE(NULLIF(?,\'\'),agent_version) WHERE id=?');$heartbeat->execute([$agentVersion,$agent['id']]);
        $stmt=$pdo->prepare("SELECT p.id,p.amount,p.currency,p.status,t.id AS terminal_id,t.name AS terminal_name,t.provider_code,t.model_name,t.driver_code,t.connection_type,t.host,t.port,t.local_terminal_key FROM pos_terminal_payments p JOIN pos_payment_terminals t ON t.id=p.terminal_id WHERE t.agent_id=? AND t.enabled=1 AND p.status='queued' ORDER BY p.requested_at ASC LIMIT 1 FOR UPDATE");
        $stmt->execute([$agent['id']]);$payment=$stmt->fetch();
        if(is_array($payment)){
            $update=$pdo->prepare("UPDATE pos_terminal_payments SET status='processing' WHERE id=? AND status='queued'");$update->execute([$payment['id']]);
            $payment['status']='processing';$payment['amount']=(int)$payment['amount'];$payment['port']=(int)$payment['port'];
        }
        $pdo->commit();
        json_response(['ok'=>true,'agent'=>['id'=>$agent['id'],'name'=>$agent['name']],'payment'=>$payment?:null]);
    } catch(Throwable $e) {
        if($pdo->inTransaction())$pdo->rollBack();
        error_log('[3Food POS] Terminal agent poll failed: '.$e->getMessage());
        json_response(['ok'=>false,'error'=>'terminal_agent_poll_failed'],500);
    }
}
if (preg_match('#^/terminal-agent/payments/([a-f0-9-]{36})/result$#iD',$path,$m) && $method==='POST') {
    $agent=require_terminal_agent($pdo);$body=request_json();
    $status=(string)($body['status']??'');$amount=filter_var($body['amount']??null,FILTER_VALIDATE_INT);
    if(!in_array($status,['approved','declined','cancelled','unknown'],true)||$amount===false||$amount<1)
        json_response(['ok'=>false,'error'=>'invalid_terminal_result'],422);
    $stmt=$pdo->prepare('SELECT p.id,p.amount,p.status,t.agent_id FROM pos_terminal_payments p JOIN pos_payment_terminals t ON t.id=p.terminal_id WHERE p.id=? LIMIT 1');
    $stmt->execute([$m[1]]);$payment=$stmt->fetch();
    if(!is_array($payment)||(string)$payment['agent_id']!==(string)$agent['id']) json_response(['ok'=>false,'error'=>'terminal_payment_not_found'],404);
    if((int)$payment['amount']!==$amount) json_response(['ok'=>false,'error'=>'terminal_amount_mismatch'],409);
    if($payment['status']!=='processing') {
        if($payment['status']===$status) json_response(['ok'=>true,'status'=>$status,'replayed'=>true]);
        json_response(['ok'=>false,'error'=>'terminal_payment_already_final','message'=>'وضعیت تراکنش قبلاً تعیین شده است'],409);
    }
    $external=substr(trim((string)($body['externalTransactionId']??'')),0,120);
    $trace=substr(trim((string)($body['traceNumber']??'')),0,80);
    $rrn=substr(trim((string)($body['retrievalReferenceNumber']??'')),0,80);
    $code=substr(trim((string)($body['responseCode']??'')),0,40);
    $message=substr(trim((string)($body['responseMessage']??'')),0,240);
    if($status==='approved'&&$external===''&&$trace===''&&$rrn==='') json_response(['ok'=>false,'error'=>'terminal_approval_reference_missing'],422);
    $safe=['providerCode'=>substr(preg_replace('/[^a-zA-Z0-9_-]/','',(string)($body['providerCode']??'')),0,64),'responseCode'=>$code];
    $update=$pdo->prepare('UPDATE pos_terminal_payments SET status=?,external_transaction_id=?,trace_number=?,retrieval_reference_number=?,response_code=?,response_message=?,safe_response=?,completed_at=UTC_TIMESTAMP() WHERE id=? AND status=\'processing\'');
    $update->execute([$status,$external!==''?$external:null,$trace!==''?$trace:null,$rrn!==''?$rrn:null,$code!==''?$code:null,$message!==''?$message:null,json_encode($safe,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),$m[1]]);
    audit($pdo,null,'terminal_payment_result','terminal_payment',$m[1],['status'=>$status,'trace_present'=>$trace!=='','rrn_present'=>$rrn!=='']);
    json_response(['ok'=>true,'status'=>$status]);
}


