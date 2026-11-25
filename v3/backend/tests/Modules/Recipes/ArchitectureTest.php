<?php
declare(strict_types=1);

return [
    'module' => 'Recipes',
    'required' => ['src/Recipes/RecipeService.php', 'src/Recipes/RecipeApplication.php', 'src/Recipes/RecipeStore.php', 'src/Infrastructure/Database/RecipeRepository.php'],
    'services' => ['src/Recipes/RecipeService.php'],
    'forbidden' => ['use PDO;', 'Infrastructure', 'Auth', 'Http'],
    'contains' => [],
    'checks' => [
        ['src/Recipes/RecipeService.php', ['implements RecipeApplication'], []],
        ['src/Recipes/RecipeController.php', ['RecipeApplication $recipes'], []],
        ['src/Recipes/RecipeApplication.php', ['interface RecipeApplication'], ['$this->']],
    ],
];
