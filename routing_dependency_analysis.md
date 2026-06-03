# Telecom Routing Engine - Codebase Dependency Analysis (Phase 0)

This report details the dependency analysis of the active codebase to prepare for building the Telecom Routing Management Suite. It ensures zero regression, production safety, and adherence to administrative boundaries.

---

## 1. Existing Flows & System Integrations

### 1.1 Existing Recharge Flow
- **Execution Mechanism**: Real transaction routing resides in `server/src/workers/rechargeWorker.js` inside the BullMQ `recharge` queue worker.
- **Provider Switching**: The worker queries active providers (`prisma.provider.findMany({ where: { isActive: true }, orderBy: { priority: "desc" } })`) and executes them in sequence.
- **Locking & State**: It uses `processingLock` to prevent double-processing. Failures result in transition to `FAILED` and then `REFUNDED` status, executing wallet/ledger reversals via `recordFinancialEntry`.

### 1.2 Existing Provider Management
- **Table**: `provider` table. Houses endpoints, credentials, health states, and priorities.
- **Obfuscation**: Controlled by `server/src/config/providerAliases.js` via `REAL_TO_ALIAS` mapping. Real names (e.g., `APIBOX`, `MPLAN`) are replaced by generic names (e.g., `Primary Gateway`, `Plans Engine`) in all API responses sent to the UI.

### 1.3 Existing Operator Management
- **Table**: `operator` table. Stores master telecom operators (e.g., `JIO`, `AIRTEL`) along with legacy regex matching patterns.

### 1.4 Existing Routing Engine
- **Service**: `server/src/services/routingEngine/routingEngine.js` containing `selectProvider()`.
- **Mode**: Runs in **Shadow Routing Mode** where it evaluates recommendations based on user, circle, and amount rules, writes these evaluations to `RoutingDecisionLog`, but returns `[selectedProvider]` (always returning the active `APIBOX` provider).

### 1.5 Existing Shadow Routing
- **observability**: Logs are printed using the prefix `[SHADOW ROUTING]` and written to the database (`RoutingDecisionLog`). No changes are made to the live provider selection list used in the worker.

### 1.6 Existing Provider Health Telemetry
- **Model**: `ProviderHealthLog` tracks periodic logs.
- **Aggregation**: `telemetryService.js` calculates live metrics (`successRate`, `avgResponseTime`, `healthStatus`) dynamically from recent logs.

### 1.7 Existing Operator Mapping
- **Table**: `OperatorMapping` matches operator names and amount slabs to provider operator codes.

### 1.8 Existing Commission Engine Integration
- **Coupling**: The commission engine (`Slab`, `CommissionPackage`, `RechargeCommissionRule`, `RangeCommissionRule`) is entirely decoupled from the active recharge worker provider sequence, ensuring provider switching does not affect margin calculations.

### 1.9 Existing Audit Logging Framework
- **Model**: `auditLog` stores administration actions.

### 1.10 Existing Redis Caching Strategy
- **Key Patterns**: Caches mobile plans at `plans:{operatorCode}:{circleCode}`. Uses connection configurations in `server/src/config/redis.js`.

### 1.11 Existing BullMQ/Background Jobs
- **Queues**: `recharge` and `recharge_dlq` are initialized under the BullMQ client context.

### 1.12 Existing Admin Sidebar Navigation
- **Component**: `admin-web/src/components/Sidebar.jsx`. Employs collapsible groups with Framer Motion.

### 1.13 Existing Route Registration Structure
- **Backend Routing**: `server/src/routes/routingAdminRoutes.js` mounted at `/api/admin/enterprise`.
- **Frontend Routing**: `admin-web/src/App.jsx`.

### 1.14 Existing Prisma Schema Dependencies
- **Constraints**: Indexes on `ruleType`, `targetValue`, and status columns to optimize matching operations.

---

## 2. Impact Report

### 2.1 Files Impacted
- **Backend Database**: `server/prisma/schema.prisma`
- **Backend Services**: 
  - `server/src/services/routingEngine/routingEngine.js` (Introduce actual routing modes, fallback controls, health/weighted checks)
  - `server/src/config/providerAliases.js` (Register new providers if needed, mask newly created operator mappings)
- **Backend Routes & Controllers**:
  - `server/src/routes/routingAdminRoutes.js` (Define new routes for ServiceSection CRUD, updated rules, simulation, emergency controls, and metrics)
  - `server/src/controllers/routingAdminController.js` (Expand route controllers)
- **Frontend App**:
  - `admin-web/src/components/Sidebar.jsx` (Register new "Operations" menu and links)
  - `admin-web/src/App.jsx` (Mount frontend views for the 8 modules)
- **Frontend Pages (NEW)**:
  - `admin-web/src/pages/operations/SectionMaster.jsx`
  - `admin-web/src/pages/operations/RoutingMaster.jsx`
  - `admin-web/src/pages/operations/ProviderRoutingRules.jsx`
  - `admin-web/src/pages/operations/OperatorMapping.jsx`
  - `admin-web/src/pages/operations/RouteSimulator.jsx`
  - `admin-web/src/pages/operations/RoutingAnalytics.jsx`
  - `admin-web/src/pages/operations/RoutingAuditLogs.jsx`
  - `admin-web/src/pages/operations/EmergencyRoutingControl.jsx`

### 2.2 New Models Required
- `ServiceSection`: For category/service classification.
- `OperatorProviderMapping`: For hiding and resolving provider operator codes.
- `RoutingRule` (Modified): Extends the existing table structure with weighted parameters, route types, latency/failure thresholds, amounts, and foreign key relations.

### 2.3 New Routes Required
#### Backend:
- `GET /api/admin/enterprise/sections` / `POST` / `PUT` / `DELETE` (Section Master)
- `GET /api/admin/enterprise/routing/rules` / `POST` / `PUT` / `DELETE` (Routing Rules Master)
- `GET /api/admin/enterprise/operators/provider-mappings` / `POST` / `PUT` / `DELETE` (Operator Mappings)
- `POST /api/admin/enterprise/routing/simulate` (Read-only simulation)
- `GET /api/admin/enterprise/routing/analytics` (Routing performance indicators)
- `POST /api/admin/enterprise/routing/emergency/override` (Emergency route modifications)

### 2.4 Potential Regressions
- **Rule Resolution Priority**: Incorrect sorting could make higher-priority manual routing overrides bypass fallback providers.
- **Failover Worker Loop**: The recharge loop might fail if `selectProvider` returns no executable provider.
- **API Response Masks**: Raw provider codes like `APIBOX` or `MPLAN` could leak to the UI if mappings are bypassed.

---

## 3. Schema Changes

```prisma
// ==========================================
// [NEW] ServiceSection Model
// ==========================================
model ServiceSection {
  id           Int           @id @default(autoincrement())
  name         String
  code         String        @unique
  description  String?       @db.Text
  icon         String?
  priority     Int           @default(0)
  status       String        @default("ACTIVE") // ACTIVE, INACTIVE
  serviceType  String
  isDefault    Boolean       @default(false)
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  createdBy    Int?
  updatedBy    Int?
  softDeleted  Boolean       @default(false)

  routingRules RoutingRule[]
}

// ==========================================
// [NEW] OperatorProviderMapping Model
// ==========================================
model OperatorProviderMapping {
  id                   Int      @id @default(autoincrement())
  operatorId           Int
  providerId           Int
  providerOperatorCode String
  providerOperatorName String?
  status               String   @default("ACTIVE") // ACTIVE, INACTIVE
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  operator             operator @relation(fields: [operatorId], references: [id], onDelete: Cascade)
  provider             provider @relation(fields: [providerId], references: [id], onDelete: Cascade)

  @@unique([operatorId, providerId])
  @@index([operatorId])
  @@index([providerId])
}

// ==========================================
// [UPDATED] RoutingRule Model
// ==========================================
model RoutingRule {
  id                 Int             @id @default(autoincrement())
  
  // Existing fields (remains nullable/optional to prevent breaking changes)
  name               String?
  ruleType           String?         // 'operator', 'user', 'amount', 'circle'
  targetValue        String?         // e.g. 'JIO', 'userId_123', 'circle_DELHI'
  providerCode       String?
  backupProviderCode String?
  isActive           Boolean         @default(true)

  // New fields
  sectionId          Int?
  operatorId         Int?
  circleId           Int?            // Stores standardized circle mapping ID
  providerId         Int?
  priority           Int             @default(1)
  weight             Int             @default(0)
  routeType          String?         // PRIMARY, SECONDARY, BACKUP, FAILOVER, LOAD_BALANCED, MANUAL
  status             String          @default("ACTIVE") // ACTIVE, INACTIVE
  failureThreshold   Int             @default(0)
  latencyThreshold   Int             @default(0)
  amountFrom         Decimal         @default(0.00) @db.Decimal(10, 2)
  amountTo           Decimal         @default(99999.00) @db.Decimal(10, 2)
  serviceType        String?         // e.g. RECHARGE, DTH, BBPS

  createdAt          DateTime        @default(now())
  updatedAt          DateTime        @updatedAt

  // Relationships (optional/nullable)
  section            ServiceSection? @relation(fields: [sectionId], references: [id], onDelete: SetNull)
  operator           operator?       @relation(fields: [operatorId], references: [id], onDelete: SetNull)
  provider           provider?       @relation(fields: [providerId], references: [id], onDelete: SetNull)

  @@index([ruleType, targetValue])
  @@index([sectionId])
  @@index([operatorId])
  @@index([providerId])
}
```

*Note: The existing `operator` and `provider` models will also receive mapping fields to maintain relations:*
- `operator` model will include: `providerMappings OperatorProviderMapping[]` and `routingRules RoutingRule[]`
- `provider` model will include: `operatorMappings OperatorProviderMapping[]` and `routingRules RoutingRule[]`

---

## 4. Migration Plan

1. **Schema Expansion**: Apply schema modifications in `prisma/schema.prisma`.
2. **Local Schema Drift Resolution**:
   ```bash
   npx prisma migrate dev --name add_routing_suite_tables
   ```
3. **Database Seeding**: Create default sections (Recharge, DTH, BBPS) and populate default `OperatorProviderMapping` relations using existing `OperatorMapping` data to prevent cold starts.

---

## 5. Rollback Plan

In case of runtime failure or database transaction locks:
1. **Schema Reversion**:
   Revert schema file changes and apply the previous migration snapshot:
   ```bash
   npx prisma migrate resolve --rolled-back add_routing_suite_tables
   ```
2. **Service Fallback**:
   Revert `routingEngine.js` changes to fallback immediately to pure single-provider `APIBOX` resolution.
