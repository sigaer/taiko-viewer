import "dart:async";

import "package:flutter/foundation.dart";

enum AppMessageTone { info, success, error }

class AppMessageState {
  const AppMessageState({
    required this.id,
    required this.message,
    required this.tone,
  });

  final int id;
  final String message;
  final AppMessageTone tone;
}

class AppMessageController extends ChangeNotifier {
  AppMessageState? _current;
  int _counter = 0;

  AppMessageState? get current => _current;

  void showInfo(String message) => _show(message, AppMessageTone.info);

  void showSuccess(String message) => _show(message, AppMessageTone.success);

  void showError(String message) => _show(message, AppMessageTone.error);

  void clear() {
    _current = null;
    notifyListeners();
  }

  void _show(String message, AppMessageTone tone) {
    final normalized = message.trim();
    if (normalized.isEmpty) return;
    final id = ++_counter;
    _current = AppMessageState(id: id, message: normalized, tone: tone);
    notifyListeners();
    Future<void>.delayed(const Duration(milliseconds: 2400), () {
      if (_current?.id == id) {
        clear();
      }
    });
  }
}
