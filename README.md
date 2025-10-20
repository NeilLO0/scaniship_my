This is a new [**React Native**](https://reactnative.dev) project, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Getting Started

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Step 3: Modify your app

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.

---

## UI Flow (RFID 掃描系統)

下列流程依據 `ui/` 目錄的設計稿整理，僅文件說明，不改動程式碼。

### 流程圖

```mermaid
flowchart TD
  A[LoginScreen] -->|登入| B[MainScreen]

  subgraph 建立新批次卡片
    B --> C{選擇倉庫}
    C -->|A/B/C| D{選擇狀態}
    D --> J[輸入訂單編號]
    J -->|入庫| E[warehouse-in Scan Screen]
    J -->|出庫| F[out of warehouse Scan Screen]
  end

  E --> E1[Manual input Modal]
  F --> F1[Manual input Modal]

  E -->|開始/停止掃描| E2[Toast: Scan success/stop]
  F -->|開始/停止掃描| F2[Toast: Scan success/stop]

  E -->|上傳資料| B
  F -->|上傳資料| B

  B -->|掃描歷史| H[Scan History - Batch View]
  H --> I[Tag View]
  I --> H

  B -->|系統設定| S[設定驗證頁]
  S -->|驗證成功| T1[系統設定 - RFID 硬體]
  S -->|驗證成功| T2[系統設定 - API/關於]

  classDef dark fill:#0B0D14,stroke:#0B0D14,color:#fff;
  class A,B,E,F,H,I,S,T1,T2 dark
```

### 對應設計稿（`ui/`）
- Login: `ui/LoginScreen.png`
- Main（初始）: `ui/MainScreen-1.png`
- Main（已選）: `ui/MainScreen-2.png`
- Main（含訂單編號）: `ui/MainScreen-3.png`
- 倉庫下拉: `ui/MainScreen-drop-down menu.png`
- 狀態下拉: `ui/MainScreen-drop-down menu2.png`
- 入庫掃描：
  - 初始 `ui/warehouse-in Scan Screen.png`
  - 掃描中/成功 `ui/warehouse-in Scan success Screen.png`
- 出庫掃描：`ui/out of warehouse Scan Screen.png`
- 手動輸入彈窗：`ui/Manual input Screen.png`
- 提示（Toast）：
  - 成功 `ui/Scan successfully to create a pop-up window.png`
  - 停止 `ui/Scan stop pop-up window.png`
- 建立批次彈窗：`ui/Batch number creation pop-up window.png`
- 歷史：
  - 批次檢視 `ui/Scan History-Batch View Screen.png`
  - Tag 檢視 `ui/Tag View Screen.png`
- 設定驗證頁：`ui/setup login Screen.png`
- 系統設定 - RFID 硬體：`ui/setup  Screen.png`
- 系統設定 - API/關於：`ui/setup  Screen2.png`

### 程式對應（目前已實作）
- `src/screens/LoginScreen.tsx` — 登入頁
- `src/screens/MainScreen.tsx` — 首頁（含自製下拉元件）

掃描作業頁、歷史、設定可依此流程逐步擴充為對應的 React Native 畫面，維持設計稿配色與排版。
