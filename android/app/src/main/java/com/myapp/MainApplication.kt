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
