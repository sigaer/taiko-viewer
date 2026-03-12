import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "app_shell.dart";
import "services/api_client.dart";
import "services/app_message_controller.dart";
import "services/auth_controller.dart";
import "services/theme_controller.dart";
import "widgets/app_message_overlay.dart";

void main() {
  final apiClient = ApiClient();
  runApp(TaikoForumApp(apiClient: apiClient));
}

class TaikoForumApp extends StatelessWidget {
  const TaikoForumApp({super.key, required this.apiClient});

  final ApiClient apiClient;

  ThemeData _buildTheme(Brightness brightness) {
    final scheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFFD84A34),
      brightness: brightness,
    );
    final background = brightness == Brightness.dark
        ? const Color(0xFF17120F)
        : const Color(0xFFF9F1E7);
    final cardColor =
        brightness == Brightness.dark ? const Color(0xFF2A201A) : Colors.white;
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: background,
      cardTheme: CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        color: cardColor,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: cardColor,
        indicatorColor: scheme.secondaryContainer,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: background,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
      ),
      snackBarTheme: const SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: apiClient),
        ChangeNotifierProvider<AuthController>(
          create: (_) => AuthController(apiClient)..restoreSession(),
        ),
        ChangeNotifierProvider<ThemeController>(
          create: (_) => ThemeController()..restore(),
        ),
        ChangeNotifierProvider<AppMessageController>(
          create: (_) => AppMessageController(),
        ),
      ],
      child: Consumer<ThemeController>(
        builder: (context, themeController, child) {
          return MaterialApp(
            title: "太鼓论坛",
            debugShowCheckedModeBanner: false,
            theme: _buildTheme(Brightness.light),
            darkTheme: _buildTheme(Brightness.dark),
            themeMode: themeController.themeMode,
            builder: (context, child) => Stack(
              children: [
                if (child != null) child,
                const AppMessageOverlay(),
              ],
            ),
            home: const AppShell(),
          );
        },
      ),
    );
  }
}
