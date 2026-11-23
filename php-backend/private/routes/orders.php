<?php
// Route module loaded in the API dispatcher scope to preserve shared request context.
if ($method === 'POST' && $path === '/orders') {
    $actor = require_role($pdo, ['manager','cashier']);
    require_csrf();
    $body = request_json();
    $items = $body['items'] ?? null;
    $totals = $body['totals'] ?? null;
    $idempotencyKey = isset($body['idempotencyKey']) && is_string($body['idempotencyKey'])
        ? strtolower(trim($body['idempotencyKey']))
        : '';
    if (!preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/D', $idempotencyKey)) {
        json_response(['ok' => false, 'error' => 'invalid_idempotency_key', 'message' => 'شناسه یکتای ثبت سفارش معتبر نیست؛ دوباره تلاش کنید'], 422);
    }
    $requestHash = hash('sha256', json_encode([
        'items' => $items,
        'totals' => $totals,
        'customer' => $body['customer'] ?? null,
        'discountCode' => strtoupper(trim((string)($body['discountCode'] ?? ''))),
        'note' => $body['note'] ?? null,
        'guestName' => $body['guestName'] ?? null,
        'guestPhone' => $body['guestPhone'] ?? null,
        'payment' => $body['payment'] ?? 'cash',
        'terminalPaymentId' => $body['terminalPaymentId'] ?? null,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
    if ($idempotencyKey !== null) {
        $existingStmt = $pdo->prepare('SELECT id, order_number, status, items, totals, request_hash, created_at FROM pos_orders WHERE idempotency_key = ? LIMIT 1');
        $existingStmt->execute([$idempotencyKey]);
        $existing = $existingStmt->fetch();
        if (is_array($existing)) {
            if (!hash_equals((string)$existing['request_hash'], $requestHash)) {
                json_response(['ok' => false, 'error' => 'idempotency_conflict', 'message' => 'این شناسه قبلاً برای سفارش دیگری استفاده شده است'], 409);
            }
            json_response(['ok' => true, 'replayed' => true, 'order' => [
                'id' => (string)$existing['id'],
                'orderNumber' => (int)$existing['order_number'],
                'status' => (string)$existing['status'],
                'createdAt' => (new DateTimeImmutable((string)$existing['created_at'], new DateTimeZone('UTC')))->format('Y-m-d\\TH:i:s\\Z'),
                'items' => json_decode((string)$existing['items'], true) ?: [],
                'totals' => json_decode((string)$existing['totals'], true) ?: [],
            ]]);
        }
    }
    if (!is_array($items) || count($items) < 1 || count($items) > 100 || !is_array($totals)) json_response(['ok' => false, 'error' => 'invalid_order', 'message' => 'اقلام یا مبلغ سفارش معتبر نیست'], 422);
    $serverSubtotal = 0;
    $ingredientNeeds = [];
    $canonicalItems = [];
    $productSnapshots = [];
    $productLookup = $pdo->prepare("SELECT payload FROM pos_records WHERE resource = 'products' AND id = ? LIMIT 1");
    foreach ($items as $line) {
        if (!is_array($line) || !isset($line['productId'], $line['qty']) || !is_numeric($line['qty']) || (float)$line['qty'] <= 0 || (float)$line['qty'] > 999 || floor((float)$line['qty']) !== (float)$line['qty']) {
            json_response(['ok' => false, 'error' => 'invalid_order_item'], 422);
        }
        $productLookup->execute([(string)$line['productId']]);
        $productRaw = $productLookup->fetchColumn();
        $product = is_string($productRaw) ? json_decode($productRaw, true) : null;
        if (!is_array($product) || empty($product['active'])) json_response(['ok' => false, 'error' => 'product_unavailable', 'message' => 'یکی از محصولات سفارش فعال نیست'], 409);
        $productId = (string)$line['productId'];
        $productSnapshots[$productId] = hash('sha256', (string)$productRaw);
        // Derive ingredient consumption from a validated server-side recipe,
        // never from browser input; malformed legacy recipes must not silently
        // bypass inventory deduction.
        $recipe = $product['recipe'] ?? [];
        if (!is_array($recipe) || count($recipe) > 100) {
            json_response(['ok' => false, 'error' => 'invalid_product_recipe', 'message' => 'دستور ساخت یکی از محصولات معتبر نیست'], 409);
        }
        foreach ($recipe as $recipeLine) {
            if (!is_array($recipeLine) || !is_string($recipeLine['ingredientId'] ?? null) ||
                !preg_match('/^[A-Za-z0-9_-]{1,100}$/D', $recipeLine['ingredientId']) ||
                !is_numeric($recipeLine['qty'] ?? null)) {
                json_response(['ok' => false, 'error' => 'invalid_product_recipe', 'message' => 'دستور ساخت یکی از محصولات ناقص است؛ ابتدا منوی محصول را اصلاح کنید'], 409);
            }
            $ingredientId = $recipeLine['ingredientId'];
            $recipeQty = (float)$recipeLine['qty'];
            if (!is_finite($recipeQty) || $recipeQty <= 0 || $recipeQty > 1000000 || round($recipeQty, 3) !== $recipeQty) {
                json_response(['ok' => false, 'error' => 'invalid_product_recipe_quantity', 'message' => 'مقدار ماده اولیه در دستور ساخت معتبر نیست'], 409);
            }
            $ingredientNeeds[$ingredientId] = ($ingredientNeeds[$ingredientId] ?? 0) + ($recipeQty * (int)$line['qty']);
        }
        $basePrice = filter_var($product['price'] ?? null, FILTER_VALIDATE_INT);
        if ($basePrice === false || $basePrice < 0) json_response(['ok' => false, 'error' => 'invalid_product_price'], 409);
        $unitPrice = $basePrice;
        $validOptions = [];
        foreach (($product['options'] ?? []) as $option) {
            if (!is_array($option) || !isset($option['id'])) continue;
            $optionPrice = filter_var($option['price'] ?? 0, FILTER_VALIDATE_INT);
            if ($optionPrice === false) continue;
            $validOptions[(string)$option['id']] = ['price' => $optionPrice, 'name' => substr((string)($option['name'] ?? ''), 0, 120)];
        }
        $rawOptionIds = $line['optionIds'] ?? [];
        if (!is_array($rawOptionIds) || count($rawOptionIds) > 30) json_response(['ok' => false, 'error' => 'invalid_product_option'], 422);
        $optionIds = array_map('strval', $rawOptionIds);
        if (count($optionIds) !== count(array_unique($optionIds))) json_response(['ok' => false, 'error' => 'duplicate_product_option'], 422);
        $optionLabels = [];
        foreach ($optionIds as $optionId) {
            if (!array_key_exists($optionId, $validOptions)) json_response(['ok' => false, 'error' => 'invalid_product_option'], 422);
            $unitPrice += $validOptions[$optionId]['price'];
            $optionLabels[] = $validOptions[$optionId]['name'];
        }
        if ($unitPrice < 0 || $unitPrice > 100000000000) json_response(['ok' => false, 'error' => 'invalid_order_item_price'], 422);
        if (isset($line['unitPrice']) && (!is_numeric($line['unitPrice']) || (float)$line['unitPrice'] !== (float)$unitPrice)) json_response(['ok' => false, 'error' => 'price_changed', 'message' => 'قیمت محصول تغییر کرده است؛ سبد را تازه‌سازی کنید'], 409);
        $serverSubtotal += $unitPrice * (int)$line['qty'];
        $clientKey = isset($line['key']) && preg_match('/^[A-Za-z0-9_-]{1,100}$/D', (string)$line['key']) ? (string)$line['key'] : 'line-' . count($canonicalItems);
        $canonicalItems[] = [
            'key' => $clientKey,
            'name' => substr((string)($product['name'] ?? 'محصول'), 0, 160),
            'productId' => $productId,
            'qty' => (int)$line['qty'],
            'unitPrice' => $unitPrice,
            'unitCost' => product_unit_cost($pdo,$product),
            'optionIds' => $optionIds,
            'optionLabels' => $optionLabels,
            'note' => isset($line['note']) ? substr(trim((string)$line['note']), 0, 500) : '',
        ];
    }
    $customer = is_array($body['customer'] ?? null) ? $body['customer'] : [];
    $customerId = isset($customer['id']) ? (string)$customer['id'] : '';
    $customerRecord = null;
    if ($customerId !== '') {
        if (strlen($customerId) > 100 || !preg_match('/^[A-Za-z0-9_-]+$/D', $customerId)) {
            json_response(['ok' => false, 'error' => 'invalid_customer'], 422);
        }
        $customerStmt = $pdo->prepare("SELECT payload FROM pos_records WHERE resource = 'customers' AND id = ? LIMIT 1");
        $customerStmt->execute([$customerId]);
        $customerRaw = $customerStmt->fetchColumn();
        $customerRecord = is_string($customerRaw) ? json_decode($customerRaw, true) : null;
        if (!is_array($customerRecord)) json_response(['ok' => false, 'error' => 'customer_not_found', 'message' => 'مشتری انتخاب‌شده پیدا نشد؛ فهرست مشتریان را تازه‌سازی کنید'], 409);
    }
    $customerName = is_array($customerRecord) ? substr((string)($customerRecord['name'] ?? ''), 0, 160) : null;
    $customerPhone = is_array($customerRecord) ? substr((string)($customerRecord['phone'] ?? ''), 0, 30) : null;
    $guestName = $customerId === '' ? trim((string)($body['guestName'] ?? 'مشتری')) : null;
    $guestPhone = $customerId === '' ? trim((string)($body['guestPhone'] ?? '')) : null;
    $payment = (string)($body['payment'] ?? 'cash');
    $terminalPaymentId = trim((string)($body['terminalPaymentId'] ?? ''));
    if ($payment === 'online') {
        json_response(['ok' => false, 'error' => 'online_payment_unavailable', 'message' => 'پرداخت آنلاین تا اتصال و تأیید واقعی درگاه فعال نیست؛ از پرداخت نقدی یا کارتخوان استفاده کنید'], 409);
    }
    if (!in_array($payment, ['cash','card'], true) || utf8_length($guestName ?? '') > 160 || strlen($guestPhone ?? '') > 30 ||
        ($payment === 'card' && !valid_uuid($terminalPaymentId)) || ($payment !== 'card' && $terminalPaymentId !== '')) {
        json_response(['ok' => false, 'error' => 'invalid_order_details', 'message' => 'اطلاعات مشتری یا روش پرداخت معتبر نیست'], 422);
    }
    $discountCode = strtoupper(trim((string)($body['discountCode'] ?? '')));
    if (strlen($discountCode) > 64 || ($discountCode !== '' && !preg_match('/^[A-Z0-9_-]+$/D', $discountCode))) {
        json_response(['ok' => false, 'error' => 'invalid_discount_code'], 422);
    }
    $discountRecordId = null;
    $discountRecord = null;
    if ($discountCode !== '') {
        $discountRows = $pdo->query("SELECT id, payload FROM pos_records WHERE resource = 'discounts'")->fetchAll();
        foreach ($discountRows as $discountRow) {
            $candidate = json_decode((string)$discountRow['payload'], true);
            if (is_array($candidate) && strtoupper(trim((string)($candidate['code'] ?? ''))) === $discountCode) {
                $discountRecordId = (string)$discountRow['id'];
                $discountRecord = $candidate;
                break;
            }
        }
        if (!is_array($discountRecord)) json_response(['ok' => false, 'error' => 'discount_not_found', 'message' => 'کد تخفیف معتبر نیست'], 422);
    }
    $totalFields = ['subtotal', 'tierDiscount', 'codeDiscount', 'pointsDiscount', 'tax', 'total'];
    foreach ($totalFields as $key) {
        if (!isset($totals[$key]) || !is_numeric($totals[$key]) || (float)$totals[$key] < 0 || (float)$totals[$key] > 100000000000 || floor((float)$totals[$key]) !== (float)$totals[$key]) {
            json_response(['ok' => false, 'error' => 'invalid_order_total', 'message' => 'مقادیر مالی سفارش معتبر نیست'], 422);
        }
    }
    if ((int)$totals['subtotal'] !== (int)$serverSubtotal) json_response(['ok' => false, 'error' => 'subtotal_mismatch', 'message' => 'جمع سفارش با قیمت محصولات مطابقت ندارد'], 409);
    $subtotal = (int)$totals['subtotal'];
    $tierDiscount = (int)$totals['tierDiscount'];
    $codeDiscount = (int)$totals['codeDiscount'];
    $pointsDiscount = (int)$totals['pointsDiscount'];
    $discountTotal = $tierDiscount + $codeDiscount + $pointsDiscount;
    $tierSettingsRaw=$pdo->query("SELECT payload FROM pos_records WHERE resource='settings' AND id='main' LIMIT 1")->fetchColumn();
    $tierSettings=is_string($tierSettingsRaw)?json_decode($tierSettingsRaw,true):[];if(!is_array($tierSettings))$tierSettings=[];
    $customerPoints = max(0, (int)($customerRecord['points'] ?? 0));
    $tierRate = loyalty_discount_rate($customerPoints,$tierSettings);
    $expectedTierDiscount = (int)round($subtotal * $tierRate / 100);
    $expectedCodeDiscount = 0;
    if ($discountCode !== '') {
        $discountType = (string)($discountRecord['type'] ?? '');
        $discountValue = (float)($discountRecord['value'] ?? 0);
        $maxDiscount = max(0, (int)($discountRecord['maxDiscount'] ?? 0));
        $minOrder = max(0, (int)($discountRecord['minOrder'] ?? 0));
        $maxUses = max(0, (int)($discountRecord['maxUses'] ?? 0));
        $usedCount = max(0, (int)($discountRecord['usedCount'] ?? 0));
        $perCustomer = max(0, (int)($discountRecord['perCustomer'] ?? 0));
        $today = date('Y-m-d');
        $startsAt = trim((string)($discountRecord['startsAt'] ?? ''));
        $endsAt = trim((string)($discountRecord['endsAt'] ?? ''));
        $audience = (string)($discountRecord['audience'] ?? 'all');
        $tier = loyalty_tier($customerPoints,$tierSettings);
        if (!in_array($discountType, ['percent','fixed'], true) || !is_finite($discountValue) || $discountValue <= 0 || ($discountType === 'percent' && $discountValue > 100)) {
            json_response(['ok' => false, 'error' => 'invalid_discount_config', 'message' => 'تعریف کد تخفیف معتبر نیست'], 409);
        }
        if (($startsAt !== '' && $today < $startsAt) || ($endsAt !== '' && $today > $endsAt)) json_response(['ok' => false, 'error' => 'discount_out_of_date', 'message' => 'کد تخفیف در این تاریخ فعال نیست'], 409);
        if ($maxUses > 0 && $usedCount >= $maxUses) json_response(['ok' => false, 'error' => 'discount_limit_reached', 'message' => 'سقف استفاده از این کد تمام شده است'], 409);
        if ($subtotal - $expectedTierDiscount < $minOrder) json_response(['ok' => false, 'error' => 'discount_minimum_not_met', 'message' => 'مبلغ سفارش به حداقل لازم برای این کد نرسیده است'], 409);
        if ($audience === 'club' && $customerId === '') json_response(['ok' => false, 'error' => 'discount_customer_required', 'message' => 'این کد فقط برای اعضای باشگاه است'], 409);
        if (in_array($audience, ['bronze','silver','gold','platinum'], true) && ($customerId === '' || $tier !== $audience)) json_response(['ok' => false, 'error' => 'discount_audience_mismatch', 'message' => 'این کد برای سطح عضویت مشتری قابل استفاده نیست'], 409);
        if (!in_array($audience, ['all','club','bronze','silver','gold','platinum'], true)) json_response(['ok' => false, 'error' => 'invalid_discount_audience'], 409);
        $afterTierForCode = max(0, $subtotal - $expectedTierDiscount);
        $expectedCodeDiscount = $discountType === 'percent'
            ? (int)round($afterTierForCode * $discountValue / 100)
            : min($afterTierForCode, (int)round($discountValue));
        if ($discountType === 'percent' && $maxDiscount > 0) $expectedCodeDiscount = min($expectedCodeDiscount, $maxDiscount);
    }
    $settingsForPointsStmt = $pdo->prepare("SELECT payload FROM pos_records WHERE resource = 'settings' AND id = 'main' LIMIT 1");
    $settingsForPointsStmt->execute();
    $rawPointsSettings = $settingsForPointsStmt->fetchColumn();
    $pointsSettings = is_string($rawPointsSettings) ? json_decode($rawPointsSettings, true) : [];
    $tomanPerPointCheck = max(1, (int)($pointsSettings['tomanPerPoint'] ?? 1));
    $expectedPointsDiscount = min(max(0, $subtotal - $expectedTierDiscount - $expectedCodeDiscount), $customerPoints * $tomanPerPointCheck);
    if ($pointsDiscount > $expectedPointsDiscount) json_response(['ok' => false, 'error' => 'invalid_points_discount', 'message' => 'مقدار تخفیف امتیازی معتبر نیست'], 409);
    $taxSettingsStmt = $pdo->prepare("SELECT payload FROM pos_records WHERE resource = 'settings' AND id = 'main' LIMIT 1");
    $taxSettingsStmt->execute();
    $rawTaxSettings = $taxSettingsStmt->fetchColumn();
    $taxSettings = is_string($rawTaxSettings) ? json_decode($rawTaxSettings, true) : [];
    if (!is_array($taxSettings)) $taxSettings = [];
    $taxEnabled = !array_key_exists('taxEnabled', $taxSettings) || $taxSettings['taxEnabled'] !== false;
    $taxPercent = (float)($taxSettings['taxPercent'] ?? 0);
    $stockPolicy = (string)($taxSettings['stockPolicy'] ?? 'warn_and_allow');
    if (!in_array($stockPolicy, ['block', 'warn_and_allow', 'allow_negative'], true)) $stockPolicy = 'warn_and_allow';
    if (!is_finite($taxPercent) || $taxPercent < 0 || $taxPercent > 100) {
        json_response(['ok' => false, 'error' => 'invalid_tax_settings', 'message' => 'تنظیم درصد مالیات معتبر نیست'], 409);
    }
    $taxableAmount = max(0, $subtotal - $discountTotal);
    $expectedTax = $taxEnabled ? (int)round($taxableAmount * $taxPercent / 100) : 0;
    // Membership tiers in the POS model grant at most 8% (platinum).
    // Keep client-supplied discounts within their mathematically possible bases.
    $maxTierDiscount = $expectedTierDiscount;
    $afterTier = $subtotal - $tierDiscount;
    $afterCode = $afterTier - $codeDiscount;
    if (
        $tierDiscount !== $expectedTierDiscount ||
        $codeDiscount !== $expectedCodeDiscount ||
        $pointsDiscount > $afterCode ||
        $discountTotal > $subtotal ||
        (int)$totals['tax'] !== $expectedTax ||
        (int)$totals['total'] !== $subtotal - $discountTotal + (int)$totals['tax']
    ) {
        json_response(['ok' => false, 'error' => 'order_total_mismatch', 'message' => 'تخفیف‌ها یا محاسبه مبلغ نهایی سفارش معتبر نیست'], 422);
    }
    // Canonical customer details were loaded before validating tier and coupon discounts.
    if ($pointsDiscount > 0 && $customerId === '') {
        json_response(['ok' => false, 'error' => 'points_require_customer', 'message' => 'برای استفاده از امتیاز باید مشتری انتخاب شود'], 422);
    }
    try {
        $pdo->beginTransaction();

        if($payment==='card'){
            $terminalPaymentLock=$pdo->prepare("SELECT id FROM pos_terminal_payments WHERE id=? AND created_by=? AND amount=? AND status='approved' AND order_id IS NULL FOR UPDATE");
            $terminalPaymentLock->execute([$terminalPaymentId,(int)$actor['id'],(int)$totals['total']]);
            if(!$terminalPaymentLock->fetchColumn()){
                $pdo->rollBack();
                json_response(['ok'=>false,'error'=>'terminal_payment_not_approved','message'=>'برای ثبت پرداخت کارتی، تأیید معتبر کارتخوان با همین مبلغ الزامی است'],409);
            }
        }
        // Lock product rows and ensure price, recipe and options did not change after quoting.
        $productLock = $pdo->prepare("SELECT payload FROM pos_records WHERE resource = 'products' AND id = ? FOR UPDATE");
        foreach ($productSnapshots as $productId => $snapshotHash) {
            $productLock->execute([$productId]);
            $lockedProductRaw = $productLock->fetchColumn();
            if (!is_string($lockedProductRaw) || !hash_equals($snapshotHash, hash('sha256', $lockedProductRaw))) {
                $pdo->rollBack();
                json_response(['ok' => false, 'error' => 'product_changed_requote', 'message' => 'اطلاعات یا قیمت یکی از محصولات تغییر کرده است؛ سبد را دوباره محاسبه کنید'], 409);
            }
        }

        $pointsToSpend = 0;
        $pointsEarned = 0;

        if ($discountCode !== '' && $discountRecordId !== null) {
            $discountLock = $pdo->prepare("SELECT payload FROM pos_records WHERE resource = 'discounts' AND id = ? FOR UPDATE");
            $discountLock->execute([$discountRecordId]);
            $lockedDiscountRaw = $discountLock->fetchColumn();
            $lockedDiscount = is_string($lockedDiscountRaw) ? json_decode($lockedDiscountRaw, true) : null;
            if (!is_array($lockedDiscount) || strtoupper(trim((string)($lockedDiscount['code'] ?? ''))) !== $discountCode) {
                $pdo->rollBack();
                json_response(['ok' => false, 'error' => 'discount_changed', 'message' => 'کد تخفیف تغییر کرده است؛ دوباره بررسی کنید'], 409);
            }
            foreach (['type','value','maxDiscount','minOrder','maxUses','perCustomer','startsAt','endsAt','audience'] as $ruleField) {
                if (($lockedDiscount[$ruleField] ?? null) !== ($discountRecord[$ruleField] ?? null)) {
                    $pdo->rollBack();
                    json_response(['ok' => false, 'error' => 'discount_changed', 'message' => 'قوانین کد تخفیف هم‌زمان تغییر کرده است؛ سفارش را دوباره محاسبه کنید'], 409);
                }
            }
            $lockedMaxUses = max(0, (int)($lockedDiscount['maxUses'] ?? 0));
            $lockedUsedCount = max(0, (int)($lockedDiscount['usedCount'] ?? 0));
            $globalRedemptionsStmt = $pdo->prepare('SELECT COUNT(*) FROM pos_discount_redemptions WHERE discount_id = ? AND reversed_at IS NULL');
            $globalRedemptionsStmt->execute([$discountRecordId]);
            $globalRedemptions = (int)$globalRedemptionsStmt->fetchColumn();
            $authoritativeUsedCount = max($lockedUsedCount, $globalRedemptions);
            if ($lockedMaxUses > 0 && $authoritativeUsedCount >= $lockedMaxUses) {
                $pdo->rollBack();
                json_response(['ok' => false, 'error' => 'discount_limit_reached', 'message' => 'آخرین سهمیه این کد هم‌زمان مصرف شد'], 409);
            }
            $lockedPerCustomer = max(0, (int)($lockedDiscount['perCustomer'] ?? 0));
            if ($lockedPerCustomer > 0 && $customerId !== '') {
                $usageStmt = $pdo->prepare('SELECT COUNT(*) FROM pos_discount_redemptions WHERE discount_id = ? AND customer_id = ? AND reversed_at IS NULL');
                $usageStmt->execute([$discountRecordId, $customerId]);
                if ((int)$usageStmt->fetchColumn() >= $lockedPerCustomer) {
                    $pdo->rollBack();
                    json_response(['ok' => false, 'error' => 'discount_customer_limit', 'message' => 'سهمیه استفاده این مشتری از کد تمام شده است'], 409);
                }
            }
            $lockedDiscount['usedCount'] = $authoritativeUsedCount + 1;
            $discountUpdate = $pdo->prepare("UPDATE pos_records SET payload = ?, updated_by = ? WHERE resource = 'discounts' AND id = ?");
            $discountUpdate->execute([json_encode($lockedDiscount, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR), (int)$actor['id'], $discountRecordId]);
        }

        // Lock ingredients in a stable order to reduce deadlocks between concurrent checkouts.
        ksort($ingredientNeeds, SORT_STRING);
        // Lock and deduct every recipe ingredient in the same transaction as order creation.
        $ingredientSelect = $pdo->prepare("SELECT payload FROM pos_records WHERE resource = 'ingredients' AND id = ? FOR UPDATE");
        $ingredientUpdate = $pdo->prepare("UPDATE pos_records SET payload = ?, updated_by = ? WHERE resource = 'ingredients' AND id = ?");
        foreach ($ingredientNeeds as $ingredientId => $needed) {
            $ingredientSelect->execute([$ingredientId]);
            $rawIngredient = $ingredientSelect->fetchColumn();
            $ingredient = is_string($rawIngredient) ? json_decode($rawIngredient, true) : null;
            if (!is_array($ingredient)) {
                $pdo->rollBack();
                json_response(['ok' => false, 'error' => 'ingredient_not_found', 'message' => 'یکی از مواد اولیه دستور محصول در انبار پیدا نشد'], 409);
            }
            $available = (float)($ingredient['stock'] ?? 0);
            if ($stockPolicy === 'block' && $available + 0.000001 < $needed) {
                $pdo->rollBack();
                json_response(['ok' => false, 'error' => 'insufficient_stock', 'message' => 'موجودی یکی از مواد اولیه کافی نیست: ' . (string)($ingredient['name'] ?? $ingredientId)], 409);
            }
            // warn_and_allow keeps the operator informed in the POS; allow_negative skips the warning.
            // Negative stock is retained as an explicit backorder/shortage signal for replenishment reports.
            $ingredient['stock'] = round($available - $needed, 3);
            $ingredientUpdate->execute([
                json_encode($ingredient, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
                (int)$actor['id'],
                $ingredientId,
            ]);
        }

        // Serialize loyalty balance changes so two cashiers cannot spend the same points.
        if ($customerId !== '') {
            $customerLock = $pdo->prepare("SELECT payload FROM pos_records WHERE resource = 'customers' AND id = ? FOR UPDATE");
            $customerLock->execute([$customerId]);
            $rawCustomer = $customerLock->fetchColumn();
            $lockedCustomer = is_string($rawCustomer) ? json_decode($rawCustomer, true) : null;
            if (!is_array($lockedCustomer)) {
                $pdo->rollBack();
                json_response(['ok' => false, 'error' => 'customer_not_found', 'message' => 'مشتری انتخاب‌شده پیدا نشد؛ فهرست مشتریان را تازه‌سازی کنید'], 409);
            }
            $settingsStmt = $pdo->prepare("SELECT payload FROM pos_records WHERE resource = 'settings' AND id = 'main' LIMIT 1");
            $settingsStmt->execute();
            $rawSettings = $settingsStmt->fetchColumn();
            $settings = is_string($rawSettings) ? json_decode($rawSettings, true) : [];
            $tomanPerPoint = max(1, (int)($settings['tomanPerPoint'] ?? 1));
            $pointsPerToman = max(1, (int)($settings['pointsPerToman'] ?? 100000));
            $pointsToSpend = $pointsDiscount > 0 ? (int)ceil($pointsDiscount / $tomanPerPoint) : 0;
            $customerName = substr((string)($lockedCustomer['name'] ?? $customerName ?? ''), 0, 160);
            $customerPhone = substr((string)($lockedCustomer['phone'] ?? $customerPhone ?? ''), 0, 30);
            $currentPoints = max(0, (int)($lockedCustomer['points'] ?? 0));
            if ($currentPoints !== $customerPoints) {
                $pdo->rollBack();
                json_response(['ok' => false, 'error' => 'customer_changed_requote', 'message' => 'امتیاز یا سطح عضویت مشتری تغییر کرده است؛ سفارش را دوباره محاسبه کنید'], 409);
            }
            if ($pointsToSpend > $currentPoints || ($pointsToSpend * $tomanPerPoint) < $pointsDiscount) {
                $pdo->rollBack();
                json_response(['ok' => false, 'error' => 'insufficient_points', 'message' => 'امتیاز مشتری برای این تخفیف کافی نیست؛ اطلاعات مشتری را تازه‌سازی کنید'], 409);
            }
            $pointsEarned = (int)floor(((int)$totals['total']) / $pointsPerToman);
            $lockedCustomer['points'] = $currentPoints - $pointsToSpend + $pointsEarned;
            $lockedCustomer['totalSpent'] = (int)($lockedCustomer['totalSpent'] ?? 0) + (int)$totals['total'];
            $lockedCustomer['visits'] = (int)($lockedCustomer['visits'] ?? 0) + 1;
            $customerUpdate = $pdo->prepare("UPDATE pos_records SET payload = ?, updated_by = ? WHERE resource = 'customers' AND id = ?");
            $customerUpdate->execute([
                json_encode($lockedCustomer, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
                (int)$actor['id'],
                $customerId,
            ]);
        }

        $counter = $pdo->query("SELECT counter_value FROM pos_counters WHERE counter_key = 'order_number' FOR UPDATE")->fetchColumn();
        if ($counter === false) throw new RuntimeException('Order counter missing');
        $orderNumber = (int)$counter + 1;
        $pdo->prepare("UPDATE pos_counters SET counter_value = ? WHERE counter_key = 'order_number'")->execute([$orderNumber]);
        $stmt = $pdo->prepare('INSERT INTO pos_orders (order_number, status, idempotency_key, request_hash, customer_id, customer_name, customer_phone, guest_name, guest_phone, payment_method, points_used, points_earned, discount_code, items, totals, note, created_by) VALUES (?, \'new\', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $orderNumber,
            $idempotencyKey,
            $idempotencyKey !== null ? $requestHash : null,
            $customerId !== '' ? $customerId : null,
            $customerName,
            $customerPhone,
            $guestName,
            $guestPhone,
            $payment,
            $pointsToSpend,
            $pointsEarned,
            $discountCode !== '' ? $discountCode : null,
            json_encode($canonicalItems, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            json_encode($totals, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            isset($body['note']) ? substr((string)$body['note'], 0, 2000) : null,
            (int)$actor['id'],
        ]);
        $id = (int)$pdo->lastInsertId();
        if($payment==='card'){
            $linkPayment=$pdo->prepare('UPDATE pos_terminal_payments SET order_id=? WHERE id=? AND order_id IS NULL');
            $linkPayment->execute([$id,$terminalPaymentId]);
            if($linkPayment->rowCount()!==1) throw new RuntimeException('Approved terminal payment could not be linked to the order');
        }
        if ($discountCode !== '' && $discountRecordId !== null) {
            $redemptionInsert = $pdo->prepare('INSERT INTO pos_discount_redemptions (order_id, discount_id, code, customer_id) VALUES (?, ?, ?, ?)');
            $redemptionInsert->execute([$id, $discountRecordId, $discountCode, $customerId !== '' ? $customerId : null]);
        }

        // Persist the exact stock and loyalty effects so cancellation can reverse
        // them once, inside the same transaction as the status change.
        $effectInsert = $pdo->prepare('INSERT INTO pos_order_effects (order_id, effect_type, resource_id, quantity, points_spent, points_earned, money_delta, visits_delta) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        foreach ($ingredientNeeds as $ingredientId => $needed) {
            if ((float)$needed > 0) $effectInsert->execute([$id, 'ingredient', $ingredientId, round((float)$needed, 3), 0, 0, 0, 0]);
        }
        if ($customerId !== '') {
            $effectInsert->execute([$id, 'customer', $customerId, 0, $pointsToSpend, $pointsEarned, (int)$totals['total'], 1]);
        }
        audit($pdo, (int)$actor['id'], 'order_created', 'order', (string)$id, ['order_number' => $orderNumber]);
        $pdo->commit();
        json_response(['ok' => true, 'order' => ['id' => (string)$id, 'orderNumber' => $orderNumber, 'status' => 'new', 'createdAt' => gmdate('Y-m-d\\TH:i:s\\Z'), 'items' => $canonicalItems, 'totals' => $totals]], 201);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        // A concurrent retry may win the unique idempotency key after our initial lookup.
        if ($idempotencyKey !== null && $e instanceof PDOException && (string)$e->getCode() === '23000') {
            $retryStmt = $pdo->prepare('SELECT id, order_number, status, items, totals, request_hash, created_at FROM pos_orders WHERE idempotency_key = ? LIMIT 1');
            $retryStmt->execute([$idempotencyKey]);
            $retry = $retryStmt->fetch();
            if (is_array($retry)) {
                if (!hash_equals((string)$retry['request_hash'], $requestHash)) {
                    json_response(['ok' => false, 'error' => 'idempotency_conflict', 'message' => 'این شناسه قبلاً برای سفارش دیگری استفاده شده است'], 409);
                }
                json_response(['ok' => true, 'replayed' => true, 'order' => [
                    'id' => (string)$retry['id'],
                    'orderNumber' => (int)$retry['order_number'],
                    'status' => (string)$retry['status'],
                    'createdAt' => (new DateTimeImmutable((string)$retry['created_at'], new DateTimeZone('UTC')))->format('Y-m-d\\TH:i:s\\Z'),
                    'items' => json_decode((string)$retry['items'], true) ?: [],
                    'totals' => json_decode((string)$retry['totals'], true) ?: [],
                ]]);
            }
        }
        error_log('[3Food POS] Order creation failed: ' . $e->getMessage());
        json_response(['ok' => false, 'error' => 'order_create_failed', 'message' => 'ثبت سفارش انجام نشد'], 500);
    }
}

if (preg_match('#^/orders/(\d+)$#', $path, $editMatch) && $method === 'PATCH') {
    $actor = require_role($pdo, ['manager']);
    require_csrf();
    $body = request_json();
    $id = (int)$editMatch[1];
    $pdo->beginTransaction();
    $editOrderStmt = $pdo->prepare('SELECT * FROM pos_orders WHERE id = ? FOR UPDATE');
    $editOrderStmt->execute([$id]);
    $existingOrder = $editOrderStmt->fetch();
    if (!is_array($existingOrder)) {
        $pdo->rollBack();
        json_response(['ok' => false, 'error' => 'order_not_found'], 404);
    }
    if ((string)$existingOrder['status'] !== 'new') {
        $pdo->rollBack();
        json_response(['ok' => false, 'error' => 'order_not_editable', 'message' => 'فقط سفارش‌های جدید قابل ویرایش هستند'], 409);
    }
    $storedPaymentMethod = (string)($existingOrder['payment_method'] ?? 'cash');
    if (array_key_exists('payment', $body) && (string)$body['payment'] !== $storedPaymentMethod) {
        $pdo->rollBack();
        json_response(['ok' => false, 'error' => 'payment_method_change_requires_new_transaction', 'message' => 'روش پرداخت سفارش پس از ثبت قابل تغییر نیست؛ پرداخت جدید را جداگانه و با تأیید معتبر ثبت کنید'], 409);
    }
    if (in_array($storedPaymentMethod, ['card','online'], true)) {
        $pdo->rollBack();
        json_response(['ok' => false, 'error' => 'payment_reconciliation_required', 'message' => 'سفارش دارای پرداخت کارتخوان یا روش آنلاین قدیمی تا تعیین‌تکلیف مالی و بازپرداخت قابل ویرایش نیست'], 409);
    }
    // Read settings as a locking/current read before touching inventory rows.
    // This avoids relying on an older repeatable-read snapshot during order edits.
    $taxSettingsStmt = $pdo->prepare("SELECT payload FROM pos_records WHERE resource = 'settings' AND id = 'main' LIMIT 1 FOR UPDATE");
    $taxSettingsStmt->execute();
    $rawTaxSettings = $taxSettingsStmt->fetchColumn();
    $taxSettings = is_string($rawTaxSettings) ? json_decode($rawTaxSettings, true) : [];
    if (!is_array($taxSettings)) $taxSettings = [];
    $stockPolicy = (string)($taxSettings['stockPolicy'] ?? 'warn_and_allow');
    if (!in_array($stockPolicy, ['block', 'warn_and_allow', 'allow_negative'], true)) $stockPolicy = 'warn_and_allow';
    $oldRedemptionStmt = $pdo->prepare('SELECT id, discount_id FROM pos_discount_redemptions WHERE order_id = ? AND reversed_at IS NULL FOR UPDATE');
    $oldRedemptionStmt->execute([$id]);
    $oldRedemption = $oldRedemptionStmt->fetch();
    $existingRedemptionId = is_array($oldRedemption) ? (int)$oldRedemption['id'] : null;
    if (is_array($oldRedemption)) {
        $oldDiscountStmt = $pdo->prepare("SELECT payload FROM pos_records WHERE resource = 'discounts' AND id = ? FOR UPDATE");
        $oldDiscountStmt->execute([(string)$oldRedemption['discount_id']]);
        $oldDiscountRaw = $oldDiscountStmt->fetchColumn();
        $oldDiscount = is_string($oldDiscountRaw) ? json_decode($oldDiscountRaw, true) : null;
        if (is_array($oldDiscount)) {
            $oldDiscount['usedCount'] = max(0, (int)($oldDiscount['usedCount'] ?? 0) - 1);
            $pdo->prepare("UPDATE pos_records SET payload = ?, updated_by = ? WHERE resource = 'discounts' AND id = ?")
                ->execute([json_encode($oldDiscount, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR), (int)$actor['id'], (string)$oldRedemption['discount_id']]);
        }
        $pdo->prepare('UPDATE pos_discount_redemptions SET reversed_at = NOW() WHERE id = ? AND reversed_at IS NULL')->execute([$existingRedemptionId]);
    }
    $oldEffectsStmt = $pdo->prepare('SELECT id, effect_type, resource_id, quantity, points_spent, points_earned, money_delta, visits_delta FROM pos_order_effects WHERE order_id = ? AND reversed_at IS NULL ORDER BY effect_type, resource_id FOR UPDATE');
    $oldEffectsStmt->execute([$id]);
    $oldEffects = $oldEffectsStmt->fetchAll();
    $oldIngredientIds = [];
    foreach ($oldEffects as $effect) if ($effect['effect_type'] === 'ingredient') $oldIngredientIds[] = (string)$effect['resource_id'];
    $oldIngredientIds = array_values(array_unique($oldIngredientIds));
    sort($oldIngredientIds, SORT_STRING);
    $oldIngredientSelect = $pdo->prepare("SELECT payload FROM pos_records WHERE resource = 'ingredients' AND id = ? FOR UPDATE");
    $oldIngredientUpdate = $pdo->prepare("UPDATE pos_records SET payload = ?, updated_by = ? WHERE resource = 'ingredients' AND id = ?");
    foreach ($oldIngredientIds as $ingredientId) {
        $oldIngredientSelect->execute([$ingredientId]);
        $rawIngredient = $oldIngredientSelect->fetchColumn();
        $ingredient = is_string($rawIngredient) ? json_decode($rawIngredient, true) : null;
        if (!is_array($ingredient)) throw new RuntimeException('Missing ingredient while reversing order');
        foreach ($oldEffects as $effect) {
            if ($effect['effect_type'] === 'ingredient' && (string)$effect['resource_id'] === $ingredientId) {
                $ingredient['stock'] = round((float)($ingredient['stock'] ?? 0) + (float)$effect['quantity'], 3);
            }
        }
        $oldIngredientUpdate->execute([json_encode($ingredient, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR), (int)$actor['id'], $ingredientId]);
    }
    foreach ($oldEffects as $effect) {
        if ($effect['effect_type'] !== 'customer') continue;
        $oldCustomerId = (string)$effect['resource_id'];
        $oldCustomerStmt = $pdo->prepare("SELECT payload FROM pos_records WHERE resource = 'customers' AND id = ? FOR UPDATE");
        $oldCustomerStmt->execute([$oldCustomerId]);
        $rawCustomer = $oldCustomerStmt->fetchColumn();
        $customer = is_string($rawCustomer) ? json_decode($rawCustomer, true) : null;
        if (!is_array($customer)) throw new RuntimeException('Missing customer while reversing order');
        $restoredPoints = (int)($customer['points'] ?? 0) + (int)$effect['points_spent'];
        if ($restoredPoints < (int)$effect['points_earned']) {
            $pdo->rollBack();
            json_response(['ok' => false, 'error' => 'loyalty_points_already_spent', 'message' => 'امتیاز حاصل از سفارش قبلاً خرج شده است؛ ابتدا حساب مشتری را بررسی کنید'], 409);
        }
        $customer['points'] = $restoredPoints - (int)$effect['points_earned'];
        $customer['totalSpent'] = max(0, (int)($customer['totalSpent'] ?? 0) - (int)$effect['money_delta']);
        $customer['visits'] = max(0, (int)($customer['visits'] ?? 0) - (int)$effect['visits_delta']);
        $pdo->prepare("UPDATE pos_records SET payload = ?, updated_by = ? WHERE resource = 'customers' AND id = ?")
            ->execute([json_encode($customer, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR), (int)$actor['id'], $oldCustomerId]);
    }
    if ($oldEffects) {
        $effectIds = array_map(static fn(array $effect): int => (int)$effect['id'], $oldEffects);
        $marks = implode(',', array_fill(0, count($effectIds), '?'));
        $pdo->prepare("UPDATE pos_order_effects SET reversed_at = NOW(), reversed_by = ? WHERE id IN ($marks) AND reversed_at IS NULL")
            ->execute(array_merge([(int)$actor['id']], $effectIds));
    }
    $items = $body['items'] ?? null;
    $totals = $body['totals'] ?? null;
    $idempotencyKey = null;
    if ($idempotencyKey !== null && !preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/D', $idempotencyKey)) {
        json_response(['ok' => false, 'error' => 'invalid_idempotency_key'], 422);
    }
    $requestHash = hash('sha256', json_encode([
        'items' => $items,
        'totals' => $totals,
        'customer' => $body['customer'] ?? null,
        'discountCode' => strtoupper(trim((string)($body['discountCode'] ?? ''))),
        'note' => $body['note'] ?? null,
        'guestName' => $body['guestName'] ?? null,
        'guestPhone' => $body['guestPhone'] ?? null,
        'payment' => $body['payment'] ?? 'cash',
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
    if ($idempotencyKey !== null) {
        $existingStmt = $pdo->prepare('SELECT id, order_number, status, items, totals, request_hash FROM pos_orders WHERE idempotency_key = ? LIMIT 1');
        $existingStmt->execute([$idempotencyKey]);
        $existing = $existingStmt->fetch();
        if (is_array($existing)) {
            if (!hash_equals((string)$existing['request_hash'], $requestHash)) {
                json_response(['ok' => false, 'error' => 'idempotency_conflict', 'message' => 'این شناسه قبلاً برای سفارش دیگری استفاده شده است'], 409);
            }
            json_response(['ok' => true, 'replayed' => true, 'order' => [
                'id' => (string)$existing['id'],
                'orderNumber' => (int)$existing['order_number'],
                'status' => (string)$existing['status'],
                'items' => json_decode((string)$existing['items'], true) ?: [],
                'totals' => json_decode((string)$existing['totals'], true) ?: [],
            ]]);
        }
    }
    if (!is_array($items) || count($items) < 1 || count($items) > 100 || !is_array($totals)) json_response(['ok' => false, 'error' => 'invalid_order', 'message' => 'اقلام یا مبلغ سفارش معتبر نیست'], 422);
    $serverSubtotal = 0;
    $ingredientNeeds = [];
    $canonicalItems = [];
    $productSnapshots = [];
    $productLookup = $pdo->prepare("SELECT payload FROM pos_records WHERE resource = 'products' AND id = ? LIMIT 1");
    foreach ($items as $line) {
        if (!is_array($line) || !isset($line['productId'], $line['qty']) || !is_numeric($line['qty']) || (float)$line['qty'] <= 0 || (float)$line['qty'] > 999 || floor((float)$line['qty']) !== (float)$line['qty']) {
            json_response(['ok' => false, 'error' => 'invalid_order_item'], 422);
        }
        $productLookup->execute([(string)$line['productId']]);
        $productRaw = $productLookup->fetchColumn();
        $product = is_string($productRaw) ? json_decode($productRaw, true) : null;
        if (!is_array($product) || empty($product['active'])) json_response(['ok' => false, 'error' => 'product_unavailable', 'message' => 'یکی از محصولات سفارش فعال نیست'], 409);
        $productId = (string)$line['productId'];
        $productSnapshots[$productId] = hash('sha256', (string)$productRaw);
        // Derive ingredient consumption from the server-side recipe, never from browser input.
        foreach (($product['recipe'] ?? []) as $recipeLine) {
            if (!is_array($recipeLine) || !isset($recipeLine['ingredientId'], $recipeLine['qty'])) continue;
            $ingredientId = (string)$recipeLine['ingredientId'];
            $recipeQty = (float)$recipeLine['qty'];
            if ($ingredientId !== '' && $recipeQty > 0 && is_finite($recipeQty)) {
                $ingredientNeeds[$ingredientId] = ($ingredientNeeds[$ingredientId] ?? 0) + ($recipeQty * (int)$line['qty']);
            }
        }
        $basePrice = filter_var($product['price'] ?? null, FILTER_VALIDATE_INT);
        if ($basePrice === false || $basePrice < 0) json_response(['ok' => false, 'error' => 'invalid_product_price'], 409);
        $unitPrice = $basePrice;
        $validOptions = [];
        foreach (($product['options'] ?? []) as $option) {
            if (!is_array($option) || !isset($option['id'])) continue;
            $optionPrice = filter_var($option['price'] ?? 0, FILTER_VALIDATE_INT);
            if ($optionPrice === false) continue;
            $validOptions[(string)$option['id']] = ['price' => $optionPrice, 'name' => substr((string)($option['name'] ?? ''), 0, 120)];
        }
        $rawOptionIds = $line['optionIds'] ?? [];
        if (!is_array($rawOptionIds) || count($rawOptionIds) > 30) json_response(['ok' => false, 'error' => 'invalid_product_option'], 422);
        $optionIds = array_map('strval', $rawOptionIds);
        if (count($optionIds) !== count(array_unique($optionIds))) json_response(['ok' => false, 'error' => 'duplicate_product_option'], 422);
        $optionLabels = [];
        foreach ($optionIds as $optionId) {
            if (!array_key_exists($optionId, $validOptions)) json_response(['ok' => false, 'error' => 'invalid_product_option'], 422);
            $unitPrice += $validOptions[$optionId]['price'];
            $optionLabels[] = $validOptions[$optionId]['name'];
        }
        if ($unitPrice < 0 || $unitPrice > 100000000000) json_response(['ok' => false, 'error' => 'invalid_order_item_price'], 422);
        if (isset($line['unitPrice']) && (!is_numeric($line['unitPrice']) || (float)$line['unitPrice'] !== (float)$unitPrice)) json_response(['ok' => false, 'error' => 'price_changed', 'message' => 'قیمت محصول تغییر کرده است؛ سبد را تازه‌سازی کنید'], 409);
        $serverSubtotal += $unitPrice * (int)$line['qty'];
        $clientKey = isset($line['key']) && preg_match('/^[A-Za-z0-9_-]{1,100}$/D', (string)$line['key']) ? (string)$line['key'] : 'line-' . count($canonicalItems);
        $canonicalItems[] = [
            'key' => $clientKey,
            'name' => substr((string)($product['name'] ?? 'محصول'), 0, 160),
            'productId' => $productId,
            'qty' => (int)$line['qty'],
            'unitPrice' => $unitPrice,
            'optionIds' => $optionIds,
            'optionLabels' => $optionLabels,
            'note' => isset($line['note']) ? substr(trim((string)$line['note']), 0, 500) : '',
        ];
    }
    $customer = is_array($body['customer'] ?? null) ? $body['customer'] : [];
    $customerId = isset($customer['id']) ? (string)$customer['id'] : '';
    $customerRecord = null;
    if ($customerId !== '') {
        if (strlen($customerId) > 100 || !preg_match('/^[A-Za-z0-9_-]+$/D', $customerId)) {
            json_response(['ok' => false, 'error' => 'invalid_customer'], 422);
        }
        $customerStmt = $pdo->prepare("SELECT payload FROM pos_records WHERE resource = 'customers' AND id = ? LIMIT 1");
        $customerStmt->execute([$customerId]);
        $customerRaw = $customerStmt->fetchColumn();
        $customerRecord = is_string($customerRaw) ? json_decode($customerRaw, true) : null;
        if (!is_array($customerRecord)) json_response(['ok' => false, 'error' => 'customer_not_found', 'message' => 'مشتری انتخاب‌شده پیدا نشد؛ فهرست مشتریان را تازه‌سازی کنید'], 409);
    }
    $customerName = is_array($customerRecord) ? substr((string)($customerRecord['name'] ?? ''), 0, 160) : null;
    $customerPhone = is_array($customerRecord) ? substr((string)($customerRecord['phone'] ?? ''), 0, 30) : null;
    $guestName = $customerId === '' ? trim((string)($body['guestName'] ?? 'مشتری')) : null;
    $guestPhone = $customerId === '' ? trim((string)($body['guestPhone'] ?? '')) : null;
    $payment = (string)($body['payment'] ?? $existingOrder['payment_method'] ?? 'cash');
    if (!in_array($payment, ['cash','card','online'], true) || utf8_length($guestName ?? '') > 160 || strlen($guestPhone ?? '') > 30) {
        json_response(['ok' => false, 'error' => 'invalid_order_details', 'message' => 'اطلاعات مشتری یا روش پرداخت معتبر نیست'], 422);
    }
    $discountCode = strtoupper(trim((string)($body['discountCode'] ?? '')));
    if (strlen($discountCode) > 64 || ($discountCode !== '' && !preg_match('/^[A-Z0-9_-]+$/D', $discountCode))) {
        json_response(['ok' => false, 'error' => 'invalid_discount_code'], 422);
    }
    $discountRecordId = null;
    $discountRecord = null;
    if ($discountCode !== '') {
        $discountRows = $pdo->query("SELECT id, payload FROM pos_records WHERE resource = 'discounts'")->fetchAll();
        foreach ($discountRows as $discountRow) {
            $candidate = json_decode((string)$discountRow['payload'], true);
            if (is_array($candidate) && strtoupper(trim((string)($candidate['code'] ?? ''))) === $discountCode) {
                $discountRecordId = (string)$discountRow['id'];
                $discountRecord = $candidate;
                break;
            }
        }
        if (!is_array($discountRecord)) json_response(['ok' => false, 'error' => 'discount_not_found', 'message' => 'کد تخفیف معتبر نیست'], 422);
    }
    $totalFields = ['subtotal', 'tierDiscount', 'codeDiscount', 'pointsDiscount', 'tax', 'total'];
    foreach ($totalFields as $key) {
        if (!isset($totals[$key]) || !is_numeric($totals[$key]) || (float)$totals[$key] < 0 || (float)$totals[$key] > 100000000000 || floor((float)$totals[$key]) !== (float)$totals[$key]) {
            json_response(['ok' => false, 'error' => 'invalid_order_total', 'message' => 'مقادیر مالی سفارش معتبر نیست'], 422);
        }
    }
    if ((int)$totals['subtotal'] !== (int)$serverSubtotal) json_response(['ok' => false, 'error' => 'subtotal_mismatch', 'message' => 'جمع سفارش با قیمت محصولات مطابقت ندارد'], 409);
    $subtotal = (int)$totals['subtotal'];
    $tierDiscount = (int)$totals['tierDiscount'];
    $codeDiscount = (int)$totals['codeDiscount'];
    $pointsDiscount = (int)$totals['pointsDiscount'];
    $discountTotal = $tierDiscount + $codeDiscount + $pointsDiscount;
    $tierSettingsRaw=$pdo->query("SELECT payload FROM pos_records WHERE resource='settings' AND id='main' LIMIT 1")->fetchColumn();
    $tierSettings=is_string($tierSettingsRaw)?json_decode($tierSettingsRaw,true):[];if(!is_array($tierSettings))$tierSettings=[];
    $customerPoints = max(0, (int)($customerRecord['points'] ?? 0));
    $tierRate = loyalty_discount_rate($customerPoints,$tierSettings);
    $expectedTierDiscount = (int)round($subtotal * $tierRate / 100);
    $expectedCodeDiscount = 0;
    if ($discountCode !== '') {
        $discountType = (string)($discountRecord['type'] ?? '');
        $discountValue = (float)($discountRecord['value'] ?? 0);
        $maxDiscount = max(0, (int)($discountRecord['maxDiscount'] ?? 0));
        $minOrder = max(0, (int)($discountRecord['minOrder'] ?? 0));
        $maxUses = max(0, (int)($discountRecord['maxUses'] ?? 0));
        $usedCount = max(0, (int)($discountRecord['usedCount'] ?? 0));
        $perCustomer = max(0, (int)($discountRecord['perCustomer'] ?? 0));
        $today = date('Y-m-d');
        $startsAt = trim((string)($discountRecord['startsAt'] ?? ''));
        $endsAt = trim((string)($discountRecord['endsAt'] ?? ''));
        $audience = (string)($discountRecord['audience'] ?? 'all');
        $tier = loyalty_tier($customerPoints,$tierSettings);
        if (!in_array($discountType, ['percent','fixed'], true) || !is_finite($discountValue) || $discountValue <= 0 || ($discountType === 'percent' && $discountValue > 100)) {
            json_response(['ok' => false, 'error' => 'invalid_discount_config', 'message' => 'تعریف کد تخفیف معتبر نیست'], 409);
        }
        if (($startsAt !== '' && $today < $startsAt) || ($endsAt !== '' && $today > $endsAt)) json_response(['ok' => false, 'error' => 'discount_out_of_date', 'message' => 'کد تخفیف در این تاریخ فعال نیست'], 409);
        if ($maxUses > 0 && $usedCount >= $maxUses) json_response(['ok' => false, 'error' => 'discount_limit_reached', 'message' => 'سقف استفاده از این کد تمام شده است'], 409);
        if ($subtotal - $expectedTierDiscount < $minOrder) json_response(['ok' => false, 'error' => 'discount_minimum_not_met', 'message' => 'مبلغ سفارش به حداقل لازم برای این کد نرسیده است'], 409);
        if ($audience === 'club' && $customerId === '') json_response(['ok' => false, 'error' => 'discount_customer_required', 'message' => 'این کد فقط برای اعضای باشگاه است'], 409);
        if (in_array($audience, ['bronze','silver','gold','platinum'], true) && ($customerId === '' || $tier !== $audience)) json_response(['ok' => false, 'error' => 'discount_audience_mismatch', 'message' => 'این کد برای سطح عضویت مشتری قابل استفاده نیست'], 409);
        if (!in_array($audience, ['all','club','bronze','silver','gold','platinum'], true)) json_response(['ok' => false, 'error' => 'invalid_discount_audience'], 409);
        $afterTierForCode = max(0, $subtotal - $expectedTierDiscount);
        $expectedCodeDiscount = $discountType === 'percent'
            ? (int)round($afterTierForCode * $discountValue / 100)
            : min($afterTierForCode, (int)round($discountValue));
        if ($discountType === 'percent' && $maxDiscount > 0) $expectedCodeDiscount = min($expectedCodeDiscount, $maxDiscount);
    }
    $settingsForPointsStmt = $pdo->prepare("SELECT payload FROM pos_records WHERE resource = 'settings' AND id = 'main' LIMIT 1");
    $settingsForPointsStmt->execute();
    $rawPointsSettings = $settingsForPointsStmt->fetchColumn();
    $pointsSettings = is_string($rawPointsSettings) ? json_decode($rawPointsSettings, true) : [];
    $tomanPerPointCheck = max(1, (int)($pointsSettings['tomanPerPoint'] ?? 1));
    $expectedPointsDiscount = min(max(0, $subtotal - $expectedTierDiscount - $expectedCodeDiscount), $customerPoints * $tomanPerPointCheck);
    if ($pointsDiscount > $expectedPointsDiscount) json_response(['ok' => false, 'error' => 'invalid_points_discount', 'message' => 'مقدار تخفیف امتیازی معتبر نیست'], 409);
    $taxEnabled = !array_key_exists('taxEnabled', $taxSettings) || $taxSettings['taxEnabled'] !== false;
    $taxPercent = (float)($taxSettings['taxPercent'] ?? 0);
    if (!is_finite($taxPercent) || $taxPercent < 0 || $taxPercent > 100) {
        json_response(['ok' => false, 'error' => 'invalid_tax_settings', 'message' => 'تنظیم درصد مالیات معتبر نیست'], 409);
    }
    $taxableAmount = max(0, $subtotal - $discountTotal);
    $expectedTax = $taxEnabled ? (int)round($taxableAmount * $taxPercent / 100) : 0;
    // Membership tiers in the POS model grant at most 8% (platinum).
    // Keep client-supplied discounts within their mathematically possible bases.
    $maxTierDiscount = $expectedTierDiscount;
    $afterTier = $subtotal - $tierDiscount;
    $afterCode = $afterTier - $codeDiscount;
    if (
        $tierDiscount !== $expectedTierDiscount ||
        $codeDiscount !== $expectedCodeDiscount ||
        $pointsDiscount > $afterCode ||
        $discountTotal > $subtotal ||
        (int)$totals['tax'] !== $expectedTax ||
        (int)$totals['total'] !== $subtotal - $discountTotal + (int)$totals['tax']
    ) {
        json_response(['ok' => false, 'error' => 'order_total_mismatch', 'message' => 'تخفیف‌ها یا محاسبه مبلغ نهایی سفارش معتبر نیست'], 422);
    }
    // Canonical customer details were loaded before validating tier and coupon discounts.
    if ($pointsDiscount > 0 && $customerId === '') {
        json_response(['ok' => false, 'error' => 'points_require_customer', 'message' => 'برای استفاده از امتیاز باید مشتری انتخاب شود'], 422);
    }
    try {
        // Order row and prior effects are already locked in this transaction.

        // Lock product rows and ensure price, recipe and options did not change after quoting.
        $productLock = $pdo->prepare("SELECT payload FROM pos_records WHERE resource = 'products' AND id = ? FOR UPDATE");
        foreach ($productSnapshots as $productId => $snapshotHash) {
            $productLock->execute([$productId]);
            $lockedProductRaw = $productLock->fetchColumn();
            if (!is_string($lockedProductRaw) || !hash_equals($snapshotHash, hash('sha256', $lockedProductRaw))) {
                $pdo->rollBack();
                json_response(['ok' => false, 'error' => 'product_changed_requote', 'message' => 'اطلاعات یا قیمت یکی از محصولات تغییر کرده است؛ سبد را دوباره محاسبه کنید'], 409);
            }
        }

        $pointsToSpend = 0;
        $pointsEarned = 0;

        if ($discountCode !== '' && $discountRecordId !== null) {
            $discountLock = $pdo->prepare("SELECT payload FROM pos_records WHERE resource = 'discounts' AND id = ? FOR UPDATE");
            $discountLock->execute([$discountRecordId]);
            $lockedDiscountRaw = $discountLock->fetchColumn();
            $lockedDiscount = is_string($lockedDiscountRaw) ? json_decode($lockedDiscountRaw, true) : null;
            if (!is_array($lockedDiscount) || strtoupper(trim((string)($lockedDiscount['code'] ?? ''))) !== $discountCode) {
                $pdo->rollBack();
                json_response(['ok' => false, 'error' => 'discount_changed', 'message' => 'کد تخفیف تغییر کرده است؛ دوباره بررسی کنید'], 409);
            }
            foreach (['type','value','maxDiscount','minOrder','maxUses','perCustomer','startsAt','endsAt','audience'] as $ruleField) {
                if (($lockedDiscount[$ruleField] ?? null) !== ($discountRecord[$ruleField] ?? null)) {
                    $pdo->rollBack();
                    json_response(['ok' => false, 'error' => 'discount_changed', 'message' => 'قوانین کد تخفیف هم‌زمان تغییر کرده است؛ سفارش را دوباره محاسبه کنید'], 409);
                }
            }
            $lockedMaxUses = max(0, (int)($lockedDiscount['maxUses'] ?? 0));
            $lockedUsedCount = max(0, (int)($lockedDiscount['usedCount'] ?? 0));
            $globalRedemptionsStmt = $pdo->prepare('SELECT COUNT(*) FROM pos_discount_redemptions WHERE discount_id = ? AND reversed_at IS NULL');
            $globalRedemptionsStmt->execute([$discountRecordId]);
            $globalRedemptions = (int)$globalRedemptionsStmt->fetchColumn();
            $authoritativeUsedCount = max($lockedUsedCount, $globalRedemptions);
            if ($lockedMaxUses > 0 && $authoritativeUsedCount >= $lockedMaxUses) {
                $pdo->rollBack();
                json_response(['ok' => false, 'error' => 'discount_limit_reached', 'message' => 'آخرین سهمیه این کد هم‌زمان مصرف شد'], 409);
            }
            $lockedPerCustomer = max(0, (int)($lockedDiscount['perCustomer'] ?? 0));
            if ($lockedPerCustomer > 0 && $customerId !== '') {
                $usageStmt = $pdo->prepare('SELECT COUNT(*) FROM pos_discount_redemptions WHERE discount_id = ? AND customer_id = ? AND reversed_at IS NULL');
                $usageStmt->execute([$discountRecordId, $customerId]);
                if ((int)$usageStmt->fetchColumn() >= $lockedPerCustomer) {
                    $pdo->rollBack();
                    json_response(['ok' => false, 'error' => 'discount_customer_limit', 'message' => 'سهمیه استفاده این مشتری از کد تمام شده است'], 409);
                }
            }
            $lockedDiscount['usedCount'] = $authoritativeUsedCount + 1;
            $discountUpdate = $pdo->prepare("UPDATE pos_records SET payload = ?, updated_by = ? WHERE resource = 'discounts' AND id = ?");
            $discountUpdate->execute([json_encode($lockedDiscount, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR), (int)$actor['id'], $discountRecordId]);
        }

        // Lock ingredients in a stable order to reduce deadlocks between concurrent checkouts.
        ksort($ingredientNeeds, SORT_STRING);
        // Lock and deduct every recipe ingredient in the same transaction as order creation.
        $ingredientSelect = $pdo->prepare("SELECT payload FROM pos_records WHERE resource = 'ingredients' AND id = ? FOR UPDATE");
        $ingredientUpdate = $pdo->prepare("UPDATE pos_records SET payload = ?, updated_by = ? WHERE resource = 'ingredients' AND id = ?");
        foreach ($ingredientNeeds as $ingredientId => $needed) {
            $ingredientSelect->execute([$ingredientId]);
            $rawIngredient = $ingredientSelect->fetchColumn();
            $ingredient = is_string($rawIngredient) ? json_decode($rawIngredient, true) : null;
            if (!is_array($ingredient)) {
                $pdo->rollBack();
                json_response(['ok' => false, 'error' => 'ingredient_not_found', 'message' => 'یکی از مواد اولیه دستور محصول در انبار پیدا نشد'], 409);
            }
            $available = (float)($ingredient['stock'] ?? 0);
            if ($stockPolicy === 'block' && $available + 0.000001 < $needed) {
                $pdo->rollBack();
                json_response(['ok' => false, 'error' => 'insufficient_stock', 'message' => 'موجودی یکی از مواد اولیه کافی نیست: ' . (string)($ingredient['name'] ?? $ingredientId)], 409);
            }
            $ingredient['stock'] = round($available - $needed, 3);
            $ingredientUpdate->execute([
                json_encode($ingredient, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
                (int)$actor['id'],
                $ingredientId,
            ]);
        }

        // Serialize loyalty balance changes so two cashiers cannot spend the same points.
        if ($customerId !== '') {
            $customerLock = $pdo->prepare("SELECT payload FROM pos_records WHERE resource = 'customers' AND id = ? FOR UPDATE");
            $customerLock->execute([$customerId]);
            $rawCustomer = $customerLock->fetchColumn();
            $lockedCustomer = is_string($rawCustomer) ? json_decode($rawCustomer, true) : null;
            if (!is_array($lockedCustomer)) {
                $pdo->rollBack();
                json_response(['ok' => false, 'error' => 'customer_not_found', 'message' => 'مشتری انتخاب‌شده پیدا نشد؛ فهرست مشتریان را تازه‌سازی کنید'], 409);
            }
            $settingsStmt = $pdo->prepare("SELECT payload FROM pos_records WHERE resource = 'settings' AND id = 'main' LIMIT 1");
            $settingsStmt->execute();
            $rawSettings = $settingsStmt->fetchColumn();
            $settings = is_string($rawSettings) ? json_decode($rawSettings, true) : [];
            $tomanPerPoint = max(1, (int)($settings['tomanPerPoint'] ?? 1));
            $pointsPerToman = max(1, (int)($settings['pointsPerToman'] ?? 100000));
            $pointsToSpend = $pointsDiscount > 0 ? (int)ceil($pointsDiscount / $tomanPerPoint) : 0;
            $customerName = substr((string)($lockedCustomer['name'] ?? $customerName ?? ''), 0, 160);
            $customerPhone = substr((string)($lockedCustomer['phone'] ?? $customerPhone ?? ''), 0, 30);
            $currentPoints = max(0, (int)($lockedCustomer['points'] ?? 0));
            if ($currentPoints !== $customerPoints) {
                $pdo->rollBack();
                json_response(['ok' => false, 'error' => 'customer_changed_requote', 'message' => 'امتیاز یا سطح عضویت مشتری تغییر کرده است؛ سفارش را دوباره محاسبه کنید'], 409);
            }
            if ($pointsToSpend > $currentPoints || ($pointsToSpend * $tomanPerPoint) < $pointsDiscount) {
                $pdo->rollBack();
                json_response(['ok' => false, 'error' => 'insufficient_points', 'message' => 'امتیاز مشتری برای این تخفیف کافی نیست؛ اطلاعات مشتری را تازه‌سازی کنید'], 409);
            }
            $pointsEarned = (int)floor(((int)$totals['total']) / $pointsPerToman);
            $lockedCustomer['points'] = $currentPoints - $pointsToSpend + $pointsEarned;
            $lockedCustomer['totalSpent'] = (int)($lockedCustomer['totalSpent'] ?? 0) + (int)$totals['total'];
            $lockedCustomer['visits'] = (int)($lockedCustomer['visits'] ?? 0) + 1;
            $customerUpdate = $pdo->prepare("UPDATE pos_records SET payload = ?, updated_by = ? WHERE resource = 'customers' AND id = ?");
            $customerUpdate->execute([
                json_encode($lockedCustomer, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
                (int)$actor['id'],
                $customerId,
            ]);
        }

        $orderNumber = (int)$existingOrder['order_number'];
        $stmt = $pdo->prepare("UPDATE pos_orders SET customer_id = ?, customer_name = ?, customer_phone = ?, guest_name = ?, guest_phone = ?, payment_method = ?, points_used = ?, points_earned = ?, discount_code = ?, items = ?, totals = ?, note = ? WHERE id = ? AND status = 'new'");
        $stmt->execute([
            $customerId !== '' ? $customerId : null,
            $customerName,
            $customerPhone,
            $guestName,
            $guestPhone,
            $payment,
            $pointsToSpend,
            $pointsEarned,
            $discountCode !== '' ? $discountCode : null,
            json_encode($canonicalItems, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            json_encode($totals, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            isset($body['note']) ? substr((string)$body['note'], 0, 2000) : null,
            $id,
        ]);
        if ($stmt->rowCount() !== 1) {
            $verify = $pdo->prepare("SELECT status FROM pos_orders WHERE id = ? FOR UPDATE");
            $verify->execute([$id]);
            if ($verify->fetchColumn() !== 'new') throw new RuntimeException('Order is no longer editable');
        }
        if ($discountCode !== '' && $discountRecordId !== null) {
            if ($existingRedemptionId !== null) {
                $redemptionUpdate = $pdo->prepare('UPDATE pos_discount_redemptions SET discount_id = ?, code = ?, customer_id = ?, redeemed_at = NOW(), reversed_at = NULL WHERE id = ? AND order_id = ?');
                $redemptionUpdate->execute([$discountRecordId, $discountCode, $customerId !== '' ? $customerId : null, $existingRedemptionId, $id]);
            } else {
                $redemptionInsert = $pdo->prepare('INSERT INTO pos_discount_redemptions (order_id, discount_id, code, customer_id) VALUES (?, ?, ?, ?)');
                $redemptionInsert->execute([$id, $discountRecordId, $discountCode, $customerId !== '' ? $customerId : null]);
            }
        }

        // Persist the exact stock and loyalty effects so cancellation can reverse
        // them once, inside the same transaction as the status change.
        $effectInsert = $pdo->prepare('INSERT INTO pos_order_effects (order_id, effect_type, resource_id, quantity, points_spent, points_earned, money_delta, visits_delta) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), points_spent = VALUES(points_spent), points_earned = VALUES(points_earned), money_delta = VALUES(money_delta), visits_delta = VALUES(visits_delta), reversed_at = NULL, reversed_by = NULL');
        foreach ($ingredientNeeds as $ingredientId => $needed) {
            if ((float)$needed > 0) $effectInsert->execute([$id, 'ingredient', $ingredientId, round((float)$needed, 3), 0, 0, 0, 0]);
        }
        if ($customerId !== '') {
            $effectInsert->execute([$id, 'customer', $customerId, 0, $pointsToSpend, $pointsEarned, (int)$totals['total'], 1]);
        }
        audit($pdo, (int)$actor['id'], 'order_edited', 'order', (string)$id, ['order_number' => $orderNumber]);
        $pdo->commit();
        json_response(['ok' => true, 'order' => ['id' => (string)$id, 'orderNumber' => $orderNumber, 'status' => 'new', 'items' => $canonicalItems, 'totals' => $totals]]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        // A concurrent retry may win the unique idempotency key after our initial lookup.
        if ($idempotencyKey !== null && $e instanceof PDOException && (string)$e->getCode() === '23000') {
            $retryStmt = $pdo->prepare('SELECT id, order_number, status, items, totals, request_hash FROM pos_orders WHERE idempotency_key = ? LIMIT 1');
            $retryStmt->execute([$idempotencyKey]);
            $retry = $retryStmt->fetch();
            if (is_array($retry)) {
                if (!hash_equals((string)$retry['request_hash'], $requestHash)) {
                    json_response(['ok' => false, 'error' => 'idempotency_conflict', 'message' => 'این شناسه قبلاً برای سفارش دیگری استفاده شده است'], 409);
                }
                json_response(['ok' => true, 'replayed' => true, 'order' => [
                    'id' => (string)$retry['id'],
                    'orderNumber' => (int)$retry['order_number'],
                    'status' => (string)$retry['status'],
                    'items' => json_decode((string)$retry['items'], true) ?: [],
                    'totals' => json_decode((string)$retry['totals'], true) ?: [],
                ]]);
            }
        }
        error_log('[3Food POS] Order edit failed: ' . $e->getMessage());
        json_response(['ok' => false, 'error' => 'order_edit_failed', 'message' => 'ویرایش سفارش انجام نشد'], 500);
    }
}


if (preg_match('#^/orders/(\d+)/status$#', $path, $m) && $method === 'PATCH') {
    $actor = require_role($pdo, ['manager','kitchen']);
    require_csrf();
    $id = (int)$m[1];
    $body = request_json();
    $status = (string)($body['status'] ?? '');
    if (!in_array($status, ['new','preparing','ready','delivered','cancelled'], true)) json_response(['ok' => false, 'error' => 'invalid_status'], 422);
    // Serialize status changes and enforce a one-way kitchen workflow.
    // A row lock prevents two devices from advancing the same order concurrently.
    try {
        $pdo->beginTransaction();
        $orderStmt = $pdo->prepare('SELECT status, payment_method FROM pos_orders WHERE id = ? FOR UPDATE');
        $orderStmt->execute([$id]);
        $currentOrder = $orderStmt->fetch();
        if (!is_array($currentOrder)) {
            $pdo->rollBack();
            json_response(['ok' => false, 'error' => 'order_not_found'], 404);
        }
        $currentStatus = (string)$currentOrder['status'];
        $currentPaymentMethod = (string)($currentOrder['payment_method'] ?? 'cash');
        if ($status === 'cancelled' && in_array($currentPaymentMethod, ['card','online'], true)) {
            $pdo->rollBack();
            json_response(['ok' => false, 'error' => 'payment_reconciliation_required', 'message' => 'لغو سفارش پرداخت‌شده بدون تعیین‌تکلیف تراکنش و بازپرداخت مجاز نیست'], 409);
        }

        $transitions = [
            'new' => ['preparing', 'cancelled'],
            'preparing' => ['ready', 'cancelled'],
            'ready' => ['delivered', 'cancelled'],
            'delivered' => [],
            'cancelled' => [],
        ];
        if (!in_array($status, $transitions[(string)$currentStatus] ?? [], true)) {
            $pdo->rollBack();
            json_response([
                'ok' => false,
                'error' => 'invalid_status_transition',
                'message' => 'تغییر وضعیت سفارش از وضعیت فعلی مجاز نیست',
            ], 409);
        }
        if ($actor['role'] === 'kitchen' && $status === 'cancelled') {
            $pdo->rollBack();
            json_response(['ok' => false, 'error' => 'forbidden'], 403);
        }

        if ($status === 'cancelled') {
            $redemptionStmt = $pdo->prepare('SELECT id, discount_id FROM pos_discount_redemptions WHERE order_id = ? AND reversed_at IS NULL FOR UPDATE');
            $redemptionStmt->execute([$id]);
            $redemption = $redemptionStmt->fetch();
            if (is_array($redemption)) {
                $couponLock = $pdo->prepare("SELECT payload FROM pos_records WHERE resource = 'discounts' AND id = ? FOR UPDATE");
                $couponLock->execute([(string)$redemption['discount_id']]);
                $couponRaw = $couponLock->fetchColumn();
                $coupon = is_string($couponRaw) ? json_decode($couponRaw, true) : null;
                if (is_array($coupon)) {
                    $coupon['usedCount'] = max(0, (int)($coupon['usedCount'] ?? 0) - 1);
                    $couponUpdate = $pdo->prepare("UPDATE pos_records SET payload = ?, updated_by = ? WHERE resource = 'discounts' AND id = ?");
                    $couponUpdate->execute([json_encode($coupon, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR), (int)$actor['id'], (string)$redemption['discount_id']]);
                }
                $markRedemption = $pdo->prepare('UPDATE pos_discount_redemptions SET reversed_at = NOW() WHERE id = ? AND reversed_at IS NULL');
                $markRedemption->execute([(int)$redemption['id']]);
            }
            // Reverse only effects recorded for this order. FOR UPDATE plus the
            // order-row lock and reversed_at guard make this operation one-shot.
            $effectsStmt = $pdo->prepare('SELECT id, effect_type, resource_id, quantity, points_spent, points_earned, money_delta, visits_delta FROM pos_order_effects WHERE order_id = ? AND reversed_at IS NULL ORDER BY effect_type, resource_id FOR UPDATE');
            $effectsStmt->execute([$id]);
            $effects = $effectsStmt->fetchAll();
            $ingredientQuantities = [];
            foreach ($effects as $effect) {
                if ($effect['effect_type'] !== 'ingredient') continue;
                $ingredientId = (string)$effect['resource_id'];
                $ingredientQuantities[$ingredientId] = ($ingredientQuantities[$ingredientId] ?? 0.0) + (float)$effect['quantity'];
            }
            $ingredientIds = array_keys($ingredientQuantities);
            sort($ingredientIds, SORT_STRING);
            $ingredientSelect = $pdo->prepare("SELECT payload FROM pos_records WHERE resource = 'ingredients' AND id = ? FOR UPDATE");
            $ingredientUpdate = $pdo->prepare("UPDATE pos_records SET payload = ?, updated_by = ? WHERE resource = 'ingredients' AND id = ?");
            foreach ($ingredientIds as $ingredientId) {
                $ingredientSelect->execute([$ingredientId]);
                $rawIngredient = $ingredientSelect->fetchColumn();
                $ingredient = is_string($rawIngredient) ? json_decode($rawIngredient, true) : null;
                if (!is_array($ingredient)) throw new RuntimeException('Ingredient missing while reversing order ' . $id);
                // An order may consume the same ingredient through multiple products
                // or recipe lines. Restore the full aggregated quantity exactly once.
                $restoredStock = round((float)($ingredient['stock'] ?? 0) + $ingredientQuantities[$ingredientId], 3);
                if (!is_finite($restoredStock) || $restoredStock < 0 || $restoredStock > 1000000000) {
                    throw new RuntimeException('Invalid ingredient stock while reversing order ' . $id);
                }
                $ingredient['stock'] = $restoredStock;
                $ingredientUpdate->execute([json_encode($ingredient, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR), (int)$actor['id'], $ingredientId]);
            }
            $customerEffects = array_values(array_filter($effects, static fn(array $effect): bool => $effect['effect_type'] === 'customer'));
            foreach ($customerEffects as $effect) {
                $customerLock = $pdo->prepare("SELECT payload FROM pos_records WHERE resource = 'customers' AND id = ? FOR UPDATE");
                $customerLock->execute([(string)$effect['resource_id']]);
                $rawCustomer = $customerLock->fetchColumn();
                $customer = is_string($rawCustomer) ? json_decode($rawCustomer, true) : null;
                if (!is_array($customer)) throw new RuntimeException('Customer missing while reversing order ' . $id);
                $restoredPoints = (int)($customer['points'] ?? 0) + (int)$effect['points_spent'];
                if ($restoredPoints < (int)$effect['points_earned']) {
                    $pdo->rollBack();
                    json_response(['ok' => false, 'error' => 'loyalty_points_already_spent', 'message' => 'امتیاز حاصل از این سفارش قبلاً خرج شده است؛ برای جلوگیری از منفی‌شدن موجودی امتیاز، ابتدا حساب مشتری را بررسی کنید'], 409);
                }
                $customer['points'] = $restoredPoints - (int)$effect['points_earned'];
                $customer['totalSpent'] = max(0, (int)($customer['totalSpent'] ?? 0) - (int)$effect['money_delta']);
                $customer['visits'] = max(0, (int)($customer['visits'] ?? 0) - (int)$effect['visits_delta']);
                $customerUpdate = $pdo->prepare("UPDATE pos_records SET payload = ?, updated_by = ? WHERE resource = 'customers' AND id = ?");
                $customerUpdate->execute([json_encode($customer, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR), (int)$actor['id'], (string)$effect['resource_id']]);
            }
            if ($effects) {
                $effectIds = array_map(static fn(array $effect): int => (int)$effect['id'], $effects);
                $marks = implode(',', array_fill(0, count($effectIds), '?'));
                $markStmt = $pdo->prepare("UPDATE pos_order_effects SET reversed_at = NOW(), reversed_by = ? WHERE id IN ($marks) AND reversed_at IS NULL");
                $markStmt->execute(array_merge([(int)$actor['id']], $effectIds));
            }
        }



        $update = $pdo->prepare('UPDATE pos_orders SET status = ?, updated_at = NOW() WHERE id = ?');
        $update->execute([$status, $id]);
        audit($pdo, (int)$actor['id'], 'order_status_changed', 'order', (string)$id, [
            'from' => (string)$currentStatus,
            'to' => $status,
        ]);
        $pdo->commit();
        json_response(['ok' => true, 'status' => $status]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('[3Food POS] Order status update failed: ' . $e->getMessage());
        json_response(['ok' => false, 'error' => 'order_status_update_failed', 'message' => 'تغییر وضعیت سفارش انجام نشد'], 500);
    }
}


