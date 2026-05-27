import "dart:convert";
import "dart:io";
import "dart:typed_data";

import "package:http/http.dart" as http;
import "package:http_parser/http_parser.dart";
import "package:mime/mime.dart";

import "../models/forum_models.dart";

class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

class LoginResult {
  const LoginResult({
    required this.user,
    required this.sessionToken,
    required this.expiresAt,
  });

  final AccountSummary user;
  final String sessionToken;
  final DateTime? expiresAt;
}

class ApiClient {
  ApiClient()
      : _client = http.Client(),
        baseUrl = const String.fromEnvironment(
          "TAIKO_FORUM_BASE_URL",
          defaultValue: "https://viewer.sakura-bot.cn",
        );

  final http.Client _client;
  final String baseUrl;
  String? _sessionToken;

  MediaType _guessImageMediaType(File file) {
    final mimeType = lookupMimeType(file.path) ?? "image/jpeg";
    return MediaType.parse(mimeType);
  }

  String _sanitizeServerMessage(String? raw) {
    final message = (raw ?? "")
        .replaceFirst(
            RegExp(r"^(Exception|ApiException)\s*:\s*", caseSensitive: false),
            "")
        .trim();
    if (message.isEmpty) {
      return "";
    }
    if (message.startsWith("<!DOCTYPE html") || message.startsWith("<html")) {
      return "";
    }
    return message;
  }

  String _defaultErrorMessage(int statusCode) {
    if (statusCode == 401 || statusCode == 403) {
      return "请先登录后再试";
    }
    if (statusCode == 404) {
      return "请求的内容不存在";
    }
    if (statusCode >= 500) {
      return "服务器开小差了，请稍后重试";
    }
    return "请求失败，请稍后重试";
  }

  void setSessionToken(String? token) {
    _sessionToken = token;
  }

  Future<Map<String, dynamic>> _getJson(
    String path, {
    Map<String, String>? query,
  }) async {
    final uri = Uri.parse("$baseUrl$path").replace(queryParameters: query);
    final response = await _client.get(uri, headers: _headers());
    return _decodeResponse(response);
  }

  Future<Map<String, dynamic>> _postJson(
    String path, {
    Object? body,
  }) async {
    final response = await _client.post(
      Uri.parse("$baseUrl$path"),
      headers: _headers(jsonBody: true),
      body: jsonEncode(body ?? const <String, dynamic>{}),
    );
    return _decodeResponse(response);
  }

  Future<Uint8List> _getBytes(String path) async {
    final response =
        await _client.get(Uri.parse("$baseUrl$path"), headers: _headers());
    if (response.statusCode >= 400) {
      _decodeResponse(response);
    }
    return response.bodyBytes;
  }

  Map<String, String> _headers({bool jsonBody = false}) {
    return {
      if (jsonBody) HttpHeaders.contentTypeHeader: "application/json",
      if (_sessionToken?.isNotEmpty == true)
        HttpHeaders.authorizationHeader: "Bearer $_sessionToken",
    };
  }

  Map<String, dynamic> _decodeResponse(http.Response response) {
    final Map<String, dynamic> payload;
    try {
      payload = response.body.isEmpty
          ? <String, dynamic>{}
          : jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {
      if (response.statusCode >= 400) {
        throw ApiException(_defaultErrorMessage(response.statusCode),
            statusCode: response.statusCode);
      }
      throw const ApiException("响应解析失败，请稍后重试");
    }
    if (response.statusCode >= 400) {
      final message = _sanitizeServerMessage(
        payload["statusMessage"] as String? ?? payload["message"] as String?,
      );
      throw ApiException(
        message.isEmpty ? _defaultErrorMessage(response.statusCode) : message,
        statusCode: response.statusCode,
      );
    }
    return payload;
  }

  Future<LoginResult> login({
    required String identifier,
    required String password,
  }) async {
    final payload = await _postJson(
      "/api/account/auth/login",
      body: {
        "identifier": identifier,
        "password": password,
      },
    );
    return LoginResult(
      user: AccountSummary.fromJson(payload["user"] as Map<String, dynamic>? ??
          const <String, dynamic>{}),
      sessionToken: payload["sessionToken"] as String? ?? "",
      expiresAt: DateTime.tryParse(payload["expiresAt"] as String? ?? ""),
    );
  }

  Future<void> sendRegisterCode(String email) async {
    await _postJson(
      "/api/account/auth/send-code",
      body: {
        "email": email,
        "purpose": "register",
      },
    );
  }

  Future<void> sendResetPasswordCode(String email) async {
    await _postJson(
      "/api/account/auth/send-code",
      body: {
        "email": email,
        "purpose": "reset",
      },
    );
  }

  Future<void> register({
    required String username,
    required String email,
    required String code,
    required String password,
  }) async {
    await _postJson(
      "/api/account/auth/register",
      body: {
        "username": username,
        "email": email,
        "code": code,
        "password": password,
      },
    );
  }

  Future<void> resetPassword({
    required String email,
    required String code,
    required String password,
  }) async {
    await _postJson(
      "/api/account/auth/reset-password",
      body: {
        "email": email,
        "code": code,
        "password": password,
      },
    );
  }

  Future<void> logout() async {
    await _postJson("/api/account/auth/logout");
  }

  Future<ForumHomePayload> fetchHome() async =>
      ForumHomePayload.fromJson(await _getJson("/api/forum/home"));

  Future<List<ForumSection>> fetchSections() async {
    final payload = await _getJson("/api/forum/sections");
    return (payload["items"] as List<dynamic>? ?? const [])
        .map((item) => ForumSection.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<ThreadListPayload> fetchThreads({
    String? sectionSlug,
    String sort = "latest",
    String? keyword,
    String? threadType,
    String? scope,
    bool includeHidden = false,
    int page = 1,
    int pageSize = 12,
  }) async {
    final payload = await _getJson(
      "/api/forum/threads",
      query: {
        "sort": sort,
        "page": "$page",
        "pageSize": "$pageSize",
        if (sectionSlug != null) "sectionSlug": sectionSlug,
        if (keyword?.isNotEmpty == true) "keyword": keyword!,
        if (threadType?.isNotEmpty == true) "threadType": threadType!,
        if (scope?.isNotEmpty == true) "scope": scope!,
        if (includeHidden) "includeHidden": "1",
      },
    );
    return ThreadListPayload.fromJson(payload);
  }

  Future<ForumThreadDetail> fetchThreadDetail(int id) async =>
      ForumThreadDetail.fromJson(await _getJson("/api/forum/threads/$id"));

  Future<void> createThread({
    required String sectionSlug,
    required String threadType,
    required String title,
    required String summary,
    required List<String> tags,
    String? songId,
    String? difficultyType,
    String? level,
    required List<Map<String, dynamic>> contentBlocks,
  }) async {
    await _postJson(
      "/api/forum/threads",
      body: {
        "sectionSlug": sectionSlug,
        "threadType": threadType,
        "title": title,
        "summary": summary,
        "tags": tags,
        "songId": songId,
        "difficultyType": difficultyType,
        "level": level,
        "contentBlocks": contentBlocks,
      },
    );
  }

  Future<String> uploadForumImage(File file) async {
    final request = http.MultipartRequest(
        "POST", Uri.parse("$baseUrl/api/forum/media/images"));
    if (_sessionToken?.isNotEmpty == true) {
      request.headers[HttpHeaders.authorizationHeader] =
          "Bearer $_sessionToken";
    }
    request.files.add(
      await http.MultipartFile.fromPath(
        "image",
        file.path,
        contentType: _guessImageMediaType(file),
      ),
    );
    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);
    final payload = _decodeResponse(response);
    return payload["imageUrl"] as String? ?? "";
  }

  Future<void> createReply({
    required int threadId,
    required String bodyText,
    required List<Map<String, dynamic>> contentBlocks,
    int? parentPostId,
  }) async {
    await _postJson(
      "/api/forum/threads/$threadId/replies",
      body: {
        "bodyText": bodyText,
        "contentBlocks": contentBlocks,
        if (parentPostId != null) "parentPostId": parentPostId,
      },
    );
  }

  Future<void> toggleThreadLike(int threadId) async {
    await _postJson("/api/forum/threads/$threadId/like");
  }

  Future<void> toggleThreadFavorite(int threadId, {bool? enabled}) async {
    await _postJson(
      "/api/forum/threads/$threadId/favorite",
      body: enabled == null ? null : {"enabled": enabled},
    );
  }

  Future<void> togglePostLike(int postId) async {
    await _postJson("/api/forum/posts/$postId/like");
  }

  Future<NotificationListPayload> fetchNotifications() async =>
      NotificationListPayload.fromJson(
          await _getJson("/api/forum/notifications"));

  Future<void> markAllNotificationsRead() async {
    await _postJson("/api/forum/notifications/read");
  }

  Future<AccountProfilePayload> fetchAccountProfile() async =>
      AccountProfilePayload.fromJson(await _getJson("/api/account/profile"));

  Future<ForumMeSummary> fetchMeSummary() async =>
      ForumMeSummary.fromJson(await _getJson("/api/forum/me/summary"));

  Future<ForumPreferences> fetchPreferences() async =>
      ForumPreferences.fromJson(await _getJson("/api/forum/preferences"));

  Future<ForumPreferences> updatePreferences({
    required bool recordHistoryEnabled,
  }) async {
    final payload = await _postJson(
      "/api/forum/preferences",
      body: {
        "recordHistoryEnabled": recordHistoryEnabled,
      },
    );
    return ForumPreferences.fromJson(
        payload["preferences"] as Map<String, dynamic>? ??
            const <String, dynamic>{});
  }

  Future<void> clearHistory() async {
    await _postJson("/api/forum/history/clear");
  }

  Future<void> submitFeedback({
    required String content,
    String? contact,
    String? appVersion,
    String? platform,
  }) async {
    await _postJson(
      "/api/forum/feedback",
      body: {
        "content": content,
        "contact": contact,
        "appVersion": appVersion,
        "platform": platform,
      },
    );
  }

  Future<RelationshipListPayload> fetchRelationships({
    required String scope,
    int page = 1,
    int pageSize = 20,
  }) async {
    final payload = await _getJson(
      "/api/forum/relationships",
      query: {
        "scope": scope,
        "page": "$page",
        "pageSize": "$pageSize",
      },
    );
    return RelationshipListPayload.fromJson(payload);
  }

  Future<ForumUserProfile> fetchUserProfile(int userId) async =>
      ForumUserProfile.fromJson(await _getJson("/api/forum/users/$userId"));

  Future<ForumRelationship> toggleFollow({
    required int userId,
    required bool enabled,
  }) async {
    final payload = await _postJson(
      "/api/forum/users/$userId/follow",
      body: {
        "enabled": enabled,
      },
    );
    return ForumRelationship.fromJson(
        payload["relationship"] as Map<String, dynamic>? ??
            const <String, dynamic>{});
  }

  Future<ForumRelationship> toggleBlock({
    required int userId,
    required bool enabled,
  }) async {
    final payload = await _postJson(
      "/api/forum/users/$userId/block",
      body: {
        "enabled": enabled,
      },
    );
    return ForumRelationship.fromJson(
        payload["relationship"] as Map<String, dynamic>? ??
            const <String, dynamic>{});
  }

  Future<Uint8List> fetchMyDonImage() async => _getBytes("/api/account/my-don");

  Future<String> uploadAvatar(File file) async {
    final request =
        http.MultipartRequest("POST", Uri.parse("$baseUrl/api/account/avatar"));
    if (_sessionToken?.isNotEmpty == true) {
      request.headers[HttpHeaders.authorizationHeader] =
          "Bearer $_sessionToken";
    }
    request.files.add(
      await http.MultipartFile.fromPath(
        "avatar",
        file.path,
        contentType: _guessImageMediaType(file),
      ),
    );
    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);
    final payload = _decodeResponse(response);
    return payload["avatarUrl"] as String? ?? "";
  }

  Future<void> removeAvatar() async {
    final response = await _client.delete(
      Uri.parse("$baseUrl/api/account/avatar"),
      headers: _headers(),
    );
    _decodeResponse(response);
  }

  Future<void> startBindingVerification(String taikoId) async {
    await _postJson(
      "/api/account/bindings/prepare",
      body: {
        "taikoId": taikoId,
      },
    );
  }

  Future<void> confirmBindingVerification(String taikoId) async {
    await _postJson(
      "/api/account/bindings/confirm",
      body: {
        "taikoId": taikoId,
      },
    );
  }

  Future<void> switchCurrentBinding(int bindingId) async {
    await _postJson(
      "/api/account/bindings/current",
      body: {
        "bindingId": bindingId,
      },
    );
  }

  Future<void> removeBinding({
    required int bindingId,
    bool force = false,
  }) async {
    await _postJson(
      "/api/account/bindings/remove",
      body: {
        "bindingId": bindingId,
        "force": force,
      },
    );
  }

  Future<void> moderateThread({
    required int threadId,
    required String action,
    required bool enabled,
  }) async {
    await _postJson(
      "/api/forum/moderation/action",
      body: {
        "threadId": threadId,
        "action": action,
        "enabled": enabled,
      },
    );
  }
}
