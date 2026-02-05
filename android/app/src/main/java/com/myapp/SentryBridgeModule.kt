package com.myapp

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import io.sentry.Sentry
import io.sentry.SentryLevel
import io.sentry.protocol.User

class SentryBridgeModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String {
    return "SentryBridge"
  }

  @ReactMethod
  fun setUser(userId: String?, account: String?) {
    Sentry.configureScope { scope ->
      if (userId.isNullOrBlank() && account.isNullOrBlank()) {
        scope.user = null
      } else {
        val user = User()
        if (!userId.isNullOrBlank()) user.id = userId
        if (!account.isNullOrBlank()) user.username = account
        scope.user = user
      }
    }
  }

  @ReactMethod
  fun setTag(key: String, value: String?) {
    Sentry.configureScope { scope ->
      if (value.isNullOrBlank()) {
        scope.removeTag(key)
      } else {
        scope.setTag(key, value)
      }
    }
  }

  @ReactMethod
  fun captureMessage(message: String, level: String?) {
    val sentryLevel = when (level?.lowercase()) {
      "debug" -> SentryLevel.DEBUG
      "info" -> SentryLevel.INFO
      "warning", "warn" -> SentryLevel.WARNING
      "fatal" -> SentryLevel.FATAL
      else -> SentryLevel.ERROR
    }
    Sentry.captureMessage(message, sentryLevel)
  }

  @ReactMethod
  fun clearContext() {
    Sentry.configureScope { scope ->
      scope.clear()
    }
  }
}
