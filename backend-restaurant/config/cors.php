<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [
        env('FRONTEND_URL', 'https://dishy.phoenixtech.web.id'),
        'https://dishy.phoenixtech.web.id',
        'http://localhost:3000',
        'http://localhost',
    ],

    'allowed_origins_patterns' => [
        '#^https?://.*\.phoenixtech\.web\.id$#',
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 86400,

    'supports_credentials' => true,
];
