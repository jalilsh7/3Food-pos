<?php
// Route module loaded in the API dispatcher scope to preserve shared request context.
function threefood_sms_gateway_read(PDO $pdo, array $fallback): array {
    $row = $pdo->query("SELECT payload FROM pos_records WHERE resource='system_meta' AND id='sms_gateway_config' LIMIT 1")->fetchColumn();
    if (is_string($row) && $row !== '') {
        $stored = json_decode($row, true);
        if (is_array($stored) && ($stored['version'] ?? 0) === 1 && function_exists('openssl_decrypt')) {
            $key = hash('sha256', (string)($GLOBALS['config']['app_key'] ?? ''), true);
            $plain = openssl_decrypt(
                base64_decode((string)($stored['ciphertext'] ?? ''), true) ?: '',
                'aes-256-gcm',
                $key,
                OPENSSL_RAW_DATA,
                base64_decode((string)($stored['iv'] ?? ''), true) ?: '',
                base64_decode((string)($stored['tag'] ?? ''), true) ?: '',
                '3food-sms-gateway-v1'
            );
            $decoded = is_string($plain) ? json_decode($plain, true) : null;
            if (is_array($decoded)) return $decoded;
        }
    }
    return [
        'enabled' => (($fallback['provider'] ?? 'none') === 'national_payamak'),
        'mode' => 'standard',
        'username' => (string)($fallback['username'] ?? ''),
        'apiKey' => (string)($fallback['password'] ?? ''),
        'sender' => (string)($fallback['sender'] ?? ''),
        'senderSupportOne' => '',
        'senderSupportTwo' => '',
        'inboxLocation' => (string)($fallback['inbox_location'] ?? ''),
        'inboxFrom' => (string)($fallback['inbox_from'] ?? ''),
    ];
}

function threefood_sms_gateway_save(PDO $pdo, array $config, int $actorId): void {
    if (!function_exists('openssl_encrypt')) throw new RuntimeException('sms_encryption_unavailable');
    $key = hash('sha256', (string)($config['app_key'] ?? ''), true);
    $iv = random_bytes(12);
    $plain = json_encode($GLOBALS['threefood_sms_gateway_write'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    $tag = '';
    $cipher = openssl_encrypt($plain, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag, '3food-sms-gateway-v1');
    if (!is_string($cipher)) throw new RuntimeException('sms_encryption_failed');
    $payload = json_encode(['version'=>1,'iv'=>base64_encode($iv),'tag'=>base64_encode($tag),'ciphertext'=>base64_encode($cipher)], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    $stmt = $pdo->prepare("INSERT INTO pos_records (id,resource,payload,updated_by) VALUES ('sms_gateway_config','system_meta',?,?) ON DUPLICATE KEY UPDATE payload=VALUES(payload),updated_by=VALUES(updated_by)");
    $stmt->execute([$payload, $actorId]);
}
if ($method === 'GET' && $path === '/reports/summary') {
    $actor = require_role($pdo, ['manager']);
    $tehranNow = new DateTimeImmutable('now', new DateTimeZone('Asia/Tehran'));
    $from = (string)($_GET['from'] ?? $tehranNow->modify('first day of this month')->format('Y-m-d'));
    $to = (string)($_GET['to'] ?? $tehranNow->format('Y-m-d'));
    if (!preg_match('/^\\d{4}-\\d{2}-\\d{2}$/D', $from) || !preg_match('/^\\d{4}-\\d{2}-\\d{2}$/D', $to)) {
        json_response(['ok'=>false,'error'=>'invalid_report_range','message'=>'بازه تاریخ گزارش معتبر نیست'],422);
    }
    $fromDate = DateTimeImmutable::createFromFormat('!Y-m-d', $from);
    $toDate = DateTimeImmutable::createFromFormat('!Y-m-d', $to);
    if (!$fromDate || !$toDate || $toDate < $fromDate || $toDate->diff($fromDate)->days > 366) {
        json_response(['ok'=>false,'error'=>'invalid_report_range','message'=>'بازه گزارش حداکثر ۳۶۶ روز و باید معتبر باشد'],422);
    }
    $ordersStmt = $pdo->prepare("SELECT id, order_number, status, payment_method, items, totals, created_at FROM pos_orders WHERE created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY) ORDER BY created_at ASC");
    $tehran = new DateTimeZone('Asia/Tehran'); $utc = new DateTimeZone('UTC');
    $fromUtc = (new DateTimeImmutable($from . ' 00:00:00', $tehran))->setTimezone($utc)->format('Y-m-d H:i:s');
    $toUtc = (new DateTimeImmutable($to . ' 00:00:00', $tehran))->modify('+1 day')->setTimezone($utc)->format('Y-m-d H:i:s');
    $ordersStmt = $pdo->prepare('SELECT id, order_number, status, payment_method, items, totals, created_at FROM pos_orders WHERE created_at >= ? AND created_at < ? ORDER BY created_at ASC');
    $ordersStmt->execute([$fromUtc, $toUtc]);
    $orders = $ordersStmt->fetchAll();
    $products = []; $categoryNames=[]; $byCategory=[];
    foreach ($pdo->query("SELECT id,payload FROM pos_records WHERE resource='categories'")->fetchAll() as $row) { $category=json_decode((string)$row['payload'],true); if(is_array($category))$categoryNames[(string)$row['id']]=(string)($category['name']??'بدون دسته'); }
    foreach ($pdo->query("SELECT id,payload FROM pos_records WHERE resource='products'")->fetchAll() as $row) {
        $p = json_decode((string)$row['payload'], true);
        if (is_array($p)) $products[(string)$row['id']] = $p;
    }
    $sales=0; $count=0; $cancelled=0; $cost=0; $taxCollected=0; $discountsTotal=0; $daily=[]; $byPayment=['cash'=>0,'card'=>0,'online'=>0]; $byProduct=[];
    foreach ($orders as $order) {
        if ($order['status'] === 'cancelled') { $cancelled++; continue; }
        $totals=json_decode((string)$order['totals'],true) ?: [];
        $total=(int)($totals['total']??0); $tax=(int)($totals['tax']??0); $discount=(int)($totals['tierDiscount']??0)+(int)($totals['codeDiscount']??0)+(int)($totals['pointsDiscount']??0); $revenue=max(0,(int)($totals['subtotal']??$total)-$discount); $sales+=$revenue; $taxCollected+=$tax; $discountsTotal+=$discount; $count++;
        $payment=(string)($order['payment_method']??'cash'); if(isset($byPayment[$payment])) $byPayment[$payment]+=$total;
        $day=(new DateTimeImmutable((string)$order['created_at'],new DateTimeZone('UTC')))->setTimezone(new DateTimeZone('Asia/Tehran'))->format('Y-m-d'); $daily[$day]=($daily[$day]??0)+$revenue;
        $items=json_decode((string)$order['items'],true) ?: [];
        foreach($items as $line){
            if(!is_array($line)) continue;
            $productId=(string)($line['productId']??''); $qty=max(0,(int)($line['qty']??0));
            $name=(string)($line['name']??'محصول'); $unit=(int)($line['unitPrice']??0);
            $byProduct[$name]??=['quantity'=>0,'revenue'=>0]; $byProduct[$name]['quantity']+=$qty; $byProduct[$name]['revenue']+=$unit*$qty;
            $categoryId=(string)($products[$productId]['categoryId']??'');$categoryName=$categoryNames[$categoryId]??'بدون دسته';$byCategory[$categoryName]??=['quantity'=>0,'revenue'=>0];$byCategory[$categoryName]['quantity']+=$qty;$byCategory[$categoryName]['revenue']+=$unit*$qty;
            $cost += max(0,(int)($line['unitCost']??($products[$productId]['cost']??0)))*$qty;
        }
    }
    $expenseStmt=$pdo->prepare("SELECT payload FROM pos_records WHERE resource='expenses'");
    $expenseStmt->execute(); $expenses=[]; $expenseTotal=0; $expenseGroups=[];
    foreach($expenseStmt->fetchAll(PDO::FETCH_COLUMN) as $raw){
        $e=json_decode((string)$raw,true); if(!is_array($e)) continue;
        $date=(string)($e['date']??''); if($date<$from||$date>$to) continue;
        $amount=max(0,(int)($e['amount']??0));
        $category=(string)($e['category']??'سایر هزینه‌ها');
        // Raw-material purchases increase inventory; consumed ingredient cost is counted in COGS above.
        if ($category !== 'مواد اولیه') $expenseTotal += $amount;
        $expenseGroups[$category]=($expenseGroups[$category]??0)+$amount;
        $expenses[]=['id'=>(string)($e['id']??''),'title'=>(string)($e['title']??''),'amount'=>$amount,'category'=>$category,'date'=>$date];
    }
    ksort($daily); ksort($expenseGroups); uasort($byProduct,static fn($a,$b)=>$b['quantity']<=>$a['quantity']); uasort($byCategory,static fn($a,$b)=>$b['revenue']<=>$a['revenue']);
    $monthly=[];
    foreach($daily as $day=>$value){$month=substr((string)$day,0,7);$monthly[$month]=($monthly[$month]??0)+$value;}
    ksort($monthly);
    $inventoryPurchases=0;
    foreach($pdo->query("SELECT payload FROM pos_records WHERE resource='supplier_purchases'")->fetchAll(PDO::FETCH_COLUMN) as $rawPurchase){$purchase=json_decode((string)$rawPurchase,true);$purchaseDate=(string)($purchase['date']??'');if(is_array($purchase)&&$purchaseDate>=$from&&$purchaseDate<=$to&&($purchase['kind']??'')==='purchase'&&!empty($purchase['ingredientId']))$inventoryPurchases+=(int)($purchase['amount']??0);}
    $inventoryPurchases+=array_sum(array_map(static fn($e)=>($e['category']??'')==='مواد اولیه'?(int)($e['amount']??0):0,$expenses));
    $consumptionStmt=$pdo->prepare("SELECT consumed.resource_id, consumed.quantity, r.payload
        FROM (
            SELECT e.resource_id, SUM(e.quantity) AS quantity
            FROM pos_order_effects e
            INNER JOIN pos_orders o ON o.id=e.order_id
            WHERE e.effect_type='ingredient' AND e.reversed_at IS NULL AND o.status<>'cancelled'
              AND o.created_at>=? AND o.created_at<?
            GROUP BY e.resource_id
        ) consumed
        LEFT JOIN pos_records r ON r.resource='ingredients' AND r.id=consumed.resource_id
        ORDER BY consumed.quantity DESC");
    $consumptionStmt->execute([$fromUtc,$toUtc]);
    $inventoryConsumption=[];
    foreach($consumptionStmt->fetchAll() as $consumed){
        $ingredient=is_string($consumed['payload']??null)?json_decode((string)$consumed['payload'],true):null;
        $inventoryConsumption[]=[
            'ingredient_id'=>(string)$consumed['resource_id'],
            'name'=>is_array($ingredient)?(string)($ingredient['name']??'ماده اولیه حذف‌شده'):'ماده اولیه حذف‌شده',
            'quantity'=>round((float)$consumed['quantity'],3),
            'unit'=>is_array($ingredient)?(string)($ingredient['unit']??''):'',
        ];
    }
    $lowStock=[]; $allInventory=[]; $inventoryValue=0;
    foreach($pdo->query("SELECT payload FROM pos_records WHERE resource='ingredients'")->fetchAll(PDO::FETCH_COLUMN) as $raw){
        $ingredient=json_decode((string)$raw,true);if(!is_array($ingredient))continue;
        $stock=(float)($ingredient['stock']??0);$min=(float)($ingredient['minStock']??0);$unitCost=(float)($ingredient['costPerUnit']??0);
        $value=max(0,$stock)*max(0,$unitCost);$inventoryValue+=$value;
        $inventoryRow=['name'=>(string)($ingredient['name']??''),'stock'=>$stock,'minStock'=>$min,'unit'=>(string)($ingredient['unit']??''),'costPerUnit'=>$unitCost,'value'=>round($value)];
        $allInventory[]=$inventoryRow;
        if($stock<=$min)$lowStock[]=$inventoryRow;
    }
    $customerRows=[];
    foreach($pdo->query("SELECT payload FROM pos_records WHERE resource='customers'")->fetchAll(PDO::FETCH_COLUMN) as $raw){
        $customer=json_decode((string)$raw,true);if(!is_array($customer))continue;
        $customerRows[]=['name'=>(string)($customer['name']??''),'phone'=>(string)($customer['phone']??''),'totalSpent'=>(int)($customer['totalSpent']??0),'visits'=>(int)($customer['visits']??0),'points'=>(int)($customer['points']??0)];
    }
    usort($customerRows,static fn($a,$b)=>$b['totalSpent']<=>$a['totalSpent']);
    json_response(['ok'=>true,'range'=>['from'=>$from,'to'=>$to],'sales'=>$sales,'orders'=>$count,'cancelled'=>$cancelled,'average_order'=>$count?intdiv($sales,$count):0,'tax_collected'=>$taxCollected,'discounts'=>$discountsTotal,'cost_of_goods'=>$cost,'expenses'=>$expenseTotal,'inventory_purchases'=>$inventoryPurchases,'gross_profit'=>$sales-$cost,'net_profit'=>$sales-$cost-$expenseTotal,'daily'=>array_map(static fn($d,$v)=>['date'=>$d,'sales'=>$v],array_keys($daily),array_values($daily)),'monthly'=>array_map(static fn($m,$v)=>['month'=>$m,'sales'=>$v],array_keys($monthly),array_values($monthly)),'payments'=>$byPayment,'products'=>array_slice(array_map(static fn($name,$v)=>['name'=>$name]+$v,array_keys($byProduct),array_values($byProduct)),0,100),'all_products'=>array_map(static fn($name,$v)=>['name'=>$name]+$v,array_keys($byProduct),array_values($byProduct)),'product_categories'=>array_map(static fn($name,$v)=>['name'=>$name]+$v,array_keys($byCategory),array_values($byCategory)),'expense_categories'=>$expenseGroups,'expense_items'=>$expenses,'inventory'=>['value'=>round($inventoryValue),'low_stock_count'=>count($lowStock)],'inventory_items'=>$allInventory,'inventory_consumption'=>$inventoryConsumption,'low_stock'=>$lowStock,'top_customers'=>array_slice($customerRows,0,20),'all_customers'=>$customerRows]);
}


if ($path === '/sms/settings' && $method === 'GET') {
    require_role($pdo, ['manager']);
    $gateway = threefood_sms_gateway_read($pdo, $config['sms'] ?? []);
    json_response(['ok'=>true,'enabled'=>(bool)($gateway['enabled']??false),'mode'=>in_array($gateway['mode']??'standard',['standard','smart_sms'],true)?$gateway['mode']:'standard','username'=>(string)($gateway['username']??''),'hasApiKey'=>trim((string)($gateway['apiKey']??''))!=='','sender'=>(string)($gateway['sender']??''),'senderSupportOne'=>(string)($gateway['senderSupportOne']??''),'senderSupportTwo'=>(string)($gateway['senderSupportTwo']??''),'inboxLocation'=>(string)($gateway['inboxLocation']??''),'inboxFrom'=>(string)($gateway['inboxFrom']??''),'inboxConfigured'=>is_numeric($gateway['inboxLocation']??null)]);
}
if ($path === '/sms/settings' && $method === 'POST') {
    $actor = require_role($pdo, ['manager']);
    require_csrf();
    $body = request_json();
    $old = threefood_sms_gateway_read($pdo, $config['sms'] ?? []);
    $enabled = ($body['enabled'] ?? false) === true;
    $mode = (string)($body['mode'] ?? 'standard');
    $username = trim((string)($body['username'] ?? ''));
    $apiKey = trim((string)($body['apiKey'] ?? ''));
    if ($apiKey === '') $apiKey = (string)($old['apiKey'] ?? '');
    $sender = trim((string)($body['sender'] ?? ''));
    $supportOne = trim((string)($body['senderSupportOne'] ?? ''));
    $supportTwo = trim((string)($body['senderSupportTwo'] ?? ''));
    $inboxLocation = trim((string)($body['inboxLocation'] ?? ($old['inboxLocation'] ?? '')));
    $inboxFrom = trim((string)($body['inboxFrom'] ?? ($old['inboxFrom'] ?? '')));
    if (!in_array($mode, ['standard','smart_sms'], true) || ($enabled && ($username === '' || $apiKey === '' || $sender === '')) ||
        strlen($username)>120 || strlen($apiKey)>500 || strlen($sender)>40 || strlen($supportOne)>40 || strlen($supportTwo)>40 || ($inboxLocation!=='' && (!ctype_digit($inboxLocation) || (int)$inboxLocation>99)) || strlen($inboxFrom)>40) {
        json_response(['ok'=>false,'error'=>'invalid_sms_settings','message'=>'نام کاربری، کلید API، سرشماره یا حالت ارسال معتبر نیست'],422);
    }
    $GLOBALS['threefood_sms_gateway_write'] = ['enabled'=>$enabled,'mode'=>$mode,'username'=>$username,'apiKey'=>$apiKey,'sender'=>$sender,'senderSupportOne'=>$supportOne,'senderSupportTwo'=>$supportTwo,'inboxLocation'=>$inboxLocation,'inboxFrom'=>$inboxFrom];
    try {
        threefood_sms_gateway_save($pdo, $config, (int)$actor['id']);
        audit($pdo, (int)$actor['id'], 'sms_gateway_settings_updated', 'sms', null, ['enabled'=>$enabled,'mode'=>$mode,'username_set'=>$username!=='','api_key_set'=>$apiKey!=='']);
        json_response(['ok'=>true,'saved'=>true,'hasApiKey'=>$apiKey!=='']);
    } catch (Throwable $e) {
        error_log('[3Food POS] SMS settings save failed: '.$e->getMessage());
        json_response(['ok'=>false,'error'=>'sms_settings_save_failed','message'=>'ذخیره امن تنظیمات پیامک انجام نشد'],500);
    } finally {
        unset($GLOBALS['threefood_sms_gateway_write']);
    }
}

if ($method === 'POST' && $path === '/sms/birthday-sync') {
    $actor = require_role($pdo, ['manager']);
    require_csrf();
    $sms = array_merge($config['sms'] ?? [], threefood_sms_gateway_read($pdo, $config['sms'] ?? []));
    $sms['inbox_location'] = $sms['inboxLocation'] ?? ($sms['inbox_location'] ?? null);
    $sms['inbox_from'] = $sms['inboxFrom'] ?? ($sms['inbox_from'] ?? '');
    $username = trim((string)($sms['username'] ?? ''));
    $password = trim((string)($sms['apiKey'] ?? ($sms['password'] ?? '')));
    $location = $sms['inbox_location'] ?? null;
    $from = trim((string)($sms['inbox_from'] ?? ''));
    $index = trim((string)($sms['inbox_index'] ?? '1'));
    $count = (int)($sms['inbox_count'] ?? 50);
    if (empty($sms['enabled']) && ($sms['provider'] ?? 'none') !== 'national_payamak' || $username === '' || $password === ''
        || !is_numeric($location) || (int)$location < 0 || (int)$location > 99
        || !preg_match('/^[0-9]{1,12}$/D', $index) || $count < 1 || $count > 100) {
        json_response(['ok' => false, 'error' => 'sms_inbox_not_configured', 'message' => 'تنظیم صندوق ورودی پیامک در تنظیمات فروشگاه کامل نیست'], 503);
    }
    $endpoint = 'https://rest.payamak-panel.com/api/SendSMS/GetMessages';
    $fields = [
        'UserName' => $username,
        'PassWord' => $password,
        'Location' => (string)(int)$location,
        'From' => $from,
        'Index' => $index,
        'Count' => (string)$count,
    ];
    try {
        $body = http_build_query($fields, '', '&', PHP_QUERY_RFC3986);
        if (function_exists('curl_init')) {
            $ch = curl_init($endpoint);
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $body,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_CONNECTTIMEOUT => 8,
                CURLOPT_TIMEOUT => 20,
                CURLOPT_SSL_VERIFYPEER => true,
                CURLOPT_SSL_VERIFYHOST => 2,
                CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
            ]);
            $raw = curl_exec($ch);
            $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);
            if ($raw === false || $status < 200 || $status >= 300) {
                throw new RuntimeException('sms_provider_http_error:' . $status . ':' . substr($curlError, 0, 120));
            }
        } else {
            $context = stream_context_create([
                'http' => [
                    'method' => 'POST',
                    'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
                    'content' => $body,
                    'timeout' => 20,
                    'ignore_errors' => true,
                ],
                'ssl' => ['verify_peer' => true, 'verify_peer_name' => true],
            ]);
            $raw = file_get_contents($endpoint, false, $context);
            $statusLine = $http_response_header[0] ?? '';
            if ($raw === false || preg_match('/\s2[0-9]{2}\s/', $statusLine) !== 1) {
                throw new RuntimeException('sms_provider_http_error');
            }
        }
        $messages = threefood_parse_payamak_inbox_response((string)$raw);
        $pdo->beginTransaction();
        $insertInbox = $pdo->prepare('INSERT IGNORE INTO pos_records (id, resource, payload, updated_by) VALUES (?, ?, ?, ?)');
        $findCustomers = $pdo->query("SELECT id, payload FROM pos_records WHERE resource = 'customers' FOR UPDATE")->fetchAll();
        $processed = 0;
        $duplicates = 0;
        $updated = 0;
        $unmatched = 0;
        $ignored = 0;
        foreach ($messages as $message) {
            $sender = threefood_normalize_iran_mobile($message['sender']);
            $providerId = $message['provider_id'];
            $dedupeSource = $providerId !== null
                ? 'provider:' . $providerId
                : 'fallback:' . ($sender ?? $message['sender']) . '|' . $message['text'] . '|' . ($message['received_at'] ?? '');
            $inboxId = 'in_' . substr(hash('sha256', $dedupeSource), 0, 60);
            $birthday = threefood_parse_birthday_sms($message['text']);
            $inbox = [
                'id' => $inboxId,
                'providerId' => $providerId,
                'sender' => $sender ?? $message['sender'],
                'receivedAt' => $message['received_at'],
                'birthday' => $birthday,
                'status' => 'received',
                'processedAt' => gmdate('c'),
            ];
            $insertInbox->execute([$inboxId, 'sms_inbox', json_encode($inbox, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR), (int)$actor['id']]);
            if ($insertInbox->rowCount() === 0) {
                $duplicates++;
                continue;
            }
            $processed++;
            if ($birthday === null || $sender === null) {
                $inbox['status'] = 'ignored_unrecognized';
                $ignored++;
            } else {
                $matches = [];
                foreach ($findCustomers as $customerRow) {
                    $customer = json_decode((string)$customerRow['payload'], true);
                    if (!is_array($customer)) continue;
                    if (threefood_normalize_iran_mobile((string)($customer['phone'] ?? '')) === $sender) {
                        $matches[] = [$customerRow['id'], $customer];
                    }
                }
                if (count($matches) !== 1) {
                    $inbox['status'] = count($matches) === 0 ? 'customer_not_found' : 'ambiguous_customer';
                    $unmatched++;
                } else {
                    [$customerId] = $matches[0];
                    // Re-read the locked row for each reply so a second SMS in
                    // this same batch cannot overwrite a birthday saved earlier.
                    $currentCustomerQuery = $pdo->prepare("SELECT payload FROM pos_records WHERE resource = 'customers' AND id = ? FOR UPDATE");
                    $currentCustomerQuery->execute([(string)$customerId]);
                    $currentCustomerRaw = $currentCustomerQuery->fetchColumn();
                    $customer = is_string($currentCustomerRaw) ? json_decode($currentCustomerRaw, true) : null;
                    if (!is_array($customer) || trim((string)($customer['birthday'] ?? '')) !== '') {
                        $inbox['status'] = 'birthday_already_set';
                        $ignored++;
                    } else {
                        $customer['birthday'] = $birthday;
                        $customerPayload = json_encode($customer, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
                        $saveCustomer = $pdo->prepare("UPDATE pos_records SET payload = ?, updated_by = ? WHERE resource = 'customers' AND id = ?");
                        $saveCustomer->execute([$customerPayload, (int)$actor['id'], (string)$customerId]);
                        $inbox['status'] = 'birthday_saved';
                        $updated++;
                        audit($pdo, (int)$actor['id'], 'customer_birthday_received_by_sms', 'customer', (string)$customerId, ['inbox_id' => $inboxId]);
                    }
                }
            }
            $saveInbox = $pdo->prepare("UPDATE pos_records SET payload = ?, updated_by = ? WHERE resource = 'sms_inbox' AND id = ?");
            $saveInbox->execute([json_encode($inbox, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR), (int)$actor['id'], $inboxId]);
        }
        $pdo->commit();
        json_response(['ok' => true, 'received' => count($messages), 'processed' => $processed, 'duplicates' => $duplicates, 'birthdays_saved' => $updated, 'unmatched' => $unmatched, 'ignored' => $ignored]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('[3Food POS] Birthday SMS inbox sync failed: ' . $e->getMessage());
        $unsupported = str_starts_with($e->getMessage(), 'sms_inbox_');
        json_response([
            'ok' => false,
            'error' => $unsupported ? 'sms_inbox_format_unsupported' : 'sms_inbox_sync_failed',
            'message' => $unsupported ? 'ساختار پاسخ صندوق پیامک با قالب پشتیبانی‌شده مطابقت ندارد؛ هیچ تغییری در مشتریان ثبت نشد' : 'دریافت یا پردازش پیامک‌های ورودی انجام نشد',
        ], $unsupported ? 502 : 502);
    }
}

if ($method === 'POST' && $path === '/sms/send') {
    $actor = require_role($pdo, ['manager', 'cashier']);
    require_csrf();
    $body = request_json();
    $to = preg_replace('/[^0-9+]/', '', (string)($body['to'] ?? ''));
    $message = trim((string)($body['text'] ?? ''));
    $bodyId = trim((string)($body['bodyId'] ?? ''));
    $variables = $body['variables'] ?? [];
    if (!preg_match('/^\\+?[0-9]{10,15}$/D', $to) || (!$bodyId && ($message === '' || utf8_length($message) > 1000))) {
        json_response(['ok' => false, 'error' => 'invalid_sms', 'message' => 'شماره یا متن پیامک معتبر نیست'], 422);
    }
    $gateway = threefood_sms_gateway_read($pdo, $config['sms'] ?? []);
    $username = trim((string)($gateway['username'] ?? ''));
    $apiKey = trim((string)($gateway['apiKey'] ?? ''));
    $sender = trim((string)($gateway['sender'] ?? ''));
    $mode = (string)($gateway['mode'] ?? 'standard');
    if (empty($gateway['enabled']) || $username === '' || $apiKey === '' || (!$bodyId && $sender === '')) {
        json_response(['ok' => false, 'error' => 'sms_not_configured', 'message' => 'سرویس پیامک در تنظیمات فروشگاه فعال یا کامل نشده است'], 503);
    }
    if ($bodyId !== '') {
        if (!preg_match('/^[0-9]{1,12}$/D', $bodyId) || !is_array($variables) || count($variables) < 1 || count($variables) > 10) {
            json_response(['ok'=>false,'error'=>'invalid_service_template','message'=>'شناسه الگوی خدماتی یا متغیرهای مرتب‌شده معتبر نیست'],422);
        }
        foreach ($variables as $value) {
            if (!is_scalar($value) || utf8_length((string)$value) > 250 || str_contains((string)$value, ';')) {
                json_response(['ok'=>false,'error'=>'invalid_service_variables','message'=>'هر متغیر خدماتی باید مقدار متنی معتبر و بدون جداکننده سمی‌کالن داشته باشد'],422);
            }
        }
        // BaseServiceNumber accepts exactly one recipient and ordered values separated by semicolons.
        $endpoint = 'https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber';
        $fields = ['username'=>$username,'password'=>$apiKey,'to'=>$to,'text'=>implode(';',array_map('strval',$variables)),'bodyId'=>$bodyId];
    } elseif ($mode === 'smart_sms') {
        if (!str_ends_with($message, 'لغو11')) {
            json_response(['ok'=>false,'error'=>'sms_optout_suffix_required','message'=>'طبق مستند SmartSMS، متن پیامک باید با «لغو11» تمام شود؛ متن را اصلاح کنید.'],422);
        }
        $endpoint = 'https://rest.payamak-panel.com/api/SmartSMS/Send';
        $fields = ['username'=>$username,'password'=>$apiKey,'to'=>$to,'text'=>$message,'from'=>$sender];
        if (trim((string)($gateway['senderSupportOne'] ?? '')) !== '') $fields['fromSupportOne'] = trim((string)$gateway['senderSupportOne']);
        if (trim((string)($gateway['senderSupportTwo'] ?? '')) !== '') $fields['fromSupportTwo'] = trim((string)$gateway['senderSupportTwo']);
    } else {
        $endpoint = 'https://rest.payamak-panel.com/api/SendSMS/SendSMS';
        $fields = ['username'=>$username,'password'=>$apiKey,'to'=>$to,'from'=>$sender,'text'=>$message,'isFlash'=>'false'];
    }
    $context = stream_context_create(['http'=>[
        'method'=>'POST',
        'header'=>"Content-Type: application/x-www-form-urlencoded\\r\\n",
        'content'=>http_build_query($fields, '', '&', PHP_QUERY_RFC3986),
        'timeout'=>15,
        'ignore_errors'=>true,
    ],'ssl'=>['verify_peer'=>true,'verify_peer_name'=>true]]);
    try {
        $raw = file_get_contents($endpoint, false, $context);
        if ($raw === false) throw new RuntimeException('SMS provider request failed');
        $statusLine = $http_response_header[0] ?? '';
        $httpOk = preg_match('/\\s2[0-9]{2}\\s/', $statusLine) === 1;
        $rawValue = trim((string)$raw, " \\t\\n\\r\\0\\x0B\\\"");
        $accepted = false;
        if ($httpOk && $bodyId !== '') {
            $accepted = ctype_digit($rawValue) && strlen($rawValue) > 15;
        } elseif ($httpOk && $mode === 'smart_sms') {
            $decoded = json_decode($rawValue, true);
            $value = is_array($decoded) ? trim((string)($decoded['Value'] ?? '')) : '';
            $retStatus = is_array($decoded) ? (int)($decoded['RetStatus'] ?? 0) : 0;
            $accepted = $retStatus === 1 && $value !== '' && preg_match('/^[0-9,]+$/D', $value) === 1;
        } elseif ($httpOk) {
            $numeric = (int)preg_replace('/[^0-9-]/', '', $rawValue);
            $accepted = $numeric > 0;
        }
        audit($pdo, (int)$actor['id'], 'sms_sent', 'sms', null, ['to'=>$to,'ok'=>$accepted,'mode'=>$bodyId!==''?'shared_service':$mode,'body_id'=>$bodyId!==''?$bodyId:null]);
        json_response(['ok'=>true,'sent'=>$accepted,'detail'=>$accepted?'پذیرش ارسال توسط سرویس پیامک ثبت شد':('پاسخ سرویس: '.substr($rawValue,0,120))]);
    } catch (Throwable $e) {
        error_log('[3Food POS] SMS provider request failed: '.$e->getMessage());
        json_response(['ok'=>false,'error'=>'sms_provider_unavailable','message'=>'ارتباط با سرویس پیامک برقرار نشد؛ وضعیت ارسال ممکن است نامشخص باشد و ارسال مجدد خودکار انجام نشد'],502);
    }
}
