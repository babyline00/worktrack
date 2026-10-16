import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Release signing credentials, read once.
//
// `android/key.properties` and the keystore it points at are both gitignored, so
// on a fresh clone this file is simply absent. That is the point: the release
// build then falls back to debug signing and still succeeds, instead of failing
// halfway through Gradle with a keystore error that looks like a broken build.
val signingProps = Properties().apply {
    val f = rootProject.file("key.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
val hasReleaseSigningKey =
    signingProps.getProperty("storeFile")?.let { rootProject.file(it).exists() } == true

// Printed with `println` rather than `logger.warn` on purpose. A warning that
// is easy to miss (or suppressed by Gradle's log level or the configuration
// cache) means a release can quietly end up debug-signed and only be noticed
// when it refuses to install on a phone. This lands in the build output every
// time, and says what to do about it.
if (!hasReleaseSigningKey) {
    println(
        "\n" +
            "=========================================================\n" +
            "  WARNING: no release signing key found.\n" +
            "  This build is signed with the DEBUG key: it will only\n" +
            "  install on machines that hold the debug key and cannot be\n" +
            "  updated in place.\n" +
            "  To sign properly, create android/key.properties from\n" +
            "  key.properties.example and generate a keystore.\n" +
            "=========================================================\n"
    )
}

android {
    namespace = "com.worktrack.worktrack"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        // Required by flutter_local_notifications for java.time on older APIs.
        isCoreLibraryDesugaringEnabled = true
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.worktrack.worktrack"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseSigningKey) {
            create("release") {
                storeFile = rootProject.file(signingProps.getProperty("storeFile"))
                storePassword = signingProps.getProperty("storePassword")
                keyAlias = signingProps.getProperty("keyAlias")
                keyPassword = signingProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            // Signed with the project keystore so the APK installs on other
            // people's phones and can be updated in place. With no credentials
            // present it still builds, signed with the debug key, and says so
            // loudly above.
            signingConfig = if (hasReleaseSigningKey) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
        }
    }
}


kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
}

flutter {
    source = "../.."
}
