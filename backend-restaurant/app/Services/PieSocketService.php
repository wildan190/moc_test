<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PieSocketService
{
    protected ?string $clusterId;
    protected ?string $apiKey;
    protected ?string $apiSecret;
    protected string $channelId;

    public function __construct()
    {
        $this->clusterId = config('services.piesocket.cluster_id', env('PIESOCKET_CLUSTER_ID', 'free.blr2'));
        $this->apiKey = config('services.piesocket.api_key', env('PIESOCKET_API_KEY'));
        $this->apiSecret = config('services.piesocket.api_secret', env('PIESOCKET_API_SECRET'));
        $this->channelId = config('services.piesocket.channel_id', env('PIESOCKET_CHANNEL_ID', '1'));
    }

    /**
     * Broadcast an event message to PieSocket channel.
     *
     * @param string $event Event name (e.g. queue_updated, table_seated, table_served)
     * @param array $data Arbitrary payload
     * @return bool
     */
    public function broadcast(string $event, array $data = []): bool
    {
        if (empty($this->apiKey) || empty($this->apiSecret)) {
            Log::warning('[PieSocket] Missing API key or Secret. Skipping broadcast.');
            return false;
        }

        $url = "https://{$this->clusterId}.piesocket.com/api/v3/publish";

        $payload = [
            'key' => $this->apiKey,
            'secret' => $this->apiSecret,
            'channelId' => (int) $this->channelId,
            'message' => json_encode([
                'event' => $event,
                'data' => $data,
                'timestamp' => microtime(true)
            ])
        ];

        try {
            $response = Http::timeout(4)->post($url, $payload);
            if ($response->successful()) {
                Log::info("[PieSocket] Broadcast sent successfully: {$event}");
                return true;
            } else {
                Log::error("[PieSocket] Publish failed with status: {$response->status()}", [
                    'body' => $response->body()
                ]);
                return false;
            }
        } catch (\Throwable $e) {
            Log::error("[PieSocket] Connection error: " . $e->getMessage());
            return false;
        }
    }
}
