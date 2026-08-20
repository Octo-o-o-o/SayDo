package com.octoooo.saydo

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

class ConnectionStore(context: Context) {
    private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    private val tokenStore = TokenStore(context)

    var profiles: List<DesktopProfile> = loadProfiles()
        private set

    var currentId: String? = preferences.getString(CURRENT_ID_KEY, null)
        private set

    init {
        if (profiles.none { it.id == currentId }) {
            currentId = profiles.firstOrNull()?.id
        }
    }

    val currentProfile: DesktopProfile?
        get() = profiles.firstOrNull { it.id == currentId }

    fun add(profile: DesktopProfile) {
        tokenStore.write(profile.id, profile.token)
        val previousProfiles = profiles
        val previousCurrentId = currentId
        profiles = profiles + profile
        currentId = profile.id
        if (!persist()) {
            profiles = previousProfiles
            currentId = previousCurrentId
            tokenStore.delete(profile.id)
            throw ProfilePersistenceException()
        }
    }

    fun select(id: String) {
        if (profiles.none { it.id == id }) return
        val previousCurrentId = currentId
        currentId = id
        if (!persist()) {
            currentId = previousCurrentId
            throw ProfilePersistenceException()
        }
    }

    fun delete(id: String) {
        val previousProfiles = profiles
        val previousCurrentId = currentId
        profiles = profiles.filterNot { it.id == id }
        if (currentId == id) {
            currentId = profiles.firstOrNull()?.id
        }
        if (!persist()) {
            profiles = previousProfiles
            currentId = previousCurrentId
            throw ProfilePersistenceException()
        }
        tokenStore.delete(id)
    }

    private fun loadProfiles(): List<DesktopProfile> {
        val rawProfiles = preferences.getString(PROFILES_KEY, null) ?: return emptyList()
        return runCatching {
            val array = JSONArray(rawProfiles)
            buildList {
                for (index in 0 until array.length()) {
                    val item = array.getJSONObject(index)
                    val id = item.getString("id")
                    add(
                        DesktopProfile(
                            id = id,
                            name = item.getString("name"),
                            url = item.getString("url"),
                            token = tokenStore.read(id).orEmpty(),
                        ),
                    )
                }
            }
        }.getOrDefault(emptyList())
    }

    private fun persist(): Boolean {
        val array = JSONArray()
        profiles.forEach { profile ->
            array.put(
                JSONObject()
                    .put("id", profile.id)
                    .put("name", profile.name)
                    .put("url", profile.url),
            )
        }

        val editor = preferences.edit().putString(PROFILES_KEY, array.toString())
        if (currentId == null) {
            editor.remove(CURRENT_ID_KEY)
        } else {
            editor.putString(CURRENT_ID_KEY, currentId)
        }
        return editor.commit()
    }

    private companion object {
        const val PREFERENCES_NAME = "saydo.desktopProfiles"
        const val PROFILES_KEY = "profiles"
        const val CURRENT_ID_KEY = "currentDesktopId"
    }
}

class ProfilePersistenceException : IllegalStateException("无法保存桌面列表，请重试")
