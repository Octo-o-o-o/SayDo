import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import java.io.File

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

fun debugKeystoreFile(): File {
    val file = rootProject.file("debug.keystore")
    if (!file.exists()) {
        val keytool = File(System.getProperty("java.home"), "bin/keytool")
        val process = ProcessBuilder(
            keytool.absolutePath,
            "-genkeypair",
            "-keystore", file.absolutePath,
            "-storepass", "android",
            "-alias", "androiddebugkey",
            "-keypass", "android",
            "-keyalg", "RSA",
            "-keysize", "2048",
            "-validity", "10000",
            "-dname", "CN=Android Debug,O=Android,C=US",
        ).inheritIO().start()
        check(process.waitFor() == 0) { "failed to create local debug keystore" }
    }
    return file
}

android {
    namespace = "com.octoooo.saydo"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.octoooo.saydo"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
    }

    signingConfigs {
        getByName("debug") {
            storeFile = debugKeystoreFile()
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("debug")
        }
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")
    testImplementation("junit:junit:4.13.2")
}
