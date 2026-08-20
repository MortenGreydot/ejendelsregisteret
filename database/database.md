# Databaseoversigt

## 1. `profiles`

Brugerprofil og kontotype.

| Kolonne        | Type          | Beskrivelse                    |
| -------------- | ------------- | ------------------------------ |
| `user_id`      | `UUID`        | Reference til `auth.users(id)` |
| `account_type` | `TEXT`        | `private` eller `business`     |
| `full_name`    | `TEXT`        | Fulde navn                     |
| `company_name` | `TEXT`        | Firmanavn (kun erhverv)        |
| `cvr_number`   | `TEXT`        | CVR-nummer (kun erhverv)       |
| `created_at`   | `TIMESTAMPTZ` | Oprettelsesdato                |

---

## 2. `subscriptions`

Medlemskab og abonnementsoplysninger.

| Kolonne                  | Type            | Beskrivelse                                                       |
| ------------------------ | --------------- | ----------------------------------------------------------------- |
| `id`                     | `UUID`          | Primær nøgle                                                      |
| `user_id`                | `UUID`          | Reference til bruger                                              |
| `status`                 | `TEXT`          | `pending_activation`, `active`, `past_due`, `canceled`, `expired` |
| `monthly_price`          | `NUMERIC(10,2)` | Månedlig pris (29 kr.)                                            |
| `included_items`         | `INTEGER`       | Inkluderede ejendele (25)                                         |
| `extra_item_price`       | `NUMERIC(10,2)` | Pris pr. ekstra ejendel (2 kr.)                                   |
| `stripe_customer_id`     | `TEXT`          | Stripe kunde-id                                                   |
| `stripe_subscription_id` | `TEXT`          | Stripe abonnements-id                                             |
| `activated_at`           | `TIMESTAMPTZ`   | Aktiveringsdato                                                   |
| `current_period_start`   | `TIMESTAMPTZ`   | Start på abonnementsperiode                                       |
| `current_period_end`     | `TIMESTAMPTZ`   | Slut på abonnementsperiode                                        |
| `created_at`             | `TIMESTAMPTZ`   | Oprettelsesdato                                                   |
| `updated_at`             | `TIMESTAMPTZ`   | Seneste opdatering                                                |

---

## 3. `categories`

Kategorier til ejendele.

| Kolonne | Type          | Beskrivelse  |
| ------- | ------------- | ------------ |
| `id`    | `SMALLSERIAL` | Primær nøgle |
| `name`  | `TEXT`        | Kategorinavn |

---

## 4. `items`

Hovedtabellen med ejendele.

| Kolonne             | Type          | Beskrivelse                         |
| ------------------- | ------------- | ----------------------------------- |
| `id`                | `UUID`        | Primær nøgle                        |
| `user_id`           | `UUID`        | Ejer af ejendelen                   |
| `category_id`       | `SMALLINT`    | Reference til kategori              |
| `name`              | `TEXT`        | Navn på ejendel                     |
| `brand`             | `TEXT`        | Mærke/fabrikant                     |
| `description`       | `TEXT`        | Beskrivelse                         |
| `status`            | `item_status` | `registered`, `lost`, `stolen`      |
| `status_changed_at` | `TIMESTAMPTZ` | Tidspunkt for seneste statusændring |
| `status_note`       | `TEXT`        | Note om status                      |
| `created_at`        | `TIMESTAMPTZ` | Oprettelsesdato                     |
| `updated_at`        | `TIMESTAMPTZ` | Seneste opdatering                  |

### ENUM: `item_status`

- `registered`
- `lost`
- `stolen`

---

## 5. `item_images`

Billeder gemt i Supabase Storage.

| Kolonne      | Type          | Beskrivelse           |
| ------------ | ------------- | --------------------- |
| `id`         | `UUID`        | Primær nøgle          |
| `item_id`    | `UUID`        | Reference til ejendel |
| `file_path`  | `TEXT`        | Sti i Storage bucket  |
| `file_name`  | `TEXT`        | Filnavn               |
| `created_at` | `TIMESTAMPTZ` | Uploadtidspunkt       |

---

## 6. `item_documents`

Dokumenter og kvitteringer.

| Kolonne      | Type          | Beskrivelse           |
| ------------ | ------------- | --------------------- |
| `id`         | `UUID`        | Primær nøgle          |
| `item_id`    | `UUID`        | Reference til ejendel |
| `file_path`  | `TEXT`        | Sti i Storage bucket  |
| `file_name`  | `TEXT`        | Filnavn               |
| `created_at` | `TIMESTAMPTZ` | Uploadtidspunkt       |

---

## 7. `billing_usage`

Månedlig beregning af ekstra ejendele.

| Kolonne             | Type            | Beskrivelse           |
| ------------------- | --------------- | --------------------- |
| `id`                | `UUID`          | Primær nøgle          |
| `user_id`           | `UUID`          | Bruger                |
| `billing_month`     | `DATE`          | Faktureringsmåned     |
| `item_count`        | `INTEGER`       | Antal ejendele        |
| `included_items`    | `INTEGER`       | Inkluderede ejendele  |
| `extra_items`       | `INTEGER`       | Antal ekstra ejendele |
| `extra_amount`      | `NUMERIC(10,2)` | Ekstra beløb i kr.    |
| `stripe_invoice_id` | `TEXT`          | Stripe faktura-id     |
| `created_at`        | `TIMESTAMPTZ`   | Oprettelsesdato       |

---

## 8. `payments`

Betalingshistorik.

| Kolonne                    | Type            | Beskrivelse                                |
| -------------------------- | --------------- | ------------------------------------------ |
| `id`                       | `UUID`          | Primær nøgle                               |
| `user_id`                  | `UUID`          | Bruger                                     |
| `subscription_id`          | `UUID`          | Reference til abonnement                   |
| `payment_type`             | `TEXT`          | `setup_fee`, `subscription`, `extra_items` |
| `amount`                   | `NUMERIC(10,2)` | Beløb                                      |
| `currency`                 | `CHAR(3)`       | Valuta (`DKK`)                             |
| `status`                   | `TEXT`          | `pending`, `paid`, `failed`, `refunded`    |
| `stripe_payment_intent_id` | `TEXT`          | Stripe PaymentIntent-id                    |
| `stripe_invoice_id`        | `TEXT`          | Stripe faktura-id                          |
| `paid_at`                  | `TIMESTAMPTZ`   | Betalingstidspunkt                         |
| `created_at`               | `TIMESTAMPTZ`   | Oprettelsesdato                            |

---

# Relationer

- `auth.users` → `profiles` (1:1)
- `auth.users` → `subscriptions` (1:1)
- `auth.users` → `items` (1:mange)
- `items` → `item_images` (1:mange)
- `items` → `item_documents` (1:mange)
- `auth.users` → `billing_usage` (1:mange)
- `auth.users` → `payments` (1:mange)
- `categories` → `items` (1:mange)

---

# Storage Buckets

| Bucket           | Formål                     |
| ---------------- | -------------------------- |
| `item-images`    | Billeder af ejendele       |
| `item-documents` | Kvitteringer og dokumenter |

---

# Betalingsmodel

- Oprettelsesgebyr: **99 kr.**
- Månedligt abonnement: **29 kr.**
- Inkluderede ejendele: **25**
- Ekstra ejendele: **2 kr. pr. ejendel pr. måned**
- Betaling håndteres via **Stripe Checkout**, **Stripe Subscription** og **Stripe Invoice Items**.
