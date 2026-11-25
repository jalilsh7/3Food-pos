<?php
declare(strict_types=1);

/**
 * Domain ownership registry for V3 schema migrations.
 * Keys are immutable migration versions (filename without .sql).
 */
return [
    '001_create-user-sessions' => [
        'owner' => 'Auth',
        'depends_on' => [],
        'tables' => ['app_user_sessions'],
        'risk' => 'low',
    ],
    '002_create-auth-login-attempts' => [
        'owner' => 'Security',
        'depends_on' => [],
        'tables' => ['app_auth_login_attempts'],
        'risk' => 'low',
    ],
    '003_create-business-scope-and-rbac' => [
        'owner' => 'Auth',
        'depends_on' => [],
        'tables' => ['pos_businesses', 'app_business_setup_state', 'pos_branches', 'app_user_business_roles', 'app_user_branch_roles'],
        'risk' => 'medium',
    ],
    '004_create-idempotency-keys' => [
        'owner' => 'Security',
        'depends_on' => ['003_create-business-scope-and-rbac'],
        'tables' => ['app_idempotency_keys'],
        'risk' => 'low',
    ],
    '005_add-audit-business-scope' => [
        'owner' => 'Security',
        'depends_on' => ['003_create-business-scope-and-rbac'],
        'tables' => ['app_audit_logs', 'pos_branches'],
        'risk' => 'medium',
    ],
    '006_scope-catalog-and-customers' => [
        'owner' => 'Catalog',
        'depends_on' => ['003_create-business-scope-and-rbac'],
        'tables' => ['pos_categories', 'pos_products', 'pos_product_variants', 'pos_option_groups', 'pos_options', 'pos_product_option_groups', 'pos_customers'],
        'risk' => 'medium',
    ],
    '007_catalog-variants-and-options' => [
        'owner' => 'Catalog',
        'depends_on' => ['006_scope-catalog-and-customers'],
        'tables' => ['pos_product_variants', 'pos_option_groups', 'pos_options', 'pos_product_option_groups'],
        'risk' => 'medium',
    ],
    '008_scope-orders-and-service-areas' => [
        'owner' => 'Orders',
        'depends_on' => ['003_create-business-scope-and-rbac', '006_scope-catalog-and-customers', '007_catalog-variants-and-options'],
        'tables' => ['pos_dining_areas', 'pos_dining_tables', 'pos_table_sessions', 'pos_preparation_stations', 'pos_orders', 'pos_order_items', 'pos_order_item_options', 'pos_order_status_events', 'pos_order_fulfillments', 'pos_order_item_preparations', 'pos_order_adjustments', 'pos_order_item_recipe_lines'],
        'risk' => 'high',
    ],
    '009_scope-payments-and-cash' => [
        'owner' => 'Finance',
        'depends_on' => ['003_create-business-scope-and-rbac', '008_scope-orders-and-service-areas'],
        'tables' => ['pos_payment_terminals', 'pos_terminal_transactions', 'pos_payments', 'pos_payment_events', 'pos_refunds', 'pos_registers', 'pos_cash_sessions', 'pos_expense_categories', 'pos_expenses', 'pos_cash_movements'],
        'risk' => 'high',
    ],
    '010_private-media-assets' => [
        'owner' => 'Media',
        'depends_on' => ['003_create-business-scope-and-rbac', '006_scope-catalog-and-customers'],
        'tables' => ['pos_media_assets', 'pos_product_media', 'pos_category_media'],
        'risk' => 'medium',
    ],
    '011_scope-inventory-and-recipes' => [
        'owner' => 'Inventory',
        'depends_on' => ['003_create-business-scope-and-rbac', '006_scope-catalog-and-customers', '007_catalog-variants-and-options', '008_scope-orders-and-service-areas'],
        'tables' => ['pos_stock_items', 'pos_stock_locations', 'pos_suppliers', 'pos_stock_documents', 'pos_stock_document_lines', 'pos_stock_ledger', 'pos_stock_balances', 'pos_stock_reservations', 'pos_stock_reservation_lines', 'pos_product_variants', 'pos_recipes', 'pos_recipe_versions', 'pos_order_items', 'pos_recipe_lines', 'pos_order_item_recipe_lines'],
        'risk' => 'high',
    ],
    '012_stock-document-line-public-ids' => [
        'owner' => 'Inventory',
        'depends_on' => ['011_scope-inventory-and-recipes'],
        'tables' => ['pos_stock_document_lines'],
        'risk' => 'medium',
    ],
];
