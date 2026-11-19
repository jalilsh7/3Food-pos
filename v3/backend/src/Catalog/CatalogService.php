<?php
declare(strict_types=1);

namespace PersiaCoder\PosV3\Catalog;

use PDO;
use PersiaCoder\PosV3\Auth\AuthenticatedPrincipal;
use PersiaCoder\PosV3\Auth\BusinessScope;
use PersiaCoder\PosV3\Http\HttpException;
use PersiaCoder\PosV3\Infrastructure\Database\AuditLogRepository;
use PersiaCoder\PosV3\Infrastructure\Database\CatalogRepository;
use PersiaCoder\PosV3\Security\AuditLogService;
use PersiaCoder\PosV3\Security\IdempotencyService;

final readonly class CatalogService
{
    private CatalogRepository $catalog;
    private IdempotencyService $idempotency;
    private AuditLogService $audit;

    public function __construct(PDO $connection, string $applicationKey)
    {
        $this->catalog = new CatalogRepository($connection);
        $this->idempotency = new IdempotencyService($connection, $applicationKey);
        $this->audit = new AuditLogService(new AuditLogRepository($connection));
    }

    public function listCategories(BusinessScope $scope): array
    {
        return $this->catalog->listCategories($scope->businessId);
    }

    public function listProducts(
        BusinessScope $scope,
        ?string $search,
        ?string $categoryPublicId,
        int $limit,
    ): array {
        if ($search !== null && self::unicodeLength($search) > 100) {
            throw new HttpException(422, 'catalog_search_too_long', 'Search text must not exceed 100 characters.');
        }
        if ($categoryPublicId !== null && !self::isUuid($categoryPublicId)) {
            throw new HttpException(422, 'category_id_invalid', 'The category identifier is invalid.');
        }
        if ($limit < 1 || $limit > 100) {
            throw new HttpException(422, 'catalog_limit_invalid', 'The catalog page size must be between 1 and 100.');
        }
        return $this->catalog->listProducts($scope->businessId, $search, $categoryPublicId, $limit);
    }

    /** @param array<string,mixed> $payload @return array{status:int,body:array<string,mixed>,replayed:bool} */
    public function createCategory(
        AuthenticatedPrincipal $actor,
        BusinessScope $scope,
        array $payload,
        string $idempotencyKey,
        string $requestId,
        string $ipAddress,
    ): array {
        $name = trim((string) ($payload['name'] ?? ''));
        if ($name === '' || self::unicodeLength($name) > 120) {
            throw new HttpException(422, 'category_name_invalid', 'Category name is required and must not exceed 120 characters.');
        }
        $parentPublicId = $payload['parent_id'] ?? null;
        if ($parentPublicId !== null && (!is_string($parentPublicId) || !self::isUuid($parentPublicId))) {
            throw new HttpException(422, 'category_parent_invalid', 'The parent category identifier is invalid.');
        }
        $sortOrder = $payload['sort_order'] ?? 0;
        if (!is_int($sortOrder) || $sortOrder < -100000 || $sortOrder > 100000) {
            throw new HttpException(422, 'category_sort_order_invalid', 'Category sort_order must be an integer within the allowed range.');
        }
        $parentId = $parentPublicId === null ? null : $this->catalog->findCategoryIdByPublicId($scope->businessId, $parentPublicId);
        if ($parentPublicId !== null && $parentId === null) {
            throw new HttpException(404, 'category_parent_not_found', 'The parent category was not found in this business.');
        }

        $publicId = self::uuidV4();
        $fingerprint = hash('sha256', json_encode([
            'name' => $name,
            'parent_id' => $parentPublicId,
            'sort_order' => $sortOrder,
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        $result = $this->idempotency->execute(
            $actor->userId,
            $scope,
            'catalog.category.create',
            $idempotencyKey,
            $fingerprint,
            function (PDO $connection) use (
                $scope, $publicId, $name, $parentId, $sortOrder, $actor, $requestId, $ipAddress,
            ): array {
                $this->catalog->createCategory($scope->businessId, $publicId, $name, $parentId, $sortOrder);
                $this->audit->record(
                    $actor->userId,
                    'catalog.category.created',
                    'category',
                    $publicId,
                    null,
                    ['name' => $name, 'parent_id' => $parentId, 'sort_order' => $sortOrder],
                    null,
                    $requestId,
                    $ipAddress,
                    $scope->businessId,
                );
                return [
                    'status' => 201,
                    'body' => ['data' => ['category' => [
                        'id' => $publicId, 'name' => $name, 'parent_id' => $parentPublicId,
                        'sort_order' => $sortOrder, 'is_active' => true,
                    ]], 'meta' => (object) []],
                ];
            },
        );
        return $result;
    }

    /** @param array<string,mixed> $payload @return array{status:int,body:array<string,mixed>,replayed:bool} */
    public function createProduct(
        AuthenticatedPrincipal $actor,
        BusinessScope $scope,
        array $payload,
        string $idempotencyKey,
        string $requestId,
        string $ipAddress,
    ): array {
        $name = trim((string) ($payload['name'] ?? ''));
        if ($name === '' || self::unicodeLength($name) > 180) {
            throw new HttpException(422, 'product_name_invalid', 'Product name is required and must not exceed 180 characters.');
        }
        $sku = $payload['sku'] ?? null;
        if ($sku !== null && (!is_string($sku) || !preg_match('/^[A-Za-z0-9._-]{1,80}$/', $sku))) {
            throw new HttpException(422, 'product_sku_invalid', 'SKU must contain at most 80 letters, digits, dots, underscores or hyphens.');
        }
        $productType = $payload['product_type'] ?? 'prepared';
        if (!is_string($productType) || !in_array($productType, ['prepared','packaged','ingredient','service'], true)) {
            throw new HttpException(422, 'product_type_invalid', 'The product type is not supported.');
        }
        $price = $payload['base_price_amount'] ?? null;
        if (!is_int($price) || $price < 0 || $price > 9000000000000000) {
            throw new HttpException(422, 'product_price_invalid', 'base_price_amount must be a non-negative integer in the supported range.');
        }
        $taxRate = $payload['tax_rate_bps'] ?? 0;
        if (!is_int($taxRate) || $taxRate < 0 || $taxRate > 10000) {
            throw new HttpException(422, 'product_tax_invalid', 'tax_rate_bps must be an integer between 0 and 10000.');
        }
        $categoryPublicId = $payload['category_id'] ?? null;
        if ($categoryPublicId !== null && (!is_string($categoryPublicId) || !self::isUuid($categoryPublicId))) {
            throw new HttpException(422, 'product_category_invalid', 'The category identifier is invalid.');
        }
        $categoryId = $categoryPublicId === null ? null : $this->catalog->findCategoryIdByPublicId($scope->businessId, $categoryPublicId);
        if ($categoryPublicId !== null && $categoryId === null) {
            throw new HttpException(404, 'product_category_not_found', 'The category was not found in this business.');
        }
        $publicId = self::uuidV4();
        $fingerprint = hash('sha256', json_encode([
            'name' => $name,
            'sku' => $sku,
            'product_type' => $productType,
            'base_price_amount' => $price,
            'tax_rate_bps' => $taxRate,
            'category_id' => $categoryPublicId,
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        return $this->idempotency->execute(
            $actor->userId,
            $scope,
            'catalog.product.create',
            $idempotencyKey,
            $fingerprint,
            function (PDO $connection) use (
                $scope, $publicId, $categoryId, $name, $sku, $productType, $price, $taxRate, $categoryPublicId,
                $actor, $requestId, $ipAddress,
            ): array {
                if ($sku !== null && $this->catalog->findProductBySku($scope->businessId, $sku)) {
                    throw new HttpException(409, 'product_sku_exists', 'A product with this SKU already exists in this business.');
                }
                $this->catalog->createProduct(
                    $scope->businessId, $publicId, $categoryId, $name, $sku, $productType, $price, $taxRate,
                );
                $this->audit->record(
                    $actor->userId,
                    'catalog.product.created',
                    'product',
                    $publicId,
                    null,
                    [
                        'name' => $name, 'sku' => $sku, 'product_type' => $productType,
                        'base_price_amount' => $price, 'tax_rate_bps' => $taxRate,
                        'category_id' => $categoryPublicId,
                    ],
                    null,
                    $requestId,
                    $ipAddress,
                    $scope->businessId,
                );
                return [
                    'status' => 201,
                    'body' => ['data' => ['product' => [
                        'id' => $publicId, 'name' => $name, 'sku' => $sku, 'product_type' => $productType,
                        'base_price_amount' => $price, 'tax_rate_bps' => $taxRate,
                        'category_id' => $categoryPublicId, 'is_active' => true,
                    ]], 'meta' => (object) []],
                ];
            },
        );
    }

    private static function unicodeLength(string $value): int
    {
        $count = preg_match_all('/./us', $value);
        return $count === false ? PHP_INT_MAX : $count;
    }

    private static function isUuid(string $value): bool
    {
        return preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $value) === 1;
    }

    private static function uuidV4(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        $hex = bin2hex($bytes);
        return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-'
            . substr($hex, 12, 4) . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20);
    }

    public function productDetails(BusinessScope $scope, string $publicId): array
    {
        if (!self::isUuid($publicId)) throw new HttpException(422, 'product_id_invalid', 'The product identifier is invalid.');
        $id = $this->catalog->findProductIdByPublicId($scope->businessId, $publicId);
        if ($id === null) throw new HttpException(404, 'product_not_found', 'The product was not found.');
        return $this->catalog->productDetails($scope->businessId, $id) ?? [];
    }

    public function createVariant(AuthenticatedPrincipal $actor, BusinessScope $scope, string $productPublicId, array $payload, string $key, string $requestId, string $ip): array
    {
        $productId = $this->catalog->findProductIdByPublicId($scope->businessId, $productPublicId);
        $name = trim((string)($payload['name'] ?? '')); $sku = $payload['sku'] ?? null; $delta = $payload['price_delta_amount'] ?? null;
        if ($productId === null) throw new HttpException(404, 'product_not_found', 'The product was not found.');
        if (!self::isUuid($productPublicId) || $name === '' || self::unicodeLength($name)>140) throw new HttpException(422, 'variant_invalid', 'Variant product or name is invalid.');
        if ($sku !== null && (!is_string($sku) || !preg_match('/^[A-Za-z0-9._-]{1,80}$/',$sku))) throw new HttpException(422, 'variant_sku_invalid', 'Variant SKU is invalid.');
        if (!is_int($delta) || $delta < -9000000000000000 || $delta > 9000000000000000) throw new HttpException(422, 'variant_price_invalid', 'Variant price delta is invalid.');
        $id = self::uuidV4(); $fp = hash('sha256', json_encode([$productPublicId,$name,$sku,$delta], JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE));
        return $this->idempotency->execute($actor->userId,$scope,'catalog.variant.create',$key,$fp,function(PDO $db) use($scope,$productId,$id,$name,$sku,$delta,$actor,$requestId,$ip): array {
            $this->catalog->createVariant($scope->businessId,$productId,$id,$name,$sku,$delta);
            $this->audit->record($actor->userId,'catalog.variant.created','product_variant',$id,null,['name'=>$name,'sku'=>$sku,'price_delta_amount'=>$delta],null,$requestId,$ip,$scope->businessId);
            return ['status'=>201,'body'=>['data'=>['variant'=>['id'=>$id,'name'=>$name,'sku'=>$sku,'price_delta_amount'=>$delta,'is_active'=>true]],'meta'=>(object)[]]];
        });
    }

    public function createOptionGroup(AuthenticatedPrincipal $actor, BusinessScope $scope, array $payload, string $key, string $requestId, string $ip): array
    {
        $name=trim((string)($payload['name']??'')); $type=$payload['selection_type']??'multiple'; $min=$payload['min_select']??0; $max=$payload['max_select']??1; $required=$payload['is_required_default']??false; $items=$payload['options']??null;
        if($name===''||self::unicodeLength($name)>140) throw new HttpException(422,'option_group_name_invalid','Option group name is invalid.');
        if(!is_string($type)||!in_array($type,['single','multiple'],true)||!is_int($min)||!is_int($max)||$min<0||$max<1||$max<$min||$max>100||($type==='single'&&$max>1)) throw new HttpException(422,'option_group_rules_invalid','Option group selection rules are invalid.');
        if(!is_bool($required)||!is_array($items)||count($items)<1||count($items)>100||($required&&$min<1)) throw new HttpException(422,'option_group_options_invalid','Required flag or option list is invalid.');
        $options=[];
        foreach($items as $item){ if(!is_array($item)||!is_string($item['name']??null)) throw new HttpException(422,'option_invalid','Each option requires a name.');
            $n=trim($item['name']);$p=$item['price_delta_amount']??0;
            if($n===''||self::unicodeLength($n)>140||!is_int($p)||$p < -9000000000000000||$p>9000000000000000) throw new HttpException(422,'option_invalid','Option name or price delta is invalid.');
            $options[]=['id'=>self::uuidV4(),'name'=>$n,'price_delta_amount'=>$p];
        }
        if($max>count($options)) throw new HttpException(422,'option_group_max_invalid','max_select cannot exceed the number of options.');
        $id=self::uuidV4();$fp=hash('sha256',json_encode([$name,$type,$min,$max,$required,array_map(static fn($o)=>[$o['name'],$o['price_delta_amount']],$options)],JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE));
        return $this->idempotency->execute($actor->userId,$scope,'catalog.option-group.create',$key,$fp,function(PDO $db) use($scope,$id,$name,$type,$min,$max,$required,$options,$actor,$requestId,$ip): array {
            $this->catalog->createOptionGroup($scope->businessId,$id,$name,$type,$min,$max,$required,$options);
            $this->audit->record($actor->userId,'catalog.option_group.created','option_group',$id,null,['name'=>$name,'selection_type'=>$type,'min_select'=>$min,'max_select'=>$max,'is_required_default'=>$required,'options'=>array_map(static fn($o)=>['name'=>$o['name'],'price_delta_amount'=>$o['price_delta_amount']],$options)],null,$requestId,$ip,$scope->businessId);
            return ['status'=>201,'body'=>['data'=>['option_group'=>['id'=>$id,'name'=>$name,'selection_type'=>$type,'min_select'=>$min,'max_select'=>$max,'is_required_default'=>$required,'options'=>$options]],'meta'=>(object)[]]];
        });
    }

    public function attachOptionGroup(AuthenticatedPrincipal $actor, BusinessScope $scope, string $productPublicId, array $payload, string $key, string $requestId, string $ip): array
    {
        $productId=$this->catalog->findProductIdByPublicId($scope->businessId,$productPublicId);$groupPublicId=$payload['option_group_id']??null;$sort=$payload['sort_order']??0;$required=$payload['is_required']??null;
        if($productId===null) throw new HttpException(404,'product_not_found','The product was not found.');
        if(!is_string($groupPublicId)||!self::isUuid($groupPublicId)||!is_int($sort)||$sort < -100000||$sort>100000||!is_bool($required)) throw new HttpException(422,'option_group_link_invalid','Option group link fields are invalid.');
        $groupId=$this->catalog->findOptionGroupId($scope->businessId,$groupPublicId);
        if($groupId===null) throw new HttpException(404,'option_group_not_found','The option group was not found in this business.');
        $fp=hash('sha256',json_encode([$productPublicId,$groupPublicId,$sort,$required],JSON_THROW_ON_ERROR));
        return $this->idempotency->execute($actor->userId,$scope,'catalog.product.option-group.attach',$key,$fp,function(PDO $db) use($scope,$productId,$groupId,$groupPublicId,$sort,$required,$actor,$requestId,$ip,$productPublicId): array {
            if($this->catalog->productHasOptionGroup($scope->businessId,$productId,$groupId)) throw new HttpException(409,'option_group_already_attached','This option group is already attached.');
            $this->catalog->attachOptionGroup($scope->businessId,$productId,$groupId,$sort,$required);
            $this->audit->record($actor->userId,'catalog.product.option_group_attached','product',$productPublicId,null,['option_group_id'=>$groupPublicId,'sort_order'=>$sort,'is_required'=>$required],null,$requestId,$ip,$scope->businessId);
            return ['status'=>201,'body'=>['data'=>['attached'=>true,'option_group_id'=>$groupPublicId],'meta'=>(object)[]]];
        });
    }



}
