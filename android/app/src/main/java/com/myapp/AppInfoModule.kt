package com.myapp

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class AppInfoModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String {
    return "AppInfo"
  }

  @ReactMethod
  fun getAppVersion(promise: Promise) {
    try {
      val context = reactApplicationContext
      val pm = context.packageManager
      val pkg = context.packageName
      val info = pm.getPackageInfo(pkg, 0)
      val versionName = info.versionName ?: "0"
      val versionCode = info.longVersionCode.toString()
      val map = mutableMapOf<String, String>()
      map["versionName"] = versionName
      map["versionCode"] = versionCode
      promise.resolve(com.facebook.react.bridge.Arguments.makeNativeMap(map))
    } catch (error: Exception) {
      promise.reject("APP_INFO_ERROR", error)
    }
  }
}
