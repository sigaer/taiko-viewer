import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "../models/forum_models.dart";
import "../services/api_client.dart";
import "../widgets/app_message_helper.dart";
import "relationship_list_screen.dart";

class PrivacySettingsScreen extends StatefulWidget {
  const PrivacySettingsScreen({super.key});

  @override
  State<PrivacySettingsScreen> createState() => _PrivacySettingsScreenState();
}

class _PrivacySettingsScreenState extends State<PrivacySettingsScreen> {
  bool _loading = true;
  ForumPreferences? _preferences;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final preferences = await context.read<ApiClient>().fetchPreferences();
      if (!mounted) return;
      setState(() => _preferences = preferences);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final preferences = _preferences;
    return Scaffold(
      appBar: AppBar(title: const Text("隐私设置")),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  child: SwitchListTile.adaptive(
                    value: preferences?.recordHistoryEnabled ?? true,
                    title: const Text("记录浏览历史"),
                    subtitle: const Text("关闭后不再记录新浏览记录"),
                    onChanged: (value) async {
                      final next = await context
                          .read<ApiClient>()
                          .updatePreferences(recordHistoryEnabled: value);
                      if (!context.mounted) return;
                      setState(() => _preferences = next);
                      context.showSuccessMessage(value ? "已开启浏览历史" : "已关闭浏览历史");
                    },
                  ),
                ),
                const SizedBox(height: 12),
                Card(
                  child: ListTile(
                    title: const Text("清空浏览历史"),
                    subtitle: const Text("仅清除论坛帖子浏览记录"),
                    trailing: const Icon(Icons.delete_outline),
                    onTap: () async {
                      await context.read<ApiClient>().clearHistory();
                      if (!context.mounted) return;
                      context.showSuccessMessage("浏览历史已清空");
                    },
                  ),
                ),
                const SizedBox(height: 12),
                Card(
                  child: ListTile(
                    title: const Text("拉黑名单"),
                    subtitle: const Text("查看和管理已屏蔽用户"),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const RelationshipListScreen(
                          title: "拉黑名单",
                          scope: "blocked",
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}
