# Project Agent Guide

## One-Page Summary
- Purpose: RFID scan → batch upload → history + billing logs.
- Core flow: Scan (UHF native) → normalize EPC → create batch → queue → chunked upload → history.
- Stability: sync lock + timeouts + backoff; scan list throttling; memory pressure handling.
- Observability: Sentry native only; JS emits warnings/metrics via bridge.
- Updates: GitHub Releases, tag `v<versionName>-<versionCode>`, APK attached.
- Env switches: `src/config/api.ts` (`ACTIVE_ENV`), billing in `src/services/billingLog.ts` (`BILLING_ENABLED`).

## Pre-Release Checklist
- `versionName` / `versionCode` bumped and consistent with tag.
- `ACTIVE_ENV` correct (production or staging).
- `BILLING_ENABLED` correct (true/false).
- Release APK builds without errors.
- GitHub Release created with correct tag + APK asset.

## Common Risks
- Old APK still installed → SentryInitProvider crash persists.
- `versionCode` not increasing → update install fails.
- Missing APK asset in Release → update check fails.
- High scan rate → memory pressure events (expected but noisy).

## Versioning & Rollback
- Tag format: `v<versionName>-<versionCode>`
- `versionCode` must always increase
- Rollback = ship a new build with higher `versionCode` and older code

## Release Notes Template
```
## vX.Y.Z-N
- Summary:
- Key changes:
  - 
  - 
- Fixes:
  - 
- Known issues:
  - 
```

## FAQ
- Q: 為什麼沒有跳更新？
  - A: Release 沒有 `.apk` 或 tag 格式不對，或 `versionCode` 未增加。
- Q: Sentry 沒有事件？
  - A: 只會記錄 crash/錯誤/警告，非錯誤行為（例如登入失敗）不會上報。
- Q: 出現 `SentryInitProvider` crash？
  - A: 裝置仍是舊版 APK，請卸載後重裝新版。

## Performance Checks
- Scan stress: 500+ EPCs, UI should remain responsive.
- Upload test: 50/200/600 items, observe sync duration and failures.
- Background/foreground: switch apps during scan and sync.
- Memory pressure: keep scan running long time and watch for warnings.

## Context
- Project: React Native (Android focus)
- Language: TypeScript + Kotlin
- Workspace root: `c:\Users\User\Desktop\MyApp-1`

## Code Architecture
- Entry: `App.tsx` (route switching + update check modal)
- Screens:
  - Login: `src/screens/LoginScreen.tsx`
  - Main: `src/screens/MainScreen.tsx`
  - Scan: `src/screens/Scan/ScanScreen.tsx`
  - History: `src/screens/History/HistoryBatchScreen.tsx`, `src/screens/History/HistoryTagScreen.tsx`
  - Settings: `src/screens/Settings/SettingsPinScreen.tsx`, `SettingsHardwareScreen.tsx`, `SettingsApiScreen.tsx`
- Services:
  - Auth: `src/services/auth.ts`
  - Logistics: `src/services/logistics.ts`
  - Sync/Upload: `src/services/rf300.ts`
  - Billing: `src/services/billingLog.ts`
  - Update check: `src/services/update.ts`
- Storage:
  - Session: `src/storage/session.ts`
  - Queue: `src/storage/batchQueue.ts`
  - History: `src/storage/history.ts`
  - Billing logs: `src/storage/billingLogs.ts`

## Native Modules
- UHF: `android/app/src/main/java/com/packages/ScanishipModule.kt`
- Sentry bridge: `android/app/src/main/java/com/myapp/SentryBridgeModule.kt`
- AppInfo: `android/app/src/main/java/com/myapp/AppInfoModule.kt`

## Key Behaviors
- Scan limit: `MAX_ITEMS` in `src/screens/Scan/ScanScreen.tsx`
- Sync timing metrics: emitted by `src/services/rf300.ts` via `sentryBridge`
- Sentry tags: set in `App.tsx` and `ScanScreen.tsx`

## UHF Native Flow (High-Level)
- JS starts scan:
  - `ScanScreen.tsx` → `uhf.start(dbm)` (via native module)
- Native read loop:
  - `ScanishipModule.inventoryEPC()` starts reader thread
  - `inventoryThread` collects tag data via `UHFRManager`
  - Tags are stored in `tagInfoMap` / `listEPC` with synchronization
- Emit to JS:
  - `Handler(MSG_INVENROTY)` snapshots `listEPC`
  - Emits `tagInfoList` event to JS
- Stop scan:
  - `uhf.stop()` → `asyncStopReading()` + handler cleanup

## Sync/Upload Flow (High-Level)
- User taps Upload:
  - `ScanScreen.tsx` → `enqueueBatch()` → `syncQueuedBatches()`
- Queue sync:
  - `rf300.ts` loads queued batches
  - Each batch split into chunks (default 50)
  - Each chunk uploaded with timeout + retry/backoff
  - Success → remove batch, store in history
  - Failure → keep batch/chunks for retry
- Billing:
  - On success, build billing meta and `recordBillingLog()`
  - If billing send fails, enqueue for retry

## Error Handling & Retry
- Network failures:
  - Backoff with exponential delay
  - Consecutive network failures stop sync
- Timeouts:
  - Per-batch timeout and total sync timeout
- Safe guards:
  - Sync lock prevents concurrent syncs
  - AsyncStorage parse failures are caught and cleaned

## Memory Pressure Strategy
- Native (Android):
  - `onLowMemory` and `onTrimMemory` send Sentry warning
  - Memory stats attached to events
- JS (ScanScreen):
  - High-water warnings sent to Sentry
  - On memory warning, reduce list size and stop scan

## Sentry Event Types (Current)
- Crash events (native)
- Memory pressure warnings:
  - `Memory pressure: low_memory`
  - `Memory pressure: trim_memory_<level>`
- Sync duration metric:
  - `RF300:sync_duration ms=... total=... synced=... failed=...`
- Scan warnings:
  - `ScanScreen:high_water ...`
  - `ScanScreen:memory_pressure ...`
- API errors:
  - `API_ERROR ...` from `src/services/sentryReport.ts`

## Quick Start For Other AIs
- Project purpose: RFID scan → batch upload → history + billing logs.
- Core flow:
  - Scan tags (UHF native) → normalize EPC → list in Scan screen.
  - Upload creates batch → queued → sync service uploads in chunks.
  - Success → history; failure → retry + error detail.
- Stability features:
  - Sync lock, timeouts, backoff, chunk window.
  - Scan list throttling, high-water warnings, memory pressure trimming.
- Observability:
  - Sentry native only; JS uses bridge to emit metrics/warnings.
  - Update checks via GitHub Releases.

## Data Structures (Summary)
- Session (`src/storage/session.ts`):
  - `token`, `expiresAt`, `user { id, account, name, node, branch }`
- QueuedBatch (`src/storage/batchQueue.ts`):
  - `id`, `createdAt`, `batchNumber`, `warehouseLabel`, `mode`, `orderNumber?`, `date`
  - `epkIds[]`, `node`, `logisticId`, `vendorId`, `vendorBranchId`, `ownerAccount`, `ownerUserId`
  - `chunkSize?`, `chunkStates?`
- BatchChunkState:
  - `index`, `start`, `end`, `status`, `undefinedCount?`, `error?`, `lastTriedAt?`
- BillingLog (`src/storage/billingLogs.ts`):
  - `requestId`, `deviceId`, `targetEndpoint`, `httpMethod`, `httpStatus`
  - `requestPayloadHash`, `responsePayloadHash`, `startDateTime`, `endDateTime`, `createdAt?`
- BillingMeta (`src/services/billingLog.ts`):
  - `requestId`, `targetEndpoint`, `httpMethod`, `httpStatus`
  - `requestPayload`, `responsePayload`, `startDateTime`, `endDateTime`
- LogisticBranch (`src/services/logistics.ts`):
  - `label`, `id`, `branch_id`

## API Endpoints & Payloads
- Base URL: `src/config/api.ts` (`apiConfig.baseUrl`)
- `POST /api/rfid/login`
  - Body: `{ account, password }`
  - Headers: `X-Timestamp`, `X-API-Key`, `X-Signature`
- `GET /api/rfid/getLogisticBranch?id=<userId>`
  - Headers: `Authorization: Bearer <token>`
- `POST /api/rfid/rfidInsert`
  - Body: `{ node, status, logi_id, techOrRepo_id, techOrRepo_branch_id, order_number, epk_array }`
  - Headers: `Authorization: Bearer <token>`

## Error Codes / Response Notes
- RF300 upload errors:
  - Mapped in `src/services/rf300.ts` (`mapRf300Error`)
  - Common cases: `network request failed`, `500`, `order_number is required`, `order_number does not exist`,
    `logi_id must be 0`, `repository does not exist`, `status error`, `logistic branch does not exist`,
    `epk_id does not exist`, `must be ...`
- Billing API:
  - Expects `ResultCode` of `0` or `OK` as success (`src/services/billingLog.ts`)
  - Other `ResultCode` values are treated as errors
- Login/Branch:
  - Non-200 or `success=false` raises error with server `message`

## API Request/Response Examples (Simplified)
- Login:
  - Request:
    ```json
    {
      "account": "demo",
      "password": "******"
    }
    ```
  - Response:
    ```json
    {
      "success": true,
      "message": "Successfully.",
      "data": {
        "user": { "id": 1, "account": "demo", "name": "User", "node": 1, "branch": 0 },
        "token": "jwt..."
      }
    }
    ```
- Logistic Branch:
  - Response:
    ```json
    {
      "success": true,
      "message": "Successfully.",
      "data": [
        { "label": "Branch A", "id": 1, "branch_id": 1 }
      ]
    }
    ```
- RFID Insert:
  - Request:
    ```json
    {
      "node": 1,
      "status": 1,
      "logi_id": 0,
      "techOrRepo_id": 1,
      "techOrRepo_branch_id": 1,
      "order_number": "SO-001",
      "epk_array": ["E200...", "E200..."]
    }
    ```
  - Response:
    ```json
    {
      "success": true,
      "message": "Successfully.",
      "data": { "total": 2, "success": 2, "repeat": 0, "undefined": 0 }
    }
    ```

## Billing API Example
- Endpoint: `POST https://packageapi.scanique.tw/api/F001Log/AddLogRecord`
- Request (simplified):
  ```json
  {
    "requestId": "uuid-v5",
    "deviceId": "device-model",
    "targetEndpoint": "/api/rfid/rfidInsert",
    "httpMethod": "POST",
    "httpStatus": 200,
    "requestPayloadHash": "sha256...",
    "responsePayloadHash": "sha256...",
    "startDateTime": "2026-02-05T12:34:56.000Z",
    "endDateTime": "2026-02-05T12:34:57.000Z"
  }
  ```
- Response (success):
  ```json
  { "ResultCode": "0" }
  ```

## Sentry Event Examples
- Memory pressure:
  - `Memory pressure: trim_memory_20`
- Sync duration:
  - `RF300:sync_duration ms=1234 total=5 synced=5 failed=0 mode=IN error=none`
- Scan high-water:
  - `ScanScreen:high_water items=450 pendingAdds=0`

## Build/Run
- Android debug: `npm run android`
- Android release APK: `cd android && .\gradlew assembleRelease`
- APK output: `android/app/build/outputs/apk/release/app-release.apk`

## Release Steps (Manual)
1. Bump version in `android/app/build.gradle`:
   - `versionName`
   - `versionCode` (must increase)
2. Build release APK:
   - `cd android && .\gradlew assembleRelease`
3. Create GitHub Release:
   - Tag: `v<versionName>-<versionCode>`
   - Upload APK asset
4. App update check:
   - App auto-checks on launch
   - Manual check in Settings → API 設定 → 檢查更新

## Test Checklist (Release)
- Login success & failure paths
- Start/stop scan repeatedly (UI remains responsive)
- Upload with small batch (e.g., 50) and medium batch (e.g., 200+)
- Network drop during sync (ensure backoff + retry)
- Verify Sentry receives:
  - Crash events
  - Memory pressure warnings
  - Sync duration metrics

## Troubleshooting
- Gradle wrapper lock error:
  - Close other Gradle builds and retry
  - If needed, rerun `.\gradlew assembleRelease`
- SentryInitProvider crash:
  - Ensure old APK is uninstalled
  - Confirm `AndroidManifest.xml` removes provider
- Update check not working:
  - Ensure Release tag format is `v<versionName>-<versionCode>`
  - Ensure APK is attached to Release
- Cannot install update:
  - `versionCode` must increase

## Rollback
- Create a new Release with a higher `versionCode`
- Upload a known good APK
- App update check will recommend the latest higher version

## Release/Update
- GitHub release repo: `NeilLO0/scaniship_my`
- Tag format: `v<versionName>-<versionCode>`
- APK must be attached to Release (any `.apk` name is OK)

## Environments
- API env switch: `src/config/api.ts` (`ACTIVE_ENV`)
- Billing switch: `src/services/billingLog.ts` (`BILLING_ENABLED`)

## Sentry
- Native Android SDK only (no JS SDK)
- Manual init in `android/app/src/main/java/com/myapp/MainApplication.kt`
- SentryInitProvider removed in `android/app/src/main/AndroidManifest.xml`

## Scan Limits & Performance
- Scan item limit: `src/screens/Scan/ScanScreen.tsx` (`MAX_ITEMS`)
- High-water and memory pressure signals are emitted to Sentry

## Update Check (App)
- Update check logic: `src/services/update.ts`
- Settings UI: `src/screens/Settings/SettingsApiScreen.tsx`

## Known Constraints
- `versionCode` must monotonically increase to allow install/update
