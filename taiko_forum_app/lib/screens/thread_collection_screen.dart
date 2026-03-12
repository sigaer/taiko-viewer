import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "../models/forum_models.dart";
import "../services/api_client.dart";
import "../widgets/forum_thread_tile.dart";
import "thread_detail_screen.dart";
import "user_profile_screen.dart";

class ThreadCollectionScreen extends StatefulWidget {
  const ThreadCollectionScreen({
    super.key,
    required this.title,
    required this.scope,
  });

  final String title;
  final String scope;

  @override
  State<ThreadCollectionScreen> createState() => _ThreadCollectionScreenState();
}

class _ThreadCollectionScreenState extends State<ThreadCollectionScreen> {
  bool _loading = true;
  ThreadListPayload? _payload;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final payload =
          await context.read<ApiClient>().fetchThreads(scope: widget.scope);
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
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if ((_payload?.items.length ?? 0) == 0)
                    const Card(
                      child: Padding(
                        padding: EdgeInsets.all(16),
                        child: Text("暂无内容"),
                      ),
                    ),
                  ...?_payload?.items.map(
                    (thread) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: ForumThreadTile(
                        thread: thread,
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                              builder: (_) =>
                                  ThreadDetailScreen(threadId: thread.id)),
                        ),
                        onAuthorTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                              builder: (_) =>
                                  UserProfileScreen(userId: thread.author.id)),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
