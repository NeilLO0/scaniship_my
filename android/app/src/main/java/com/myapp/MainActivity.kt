package com.myapp

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.ReactApplication
import com.facebook.react.modules.core.DeviceEventManagerModule
import android.view.KeyEvent
import android.util.Log

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "MyApp"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onKeyUp(keyCode: Int, event: KeyEvent?): Boolean {
    // Some PDA 掃描鍵會被映射成功能鍵；轉送給 JS 的 buttonClick 事件，保持與原生 KeyReceiver 同步。
    val triggerKeys = setOf(
      KeyEvent.KEYCODE_F1,
      KeyEvent.KEYCODE_F2,
      KeyEvent.KEYCODE_F3,
      KeyEvent.KEYCODE_F4,
      KeyEvent.KEYCODE_F5,
      KeyEvent.KEYCODE_F7
    )
    if (triggerKeys.contains(keyCode)) {
      Log.d("MainActivity", "onKeyUp keyCode=$keyCode")
      reactNativeHost.reactInstanceManager.currentReactContext
        ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        ?.emit("buttonClick", 1)
      return true
    }
    // 如果不是已知 keycode，打一筆 log 幫忙確認實機掃描鍵實際的 keycode。
    Log.d("MainActivity", "onKeyUp unknown keyCode=$keyCode")
    return super.onKeyUp(keyCode, event)
  }

  override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
    val triggerKeys = setOf(
      KeyEvent.KEYCODE_F1,
      KeyEvent.KEYCODE_F2,
      KeyEvent.KEYCODE_F3,
      KeyEvent.KEYCODE_F4,
      KeyEvent.KEYCODE_F5,
      KeyEvent.KEYCODE_F7
    )
    if (triggerKeys.contains(keyCode)) {
      Log.d("MainActivity", "onKeyDown keyCode=$keyCode")
      reactNativeHost.reactInstanceManager.currentReactContext
        ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        ?.emit("buttonClick", 1)
      return true
    }
    Log.d("MainActivity", "onKeyDown unknown keyCode=$keyCode")
    return super.onKeyDown(keyCode, event)
  }
}
