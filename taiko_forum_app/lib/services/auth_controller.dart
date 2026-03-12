import "package:flutter/foundation.dart";
import "package:shared_preferences/shared_preferences.dart";

import "../models/forum_models.dart";
import "api_client.dart";

class AuthController extends ChangeNotifier {
  AuthController(this._apiClient);

  static const _tokenKey = "forum_session_token";
  static const _usernameKey = "forum_username";
  static const _emailKey = "forum_email";
  static const _avatarKey = "forum_avatar";
  static const _userIdKey = "forum_user_id";
  static const _rememberCredentialsKey = "forum_remember_credentials";
  static const _rememberedIdentifierKey = "forum_remembered_identifier";
  static const _rememberedPasswordKey = "forum_remembered_password";

  final ApiClient _apiClient;
  AccountSummary? _user;
  String? _sessionToken;
  bool _loading = false;
  bool _rememberCredentials = false;
  String _rememberedIdentifier = "";
  String _rememberedPassword = "";

  AccountSummary? get user => _user;
  bool get isAuthenticated => _sessionToken?.isNotEmpty == true;
  bool get isLoading => _loading;
  bool get rememberCredentials => _rememberCredentials;
  String get rememberedIdentifier => _rememberedIdentifier;
  String get rememberedPassword => _rememberedPassword;

  Future<void> restoreSession() async {
    final prefs = await SharedPreferences.getInstance();
    _rememberCredentials = prefs.getBool(_rememberCredentialsKey) ?? false;
    _rememberedIdentifier = prefs.getString(_rememberedIdentifierKey) ?? "";
    _rememberedPassword = _rememberCredentials
        ? (prefs.getString(_rememberedPasswordKey) ?? "")
        : "";
    final token = prefs.getString(_tokenKey);
    if (token?.isEmpty ?? true) {
      notifyListeners();
      return;
    }
    _sessionToken = token;
    _apiClient.setSessionToken(token);
    _user = AccountSummary(
      id: prefs.getInt(_userIdKey) ?? 0,
      username: prefs.getString(_usernameKey) ?? "",
      email: prefs.getString(_emailKey) ?? "",
      avatarUrl: prefs.getString(_avatarKey) ?? "",
    );
    notifyListeners();
  }

  Future<void> login({
    required String identifier,
    required String password,
    bool rememberCredentials = false,
  }) async {
    _loading = true;
    notifyListeners();
    try {
      final result =
          await _apiClient.login(identifier: identifier, password: password);
      _sessionToken = result.sessionToken;
      _user = result.user;
      _apiClient.setSessionToken(_sessionToken);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_tokenKey, _sessionToken ?? "");
      await prefs.setString(_usernameKey, _user?.username ?? "");
      await prefs.setString(_emailKey, _user?.email ?? "");
      await prefs.setString(_avatarKey, _user?.avatarUrl ?? "");
      await prefs.setInt(_userIdKey, _user?.id ?? 0);
      _rememberCredentials = rememberCredentials;
      _rememberedIdentifier = rememberCredentials ? identifier : "";
      _rememberedPassword = rememberCredentials ? password : "";
      await prefs.setBool(_rememberCredentialsKey, rememberCredentials);
      if (rememberCredentials) {
        await prefs.setString(_rememberedIdentifierKey, identifier);
        await prefs.setString(_rememberedPasswordKey, password);
      } else {
        await prefs.remove(_rememberedIdentifierKey);
        await prefs.remove(_rememberedPasswordKey);
      }
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    try {
      await _apiClient.logout();
    } catch (_) {}
    _sessionToken = null;
    _user = null;
    _apiClient.setSessionToken(null);
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_usernameKey);
    await prefs.remove(_emailKey);
    await prefs.remove(_avatarKey);
    await prefs.remove(_userIdKey);
    notifyListeners();
  }

  Future<void> setRememberedCredentials({
    required bool enabled,
    String? identifier,
    String? password,
  }) async {
    _rememberCredentials = enabled;
    _rememberedIdentifier =
        enabled ? (identifier ?? _rememberedIdentifier) : "";
    _rememberedPassword = enabled ? (password ?? _rememberedPassword) : "";
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_rememberCredentialsKey, enabled);
    if (enabled) {
      await prefs.setString(_rememberedIdentifierKey, _rememberedIdentifier);
      await prefs.setString(_rememberedPasswordKey, _rememberedPassword);
    } else {
      await prefs.remove(_rememberedIdentifierKey);
      await prefs.remove(_rememberedPasswordKey);
    }
    notifyListeners();
  }

  Future<void> updateUser(AccountSummary user) async {
    _user = user;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_usernameKey, user.username);
    await prefs.setString(_emailKey, user.email);
    await prefs.setString(_avatarKey, user.avatarUrl);
    await prefs.setInt(_userIdKey, user.id);
    notifyListeners();
  }
}
