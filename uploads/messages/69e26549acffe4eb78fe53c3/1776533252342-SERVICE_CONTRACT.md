# Payment + Notification Service Contract

Tai lieu nay mo ta nhanh cac gia tri service nhan vao va tra ra de cac service khac trong nhom tich hop.

## 1) Broker va event naming

- Broker: RabbitMQ
- Exchange: lay tu bien moi truong `RABBITMQ_EXCHANGE` (mac dinh: `movie_ticket_events`)
- Routing key (event name):
  - `BOOKING_CREATED`
  - `PAYMENT_COMPLETED`
  - `BOOKING_FAILED`

## 2) Service nhan vao

### 2.1 Event nhan vao: BOOKING_CREATED

Service consume event `BOOKING_CREATED` tu Booking Service.

Payload bat buoc:

```json
{
  "type": "BOOKING_CREATED",
  "bookingId": "BK123",
  "userId": "U01",
  "totalPrice": 180000
}
```

Payload day du de xuat:

```json
{
  "type": "BOOKING_CREATED",
  "bookingId": "BK123",
  "userId": "U01",
  "movieId": "M009",
  "seats": ["A1", "A2"],
  "totalPrice": 180000,
  "createdAt": "2026-04-17T10:20:00.000Z"
}
```

Ghi chu validate:

- `bookingId`: bat buoc, string
- `userId`: bat buoc, string
- `totalPrice`: bat buoc, number
- `seats`: neu khong co hoac sai dinh dang, service tu dong chuyen thanh mang rong `[]`

## 3) Service tra ra (publish event)

### 3.1 Event publish: PAYMENT_COMPLETED

Duoc publish khi payment random thanh cong.

```json
{
  "type": "PAYMENT_COMPLETED",
  "bookingId": "BK123",
  "userId": "U01",
  "paymentId": "661f0f7f4271f9770e839111",
  "amount": 180000,
  "transactionRef": "TXN-1713359999999-123456",
  "paidAt": "2026-04-17T10:20:03.000Z"
}
```

### 3.2 Event publish: BOOKING_FAILED

Duoc publish khi payment random that bai.

```json
{
  "type": "BOOKING_FAILED",
  "bookingId": "BK123",
  "userId": "U01",
  "paymentId": "661f0f7f4271f9770e839112",
  "amount": 180000,
  "reason": "Random payment simulation failed",
  "failedAt": "2026-04-17T10:20:03.000Z"
}
```

## 4) API monitor service tra ve

Base URL LAN de xuat: `http://<PAYMENT_HOST>:8084`

### 4.1 GET /health

Response:

```json
{
  "success": true,
  "service": "payment-notification-service",
  "timestamp": "2026-04-17T10:30:00.000Z"
}
```

### 4.2 GET /payments

Response:

```json
{
  "success": true,
  "data": [
    {
      "_id": "661f0f7f4271f9770e839111",
      "bookingId": "BK123",
      "userId": "U01",
      "movieId": "M009",
      "seats": ["A1", "A2"],
      "amount": 180000,
      "status": "SUCCESS",
      "transactionRef": "TXN-1713359999999-123456",
      "processedAt": "2026-04-17T10:20:03.000Z",
      "createdAt": "2026-04-17T10:20:01.000Z",
      "updatedAt": "2026-04-17T10:20:03.000Z"
    }
  ]
}
```

### 4.3 GET /payments/booking/:bookingId

- Neu tim thay:

```json
{
  "success": true,
  "data": {
    "_id": "661f0f7f4271f9770e839111",
    "bookingId": "BK123",
    "userId": "U01",
    "amount": 180000,
    "status": "SUCCESS"
  }
}
```

- Neu khong tim thay: HTTP 404

```json
{
  "success": false,
  "message": "Payment not found for this booking"
}
```

### 4.4 GET /notifications

Response:

```json
{
  "success": true,
  "data": [
    {
      "_id": "661f102b4271f9770e839200",
      "userId": "U01",
      "bookingId": "BK123",
      "eventType": "PAYMENT_COMPLETED",
      "message": "User U01 da dat ve #BK123 thanh cong",
      "createdAt": "2026-04-17T10:20:03.100Z",
      "updatedAt": "2026-04-17T10:20:03.100Z"
    }
  ]
}
```

## 5) Hanh vi xu ly cua service

- Khi nhan `BOOKING_CREATED`, service tao ban ghi payment `PENDING`, delay mo phong 0.5s -> 2s, sau do random:
  - 80% thanh cong -> `SUCCESS` -> publish `PAYMENT_COMPLETED`
  - 20% that bai -> `FAILED` -> publish `BOOKING_FAILED`
- Notification chi consume `PAYMENT_COMPLETED`, luu thong bao vao MongoDB va in log.
