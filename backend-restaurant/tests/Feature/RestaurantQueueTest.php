<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\Table;
use App\Models\QueueMember;
use Illuminate\Foundation\Testing\RefreshDatabase;

class RestaurantQueueTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Seed default tables A, B, C, D
        $this->seed(\Database\Seeders\TableSeeder::class);
    }

    public function test_it_validates_arrival_inputs()
    {
        $response = $this->postJson('/api/arrive', [
            'customer_name' => '',
            'party_size' => 10, // Max size is 8
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['customer_name', 'party_size']);
    }

    public function test_it_seats_party_directly_at_matching_table()
    {
        // Party of 2 arrives, Table A has capacity 2, it should get seated immediately
        $response = $this->postJson('/api/arrive', [
            'customer_name' => 'Alice',
            'party_size' => 2,
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('queue_members', [
            'customer_name' => 'Alice',
            'party_size' => 2,
            'status' => 'seated'
        ]);

        $this->assertDatabaseHas('tables', [
            'id' => 'A',
            'status' => 'dining'
        ]);
    }

    public function test_it_seats_party_at_next_closest_table_if_exact_is_full()
    {
        // Seat Table A first
        $this->postJson('/api/arrive', [
            'customer_name' => 'Alice',
            'party_size' => 2,
        ]);

        // Another party of 2 arrives. Table A is occupied, so it should seat at Table B (capacity 4)
        $response = $this->postJson('/api/arrive', [
            'customer_name' => 'Bob',
            'party_size' => 2,
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('tables', [
            'id' => 'B',
            'status' => 'dining'
        ]);
    }

    public function test_it_sends_party_to_waiting_queue_if_no_tables_available()
    {
        // Occupy all tables
        $this->postJson('/api/arrive', [
            'customer_name' => 'P1',
            'party_size' => 2, // Seats A
        ]);
        $this->postJson('/api/arrive', [
            'customer_name' => 'P2',
            'party_size' => 4, // Seats B
        ]);
        $this->postJson('/api/arrive', [
            'customer_name' => 'P3',
            'party_size' => 6, // Seats C
        ]);
        $this->postJson('/api/arrive', [
            'customer_name' => 'P4',
            'party_size' => 8, // Seats D
        ]);

        // Table are full. P5 arrives (party size 4). Should be put in waiting queue.
        $response = $this->postJson('/api/arrive', [
            'customer_name' => 'P5',
            'party_size' => 4,
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('queue_members', [
            'customer_name' => 'P5',
            'status' => 'waiting'
        ]);
    }

    public function test_it_prioritizes_largest_party_sizes_first_in_queue()
    {
        // Occupy all tables
        $this->postJson('/api/arrive', [
            'customer_name' => 'P1',
            'party_size' => 2,
        ]);
        $this->postJson('/api/arrive', [
            'customer_name' => 'P2',
            'party_size' => 4,
        ]);
        $this->postJson('/api/arrive', [
            'customer_name' => 'P3',
            'party_size' => 6,
        ]);
        $this->postJson('/api/arrive', [
            'customer_name' => 'P4',
            'party_size' => 8,
        ]);

        // Add small party to queue first
        $this->postJson('/api/arrive', [
            'customer_name' => 'SmallParty',
            'party_size' => 2,
        ]);

        // Add large party to queue second
        $this->postJson('/api/arrive', [
            'customer_name' => 'LargeParty',
            'party_size' => 6,
        ]);

        // Retrieve status and check active queue order
        $response = $this->getAsJson('/api/status');
        $queue = $response->json('queue');

        $this->assertEquals('LargeParty', $queue[0]['customer_name']);
        $this->assertEquals('SmallParty', $queue[1]['customer_name']);
    }

    public function test_it_serves_and_force_completes_dining()
    {
        // Seat a party at A
        $this->postJson('/api/arrive', [
            'customer_name' => 'Alice',
            'party_size' => 2,
        ]);

        // Complete/Serve Table A
        $response = $this->postJson('/api/serve', [
            'table_id' => 'A',
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('tables', [
            'id' => 'A',
            'status' => 'vacant',
            'queue_member_id' => null
        ]);

        $this->assertDatabaseHas('queue_members', [
            'customer_name' => 'Alice',
            'status' => 'served'
        ]);
    }

    public function test_it_automatically_seats_from_queue_when_table_is_served()
    {
        // Occupy all tables
        $this->postJson('/api/arrive', [
            'customer_name' => 'P1',
            'party_size' => 2, // Seats A
        ]);
        $this->postJson('/api/arrive', [
            'customer_name' => 'P2',
            'party_size' => 4, // Seats B
        ]);
        $this->postJson('/api/arrive', [
            'customer_name' => 'P3',
            'party_size' => 6, // Seats C
        ]);
        $this->postJson('/api/arrive', [
            'customer_name' => 'P4',
            'party_size' => 8, // Seats D
        ]);

        // Put P5 in waiting queue
        $this->postJson('/api/arrive', [
            'customer_name' => 'P5',
            'party_size' => 2,
        ]);

        // Complete Table A (capacity 2)
        $this->postJson('/api/serve', [
            'table_id' => 'A',
        ]);

        // A should now be occupied by P5
        $this->assertDatabaseHas('tables', [
            'id' => 'A',
            'status' => 'dining'
        ]);

        $p5 = QueueMember::where('customer_name', 'P5')->first();
        $this->assertEquals('seated', $p5->status);
    }

    public function test_it_retrieves_history_of_served_parties()
    {
        // Seat and serve a party
        $this->postJson('/api/arrive', [
            'customer_name' => 'Alice',
            'party_size' => 2,
        ]);
        $this->postJson('/api/serve', [
            'table_id' => 'A',
        ]);

        $response = $this->getAsJson('/api/history');
        $response->assertStatus(200);
        $this->assertCount(1, $response->json());
        $this->assertEquals('Alice', $response->json()[0]['customer_name']);
    }

    // Helper method to ensure we are sending JSON GET request
    protected function getAsJson($uri, array $headers = [])
    {
        return $this->json('GET', $uri, [], $headers);
    }
}
