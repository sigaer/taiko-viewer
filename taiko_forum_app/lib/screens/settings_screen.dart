import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "../services/theme_controller.dart";
import "account_management_screen.dart";
import "account_profile_screen.dart";
import "feedback_screen.dart";
import "privacy_settings_screen.dart";
import "version_info_screen.dart";

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({
    super.key,
    required this.email,
  });

  final String email;

  @override
  Widget build(BuildContext context) {
    final themeController = context.watch<ThemeController>();
    return Scaffold(
      appBar: AppBar(title: const Text("设置")),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Column(
              children: [
                ListTile(
                  title: const Text("账号管理"),
                  subtitle: const Text("邮箱、记忆登录、密码重置、退出登录"),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => AccountManagementScreen(email: email),
                    ),
                  ),
                ),
                ListTile(
                  title: const Text("个人资料"),
                  subtitle: const Text("头像、鼓众 ID 绑定、我的小咚"),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const AccountProfileScreen(),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text("主题外观", style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 12),
                  SegmentedButton<AppThemePreference>(
                    segments: const [
                      ButtonSegment(
                        value: AppThemePreference.system,
                        label: Text("跟随系统"),
                      ),
                      ButtonSegment(
                        value: AppThemePreference.light,
                        label: Text("浅色"),
                      ),
                      ButtonSegment(
                        value: AppThemePreference.dark,
                        label: Text("深色"),
                      ),
                    ],
                    selected: {themeController.preference},
                    onSelectionChanged: (value) =>
                        themeController.setPreference(value.first),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: Column(
              children: [
                ListTile(
                  title: const Text("隐私设置"),
                  subtitle: const Text("浏览历史、拉黑名单"),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const PrivacySettingsScreen(),
                    ),
                  ),
                ),
                ListTile(
                  title: const Text("版本信息"),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const VersionInfoScreen(),
                    ),
                  ),
                ),
                ListTile(
                  title: const Text("意见反馈"),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const FeedbackScreen(),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
