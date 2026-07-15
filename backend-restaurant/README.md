# 🍽️ Restaurant Queue System

Sistem manajemen antrean restoran berbasis API dengan backend Laravel dan frontend Next.js.

---

## 🏗️ Arsitektur

### Backend (Laravel 13 — `backend-restaurant/`)
- **Monolith** dengan struktur bersih
- **Repository Pattern** — abstraksi layer database
- **Service Pattern** — logika bisnis terisolasi di `RestaurantService`
- **Laravel Actions** — satu class = satu use-case (`ArriveAction`, `ServeAction`, dst.)
- **Thin Controllers** — controller hanya meneruskan ke Action
- **HTTP Request Validation** — validasi di `app/Http/Requests/`
- **Laravel Sanctum** — siap digunakan untuk autentikasi API

### Frontend (Next.js 16 — `frontend-restaurant/`)
- **React** client component dengan polling API setiap 5 detik
- **8 Fitur interaktif** dashboard (lihat di bawah)
- **Vitest + Testing Library** untuk unit testing

---

## 🚀 Cara Menjalankan

### Menggunakan Docker (Recommended)

```bash
cd backend-restaurant
docker compose -f docker-local-compose.yml up --build
```

Akses backend: `http://localhost/api`

### Frontend

```bash
cd frontend-restaurant
npm install
npm run dev
```

Akses frontend: `http://localhost:3000`

---

## 📡 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `POST` | `/api/arrive` | Daftarkan pelanggan baru |
| `GET`  | `/api/status` | Status meja dan antrean aktif |
| `POST` | `/api/serve` | Force complete sebuah meja |
| `POST` | `/api/seat` | Manual seating (drag & drop) |
| `GET`  | `/api/history` | Riwayat kunjungan |

### Contoh `POST /api/arrive`
```json
{ "customer_name": "Alice", "party_size": 4 }
```

### Aturan Bisnis
- **4 Meja**: A(2 org), B(4 org), C(6 org), D(8 org)
- **Penugasan meja**: Pilih meja terkecil yang kapasitasnya ≥ party size (tidak oversize)
- **Waktu makan**: `(party_size × 15) + random(5–15) menit`
- **Prioritas antrean**: Party terbesar diutamakan (bukan FIFO)

---

## 🖥️ Fitur Frontend

1. **Denah Restoran Interaktif** — Grid 4 meja dengan info real-time
2. **Status Warna Otomatis** — 🟢 Kosong | 🔵 Baru duduk | 🟡 Sedang makan | 🔴 Hampir selesai
3. **Drag & Drop** — Seret pelanggan dari antrean ke meja + validasi kapasitas
4. **Live Countdown Timer** — Berbasis `Date.now()`, update tiap detik
5. **Force Complete** — Tombol paksa kosongkan meja dari dashboard
6. **Queue Priority Visualization** — List antrean urut party terbesar dulu
7. **History Table + Multi-Column Sort** — Klik header kolom untuk urutkan
8. **Search & Filter** — Filter berdasarkan nama, party size, dan status

---

## ✅ Unit Tests

### Backend (8 tests)
```bash
docker compose -f docker-local-compose.yml exec app \
  ./vendor/bin/phpunit tests/Feature/RestaurantQueueTest.php
```

| # | Test |
|---|------|
| 1 | Validasi input kedatangan |
| 2 | Penempatan langsung ke meja yang tepat |
| 3 | Fallback ke meja berikutnya jika meja pas penuh |
| 4 | Masuk antrean jika semua meja penuh |
| 5 | Prioritas antrean: party terbesar di depan |
| 6 | Force complete (serve) meja |
| 7 | Auto-seat dari antrean saat meja dikosongkan |
| 8 | Riwayat kunjungan terekam setelah serve |

### Frontend (6 tests)
```bash
cd frontend-restaurant && npm run test
```

| # | Test |
|---|------|
| 1 | Render tata letak meja dan antrean |
| 2 | Validasi nama kosong tidak memanggil API |
| 3 | Indikator status dan styling meja dining |
| 4 | Filter riwayat berdasarkan keyword |
| 5 | Tombol force complete trigger endpoint `/serve` |
| 6 | Sorting riwayat via klik header kolom |

---

## 🧠 Bonus: Optimasi Revenue — Strategi Penahan Party Kecil

### Masalah
Dengan prioritas party terbesar, party kecil (1–2 orang) bisa "kelaparan" (starvation) karena terus-menerus didahulukan party besar, bahkan jika meja kecil (A: 2 orang) tersedia.

Namun, memberi mereka meja besar (mis. D: 8 orang) hanya untuk 2 orang adalah pemborosan kapasitas yang merugikan revenue.

### Strategi: Priority Boost dengan Batas Waktu Tunggu

```
FUNGSI calculate_effective_priority(customer):
  base_priority    = customer.party_size
  wait_minutes     = (NOW - customer.joined_at) / 60
  patience_limit   = 20  // menit
  urgency_boost    = 0

  JIKA wait_minutes > patience_limit:
    // Boost makin besar seiring waktu tunggu
    urgency_boost = (wait_minutes - patience_limit) * 0.5

  RETURN base_priority + urgency_boost
```

### Aturan Penugasan Meja + Holding

```
FUNGSI find_best_table(customer, all_tables):
  exact_match   = meja dengan capacity == customer.party_size (status: vacant)
  closest_match = meja terkecil >= customer.party_size (status: vacant)

  JIKA exact_match ADA:
    RETURN exact_match  // Prioritaskan meja yang pas

  JIKA closest_match ADA:
    oversized_ratio = closest_match.capacity / customer.party_size

    // Izinkan oversize jika:
    // (a) oversized_ratio <= 2x (tidak terlalu mubazir)
    // (b) ATAU customer sudah menunggu > patience_limit
    JIKA oversized_ratio <= 2.0 ATAU customer sudah lama tunggu:
      RETURN closest_match

  RETURN NULL  // Tetap tunggu di antrean
```

### Trade-offs

| Strategi | Pro | Kontra |
|----------|-----|--------|
| **FIFO murni** | Tidak ada starvation | Revenue buruk; meja besar terisi party kecil |
| **Prioritas party terbesar** | Revenue optimal | Party kecil bisa starvation lama |
| **Priority Boost (diusulkan)** | Seimbang antara revenue & fairness | Lebih kompleks; butuh tuning parameter `patience_limit` |
| **Hold meja kecil untuk party kecil** | Meja kecil terjaga | Meja kecil bisa idle terlalu lama |

### Rekomendasi
Gunakan **Priority Boost** dengan `patience_limit` ≈ 15–20 menit.
Dengan oversized_ratio ≤ 2x, party kecil tidak akan mendapat meja yang terlalu besar (mis. party 2 orang tidak akan ke meja 8 orang, tapi boleh ke meja 4 orang setelah menunggu lama).

---

## 📁 Struktur File Backend

```
app/
├── Actions/         # Single-responsibility use-cases
│   ├── ArriveAction.php
│   ├── GetStatusAction.php
│   ├── GetHistoryAction.php
│   ├── ServeAction.php
│   └── SeatAction.php
├── Http/
│   ├── Controllers/
│   │   └── QueueController.php   # Thin controller
│   └── Requests/                 # HTTP Validation
│       ├── ArriveRequest.php
│       ├── ServeRequest.php
│       └── SeatRequest.php
├── Models/
│   ├── Table.php
│   └── QueueMember.php
├── Repositories/
│   ├── Contracts/               # Interfaces
│   │   ├── TableRepositoryInterface.php
│   │   └── QueueRepositoryInterface.php
│   └── Eloquent/                # Implementations
│       ├── TableRepository.php
│       └── QueueRepository.php
├── Services/
│   └── RestaurantService.php    # Business logic
└── Providers/
    └── AppServiceProvider.php   # DI bindings
```
