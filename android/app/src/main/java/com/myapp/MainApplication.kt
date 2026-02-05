package com.myapp

import android.app.Application
import android.util.Log
import android.content.Context
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.scaniship.packages.ScanishipPackage
import io.sentry.android.core.SentryAndroid
import io.sentry.Sentry
import io.sentry.SentryEvent
import io.sentry.SentryLevel
import android.os.Build
import java.io.File
import java.util.zip.ZipFile

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          val hasNativeLib = hasDevApiNativeLib(applicationContext)
          Log.d("MainApplication", "React packages before filter=${map { it.javaClass.name }}")
          if (!hasNativeLib) {
            Log.d("MainApplication", "libdevapi.so not found; filtering vendor UHF package for emulator/unsupported devices.")
            val before = size
            removeAll { it.javaClass.name == "com.scaniship.packages.ScanishipPackage" }
            Log.d("MainApplication", "Removed ${before - size} vendor UHF package(s); remaining packages=$size")
          } else {
            Log.d("MainApplication", "libdevapi.so detected; keeping vendor UHF package.")
            // Ensure our vendor package is present (autolinking won't add it automatically).
            if (none { it.javaClass.name == "com.scaniship.packages.ScanishipPackage" }) {
              add(ScanishipPackage())
              Log.d("MainApplication", "Manually added ScanishipPackage() after detecting libdevapi.so")
            }
          }
          if (none { it.javaClass.name == "com.myapp.SentryBridgePackage" }) {
            add(SentryBridgePackage())
          }
          if (none { it.javaClass.name == "com.myapp.AppInfoPackage" }) {
            add(AppInfoPackage())
          }
          Log.d("MainApplication", "React packages after filter=${map { it.javaClass.name }}")
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    SentryAndroid.init(this) { options ->
      options.dsn = "https://88bf3d5803f9f8e8dcf50616ddd8d212@o4510821508513792.ingest.us.sentry.io/4510821511921664"
      options.tracesSampleRate = 0.2
      options.environment = BuildConfig.BUILD_TYPE
      options.release = "${BuildConfig.APPLICATION_ID}@${BuildConfig.VERSION_NAME}+${BuildConfig.VERSION_CODE}"
      options.beforeSend = io.sentry.SentryOptions.BeforeSendCallback { event: SentryEvent, _ ->
        attachMemoryStats(event)
        if (isOutOfMemory(event)) {
          event.setTag("crash_reason", "oom")
        }
        event
      }
    }
    Sentry.configureScope { scope ->
      scope.setTag("app_version", BuildConfig.VERSION_NAME)
      scope.setTag("device", Build.MODEL)
    }
    loadReactNative(this)
  }

  override fun onLowMemory() {
    super.onLowMemory()
    reportMemoryPressure("low_memory")
  }

  override fun onTrimMemory(level: Int) {
    super.onTrimMemory(level)
    reportMemoryPressure("trim_memory_$level")
  }
}

private fun isOutOfMemory(event: SentryEvent): Boolean {
  val throwable = event.throwable
  if (throwable is OutOfMemoryError) return true
  val exceptions = event.exceptions ?: return false
  return exceptions.any { ex ->
    val type = ex.type ?: return@any false
    type.contains("OutOfMemoryError", ignoreCase = true) ||
      type.contains("OOM", ignoreCase = true)
  }
}

private fun attachMemoryStats(event: SentryEvent) {
  val runtime = Runtime.getRuntime()
  val used = runtime.totalMemory() - runtime.freeMemory()
  event.setExtra("mem_used_mb", ((used / 1024 / 1024)).toString())
  event.setExtra("mem_free_mb", ((runtime.freeMemory() / 1024 / 1024)).toString())
  event.setExtra("mem_total_mb", ((runtime.totalMemory() / 1024 / 1024)).toString())
  event.setExtra("mem_max_mb", ((runtime.maxMemory() / 1024 / 1024)).toString())
}

private fun reportMemoryPressure(reason: String) {
  val runtime = Runtime.getRuntime()
  Sentry.withScope { scope ->
    scope.setTag("memory_pressure", reason)
    scope.setExtra("mem_used_mb", (((runtime.totalMemory() - runtime.freeMemory()) / 1024 / 1024)).toString())
    scope.setExtra("mem_free_mb", ((runtime.freeMemory() / 1024 / 1024)).toString())
    scope.setExtra("mem_total_mb", ((runtime.totalMemory() / 1024 / 1024)).toString())
    scope.setExtra("mem_max_mb", ((runtime.maxMemory() / 1024 / 1024)).toString())
    Sentry.captureMessage("Memory pressure: $reason", SentryLevel.WARNING)
  }
}

private fun hasDevApiNativeLib(context: Context): Boolean {
  val libDir = context.applicationInfo.nativeLibraryDir
  val extractedCandidates = listOfNotNull(
    libDir?.let { "$it/libdevapi.so" },
    "/system/lib/libdevapi.so",
    "/system/lib64/libdevapi.so",
    "/vendor/lib/libdevapi.so",
    "/vendor/lib64/libdevapi.so",
  )
  if (extractedCandidates.any { path -> File(path).exists() }) {
    return true
  }

  // On newer Android versions native libs may not be extracted to nativeLibraryDir.
  // Fallback: inspect the APK to see if libdevapi.so exists for any supported ABI.
  val apkPath = context.applicationInfo.sourceDir ?: return false
  return try {
    ZipFile(apkPath).use { zip ->
      val abis = listOf("arm64-v8a", "armeabi-v7a", "armeabi")
      abis.any { abi -> zip.getEntry("lib/$abi/libdevapi.so") != null }
    }
  } catch (_: Exception) {
    false
  }
}
