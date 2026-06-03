  # Telecom Routing Engine - Execution & Architecture Design (v2 Hardened)

  This document represents the definitive architecture and integration specification for the DiziPay Telecom Routing Management Suite.

  ---

  ## 1. Weighted Routing Algorithm Specification

  We implement the **Smooth Weighted Round Robin (SWRR)** algorithm. This algorithm eliminates traffic clustering by dynamically spreading transaction requests across providers according to their designated percentages.

  ### 1.1 Mathematical Model
  Let:
  - $W_i$ be the configured static weight of provider $i$.
  - $EW_i$ be the effective weight of provider $i$ (dynamically adjusted based on health degradation, defaults to $W_i$).
  - $CW_i$ be the current weight of provider $i$ (state variable stored in Redis).
  - $S_{EW}$ be the sum of all effective weights: $S_{EW} = \sum EW_k$.

  Algorithm Steps per transaction query:
  1. For each provider $i$, increment its current weight:
    $$CW_i \leftarrow CW_i + EW_i$$
  2. Identify the provider $j$ with the maximum current weight:
    $$j = \arg\max_i (CW_i)$$
  3. Select provider $j$ to route the transaction.
  4. Deduct $S_{EW}$ from the selected provider's current weight:
    $$CW_j \leftarrow CW_j - S_{EW}$$
  5. Return provider $j$.

  ### 1.2 Example Execution (Weights: A=70, B=20, C=10; Total Sum = 100)
  - **Init**: $CW = [0, 0, 0]$
  - **Step 1**: $CW \leftarrow CW + [70, 20, 10] = [70, 20, 10]$. Max = 70 (A). Selected = A. $CW \leftarrow [70-100, 20, 10] = [-30, 20, 10]$.
  - **Step 2**: $CW \leftarrow CW + [70, 20, 10] = [40, 40, 20]$. Max = 40 (Tie: choose A). Selected = A. $CW \leftarrow [40-100, 40, 20] = [-60, 40, 20]$.
  - **Step 3**: $CW \leftarrow CW + [70, 20, 10] = [10, 60, 30]$. Max = 60 (B). Selected = B. $CW \leftarrow [10, 60-100, 30] = [10, -40, 30]$.

  ### 1.3 Atomic Redis Implementation (Lua Script)
  To avoid race conditions and ensure atomic execution across multiple worker nodes, we run SWRR inside an atomic Redis Lua transaction block:
  ```lua
  local keys = KEYS -- Array of provider codes
  local weights = ARGV -- Corresponding weights

  local max_val = -999999
  local max_idx = 1
  local total_sum = 0

  -- Load current weights
  local current_weights = {}
  for i, key in ipairs(keys) do
      local cw = tonumber(redis.call('HGET', 'routing:traffic:current_weights', key)) or 0
      local ew = tonumber(weights[i])
      total_sum = total_sum + ew
      cw = cw + ew
      current_weights[i] = cw
      redis.call('HSET', 'routing:traffic:current_weights', key, cw)
      if cw > max_val then
          max_val = cw
          max_idx = i
      end
  end

  -- Decrease selected provider weight
  local selected_key = keys[max_idx]
  local new_cw = current_weights[max_idx] - total_sum
  redis.call('HSET', 'routing:traffic:current_weights', selected_key, new_cw)

  return selected_key
  ```

  ---

  ## 2. Distributed Locking Strategy

  To manage counter writes and prevent race conditions when shifting health states, we deploy a Redis-based distributed locking pattern using the Redlock algorithm.

  - **Lock Key**: `routing:lock:provider:{id}`
  - **Lease Time**: 5000ms.
  - **Acquire Logic**:
    ```javascript
    const acquireLock = async (lockKey, token, ttlMs) => {
      const result = await redisClient.set(lockKey, token, "NX", "PX", ttlMs);
      return result === "OK";
    };
    ```
  - **Safe Release (Lua script)**:
    ```lua
    if redis.call("get",KEYS[1]) == ARGV[1] then
        return redis.call("del",KEYS[1])
    else
        return 0
    end
    ```

  ---

  ## 3. Bulk Rule Deployment Strategy

  When deploying multiple routing rules at once, we use database transactions and atomic pipeline execution:

  1. **Rule Batches**: Create record in `RoutingRuleBatch` containing states: `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`.
  2. **Transaction Publishing**:
    ```javascript
    await prisma.$transaction(async (tx) => {
      // 1. Update rule batch status
      // 2. Write snapshots to RoutingRuleVersion
      // 3. Update Rule active flags
    });
    ```
  3. **Pipeline Cache Sync**:
    Execute `redis.pipeline()` containing `HSET` operations to refresh rules cleanly. If a single item fails, the cache invalidation triggers a rebuild of the entire routing namespace.

  ---

  ## 4. Routing Rule Version Comparison

  ### 4.1 Schema Definition
  `RoutingRuleVersion` stores snapshot JSONs of the rule before and after changes:
  ```prisma
  model RoutingRuleVersion {
    id             Int       @id @default(autoincrement())
    routingRuleId  Int
    version        Int       @default(1)
    configSnapshot Json      // Exact JSON structure of the rule configuration
    status         String    @default("DRAFT") // DRAFT, PENDING, APPROVED, REJECTED
    createdBy      Int
    approvedBy     Int?
    approvedAt     DateTime?
    createdAt      DateTime  @default(now())
  }
  ```

  ### 4.2 UI Diff Representation
  The admin panel will render a comparative JSON structure showing changed fields:
  - Red Highlights: Deleted/Previous parameters.
  - Green Highlights: Newly requested parameters.
  - Displays Maker IDs, Checker validation notes, and a "Revert to Version" control action.

  ---

  ## 5. Database Indexing Plan

  We apply the following indices in MySQL to ensure query responses remain under 5ms:

  ```sql
  -- Index on Operator Provider mappings
  CREATE UNIQUE INDEX idx_operator_provider ON OperatorProviderMapping (operatorId, providerId);

  -- Compound indexes on rule resolution targets
  CREATE INDEX idx_rule_resolution ON RoutingRule (sectionId, isActive, isDeleted);
  CREATE INDEX idx_operator_circle_rule ON RoutingRule (operatorId, circleId, isActive, isDeleted);
  CREATE INDEX idx_amount_slab_rule ON RoutingRule (amountFrom, amountTo, isActive, isDeleted);

  -- Index on version logs lookup
  CREATE INDEX idx_rule_versions ON RoutingRuleVersion (routingRuleId, version);
  ```

  ---

  ## 6. Provider Cost Engine

  To evaluate smart routing configurations, we introduce a dedicated provider cost structure:

  ### 6.1 Schema
  ```prisma
  model ProviderCost {
    id                Int      @id @default(autoincrement())
    providerId        Int      @unique
    costPerTxn        Decimal  @default(0.00) @db.Decimal(10, 2)
    costPerAmountSlab Json?    // JSON array storing slab cost structures e.g. [{"from": 1, "to": 1000, "fee": 1.50}]
    priorityWeight    Int      @default(1)
    isActive          Boolean  @default(true)
    createdAt         DateTime @default(now())
    updatedAt         DateTime @updatedAt
  }
  ```

  ### 6.2 Redis Cache
  - **Key**: `routing:costs`
  - **Structure**: `HASH` containing JSON cost mappings per provider ID.

  ---

  ## 7. Audit Immutability

  - **Constraint**: Database triggers are applied to the `RoutingAuditLog` table to abort any `UPDATE` or `DELETE` requests.
  - **Log Archiving Policy**:
    - 90 Days: Real-time telemetry log partition dropped.
    - 180 Days: General operational audit logs moved to cold storage.
    - 1 Year: Financial sequence trace records dropped.

  ---

  ## 8. Simulator Load Protection

  To protect the server from load issues caused by high simulation usage:
  - **Rate Limiting**: Integrated via sliding window rate limiter in Redis (`routing:simulator:limit:{userId}`). Permits up to 20 simulation queries per user per minute.
  - **Input Caching**: Identical query parameters are hashed (e.g. `MD5` value of the input keys) and cached for 10 seconds.

  ---

  ## 9. Observability & Prometheus Metrics

  We register the following Prometheus format metric names:

  - `dizipay_route_resolution_duration_seconds` (Histogram): Latency of the resolver in milliseconds.
  - `dizipay_provider_failover_count_total` (Counter): Counts route failovers per provider.
  - `dizipay_circuit_breaker_trips_total` (Counter): Logs circuit breaker state updates.
  - `dizipay_routing_cache_hits_total` (Counter): Monitored routing cache calls resolved successfully.
  - `dizipay_routing_cache_misses_total` (Counter): Requests falling back to database query actions.
  - `dizipay_weighted_distribution_accuracy_deviation` (Gauge): Current traffic deviation from designated target weights.

  ---

  ## 10. Rollback Execution Playbook

  ### Scenario A: Bad Rule Deployment
  - **Detection**: Success rate drops below 85% or latency spikes on the resolved path.
  - **Containment**: Instantly toggle `shadowRoutingEnabled` to `true` via Redis CLI or Admin panel to fallback to legacy single-provider routing.
  - **Rollback**: Trigger version revert on `RoutingRuleVersion` to redeploy the previous snapshot.
  - **Verification**: Run simulator tests and assert that routing decisions match expectations.

  ### Scenario B: Redis Outage
  - **Detection**: Connection timeout errors logged in `server`.
  - **Containment**: Route queries fall back to direct MySQL queries using local database pool nodes.
  - **Rollback**: Restart Redis instance, check status, and execute cache rebuild.
  - **Verification**: Ensure cache hits count resumes growth.

  ### Scenario C: Database Outage
  - **Detection**: Prisma query failures in server logs.
  - **Containment**: Freeze rules configuration updates. Active routing is served from memory/Redis.
  - **Rollback**: Restore database clustering state, re-establish connection pool.
  - **Verification**: Run diagnostic query tools.

  ### Scenario D: Provider Failure Storm
  - **Detection**: Consecutive execution failures across multiple provider gateways.
  - **Containment**: Emergency override forced routing is activated to direct traffic to backup providers.
  - **Rollback**: Once remote systems recover, restore circuit breaker status.
  - **Verification**: Confirm transaction success rates return to baseline levels.

  ### Scenario E: Smart Routing Failure
  - **Detection**: Faulty weight outputs result in dead loops.
  - **Containment**: Set `smartRoutingEnabled` to `false` via Redis to default back to static PRIORITY routing.
  - **Rollback**: Review and patch cost scoring variables.
  - **Verification**: Run verification suite mocks.

  ---

  ## 11. Security Hardening

  - **Input Validation**: All rule and mapping update schemas are strictly validated via Joi or Zod before hitting DB handlers.
  - **CSRF & Replay**: All administrative write operations demand active CSRF tokens and include nonce replay checks.
  - **Meticulous Log Trail**: Every write action on freeze, override, or fallback settings is written directly to `RoutingAuditLog`.
