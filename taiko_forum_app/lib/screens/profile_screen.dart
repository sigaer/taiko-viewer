import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "../models/forum_models.dart";
import "../services/api_client.dart";
import "../services/auth_controller.dart";
import "../widgets/app_message_helper.dart";
import "../widgets/forum_media.dart";
import "../widgets/forum_page_view.dart";
import "../widgets/forum_thread_tile.dart";
import "register_screen.dart";
import "relationship_list_screen.dart";
import "settings_screen.dart";
import "thread_collection_screen.dart";
import "thread_detail_screen.dart";
import "user_profile_screen.dart";

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _loading = false;
  bool _rememberCredentials = true;
  bool _credentialsHydrated = false;
  ForumMeSummary? _summary;
  ThreadListPayload? _moderation;

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    final auth = context.read<AuthController>();
    if (_identifierController.text.trim().isEmpty ||
        _passwordController.text.isEmpty) {
      context.showInfoMessage("请输入用户名和密码");
      return;
    }
    setState(() => _loading = true);
    try {
      await auth.login(
        identifier: _identifierController.text.trim(),
        password: _passwordController.text,
        rememberCredentials: _rememberCredentials,
      );
      await _loadProfile();
      if (mounted) context.showSuccessMessage("登录成功");
    } catch (error) {
      if (mounted) {
        context.showOperationError(error, fallback: "登录失败，请检查账号或密码");
      }
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _loadProfile() async {
    final api = context.read<ApiClient>();
    setState(() => _loading = true);
    try {
      final summary = await api.fetchMeSummary();
      ThreadListPayload? moderation;
      if (["moderator", "admin"].contains(summary.forumBadge.role)) {
        moderation = await api.fetchThreads(
          sort: "latest",
          pageSize: 8,
          includeHidden: true,
        );
      }
      if (!mounted) return;
      setState(() {
        _summary = summary;
        _moderation = moderation;
      });
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final auth = context.watch<AuthController>();
    if (!_credentialsHydrated ||
        (_identifierController.text.isEmpty &&
            auth.rememberedIdentifier.isNotEmpty)) {
      _rememberCredentials = auth.rememberCredentials;
      _identifierController.text = auth.rememberedIdentifier;
      _passwordController.text = auth.rememberedPassword;
      _credentialsHydrated = true;
    }
    if (auth.isAuthenticated && _summary == null && !_loading) {
      _loadProfile();
    }
  }

  Future<void> _handleModerationAction({
    required ForumThreadCard thread,
    required String action,
    required bool enabled,
    required String successMessage,
  }) async {
    try {
      await context.read<ApiClient>().moderateThread(
            threadId: thread.id,
            action: action,
            enabled: enabled,
          );
      await _loadProfile();
      if (!mounted) return;
      context.showSuccessMessage(successMessage);
    } catch (error) {
      if (mounted) {
        context.showOperationError(error, fallback: "站务操作失败，请稍后重试");
      }
    }
  }

  void _openThreadScope(String title, String scope) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ThreadCollectionScreen(title: title, scope: scope),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();

    if (!auth.isAuthenticated) {
      return Scaffold(
        body: ForumPageView(
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              Text("登录社区", style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 12),
              Text("登录后可继续回帖、点赞、查看通知和使用站务台。",
                  style: Theme.of(context).textTheme.bodyMedium),
              const SizedBox(height: 16),
              TextField(
                controller: _identifierController,
                decoration: const InputDecoration(
                    labelText: "用户名或邮箱", border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _passwordController,
                obscureText: true,
                decoration: const InputDecoration(
                    labelText: "密码", border: OutlineInputBorder()),
              ),
              const SizedBox(height: 8),
              SwitchListTile.adaptive(
                value: _rememberCredentials,
                onChanged: (value) =>
                    setState(() => _rememberCredentials = value),
                contentPadding: EdgeInsets.zero,
                title: const Text("记住用户名和密码"),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _loading ? null : _login,
                child: Text(_loading ? "登录中..." : "登录"),
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: () async {
                  final result = await Navigator.of(context).push<bool>(
                    MaterialPageRoute(builder: (_) => const RegisterScreen()),
                  );
                  if (result == true && mounted) {
                    await _loadProfile();
                  }
                },
                child: const Text("注册账号"),
              ),
            ],
          ),
        ),
      );
    }

    final summary = _summary;
    final canModerate =
        ["moderator", "admin"].contains(summary?.forumBadge.role);

    return Scaffold(
      body: ForumPageView(
        child: _loading && summary == null
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: _loadProfile,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 6, 16, 16),
                  children: [
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                ForumAvatar(
                                  radius: 28,
                                  name: summary?.user.username ??
                                      auth.user?.username ??
                                      "",
                                  avatarUrl: summary?.user.avatarUrl ??
                                      auth.user?.avatarUrl ??
                                      "",
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        summary?.user.username ??
                                            auth.user?.username ??
                                            "",
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleLarge,
                                      ),
                                      Text(
                                        summary?.currentBinding?.taikoId == null
                                            ? "当前鼓众 ID：未绑定"
                                            : "当前鼓众 ID：${summary!.currentBinding!.taikoId}",
                                      ),
                                      if (summary
                                              ?.currentBinding?.verifiedTitle !=
                                          null)
                                        Text(
                                            "认证称号：${summary!.currentBinding!.verifiedTitle}"),
                                    ],
                                  ),
                                ),
                                IconButton(
                                  onPressed: summary == null
                                      ? null
                                      : () => Navigator.of(context).push(
                                            MaterialPageRoute(
                                              builder: (_) => SettingsScreen(
                                                email: summary.user.email,
                                              ),
                                            ),
                                          ),
                                  icon: const Icon(Icons.settings_outlined),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Wrap(
                              spacing: 12,
                              runSpacing: 10,
                              children: [
                                ActionChip(
                                  label: Text(
                                      "粉丝 ${summary?.stats.followerCount ?? 0}"),
                                  onPressed: () => Navigator.of(context).push(
                                    MaterialPageRoute(
                                      builder: (_) =>
                                          const RelationshipListScreen(
                                        title: "我的粉丝",
                                        scope: "followers",
                                      ),
                                    ),
                                  ),
                                ),
                                ActionChip(
                                  label: Text(
                                      "关注 ${summary?.stats.followingCount ?? 0}"),
                                  onPressed: () => Navigator.of(context).push(
                                    MaterialPageRoute(
                                      builder: (_) =>
                                          const RelationshipListScreen(
                                        title: "我的关注",
                                        scope: "following",
                                      ),
                                    ),
                                  ),
                                ),
                                ActionChip(
                                  label: Text(
                                      "拉黑 ${summary?.stats.blockedCount ?? 0}"),
                                  onPressed: () => Navigator.of(context).push(
                                    MaterialPageRoute(
                                      builder: (_) =>
                                          const RelationshipListScreen(
                                        title: "拉黑名单",
                                        scope: "blocked",
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Text(
                                "未读通知 ${summary?.unreadNotificationCount ?? 0} · 论坛身份 ${summary?.forumBadge.roleLabel ?? "鼓友"}"),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 18),
                    Text("我的内容", style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      children: [
                        _StatCard(
                          label: "我的发帖",
                          count: summary?.stats.threadCount ?? 0,
                          onTap: () => _openThreadScope("我的发帖", "mine"),
                        ),
                        _StatCard(
                          label: "我的回帖",
                          count: summary?.stats.repliedThreadCount ?? 0,
                          onTap: () => _openThreadScope("我的回帖", "replied"),
                        ),
                        _StatCard(
                          label: "浏览历史",
                          count: summary?.stats.historyCount ?? 0,
                          onTap: () => _openThreadScope("浏览历史", "history"),
                        ),
                        _StatCard(
                          label: "我的收藏",
                          count: summary?.stats.favoriteCount ?? 0,
                          onTap: () => _openThreadScope("我的收藏", "favorites"),
                        ),
                      ],
                    ),
                    if (canModerate) ...[
                      const SizedBox(height: 24),
                      Text("站务台",
                          style: Theme.of(context).textTheme.titleLarge),
                      const SizedBox(height: 12),
                      ...?_moderation?.items.take(4).map(
                            (thread) => Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: Card(
                                child: Padding(
                                  padding: const EdgeInsets.all(12),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      ForumThreadTile(
                                        thread: thread,
                                        onTap: () => Navigator.of(context).push(
                                          MaterialPageRoute(
                                              builder: (_) =>
                                                  ThreadDetailScreen(
                                                      threadId: thread.id)),
                                        ),
                                        onAuthorTap: () =>
                                            Navigator.of(context).push(
                                          MaterialPageRoute(
                                              builder: (_) => UserProfileScreen(
                                                  userId: thread.author.id)),
                                        ),
                                      ),
                                      Wrap(
                                        spacing: 8,
                                        runSpacing: 8,
                                        children: [
                                          OutlinedButton(
                                            onPressed: () =>
                                                _handleModerationAction(
                                              thread: thread,
                                              action: "pin",
                                              enabled: !thread.isPinned,
                                              successMessage: thread.isPinned
                                                  ? "已取消置顶"
                                                  : "已置顶",
                                            ),
                                            child: Text(thread.isPinned
                                                ? "取消置顶"
                                                : "置顶"),
                                          ),
                                          OutlinedButton(
                                            onPressed: () =>
                                                _handleModerationAction(
                                              thread: thread,
                                              action: "feature",
                                              enabled: !thread.isFeatured,
                                              successMessage: thread.isFeatured
                                                  ? "已取消加精"
                                                  : "已加精",
                                            ),
                                            child: Text(thread.isFeatured
                                                ? "取消加精"
                                                : "加精"),
                                          ),
                                          OutlinedButton(
                                            onPressed: () =>
                                                _handleModerationAction(
                                              thread: thread,
                                              action: "lock",
                                              enabled: !thread.isLocked,
                                              successMessage: thread.isLocked
                                                  ? "已解除锁帖"
                                                  : "已锁帖",
                                            ),
                                            child: Text(thread.isLocked
                                                ? "解除锁帖"
                                                : "锁帖"),
                                          ),
                                          OutlinedButton(
                                            onPressed: () =>
                                                _handleModerationAction(
                                              thread: thread,
                                              action: "hide",
                                              enabled:
                                                  thread.status == "published",
                                              successMessage:
                                                  thread.status == "published"
                                                      ? "已隐藏帖子"
                                                      : "已恢复帖子",
                                            ),
                                            child: Text(
                                                thread.status == "published"
                                                    ? "隐藏"
                                                    : "恢复"),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                    ],
                  ],
                ),
              ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.count,
    required this.onTap,
  });

  final String label;
  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 160,
      child: Card(
        child: InkWell(
          borderRadius: BorderRadius.circular(28),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                Text("$count",
                    style: Theme.of(context).textTheme.headlineMedium),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
