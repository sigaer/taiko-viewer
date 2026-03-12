import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "../models/forum_models.dart";
import "../services/api_client.dart";
import "user_profile_screen.dart";

class RelationshipListScreen extends StatefulWidget {
  const RelationshipListScreen({
    super.key,
    required this.title,
    required this.scope,
  });

  final String title;
  final String scope;

  @override
  State<RelationshipListScreen> createState() => _RelationshipListScreenState();
}

class _RelationshipListScreenState extends State<RelationshipListScreen> {
  bool _loading = true;
  RelationshipListPayload? _payload;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final payload = await context
          .read<ApiClient>()
          .fetchRelationships(scope: widget.scope);
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
                        child: Text("暂无用户"),
                      ),
                    ),
                  ...?_payload?.items.map(
                    (item) => Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      child: ListTile(
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                              builder: (_) =>
                                  UserProfileScreen(userId: item.user.id)),
                        ),
                        title: Text(item.user.username),
                        subtitle: Text(
                          "${item.user.taikoIdMasked}${item.user.verifiedTitle == null ? "" : " · ${item.user.verifiedTitle}"}",
                        ),
                        trailing: item.mutualFollow
                            ? const Chip(label: Text("互相关注"))
                            : null,
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
