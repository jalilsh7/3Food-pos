<?php
// Route module loaded in the API dispatcher scope to preserve shared request context.
if ($method === 'GET' && $path === '/bootstrap') {
    $user = require_user($pdo);
    if ($user['role'] === 'manager') {
        $defaults = ['قبوض آب، برق و گاز','مواد اولیه','حقوق و دستمزد','اجاره','تعمیرات و نگهداری','بسته‌بندی','حمل‌ونقل','سایر هزینه‌ها'];
        // Seed defaults once. A marker prevents intentionally deleted categories from reappearing on every refresh.
        $seeded = $pdo->prepare("SELECT id FROM pos_records WHERE resource = 'system_meta' AND id = 'expense_categories_seeded' LIMIT 1");
        $seeded->execute();
        if ($seeded->fetchColumn() === false) {
            $seed = $pdo->prepare("INSERT IGNORE INTO pos_records (id, resource, payload, updated_by) VALUES (?, 'expense_categories', ?, ?)");
            foreach ($defaults as $index => $label) {
                $id = 'expense_cat_' . ($index + 1);
                $seed->execute([$id, json_encode(['id'=>$id,'name'=>$label,'active'=>true], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES), (int)$user['id']]);
            }
            $marker = $pdo->prepare("INSERT IGNORE INTO pos_records (id, resource, payload, updated_by) VALUES ('expense_categories_seeded', 'system_meta', ?, ?)");
            $marker->execute(['{"seeded":true}', (int)$user['id']]);
        }
    }
    $resources = $user['role'] === 'kitchen' ? ['categories','products'] : ($user['role'] === 'cashier' ? ['categories','products','ingredients','customers','discounts','settings','sms_logs'] : ['categories','products','ingredients','customers','discounts','expenses','expense_categories','suppliers','supplier_purchases','templates','settings','sms_logs']);
    $result = [];
    foreach ($resources as $resource) {
        $q = $pdo->prepare('SELECT id, payload FROM pos_records WHERE resource = ? ORDER BY created_at ASC');
        $q->execute([$resource]);
        $result[$resource] = array_map(static function(array $row) use ($resource, $user): array {
            $value = json_decode((string)$row['payload'], true);
            if (!is_array($value)) return [];
            // Provider credentials must never be returned by the POS data API.
            if ($resource === 'settings') {
                unset($value['smsUser'], $value['smsKey'], $value['smsFrom']);
            }
            // Cashiers need current stock for checkout warnings, but never ingredient cost data.
            if ($resource === 'ingredients' && $user['role'] === 'cashier') {
                unset($value['costPerUnit'], $value['cost'], $value['unitCost']);
            }
            return $value;
        }, $q->fetchAll());
    }
    $orders = $pdo->query('SELECT id, order_number, status, customer_id, customer_name, customer_phone, guest_name, guest_phone, payment_method, points_used, points_earned, discount_code, items, totals, note, created_at, updated_at FROM pos_orders ORDER BY id DESC')->fetchAll();
    foreach ($orders as &$order) {
        $order['id'] = (string)$order['id'];
        $order['orderNumber'] = (int)$order['order_number'];
        $order['createdAt'] = (new DateTimeImmutable((string)$order['created_at'], new DateTimeZone('UTC')))->format('Y-m-d\\TH:i:s\\Z');
        $order['customerId'] = $order['customer_id'];
        $order['customerName'] = $order['customer_name'];
        $order['customerPhone'] = $order['customer_phone'] ?? $order['guest_phone'] ?? '';
        $order['customerName'] = $order['customer_name'] ?: ($order['guest_name'] ?? 'مشتری');
        $order['payment'] = $order['payment_method'] ?? 'cash';
        $order['pointsUsed'] = (int)($order['points_used'] ?? 0);
        $order['pointsEarned'] = (int)($order['points_earned'] ?? 0);
        $order['discountCode'] = $order['discount_code'] ?? '';
        $order['items'] = json_decode((string)$order['items'], true) ?: [];
        $order['totals'] = json_decode((string)$order['totals'], true) ?: [];
        unset($order['order_number'], $order['customer_id'], $order['customer_name'], $order['customer_phone'], $order['guest_name'], $order['guest_phone'], $order['payment_method'], $order['points_used'], $order['points_earned'], $order['discount_code']);
        // Kitchen staff need preparation details, not customer contact data or
        // cashier/manager notes that may contain private instructions.
        if ($user['role'] === 'kitchen') {
            unset($order['customerId'], $order['customerName'], $order['customerPhone'], $order['note']);
        }
    }
    unset($order);
    $result['orders'] = $orders;
    if ($user['role'] === 'kitchen') {
        $result = ['categories' => $result['categories'] ?? [], 'products' => $result['products'] ?? [], 'orders' => $result['orders']];
    }
    $counter = (int)$pdo->query("SELECT counter_value FROM pos_counters WHERE counter_key = 'order_number'")->fetchColumn();
    json_response(['ok' => true, 'data' => $result, 'next_order' => $counter + 1, 'user' => ['id' => (int)$user['id'], 'username' => $user['username'], 'display_name' => $user['display_name'], 'role' => $user['role']]]);
}


if (preg_match('#^/suppliers/([A-Za-z0-9_-]+)/purchases$#D', $path, $supplierMatch) && $method === 'POST') {
    $actor = require_role($pdo, ['manager']);
    require_csrf();
    $supplierId = $supplierMatch[1];
    $body = request_json();
    $item = $body['item'] ?? null;
    if (!is_array($item) || !preg_match('/^[A-Za-z0-9_-]{1,100}$/D', (string)($item['id'] ?? '')) ||
        !in_array($item['kind'] ?? '', ['purchase','payment'], true) ||
        trim((string)($item['title'] ?? '')) === '' ||
        !is_numeric($item['amount'] ?? null) || !is_numeric($item['paid'] ?? null)) {
        json_response(['ok'=>false,'error'=>'invalid_supplier_transaction','message'=>'اطلاعات خرید یا پرداخت معتبر نیست'],422);
    }
    $amountRaw=(float)$item['amount']; $paidRaw=(float)$item['paid'];
    if (!is_finite($amountRaw) || !is_finite($paidRaw) || floor($amountRaw)!==$amountRaw || floor($paidRaw)!==$paidRaw ||
        $amountRaw<0 || $paidRaw<0 || $amountRaw>100000000000 || $paidRaw>100000000000 ||
        ($item['kind']==='purchase' && ($amountRaw<=0 || $paidRaw>$amountRaw)) ||
        ($item['kind']==='payment' && ($amountRaw!==0.0 || $paidRaw===0.0))) {
        json_response(['ok'=>false,'error'=>'invalid_supplier_amount','message'=>'مبلغ خرید یا تسویه باید عدد صحیح و معتبر به تومان باشد'],422);
    }
    $amount=(int)$amountRaw; $paid=(int)$paidRaw;
    try {
        $pdo->beginTransaction();
        $supplierStmt=$pdo->prepare("SELECT payload FROM pos_records WHERE resource='suppliers' AND id=? FOR UPDATE");
        $supplierStmt->execute([$supplierId]); $raw=$supplierStmt->fetchColumn();
        $supplier=is_string($raw)?json_decode($raw,true):null;
        if(!is_array($supplier) || ($item['kind']==='purchase' && empty($supplier['active']))) {
            $pdo->rollBack(); json_response(['ok'=>false,'error'=>'supplier_not_found','message'=>'برای خرید جدید باید تأمین‌کننده فعال باشد'],404);
        }
        $currentBalance=max(0,(int)($supplier['balance']??0));
        if($item['kind']==='payment' && $paid>$currentBalance){$pdo->rollBack();json_response(['ok'=>false,'error'=>'supplier_payment_exceeds_balance','message'=>'مبلغ پرداخت از بدهی تأمین‌کننده بیشتر است'],409);}
        $ingredientId=trim((string)($item['ingredientId']??''));
        $ingredientQty=(float)($item['quantity']??0);
        $unitCostRaw=(float)($item['unitCost']??0);
        $ingredientUnitCost=(int)$unitCostRaw;
        if($ingredientId!=='' && (!is_finite($ingredientQty) || $ingredientQty<=0 || $ingredientQty>1000000000 || round($ingredientQty,3)!==$ingredientQty ||
            !is_finite($unitCostRaw) || $unitCostRaw<=0 || floor($unitCostRaw)!==$unitCostRaw || $unitCostRaw>100000000000 ||
            $item['kind']!=='purchase' || $ingredientUnitCost<=0 || abs($amount-(int)round($ingredientQty*$ingredientUnitCost))>max(1,(int)round($amount*0.01)))){
            $pdo->rollBack();json_response(['ok'=>false,'error'=>'invalid_inventory_purchase','message'=>'مقدار یا قیمت ماده اولیه با مبلغ خرید هم‌خوانی ندارد'],422);
        }
        if($ingredientId!==''){
            $ingredientStmt=$pdo->prepare("SELECT payload FROM pos_records WHERE resource='ingredients' AND id=? FOR UPDATE");
            $ingredientStmt->execute([$ingredientId]);$ingredientRaw=$ingredientStmt->fetchColumn();
            $ingredient=is_string($ingredientRaw)?json_decode($ingredientRaw,true):null;
            if(!is_array($ingredient)){$pdo->rollBack();json_response(['ok'=>false,'error'=>'ingredient_not_found','message'=>'ماده اولیه انتخاب‌شده پیدا نشد'],404);}
            $oldStock=(float)($ingredient['stock']??0);$oldCost=max(0,(float)($ingredient['costPerUnit']??0));
            $newStock=round($oldStock+$ingredientQty,3);
            $newCost=$oldStock>0?round((($oldStock*$oldCost)+($ingredientQty*$ingredientUnitCost))/($oldStock+$ingredientQty),2):$ingredientUnitCost;
            $ingredient['stock']=$newStock;$ingredient['costPerUnit']=$newCost;
            $ingredientUpdate=$pdo->prepare("UPDATE pos_records SET payload=?,updated_by=? WHERE resource='ingredients' AND id=?");
            $ingredientUpdate->execute([json_encode($ingredient,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR),(int)$actor['id'],$ingredientId]);
            $item['ingredientId']=$ingredientId;$item['quantity']=$ingredientQty;$item['unitCost']=$ingredientUnitCost;
            $item['stockAfter']=$newStock;$item['weightedCostAfter']=$newCost;
        }
        $item['supplierId']=$supplierId;
        $tehranNow = new DateTimeImmutable('now', new DateTimeZone('Asia/Tehran'));
        $item['date']=$tehranNow->format('Y-m-d');
        $item['createdAt']=$tehranNow->format('c');
        $balance=max(0,$currentBalance+($item['kind']==='purchase'?$amount-$paid:-$paid));
        $supplier['balance']=$balance;
        $payload=json_encode($item,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
        $insert=$pdo->prepare("INSERT INTO pos_records (id,resource,payload,updated_by) VALUES (?,'supplier_purchases',?,?)");
        $insert->execute([(string)$item['id'],$payload,(int)$actor['id']]);
        $update=$pdo->prepare("UPDATE pos_records SET payload=?,updated_by=? WHERE resource='suppliers' AND id=?");
        $update->execute([json_encode($supplier,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR),(int)$actor['id'],$supplierId]);
        audit($pdo,(int)$actor['id'],$item['kind']==='purchase'?'supplier_purchase_recorded':'supplier_payment_recorded','supplier',$supplierId,['amount'=>$amount,'paid'=>$paid,'balance'=>$balance]);
        $pdo->commit();
        json_response(['ok'=>true,'item'=>$item,'supplier'=>$supplier]);
    } catch(Throwable $e) {
        if($pdo->inTransaction())$pdo->rollBack();
        error_log('[3Food POS] Supplier transaction failed: '.$e->getMessage());
        json_response(['ok'=>false,'error'=>'supplier_transaction_failed','message'=>'ثبت خرید یا تسویه انجام نشد'],500);
    }
}

if (preg_match('#^/records/([a-z_]+)$#', $path, $m)) {
    $resource = $m[1];
    if (!isset($resourceRoles[$resource])) json_response(['ok' => false, 'error' => 'resource_not_found'], 404);
    $actor = require_user($pdo);
    if (!in_array($actor['role'], $resourceRoles[$resource], true)) json_response(['ok' => false, 'error' => 'forbidden'], 403);
    if ($resource === 'supplier_purchases' && in_array($method, ['POST','DELETE'], true)) {
        json_response(['ok' => false, 'error' => 'supplier_ledger_read_only', 'message' => 'سوابق خرید و تسویه فقط از مسیر تراکنش امن تأمین‌کننده قابل ثبت هستند'], 405);
    }
    if ($method === 'GET') {
        $q = $pdo->prepare('SELECT payload FROM pos_records WHERE resource = ? ORDER BY created_at ASC');
        $q->execute([$resource]);
        $rows = [];
        foreach ($q->fetchAll() as $row) {
            $v = json_decode((string)$row['payload'], true);
            if (!is_array($v)) continue;
            // Keep SMS gateway credentials server-side, even for manager reads.
            if ($resource === 'settings') unset($v['smsUser'], $v['smsKey'], $v['smsFrom']);
            $rows[] = $v;
        }
        json_response(['ok' => true, 'items' => $rows]);
    }
    if ($method === 'POST') {
        require_csrf();
        $body = request_json();
        $item = $body['item'] ?? null;
        if (!is_array($item) || !isset($item['id']) || !is_string($item['id']) && !is_int($item['id'])) {
            json_response(['ok' => false, 'error' => 'invalid_item'], 422);
        }
        // Never truncate identifiers: two distinct client IDs must not silently
        // collide into the same MySQL record key.
        $id = (string)$item['id'];
        if ($id === '' || strlen($id) > 100 || !preg_match('/^[A-Za-z0-9_-]+$/D', $id)) {
            json_response(['ok' => false, 'error' => 'invalid_id'], 422);
        }
        // SMS gateway credentials are server-only configuration. Ignore legacy
        // browser fields on writes as well as reads, so they cannot be persisted
        // or echoed back through the generic settings-record endpoint.
        if ($resource === 'settings') {
            unset($item['smsUser'], $item['smsKey'], $item['smsFrom']);
            $allowedStockPolicies = ['block', 'warn_and_allow', 'allow_negative'];
            if (array_key_exists('stockPolicy', $item)) {
                if (!is_string($item['stockPolicy']) || !in_array($item['stockPolicy'], $allowedStockPolicies, true)) {
                    json_response(['ok' => false, 'error' => 'invalid_stock_policy', 'message' => 'سیاست موجودی انتخاب‌شده معتبر نیست'], 422);
                }
            } else {
                $existingSettingsStmt = $pdo->prepare("SELECT payload FROM pos_records WHERE resource = 'settings' AND id = ? LIMIT 1");
                $existingSettingsStmt->execute([$id]);
                $existingSettingsRaw = $existingSettingsStmt->fetchColumn();
                $existingSettings = is_string($existingSettingsRaw) ? json_decode($existingSettingsRaw, true) : null;
                $existingPolicy = is_array($existingSettings) ? ($existingSettings['stockPolicy'] ?? null) : null;
                $item['stockPolicy'] = is_string($existingPolicy) && in_array($existingPolicy, $allowedStockPolicies, true) ? $existingPolicy : 'warn_and_allow';
            }
        }
        // Supplier balances are ledger-owned. Generic profile edits may change
        // contact fields, but only the transactional purchase/payment endpoint
        // may change the balance.
        $supplierWrite = $resource === 'suppliers' && $actor['role'] === 'manager';
        if ($supplierWrite) {
            $pdo->beginTransaction();
            $supplierCurrentStmt = $pdo->prepare("SELECT payload FROM pos_records WHERE resource = 'suppliers' AND id = ? FOR UPDATE");
            $supplierCurrentStmt->execute([$id]);
            $supplierCurrentRaw = $supplierCurrentStmt->fetchColumn();
            $supplierCurrent = is_string($supplierCurrentRaw) ? json_decode($supplierCurrentRaw, true) : null;
            $item['balance'] = is_array($supplierCurrent) ? max(0, (int)($supplierCurrent['balance'] ?? 0)) : 0;
        }
        $productWrite = $resource === 'products' && $actor['role'] === 'manager';
        if ($productWrite) {
            $productName = trim((string)($item['name'] ?? ''));
            $productNameLength = preg_match_all('/./us', $productName, $productNameChars);
            $productPrice = filter_var($item['price'] ?? null, FILTER_VALIDATE_INT);
            $productCost = filter_var($item['cost'] ?? 0, FILTER_VALIDATE_INT);
            $productActive = $item['active'] ?? true;
            if ($productName === '' || $productNameLength === false || $productNameLength > 160 ||
                $productPrice === false || $productPrice < 0 || $productPrice > 100000000000 ||
                $productCost === false || $productCost < 0 || $productCost > 100000000000 ||
                !in_array($productActive, [true, false, 0, 1, '0', '1'], true)) {
                json_response(['ok' => false, 'error' => 'invalid_product', 'message' => 'نام، قیمت یا وضعیت محصول معتبر نیست'], 422);
            }
            $item['name'] = $productName;
            $item['price'] = (int)$productPrice;
            $item['cost'] = (int)$productCost;
            $item['active'] = in_array($productActive, [true, 1, '1'], true);

            $options = $item['options'] ?? [];
            if (!is_array($options) || count($options) > 30) {
                json_response(['ok' => false, 'error' => 'invalid_product_options', 'message' => 'فهرست گزینه‌های محصول معتبر نیست'], 422);
            }
            $canonicalOptions = [];
            $optionIds = [];
            foreach ($options as $option) {
                if (!is_array($option)) {
                    json_response(['ok' => false, 'error' => 'invalid_product_option', 'message' => 'هر گزینه محصول باید اطلاعات معتبر داشته باشد'], 422);
                }
                $optionId = (string)($option['id'] ?? '');
                $optionName = trim((string)($option['name'] ?? ''));
                $optionNameLength = preg_match_all('/./us', $optionName, $optionNameChars);
                $optionPrice = filter_var($option['price'] ?? null, FILTER_VALIDATE_INT);
                if (!preg_match('/^[A-Za-z0-9_-]{1,100}$/D', $optionId) ||
                    in_array($optionId, $optionIds, true) ||
                    $optionName === '' || $optionNameLength === false || $optionNameLength > 120 ||
                    $optionPrice === false || $optionPrice < 0 || $optionPrice > 100000000000) {
                    json_response(['ok' => false, 'error' => 'invalid_product_option', 'message' => 'نام، شناسه یا مبلغ یکی از گزینه‌های محصول معتبر نیست'], 422);
                }
                $optionIds[] = $optionId;
                $canonicalOptions[] = ['id' => $optionId, 'name' => $optionName, 'price' => (int)$optionPrice];
            }
            $item['options'] = $canonicalOptions;

            $recipe = $item['recipe'] ?? [];
            if (!is_array($recipe) || count($recipe) > 100) {
                json_response(['ok' => false, 'error' => 'invalid_product_recipe', 'message' => 'دستور ساخت محصول معتبر نیست'], 422);
            }
            $ingredientIds = [];
            foreach ($recipe as $recipeLine) {
                if (!is_array($recipeLine) || !is_string($recipeLine['ingredientId'] ?? null) ||
                    !preg_match('/^[A-Za-z0-9_-]{1,100}$/D', $recipeLine['ingredientId']) ||
                    !is_numeric($recipeLine['qty'] ?? null)) {
                    json_response(['ok' => false, 'error' => 'invalid_product_recipe', 'message' => 'هر ردیف دستور ساخت باید ماده اولیه و مقدار معتبر داشته باشد'], 422);
                }
                $quantity = (float)$recipeLine['qty'];
                if (!is_finite($quantity) || $quantity <= 0 || $quantity > 1000000 || round($quantity, 3) !== $quantity) {
                    json_response(['ok' => false, 'error' => 'invalid_product_recipe_quantity', 'message' => 'مقدار هر ماده اولیه باید مثبت و حداکثر سه رقم اعشار باشد'], 422);
                }
                $ingredientIds[] = $recipeLine['ingredientId'];
            }
            if (count($ingredientIds) !== count(array_unique($ingredientIds))) {
                json_response(['ok' => false, 'error' => 'duplicate_product_recipe_ingredient', 'message' => 'هر ماده اولیه فقط یک‌بار در دستور ساخت محصول درج شود'], 422);
            }
            sort($ingredientIds, SORT_STRING);
            $pdo->beginTransaction();
            $ingredientExists = $pdo->prepare("SELECT id FROM pos_records WHERE resource = 'ingredients' AND id = ? FOR UPDATE");
            foreach ($ingredientIds as $ingredientId) {
                $ingredientExists->execute([$ingredientId]);
                if ($ingredientExists->fetchColumn() === false) {
                    $pdo->rollBack();
                    json_response(['ok' => false, 'error' => 'recipe_ingredient_not_found', 'message' => 'یکی از مواد اولیه دستور ساخت دیگر در انبار وجود ندارد'], 409);
                }
            }
        }
        $ingredientWrite = $resource === 'ingredients' && $actor['role'] === 'manager';
        if ($ingredientWrite) {
            $pdo->beginTransaction();
            $currentIngredientStmt = $pdo->prepare("SELECT payload FROM pos_records WHERE resource = 'ingredients' AND id = ? FOR UPDATE");
            $currentIngredientStmt->execute([$id]);
            $currentIngredientRaw = $currentIngredientStmt->fetchColumn();
            if ($currentIngredientRaw !== false) {
                $currentIngredient = is_string($currentIngredientRaw) ? json_decode($currentIngredientRaw, true) : null;
                if (!is_array($currentIngredient)) {
                    $pdo->rollBack();
                    json_response(['ok' => false, 'error' => 'ingredient_record_invalid', 'message' => 'اطلاعات ماده اولیه معتبر نیست؛ ابتدا نسخه پشتیبان را بررسی کنید'], 409);
                }
                // Stock changes must go through the audited /ingredients/{id}/stock
                // endpoint; supplier receipts alone may update weighted unit cost.
                foreach (['stock', 'costPerUnit', 'cost', 'unitCost'] as $protectedField) {
                    if (array_key_exists($protectedField, $currentIngredient)) {
                        $item[$protectedField] = $currentIngredient[$protectedField];
                    } else {
                        unset($item[$protectedField]);
                    }
                }
            } else {
                // New ingredients always start with zero stock and zero valuation.
                // Initial stock must be entered through the audited adjustment flow.
                $item['stock'] = 0;
                $item['costPerUnit'] = 0;
                unset($item['cost'], $item['unitCost']);
            }
        }
        $expenseCategoryWrite = $resource === 'expense_categories' && $actor['role'] === 'manager';
        if ($expenseCategoryWrite) {
            $name = trim((string)($item['name'] ?? ''));
            $nameCharCount = preg_match_all('/./us', $name, $nameChars);
            if ($name === '' || $nameCharCount === false || $nameCharCount > 80) {
                json_response(['ok' => false, 'error' => 'invalid_expense_category', 'message' => 'نام دسته هزینه باید بین ۱ تا ۸۰ نویسه معتبر باشد'], 422);
            }
            $item['name'] = $name;
            $pdo->beginTransaction();
            $duplicate = $pdo->prepare("SELECT 1 FROM pos_records WHERE resource = 'expense_categories' AND id <> ? AND JSON_UNQUOTE(JSON_EXTRACT(payload, '$.name')) = ? LIMIT 1");
            $duplicate->execute([$id, $name]);
            if ($duplicate->fetchColumn() !== false) {
                $pdo->rollBack();
                json_response(['ok' => false, 'error' => 'duplicate_expense_category', 'message' => 'دسته‌ای با این نام وجود دارد'], 409);
            }
            $currentCategoryStmt = $pdo->prepare("SELECT payload FROM pos_records WHERE resource = 'expense_categories' AND id = ? FOR UPDATE");
            $currentCategoryStmt->execute([$id]);
            $currentCategoryRaw = $currentCategoryStmt->fetchColumn();
            $currentCategory = is_string($currentCategoryRaw) ? json_decode($currentCategoryRaw, true) : null;
            if (is_array($currentCategory)) {
                $oldName = trim((string)($currentCategory['name'] ?? ''));
                if ($oldName !== '' && $oldName !== $name) {
                    $renameExpenses = $pdo->prepare("UPDATE pos_records SET payload = JSON_SET(payload, '$.category', ?), updated_by = ? WHERE resource = 'expenses' AND JSON_UNQUOTE(JSON_EXTRACT(payload, '$.category')) = ?");
                    $renameExpenses->execute([$name, (int)$actor['id'], $oldName]);
                }
            }
        }
        // Cashiers may maintain customer contact details, but loyalty balances
        // are server-owned and must never be writable through generic CRUD.
        $cashierCustomerWrite = $resource === 'customers' && $actor['role'] === 'cashier';
        if ($cashierCustomerWrite) {
            $pdo->beginTransaction();
            $currentCustomer = $pdo->prepare("SELECT payload FROM pos_records WHERE resource = 'customers' AND id = ? FOR UPDATE");
            $currentCustomer->execute([$id]);
            $currentPayload = $currentCustomer->fetchColumn();
            $current = is_string($currentPayload) ? json_decode($currentPayload, true) : null;
            if (is_array($current)) {
                foreach (['points', 'totalSpent', 'visits', 'createdAt'] as $serverField) {
                    if (array_key_exists($serverField, $current)) $item[$serverField] = $current[$serverField];
                    else unset($item[$serverField]);
                }
            } else {
                $item['points'] = 0;
                $item['totalSpent'] = 0;
                $item['visits'] = 0;
                $item['createdAt'] = gmdate('c');
            }
        }
        $payload = json_encode($item, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        if (strlen($payload) > 262144) {
            if (($cashierCustomerWrite || $supplierWrite || $expenseCategoryWrite || $ingredientWrite || $productWrite) && $pdo->inTransaction()) $pdo->rollBack();
            json_response(['ok' => false, 'error' => 'record_too_large', 'message' => 'حجم اطلاعات ارسالی بیش از حد مجاز است'], 413);
        }
        $q = $pdo->prepare('INSERT INTO pos_records (id, resource, payload, updated_by) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_by = VALUES(updated_by)');
        $q->execute([$id, $resource, $payload, (int)$actor['id']]);
        audit($pdo, (int)$actor['id'], 'record_saved', $resource, $id);
        if ($cashierCustomerWrite || $supplierWrite || $expenseCategoryWrite || $ingredientWrite || $productWrite) $pdo->commit();
        json_response(['ok' => true, 'item' => $item], 201);
    }
    if ($method === 'DELETE') {
        // Cashiers may maintain customer details during checkout, but destructive
        // record removal remains a manager-only operation.
        if ($resource === 'customers' && $actor['role'] !== 'manager') {
            json_response(['ok' => false, 'error' => 'forbidden'], 403);
        }
        require_csrf();
        $id = (string)($_GET['id'] ?? '');
        if ($id === '' || strlen($id) > 100) json_response(['ok' => false, 'error' => 'invalid_id'], 422);
        if ($resource === 'suppliers') {
            $history = $pdo->prepare("SELECT 1 FROM pos_records WHERE resource = 'supplier_purchases' AND JSON_UNQUOTE(JSON_EXTRACT(payload, '$.supplierId')) = ? LIMIT 1");
            $history->execute([$id]);
            if ($history->fetchColumn() !== false) {
                json_response(['ok' => false, 'error' => 'supplier_has_ledger_history', 'message' => 'تأمین‌کننده دارای سابقه خرید یا تسویه است؛ به‌جای حذف، آن را غیرفعال کنید'], 409);
            }
        }
        if ($resource === 'ingredients') {
            $recipeUsage = $pdo->prepare("SELECT 1 FROM pos_records WHERE resource = 'products' AND JSON_SEARCH(payload, 'one', ?, NULL, '$.recipe[*].ingredientId') IS NOT NULL LIMIT 1");
            $recipeUsage->execute([$id]);
            $ledgerUsage = $pdo->prepare("SELECT 1 FROM pos_records WHERE resource = 'supplier_purchases' AND JSON_UNQUOTE(JSON_EXTRACT(payload, '$.ingredientId')) = ? LIMIT 1");
            $ledgerUsage->execute([$id]);
            $orderUsage = $pdo->prepare("SELECT 1 FROM pos_order_effects WHERE effect_type = 'ingredient' AND resource_id = ? LIMIT 1");
            $orderUsage->execute([$id]);
            if ($recipeUsage->fetchColumn() !== false || $ledgerUsage->fetchColumn() !== false || $orderUsage->fetchColumn() !== false) {
                json_response(['ok' => false, 'error' => 'ingredient_has_history', 'message' => 'این ماده اولیه در دستور ساخت یا سوابق انبار/سفارش استفاده شده است و قابل حذف نیست'], 409);
            }
        }
        if ($resource === 'expense_categories') {
            $categoryStmt = $pdo->prepare("SELECT payload FROM pos_records WHERE resource = 'expense_categories' AND id = ?");
            $categoryStmt->execute([$id]);
            $categoryRaw = $categoryStmt->fetchColumn();
            $category = is_string($categoryRaw) ? json_decode($categoryRaw, true) : null;
            $categoryName = is_array($category) ? trim((string)($category['name'] ?? '')) : '';
            if ($categoryName !== '') {
                $usage = $pdo->prepare("SELECT 1 FROM pos_records WHERE resource = 'expenses' AND JSON_UNQUOTE(JSON_EXTRACT(payload, '$.category')) = ? LIMIT 1");
                $usage->execute([$categoryName]);
                if ($usage->fetchColumn() !== false) {
                    json_response(['ok' => false, 'error' => 'expense_category_in_use', 'message' => 'این دسته در سوابق هزینه استفاده شده است؛ ابتدا هزینه‌های مرتبط را به دسته دیگری منتقل کنید'], 409);
                }
            }
        }
        $q = $pdo->prepare('DELETE FROM pos_records WHERE resource = ? AND id = ?');
        $q->execute([$resource, $id]);
        audit($pdo, (int)$actor['id'], 'record_deleted', $resource, $id);
        json_response(['ok' => true]);
    }
}

