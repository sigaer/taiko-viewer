import "package:flutter/widgets.dart";
import "package:provider/provider.dart";

import "../services/api_client.dart";
import "../services/app_message_controller.dart";

extension AppMessageHelper on BuildContext {
  String _sanitizeMessage(String message, {required String fallback}) {
    final normalized = message
        .replaceFirst(
            RegExp(r"^(Exception|ApiException)\s*:\s*", caseSensitive: false),
            "")
        .trim();
    if (normalized.isEmpty) {
      return fallback;
    }
    if (normalized.contains("SocketException") ||
        normalized.contains("ClientException") ||
        normalized.contains("HandshakeException") ||
        normalized.contains("Connection") ||
        normalized.contains("XMLHttpRequest")) {
      return "网络异常，请稍后再试";
    }
    if (normalized.startsWith("Request failed:") ||
        normalized.startsWith("FormatException") ||
        normalized.startsWith("type '") ||
        normalized.startsWith("<!DOCTYPE html") ||
        normalized.startsWith("<html")) {
      return fallback;
    }
    return normalized;
  }

  void showInfoMessage(String message) {
    read<AppMessageController>().showInfo(message);
  }

  void showSuccessMessage(String message) {
    read<AppMessageController>().showSuccess(message);
  }

  void showErrorMessage(
    String message, {
    String fallback = "操作失败，请稍后重试",
  }) {
    read<AppMessageController>()
        .showError(_sanitizeMessage(message, fallback: fallback));
  }

  void showOperationError(
    Object error, {
    String fallback = "操作失败，请稍后重试",
  }) {
    final raw = switch (error) {
      ApiException apiException => apiException.message,
      _ => error.toString(),
    };
    showErrorMessage(raw, fallback: fallback);
  }
}
