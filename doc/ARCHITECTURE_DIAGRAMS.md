# Meal Membership System - Architecture Diagrams

This document contains high-level design diagrams in Mermaid format for:

- System Design
- Database Design
- API Design

---

## 1) System Design

```mermaid
flowchart LR
  subgraph Clients
    Mobile[Expo Mobile App<br/>iOS / Android]
    Web[Expo Web App]
  end

  subgraph Edge["Vercel Edge / Hosting"]
    Static[Static Assets<br/>meal-mobile.vercel.app]
    API[Hono API Service<br/>meal-api-nu.vercel.app]
  end

  subgraph DataLayer["Data & Storage"]
    Turso[(Turso / libSQL)]
    R2[(Cloudflare R2<br/>backup - planned)]
  end

  subgraph Integrations
    EAS[Expo EAS Build]
    GH[GitHub + CI]
    Linear[Linear Project Management]
  end

  Mobile --> API
  Web --> Static
  Web --> API
  Static --> Web
  API --> Turso
  API -. backup/export .-> R2

  GH --> EAS
  GH --> Static
  GH --> API
  Linear --> GH
```



---

## 2) Database Design

```mermaid
erDiagram
  USERS ||--o{ AUDIT_LOGS : "creates actions"
  USERS ||--o{ MEMBERS : "created_by_user_id"
  USERS ||--o{ CARDS : "collector/creator"
  USERS ||--o{ DAILY_ORDERS : "created/fulfilled/delivered/cancelled by"
  USERS ||--o{ FINANCE_ENTRIES : "created_by_user_id"

  MEMBERS ||--o{ CARDS : "owns"
  MEMBERS ||--o{ DAILY_ORDERS : "places"

  CARDS ||--o{ DAILY_ORDERS : "consumed_by card_id"

  USERS {
    int id PK
    string username UK
    string full_name
    enum role "admin|staff"
    boolean is_active
    int token_version
    string avatar_url
    datetime created_at
  }

  MEMBERS {
    int id PK
    string uid UK
    string name
    string nickname
    string phone
    string wechat_id
    string address
    boolean is_hospital
    boolean is_walkin
    boolean is_active
    int created_by_user_id FK
    datetime created_at
  }

  CARDS {
    int id PK
    int member_id FK
    string card_code
    string card_name
    enum status "active|upgraded|exhausted|refunded"
    int total_meals
    int used_meals
    int remaining_meals
    decimal paid_amount
    decimal unit_price
    int collector_user_id FK
    int created_by_user_id FK
    datetime purchased_at
  }

  DAILY_ORDERS {
    int id PK
    int member_id FK
    int card_id FK
    date order_date
    enum meal_type "lunch|dinner"
    int quantity
    decimal amount
    enum status "pending|fulfilled|delivered|cancelled"
    int created_by_user_id FK
    int fulfilled_by_user_id FK
    int delivered_by_user_id FK
    int cancelled_by_user_id FK
    datetime fulfilled_at
    datetime delivered_at
    datetime cancelled_at
  }

  FINANCE_ENTRIES {
    int id PK
    date entry_date
    enum type "income|expense"
    string category
    decimal amount
    string description
    enum source "auto|manual|imported_legacy"
    boolean voided
    int created_by_user_id FK
  }

  AUDIT_LOGS {
    int id PK
    int user_id FK
    string action
    string entity
    int entity_id
    json diff_json
    datetime created_at
  }
```



---

## 3) API Design

```mermaid
flowchart TB
  Client[Client App] --> Auth["/api/auth"]
  Client --> Members["/api/members"]
  Client --> Cards["/api/cards"]
  Client --> Orders["/api/orders"]
  Client --> Finance["/api/finance"]
  Client --> Users["/api/users"]
  Client --> Audit["/api/audit-logs"]

  subgraph AuthDomain["Authentication Domain"]
    Auth --> Login["POST /login"]
    Auth --> Me["GET /me"]
  end

  subgraph MemberDomain["Member Domain"]
    Members --> MemberList["GET /"]
    Members --> MemberCreate["POST /"]
    Members --> MemberUpdate["PATCH /:id"]
    Members --> MemberArchive["PATCH /:id/archive"]
    Members --> MemberDelete["DELETE /:id"]
  end

  subgraph CardDomain["Card Domain"]
    Cards --> CardList["GET /?member_id=..."]
    Cards --> CardPurchase["POST /"]
    Cards --> CardUpgrade["POST /:id/upgrade"]
    Cards --> CardRenew["POST /:id/renew"]
    Cards --> CardRefund["POST /:id/refund"]
    Cards --> CardPatch["PATCH /:id"]
  end

  subgraph OrderDomain["Order Domain"]
    Orders --> OrderList["GET /"]
    Orders --> OrderToday["GET /today"]
    Orders --> OrderCreate["POST /"]
    Orders --> OrderPatch["PATCH /:id"]
    Orders --> OrderStatus["PATCH /:id/status"]
    Orders --> OrderDeliveryFailed["PATCH /:id/delivery-failed"]
    Orders --> OrderCancel["PATCH /:id/cancel"]
  end

  subgraph FinanceDomain["Finance Domain"]
    Finance --> FinanceList["GET /"]
    Finance --> FinanceExpense["POST /expense"]
    Finance --> FinancePatch["PATCH /:id"]
    Finance --> FinanceDelete["DELETE /:id"]
  end

  subgraph AdminDomain["Admin / Ops Domain"]
    Users --> UserList["GET /"]
    Users --> UserAccess["PATCH /:id/access"]
    Users --> UserResetPw["PATCH /:id/password"]
    Users --> UserAvatar["PATCH|DELETE /me/avatar"]
    Audit --> AuditList["GET /api/audit-logs"]
  end
```

Notes:

- `PATCH /api/orders/:id/delivery-failed` is a business alias of cancellation for `fulfilled` orders, with mandatory reason and meal rollback side effects.



