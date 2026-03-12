import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "../models/forum_models.dart";
import "../services/api_client.dart";
import "../services/auth_controller.dart";
import "../widgets/app_message_helper.dart";
import "../widgets/forum_page_view.dart";
import "thread_detail_screen.dart";

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  bool _loading = true;
  NotificationListPayload? _payload;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final payload = await context.read<ApiClient>().fetchNotifications();
      if (!mounted) return;
      setState(() => _payload = payload);
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    if (!auth.isAuthenticated) {
      return const Scaffold(
        body: ForumPageView(
          child: Center(child: Text("登录后查看站内通知。")),
        ),
      );
    }
    return Scaffold(
      body: ForumPageView(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: _load,
                child: ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 6, 16, 16),
                  itemCount: (_payload?.items.length ?? 0) + 1,
                  itemBuilder: (context, index) {
                    if (index == 0) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text("站内通知",
                                  style: Theme.of(context)
                                      .textTheme
                                      .headlineSmall),
                            ),
                            TextButton(
                              onPressed: () async {
                                final api = context.read<ApiClient>();
                                await api.markAllNotificationsRead();
                                await _load();
                                if (!context.mounted) return;
                                context.showSuccessMessage("通知已全部标为已读");
                              },
                              child: const Text("全部已读"),
                            ),
                          ],
                        ),
                      );
                    }
                    final item = _payload!.items[index - 1];
                    return Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      child: ListTile(
                        title: Text(item.title),
                        subtitle: Text(item.body),
                        trailing: item.threadId == null
                            ? null
                            : const Icon(Icons.chevron_right),
                        leading: CircleAvatar(
                          child: Text(item.type.substring(0, 1).toUpperCase()),
                        ),
                        onTap: item.threadId == null
                            ? null
                            : () => Navigator.of(context).push(
                                  MaterialPageRoute(
                                      builder: (_) => ThreadDetailScreen(
                                          threadId: item.threadId!)),
                                ),
                      ),
                    );
                  },
                ),
              ),
      ),
    );
  }
}
