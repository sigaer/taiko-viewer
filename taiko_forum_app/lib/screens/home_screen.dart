import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "../models/forum_models.dart";
import "../services/api_client.dart";
import "../widgets/forum_page_view.dart";
import "../widgets/forum_thread_tile.dart";
import "thread_detail_screen.dart";
import "user_profile_screen.dart";

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _loading = true;
  ForumHomePayload? _payload;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final payload = await context.read<ApiClient>().fetchHome();
      if (!mounted) return;
      setState(() => _payload = payload);
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  void _openThread(ForumThreadCard thread) {
    Navigator.of(context).push(
      MaterialPageRoute(
          builder: (_) => ThreadDetailScreen(threadId: thread.id)),
    );
  }

  void _openUser(ForumUserBadge user) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => UserProfileScreen(userId: user.id)),
    );
  }

  Widget _buildSection(String title, List<ForumThreadCard> items) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 12),
        if (items.isEmpty)
          const Card(
              child: Padding(padding: EdgeInsets.all(16), child: Text("暂无内容")))
        else
          ...items.map(
            (thread) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: ForumThreadTile(
                thread: thread,
                onTap: () => _openThread(thread),
                onAuthorTap: () => _openUser(thread.author),
              ),
            ),
          ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: ForumPageView(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: _load,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 6, 16, 16),
                  children: [
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(28),
                        gradient: const LinearGradient(
                          colors: [Color(0xFFD84A34), Color(0xFFF08A24)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text("Taiko Forum",
                              style: Theme.of(context)
                                  .textTheme
                                  .labelLarge
                                  ?.copyWith(color: Colors.white70)),
                          const SizedBox(height: 10),
                          Text(
                            "把攻略、热帖、公告和段位讨论放进一个移动社区。",
                            style: Theme.of(context)
                                .textTheme
                                .headlineSmall
                                ?.copyWith(color: Colors.white),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            "当前版块 ${_payload?.sections.length ?? 0} 个 · 未读通知 ${_payload?.unreadNotificationCount ?? 0} 条",
                            style: Theme.of(context)
                                .textTheme
                                .bodyMedium
                                ?.copyWith(color: Colors.white70),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                    _buildSection("推荐", _payload?.featuredThreads ?? const []),
                    const SizedBox(height: 16),
                    _buildSection("热帖", _payload?.hotThreads ?? const []),
                    const SizedBox(height: 16),
                    _buildSection("攻略", _payload?.latestGuides ?? const []),
                    const SizedBox(height: 16),
                    _buildSection("公告", _payload?.announcements ?? const []),
                  ],
                ),
              ),
      ),
    );
  }
}
