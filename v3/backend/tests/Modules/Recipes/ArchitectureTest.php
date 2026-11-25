<?php
declare(strict_types=1);

return [
    'module' => 'Recipes',
    'required' => ["src/Recipes/RecipeService.php","src/Recipes/RecipeStore.php","src/Infrastructure/Database/RecipeRepository.php"],
    'services' => ["src/Recipes/RecipeService.php"],
    'forbidden' => ["use PDO;","Infrastructure\\\\Database","\\\\Auth\\\\","\\\\Http\\\\"],
];
