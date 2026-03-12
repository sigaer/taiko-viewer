import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "../services/app_message_controller.dart";

class AppMessageOverlay extends StatelessWidget {
  const AppMessageOverlay({super.key});

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Consumer<AppMessageController>(
        builder: (context, controller, child) {
          final current = controller.current;
          final visible = current != null;
          final colorScheme = Theme.of(context).colorScheme;
          final background = switch (current?.tone) {
            AppMessageTone.success => const Color(0xFF1F7A4C),
            AppMessageTone.error => const Color(0xFFB53C2F),
            _ => colorScheme.inverseSurface,
          };
          final icon = switch (current?.tone) {
            AppMessageTone.success => Icons.check_circle_outline,
            AppMessageTone.error => Icons.error_outline,
            _ => Icons.info_outline,
          };
          return SafeArea(
            child: Align(
              alignment: Alignment.topCenter,
              child: AnimatedSlide(
                duration: const Duration(milliseconds: 220),
                offset: visible ? Offset.zero : const Offset(0, -1.2),
                child: AnimatedOpacity(
                  duration: const Duration(milliseconds: 180),
                  opacity: visible ? 1 : 0,
                  child: current == null
                      ? const SizedBox.shrink()
                      : Container(
                          constraints: const BoxConstraints(maxWidth: 300),
                          margin: const EdgeInsets.fromLTRB(12, 6, 12, 0),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: background,
                            borderRadius: BorderRadius.circular(12),
                            boxShadow: const [
                              BoxShadow(
                                color: Color(0x30000000),
                                blurRadius: 14,
                                offset: Offset(0, 8),
                              ),
                            ],
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(icon, color: Colors.white, size: 16),
                              const SizedBox(width: 8),
                              Flexible(
                                child: Text(
                                  current.message,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w600,
                                    fontSize: 13,
                                    height: 1.2,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
