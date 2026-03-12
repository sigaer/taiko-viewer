import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "../models/forum_models.dart";
import "../services/api_client.dart";
import "../widgets/app_message_helper.dart";
import "../widgets/forum_thread_tile.dart";
import "thread_detail_screen.dart";

class UserProfileScreen extends StatefulWidget {
  const UserProfileScreen({super.key, required this.userId});

  final int userId;

  @override
  State<UserProfileScreen> createState() => _UserProfileScreenState();
}

class _UserProfileScreenState extends State<UserProfileScreen> {
  bool _loading = true;
  ForumUserProfile? _profile;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final profile =
          await context.read<ApiClient>().fetchUserProfile(widget.userId);
      if (!mounted) return;
      setState(() => _profile = profile);
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _toggleFollow() async {
    final profile = _profile;
    if (profile == null) return;
    try {
      final relation = await context.read<ApiClient>().toggleFollow(
            userId: profile.user.id,
            enabled: !profile.relationship.isFollowing,
          );
      setState(() {
        _profile = ForumUserProfile(
          user: profile.user,
          relationship: relation,
          stats: profile.stats,
          latestThreads: profile.latestThreads,
        );
      });
      if (!mounted) return;
      context.showSuccessMessage(relation.isFollowing ? "已关注" : "已取消关注");
      await _load();
    } catch (error) {
      if (mounted) {
        context.showOperationError(error, fallback: "关注操作失败，请稍后再试");
      }
    }
  }

  Future<void> _toggleBlock() async {
    final profile = _profile;
    if (profile == null) return;
    try {
      final relation = await context.read<ApiClient>().toggleBlock(
            userId: profile.user.id,
            enabled: !profile.relationship.isBlocked,
          );
      setState(() {
        _profile = ForumUserProfile(
          user: profile.user,
          relationship: relation,
          stats: profile.stats,
          latestThreads: relation.isBlocked ? const [] : profile.latestThreads,
        );
      });
      if (!mounted) return;
      context.showSuccessMessage(relation.isBlocked ? "已加入屏蔽列表" : "已取消屏蔽");
      await _load();
    } catch (error) {
      if (mounted) {
        context.showOperationError(error, fallback: "拉黑操作失败，请稍后再试");
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile = _profile;
    return Scaffold(
      appBar: AppBar(title: const Text("用户主页")),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : profile == null
              ? const Center(child: Text("用户不存在"))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(profile.user.username,
                                  style: Theme.of(context)
                                      .textTheme
                                      .headlineSmall),
                              const SizedBox(height: 8),
                              Text(
                                  "${profile.user.taikoIdMasked}${profile.user.verifiedTitle == null ? "" : " · ${profile.user.verifiedTitle}"}"),
                              const SizedBox(height: 12),
                              Wrap(
                                spacing: 16,
                                runSpacing: 8,
                                children: [
                                  Text("主题 ${profile.stats.threadCount}"),
                                  Text("粉丝 ${profile.stats.followerCount}"),
                                  Text("关注 ${profile.stats.followingCount}"),
                                ],
                              ),
                              if (!profile.relationship.isSelf) ...[
                                const SizedBox(height: 14),
                                Wrap(
                                  spacing: 12,
                                  runSpacing: 12,
                                  children: [
                                    FilledButton.tonal(
                                      onPressed: _toggleFollow,
                                      child: Text(
                                          profile.relationship.isFollowing
                                              ? "取消关注"
                                              : "关注"),
                                    ),
                                    FilledButton.tonal(
                                      onPressed: _toggleBlock,
                                      child: Text(profile.relationship.isBlocked
                                          ? "取消拉黑"
                                          : "拉黑"),
                                    ),
                                  ],
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 18),
                      Text("TA 的最新主题",
                          style: Theme.of(context).textTheme.titleLarge),
                      const SizedBox(height: 12),
                      if (profile.latestThreads.isEmpty)
                        const Card(
                          child: Padding(
                            padding: EdgeInsets.all(16),
                            child: Text("暂无可展示的主题"),
                          ),
                        ),
                      ...profile.latestThreads.map(
                        (thread) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: ForumThreadTile(
                            thread: thread,
                            onTap: () => Navigator.of(context).push(
                              MaterialPageRoute(
                                  builder: (_) =>
                                      ThreadDetailScreen(threadId: thread.id)),
                            ),
                            onAuthorTap: null,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
    );
  }
}
