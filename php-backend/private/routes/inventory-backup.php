<?php
// Route module loaded in the API dispatcher scope to preserve shared request context.
if (preg_match('#^/ingredients/([A-Za-z0-9_-]+)/stock$#D', $path, $stockMatch) && $method === 'POST') {
    $actor = require_role($pdo, ['manager']);
    require_csrf();
    $body = request_json();
    $deltaRaw = $body['delta'] ?? null;
    if (!is_int($deltaRaw) && !is_float($deltaRaw) && !(is_string($deltaRaw) && is_numeric($deltaRaw))) {
        json_response(['ok' => false, 'error' => 'invalid_stock_delta', 'message' => 'مقدار تغییر موجودی معتبر نیست'], 422);
    }
    $delta = (float)$deltaRaw;
    if (!is_finite($delta) || $delta == 0.0 || abs($delta) > 1000000 || round($delta, 3) !== $delta) {
        json_response(['ok' => false, 'error' => 'invalid_stock_delta', 'message' => 'تغییر موجودی باید غیرصفر و حداکثر سه رقم اعشار باشد'], 422);
    }
    $ingredientId = $stockMatch[1];
    try {
        $pdo->beginTransaction();
        $select = $pdo->prepare("SELECT payload FROM pos_records WHERE resource = 'ingredients' AND id = ? FOR UPDATE");
        $select->execute([$ingredientId]);
        $row = $select->fetch();
        if (!$row) {
            $pdo->rollBack();
            json_response(['ok' => false, 'error' => 'ingredient_not_found', 'message' => 'ماده اولیه پیدا نشد'], 404);
        }
        $item = json_decode((string)$row['payload'], true);
        if (!is_array($item) || !isset($item['stock']) || !is_numeric($item['stock'])) {
            $pdo->rollBack();
            json_response(['ok' => false, 'error' => 'ingredient_stock_invalid', 'message' => 'اطلاعات موجودی ماده اولیه معتبر نیست'], 409);
        }
        $before = (float)$item['stock'];
        $after = round($before + $delta, 3);
        if (!is_finite($before) || $before < 0 || $after < 0 || $after > 1000000000) {
            $pdo->rollBack();
            json_response(['ok' => false, 'error' => 'insufficient_stock', 'message' => 'موجودی برای این تغییر کافی نیست'], 409);
        }
        $item['stock'] = $after;
        $payload = json_encode($item, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $update = $pdo->prepare("UPDATE pos_records SET payload = ?, updated_by = ? WHERE resource = 'ingredients' AND id = ?");
        $update->execute([$payload, (int)$actor['id'], $ingredientId]);
        audit($pdo, (int)$actor['id'], 'ingredient_stock_adjusted', 'ingredient', $ingredientId, ['delta' => $delta, 'before' => $before, 'after' => $after]);
        $pdo->commit();
        json_response(['ok' => true, 'item' => $item]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('[3Food POS] Ingredient stock adjustment failed: ' . $e->getMessage());
        json_response(['ok' => false, 'error' => 'stock_adjustment_failed', 'message' => 'تغییر موجودی ذخیره نشد'], 500);
    }
}

if ($method === 'GET' && $path === '/backup/export') {
    $actor = require_role($pdo, ['manager']);
    $records = $pdo->query('SELECT id, resource, payload, updated_by, created_at, updated_at FROM pos_records ORDER BY resource, id')->fetchAll();
    // Gateway credentials are encrypted with this installation's app_key; never export them.
    $records = array_values(array_filter($records, static fn(array $record): bool => !($record['resource'] === 'system_meta' && $record['id'] === 'sms_gateway_config')));
    foreach ($records as &$record) {
        $record['payload'] = json_decode((string)$record['payload'], true) ?: [];
        if ($record['resource'] === 'settings' && is_array($record['payload'])) {
            unset($record['payload']['smsUser'], $record['payload']['smsKey'], $record['payload']['smsFrom']);
        }
    }
    unset($record);
    $orders = $pdo->query('SELECT id, order_number, status, idempotency_key, request_hash, customer_id, customer_name, customer_phone, guest_name, guest_phone, payment_method, points_used, points_earned, discount_code, items, totals, note, created_by, created_at, updated_at FROM pos_orders ORDER BY id')->fetchAll();
    foreach ($orders as &$order) {
        $order['items'] = json_decode((string)$order['items'], true) ?: [];
        $order['totals'] = json_decode((string)$order['totals'], true) ?: [];
    }
    unset($order);
    $effects = $pdo->query('SELECT order_id, effect_type, resource_id, quantity, points_spent, points_earned, money_delta, visits_delta, reversed_at, reversed_by, created_at FROM pos_order_effects ORDER BY id')->fetchAll();
    $redemptions = $pdo->query('SELECT order_id, discount_id, code, customer_id, redeemed_at, reversed_at FROM pos_discount_redemptions ORDER BY id')->fetchAll();
    $counters = $pdo->query('SELECT counter_key, counter_value FROM pos_counters ORDER BY counter_key')->fetchAll();
    // Agent credentials are never exported. Restored agents are disabled and must be paired again.
    $terminalAgents = $pdo->query('SELECT id,name,agent_version,created_at FROM app_terminal_agents ORDER BY id')->fetchAll();
    $paymentTerminals = $pdo->query('SELECT id,agent_id,local_terminal_key,name,provider_code,model_name,driver_code,connection_type,host,port,created_at,updated_at FROM pos_payment_terminals ORDER BY id')->fetchAll();
    $terminalPayments = $pdo->query('SELECT id,idempotency_key,terminal_id,order_id,amount,currency,status,external_transaction_id,trace_number,retrieval_reference_number,response_code,response_message,safe_response,requested_at,completed_at,updated_at FROM pos_terminal_payments ORDER BY requested_at')->fetchAll();
    foreach($terminalPayments as &$terminalPayment){
        if(is_string($terminalPayment['safe_response']??null)) $terminalPayment['safe_response']=json_decode($terminalPayment['safe_response'],true);
        if(in_array($terminalPayment['status'],['queued','processing'],true)) $terminalPayment['status']='unknown';
    } unset($terminalPayment);
    audit($pdo, (int)$actor['id'], 'backup_exported', 'backup', null, ['records' => count($records), 'orders' => count($orders)]);
    json_response(['ok' => true, 'backup' => [
        'format' => '3food-pos-mysql-backup',
        'version' => 1,
        'exported_at' => gmdate('c'),
        'records' => $records,
        'orders' => $orders,
        'order_effects' => $effects,
        'discount_redemptions' => $redemptions,
        'counters' => $counters,
        'terminal_agents' => $terminalAgents,
        'payment_terminals' => $paymentTerminals,
        'terminal_payments' => $terminalPayments,
    ]]);
}

if ($method === 'POST' && $path === '/backup/restore') {
    $actor = require_role($pdo, ['manager']);
    require_csrf();
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 8 * 1024 * 1024) {
        json_response(['ok' => false, 'error' => 'backup_too_large'], 413);
    }
    $body = request_json();
    $backup = $body['backup'] ?? null;
    if (!is_array($backup) || ($backup['format'] ?? '') !== '3food-pos-mysql-backup' || (int)($backup['version'] ?? 0) !== 1) {
        json_response(['ok' => false, 'error' => 'invalid_backup'], 422);
    }
    foreach (['records','orders','order_effects','discount_redemptions','counters'] as $key) {
        if (!isset($backup[$key]) || !is_array($backup[$key])) {
            json_response(['ok' => false, 'error' => 'invalid_backup_structure'], 422);
        }
    }
    foreach(['terminal_agents','payment_terminals','terminal_payments'] as $optionalKey){
        if(!isset($backup[$optionalKey])) $backup[$optionalKey]=[];
        if(!is_array($backup[$optionalKey])) json_response(['ok'=>false,'error'=>'invalid_backup_structure'],422);
    }
    if (count($backup['records']) > 40000 || count($backup['orders']) > 20000 ||
        count($backup['order_effects']) > 60000 || count($backup['discount_redemptions']) > 20000 ||
        count($backup['counters']) > 100 || count($backup['terminal_agents']) > 100 ||
        count($backup['payment_terminals']) > 500 || count($backup['terminal_payments']) > 50000) {
        json_response(['ok' => false, 'error' => 'backup_limits_exceeded'], 413);
    }
    try {
        $pdo->beginTransaction();
        $pdo->query('SELECT counter_key FROM pos_counters WHERE counter_key = "order_number" FOR UPDATE')->fetchColumn();
        // Lock the empty/current key ranges too, preventing concurrent POS writes
        // from slipping in after the empty-database check but before restoration.
        $pdo->query('SELECT id FROM pos_records FOR UPDATE')->fetchAll();
        $pdo->query('SELECT id FROM pos_orders FOR UPDATE')->fetchAll();
        $pdo->query('SELECT id FROM pos_order_effects FOR UPDATE')->fetchAll();
        $pdo->query('SELECT id FROM pos_discount_redemptions FOR UPDATE')->fetchAll();
        $pdo->query('SELECT id FROM app_terminal_agents FOR UPDATE')->fetchAll();
        $pdo->query('SELECT id FROM pos_payment_terminals FOR UPDATE')->fetchAll();
        $pdo->query('SELECT id FROM pos_terminal_payments FOR UPDATE')->fetchAll();
        $occupied = (int)$pdo->query('SELECT (SELECT COUNT(*) FROM pos_records) + (SELECT COUNT(*) FROM pos_orders) + (SELECT COUNT(*) FROM pos_order_effects) + (SELECT COUNT(*) FROM pos_discount_redemptions) + (SELECT COUNT(*) FROM app_terminal_agents) + (SELECT COUNT(*) FROM pos_payment_terminals) + (SELECT COUNT(*) FROM pos_terminal_payments)')->fetchColumn();
        if ($occupied !== 0) {
            $pdo->rollBack();
            json_response(['ok' => false, 'error' => 'restore_requires_empty_pos', 'message' => 'بازیابی فقط روی دیتابیس عملیاتی خالی انجام می‌شود؛ ابتدا از اطلاعات فعلی پشتیبان بگیرید و دیتابیس مقصد خالی باشد'], 409);
        }
        $allowedResources = ['categories','products','ingredients','customers','discounts','expenses','expense_categories','suppliers','supplier_purchases','templates','settings','sms_logs','system_meta'];
        $insertRecord = $pdo->prepare('INSERT INTO pos_records (id, resource, payload, updated_by) VALUES (?, ?, ?, ?)');
        foreach ($backup['records'] as $record) {
            if (!is_array($record) || !in_array($record['resource'] ?? '', $allowedResources, true) ||
                !is_string($record['id'] ?? null) || !preg_match('/^[A-Za-z0-9_-]{1,100}$/D', $record['id']) ||
                !is_array($record['payload'] ?? null)) throw new InvalidArgumentException('Invalid backup record');
            $payloadData = $record['payload'];
            if ($record['resource'] === 'settings') unset($payloadData['smsUser'], $payloadData['smsKey'], $payloadData['smsFrom']);
            $payload = json_encode($payloadData, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
            if (strlen($payload) > 262144) throw new InvalidArgumentException('Backup record too large');
            $insertRecord->execute([$record['id'], $record['resource'], $payload, null]);
        }
        $insertOrder = $pdo->prepare('INSERT INTO pos_orders (id, order_number, status, idempotency_key, request_hash, customer_id, customer_name, customer_phone, guest_name, guest_phone, payment_method, points_used, points_earned, discount_code, items, totals, note, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $orderIds = [];
        foreach ($backup['orders'] as $order) {
            if (!is_array($order) || !is_numeric($order['id'] ?? null) || (int)$order['id'] < 1 ||
                !is_numeric($order['order_number'] ?? null) || (int)$order['order_number'] < 1 ||
                !in_array($order['status'] ?? '', ['new','preparing','ready','delivered','cancelled'], true) ||
                !is_array($order['items'] ?? null) || !is_array($order['totals'] ?? null)) throw new InvalidArgumentException('Invalid backup order');
            $id = (int)$order['id'];
            if (isset($orderIds[$id])) throw new InvalidArgumentException('Duplicate backup order');
            $orderIds[$id] = true;
            $items = json_encode($order['items'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
            $totals = json_encode($order['totals'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
            $insertOrder->execute([$id, (int)$order['order_number'], $order['status'], $order['idempotency_key'] ?? null, $order['request_hash'] ?? null,
                $order['customer_id'] ?? null, $order['customer_name'] ?? null, $order['customer_phone'] ?? null,
                $order['guest_name'] ?? null, $order['guest_phone'] ?? null, $order['payment_method'] ?? 'cash',
                (int)($order['points_used'] ?? 0), (int)($order['points_earned'] ?? 0), $order['discount_code'] ?? null,
                $items, $totals, $order['note'] ?? null, (int)$actor['id'], $order['created_at'] ?? gmdate('Y-m-d H:i:s'), $order['updated_at'] ?? gmdate('Y-m-d H:i:s')]);
        }
        $insertEffect = $pdo->prepare('INSERT INTO pos_order_effects (order_id, effect_type, resource_id, quantity, points_spent, points_earned, money_delta, visits_delta, reversed_at, reversed_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)');
        foreach ($backup['order_effects'] as $effect) {
            if (!is_array($effect) || !isset($orderIds[(int)($effect['order_id'] ?? 0)]) ||
                !in_array($effect['effect_type'] ?? '', ['ingredient','customer'], true) ||
                !is_string($effect['resource_id'] ?? null) || strlen($effect['resource_id']) > 100) throw new InvalidArgumentException('Invalid backup effect');
            $insertEffect->execute([(int)$effect['order_id'], $effect['effect_type'], $effect['resource_id'], $effect['quantity'] ?? 0,
                $effect['points_spent'] ?? 0, $effect['points_earned'] ?? 0, $effect['money_delta'] ?? 0, $effect['visits_delta'] ?? 0,
                $effect['reversed_at'] ?? null, $effect['created_at'] ?? gmdate('Y-m-d H:i:s')]);
        }
        $insertRedemption = $pdo->prepare('INSERT INTO pos_discount_redemptions (order_id, discount_id, code, customer_id, redeemed_at, reversed_at) VALUES (?, ?, ?, ?, ?, ?)');
        foreach ($backup['discount_redemptions'] as $redemption) {
            if (!is_array($redemption) || !isset($orderIds[(int)($redemption['order_id'] ?? 0)]) ||
                !is_string($redemption['discount_id'] ?? null) || !is_string($redemption['code'] ?? null)) throw new InvalidArgumentException('Invalid backup redemption');
            $insertRedemption->execute([(int)$redemption['order_id'], $redemption['discount_id'], $redemption['code'],
                $redemption['customer_id'] ?? null, $redemption['redeemed_at'] ?? gmdate('Y-m-d H:i:s'), $redemption['reversed_at'] ?? null]);
        }

        $agentIds=[];
        $insertAgent=$pdo->prepare('INSERT INTO app_terminal_agents (id,name,token_hash,enabled,agent_version,last_seen_at,created_by,created_at) VALUES (?,?,?,0,?,NULL,?,?)');
        foreach($backup['terminal_agents'] as $agent){
            if(!is_array($agent)||!valid_uuid((string)($agent['id']??''))||trim((string)($agent['name']??''))===''||utf8_length((string)$agent['name'])>120) throw new InvalidArgumentException('Invalid terminal agent backup');
            $agentIds[(string)$agent['id']]=true;
            $insertAgent->execute([$agent['id'],substr((string)$agent['name'],0,120),hash('sha256',random_bytes(32)),isset($agent['agent_version'])?substr((string)$agent['agent_version'],0,40):null,(int)$actor['id'],$agent['created_at']??gmdate('Y-m-d H:i:s')]);
        }
        $terminalIds=[];
        $insertTerminal=$pdo->prepare('INSERT INTO pos_payment_terminals (id,agent_id,local_terminal_key,name,provider_code,model_name,driver_code,connection_type,host,port,enabled,is_default,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,0,0,?,?,?)');
        foreach($backup['payment_terminals'] as $terminal){
            if(!is_array($terminal)||!is_string($terminal['id']??null)||!preg_match('/^[A-Za-z0-9_-]{1,100}$/D',$terminal['id'])||
                !isset($agentIds[(string)($terminal['agent_id']??'')])||!preg_match('/^[A-Za-z0-9_-]{1,100}$/D',(string)($terminal['local_terminal_key']??''))||
                !in_array($terminal['connection_type']??'', ['lan','wifi'],true)||(filter_var($terminal['host']??'',FILTER_VALIDATE_IP)===false||!is_private_terminal_ip((string)$terminal['host']))||
                !is_numeric($terminal['port']??null)||(int)$terminal['port']<1||(int)$terminal['port']>65535) throw new InvalidArgumentException('Invalid payment terminal backup');
            $terminalIds[$terminal['id']]=true;
            $insertTerminal->execute([$terminal['id'],$terminal['agent_id'],$terminal['local_terminal_key'],substr((string)($terminal['name']??''),0,120),substr((string)($terminal['provider_code']??'unknown'),0,64),isset($terminal['model_name'])?substr((string)$terminal['model_name'],0,120):null,substr((string)($terminal['driver_code']??'unconfigured'),0,80),$terminal['connection_type'],$terminal['host'],(int)$terminal['port'],(int)$actor['id'],$terminal['created_at']??gmdate('Y-m-d H:i:s'),$terminal['updated_at']??gmdate('Y-m-d H:i:s')]);
        }
        $insertTerminalPayment=$pdo->prepare('INSERT INTO pos_terminal_payments (id,idempotency_key,terminal_id,order_id,amount,currency,status,external_transaction_id,trace_number,retrieval_reference_number,response_code,response_message,safe_response,created_by,requested_at,completed_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
        foreach($backup['terminal_payments'] as $terminalPayment){
            if(!is_array($terminalPayment)||!valid_uuid((string)($terminalPayment['id']??''))||!valid_uuid((string)($terminalPayment['idempotency_key']??''))||
                !isset($terminalIds[(string)($terminalPayment['terminal_id']??'')])||!is_numeric($terminalPayment['amount']??null)||(int)$terminalPayment['amount']<1||
                !in_array($terminalPayment['status']??'', ['queued','processing','approved','declined','cancelled','unknown','expired'],true)) throw new InvalidArgumentException('Invalid terminal payment backup');
            $linkedOrder=$terminalPayment['order_id']??null;
            if($linkedOrder!==null&&!isset($orderIds[(int)$linkedOrder])) throw new InvalidArgumentException('Invalid linked order in terminal payment backup');
            $paymentStatus=in_array($terminalPayment['status'],['queued','processing'],true)?'unknown':$terminalPayment['status'];
            $safeResponse=is_array($terminalPayment['safe_response']??null)?json_encode($terminalPayment['safe_response'],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR):null;
            $insertTerminalPayment->execute([$terminalPayment['id'],$terminalPayment['idempotency_key'],$terminalPayment['terminal_id'],$linkedOrder,(int)$terminalPayment['amount'],substr((string)($terminalPayment['currency']??'IRT'),0,3),$paymentStatus,
                isset($terminalPayment['external_transaction_id'])?substr((string)$terminalPayment['external_transaction_id'],0,120):null,isset($terminalPayment['trace_number'])?substr((string)$terminalPayment['trace_number'],0,80):null,
                isset($terminalPayment['retrieval_reference_number'])?substr((string)$terminalPayment['retrieval_reference_number'],0,80):null,isset($terminalPayment['response_code'])?substr((string)$terminalPayment['response_code'],0,40):null,
                isset($terminalPayment['response_message'])?substr((string)$terminalPayment['response_message'],0,240):null,$safeResponse,(int)$actor['id'],$terminalPayment['requested_at']??gmdate('Y-m-d H:i:s'),
                $terminalPayment['completed_at']??null,$terminalPayment['updated_at']??gmdate('Y-m-d H:i:s')]);
        }

        $counter = 0;
        foreach ($backup['counters'] as $entry) {
            if (!is_array($entry) || ($entry['counter_key'] ?? '') !== 'order_number' || !is_numeric($entry['counter_value'] ?? null) ||
                (int)$entry['counter_value'] < 0 || (int)$entry['counter_value'] > 1000000000) throw new InvalidArgumentException('Invalid backup counter');
            $counter = (int)$entry['counter_value'];
        }
        $maxOrder = (int)$pdo->query('SELECT COALESCE(MAX(order_number), 0) FROM pos_orders')->fetchColumn();
        $pdo->prepare("UPDATE pos_counters SET counter_value = ? WHERE counter_key = 'order_number'")->execute([max($counter, $maxOrder)]);
        audit($pdo, (int)$actor['id'], 'backup_restored', 'backup', null, [
            'records' => count($backup['records']), 'orders' => count($backup['orders']),
            'effects' => count($backup['order_effects']), 'redemptions' => count($backup['discount_redemptions']), 'terminal_agents' => count($backup['terminal_agents']), 'terminals' => count($backup['payment_terminals']), 'terminal_payments' => count($backup['terminal_payments']),
        ]);
        $pdo->commit();
        json_response(['ok' => true, 'restored' => [
            'records' => count($backup['records']), 'orders' => count($backup['orders']),
            'effects' => count($backup['order_effects']), 'redemptions' => count($backup['discount_redemptions']),
        ]]);
    } catch (InvalidArgumentException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        json_response(['ok' => false, 'error' => 'invalid_backup_data', 'message' => 'ساختار یا یکی از رکوردهای فایل پشتیبان معتبر نیست'], 422);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('[3Food POS] Backup restore failed: ' . $e->getMessage());
        json_response(['ok' => false, 'error' => 'backup_restore_failed', 'message' => 'بازیابی انجام نشد؛ هیچ بخشی از اطلاعات تغییر نکرد'], 500);
    }
}

if ($method === 'POST' && $path === '/migration/import') {
    $actor = require_role($pdo, ['manager']);
    require_csrf();
    $body = request_json();
    $allowed = ['categories','products','ingredients','customers','discounts','expenses','expense_categories','suppliers','supplier_purchases','templates','settings'];
    $provided = $body['data'] ?? null;
    if (!is_array($provided)) json_response(['ok' => false, 'error' => 'invalid_import'], 422);
    $encodedBody = json_encode($provided, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    if (strlen($encodedBody) > 2 * 1024 * 1024) {
        json_response(['ok' => false, 'error' => 'import_too_large', 'message' => 'حجم انتقال داده بیش از ۲ مگابایت است'], 413);
    }
    try {
        $pdo->beginTransaction();
        $existingRecords = (int)$pdo->query('SELECT COUNT(*) FROM pos_records')->fetchColumn();
        $existingOrders = (int)$pdo->query('SELECT COUNT(*) FROM pos_orders')->fetchColumn();
        if ($existingRecords > 0 || $existingOrders > 0) {
            $pdo->rollBack();
            json_response(['ok' => false, 'error' => 'import_not_empty', 'message' => 'دیتابیس قبلاً داده دارد؛ انتقال اولیه فقط روی دیتابیس خالی مجاز است'], 409);
        }
        $insert = $pdo->prepare('INSERT INTO pos_records (id, resource, payload, updated_by) VALUES (?, ?, ?, ?)');
        $counts = [];
        foreach ($allowed as $resource) {
            $records = $provided[$resource] ?? [];
            if (!is_array($records) || count($records) > 5000) {
                throw new InvalidArgumentException('Invalid import resource: ' . $resource);
            }
            $counts[$resource] = 0;
            foreach ($records as $record) {
                if (!is_array($record)) throw new InvalidArgumentException('Invalid record in ' . $resource);
                $id = $resource === 'settings' ? (string)($record['id'] ?? 'main') : (string)($record['id'] ?? '');
                if ($id === '' || strlen($id) > 100 || !preg_match('/^[A-Za-z0-9_-]+$/D', $id)) {
                    throw new InvalidArgumentException('Invalid record id in ' . $resource);
                }
                if ($resource === 'settings') {
                    unset($record['smsUser'], $record['smsKey'], $record['smsFrom']);
                }
                $payload = json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
                if (strlen($payload) > 262144) throw new InvalidArgumentException('Record too large in ' . $resource);
                $insert->execute([$id, $resource, $payload, (int)$actor['id']]);
                $counts[$resource]++;
            }
        }
        $nextOrder = isset($body['nextOrder']) ? max(1, min(1000000000, (int)$body['nextOrder'])) : 1042;
        $pdo->prepare("UPDATE pos_counters SET counter_value = ? WHERE counter_key = 'order_number'")->execute([$nextOrder - 1]);
        audit($pdo, (int)$actor['id'], 'legacy_data_imported', 'migration', null, ['counts' => $counts]);
        $pdo->commit();
        json_response(['ok' => true, 'counts' => $counts, 'orders_imported' => 0]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        if ($e instanceof InvalidArgumentException) {
            json_response(['ok' => false, 'error' => 'invalid_import_record', 'message' => 'یکی از رکوردهای انتقال داده معتبر نیست'], 422);
        }
        error_log('[3Food POS] Legacy import failed: ' . $e->getMessage());
        json_response(['ok' => false, 'error' => 'import_failed', 'message' => 'انتقال داده انجام نشد'], 500);
    }
}


