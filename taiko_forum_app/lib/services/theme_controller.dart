import "package:flutter/material.dart";
import "package:shared_preferences/shared_preferences.dart";

enum AppThemePreference { system, light, dark }

class ThemeController extends ChangeNotifier {
  static const _themeKey = "forum_theme_preference";

  AppThemePreference _preference = AppThemePreference.system;

  AppThemePreference get preference => _preference;

  ThemeMode get themeMode {
    switch (_preference) {
      case AppThemePreference.light:
        return ThemeMode.light;
      case AppThemePreference.dark:
        return ThemeMode.dark;
      case AppThemePreference.system:
        return ThemeMode.system;
    }
  }

  Future<void> restore() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_themeKey) ?? "system";
    _preference = AppThemePreference.values.firstWhere(
      (item) => item.name == raw,
      orElse: () => AppThemePreference.system,
    );
    notifyListeners();
  }

  Future<void> setPreference(AppThemePreference value) async {
    _preference = value;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_themeKey, value.name);
  }
}
