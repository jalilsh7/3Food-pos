<?php
// Order route module loaded in the shared API dispatcher scope.
if (preg_match('#^/orders/(\d+)/status$#', $path, $m) && $method === 'PATCH') {
    $actor = require_role($pdo, ['manager','cashier','kitchen']);
    require_csrf();
    $id = (int)$m[1];
    $body = request_json();
    $status = (string)($body['status'] ?? '');
    if (!in_array($status, ['new','preparing','ready','dispatched','delivered','cancelled'], true)) json_response(['ok' => false, 'error' => 'invalid_status'], 422);
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
        // Cashiers and kitchen staff share the limited preparation workflow.
        // The manager alone may deliver or cancel orders.
        if (in_array($actor['role'], ['cashier', 'kitchen'], true) && !in_array($status, ['preparing', 'ready'], true)) {
            $pdo->rollBack();
            json_response(['ok' => false, 'error' => 'forbidden', 'message' => 'این نقش فقط مجاز به شروع آماده‌سازی و اعلام آماده‌شدن سفارش است'], 403);
        }
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
        if ($status === $currentStatus) {
            $pdo->rollBack();
            json_response(['ok' => true, 'status' => $currentStatus, 'unchanged' => true]);
        }
        $transitions = [
            'new' => ['preparing', 'ready', 'dispatched', 'delivered', 'cancelled'],
            'preparing' => ['ready', 'dispatched', 'delivered', 'cancelled'],
            'ready' => ['dispatched', 'delivered', 'cancelled'],
            'dispatched' => ['delivered', 'cancelled'],
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
                // Negative stock is a valid shortage signal in V2. Cancellation must
                // restore this order's quantity even if other sales leave stock below zero.
                if (!is_finite($restoredStock) || $restoredStock > 1000000000 || $restoredStock < -1000000000) {
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
