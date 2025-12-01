package com.myapp

import android.app.Application
import android.util.Log
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import java.io.File

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          val hasNativeLib = hasDevApiNativeLib()
          Log.d("MainApplication", "React packages before filter=${map { it.javaClass.name }}")
          if (!hasNativeLib) {
            Log.d("MainApplication", "libdevapi.so not found; filtering vendor UHF package for emulator/unsupported devices.")
            val before = size
            removeAll { it.javaClass.name == "com.scaniship.packages.ScanishipPackage" }
            Log.d("MainApplication", "Removed ${before - size} vendor UHF package(s); remaining packages=$size")
          } else {
            Log.d("MainApplication", "libdevapi.so detected; keeping vendor UHF package.")
          }
          Log.d("MainApplication", "React packages after filter=${map { it.javaClass.name }}")
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}

private fun hasDevApiNativeLib(): Boolean {
  val candidates = listOf(
    "/system/lib/libdevapi.so",
    "/system/lib64/libdevapi.so",
    "/vendor/lib/libdevapi.so",
    "/vendor/lib64/libdevapi.so",
  )
  return candidates.any { path -> File(path).exists() }
}
