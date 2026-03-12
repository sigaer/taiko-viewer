import "dart:io";

import "package:flutter/material.dart";
import "package:image_picker/image_picker.dart";
import "package:provider/provider.dart";

import "../models/forum_models.dart";
import "../services/api_client.dart";
import "../services/auth_controller.dart";
import "../widgets/app_message_helper.dart";
import "../widgets/forum_content_blocks.dart";
import "../widgets/forum_media.dart";
import "user_profile_screen.dart";

class ThreadDetailScreen extends StatefulWidget {
  const ThreadDetailScreen({super.key, required this.threadId});

  final int threadId;

  @override
  State<ThreadDetailScreen> createState() => _ThreadDetailScreenState();
}

class _ThreadDetailScreenState extends State<ThreadDetailScreen> {
  final TextEditingController _replyController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  bool _loading = true;
  bool _submitting = false;
  bool _uploadingImages = false;
  ForumThreadDetail? _detail;
  int? _replyTargetId;
  String _replyTargetLabel = "";
  final List<String> _replyImageUrls = [];
  final Set<int> _expandedBlockedIds = <int>{};

  @override
  void dispose() {
    _replyController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  bool _requireAuth(String message) {
    final auth = context.read<AuthController>();
    if (auth.isAuthenticated) return true;
    context.showInfoMessage(message);
    return false;
  }

  double? _currentScrollOffset() {
    if (!_scrollController.hasClients) return null;
    return _scrollController.offset;
  }

  void _restoreScrollOffset(double? offset) {
    if (offset == null) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      final maxExtent = _scrollController.position.maxScrollExtent;
      _scrollController.jumpTo(offset.clamp(0.0, maxExtent).toDouble());
    });
  }

  Future<void> _load({bool silent = false, double? restoreOffset}) async {
    final apiClient = context.read<ApiClient>();
    if (!silent) {
      setState(() => _loading = true);
    }
    try {
      final detail = await apiClient.fetchThreadDetail(widget.threadId);
      if (!mounted) return;
      setState(() {
        _detail = detail;
        _loading = false;
      });
      _restoreScrollOffset(restoreOffset);
    } finally {
      if (mounted && !silent) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _reloadPreservingPosition() async {
    await _load(silent: true, restoreOffset: _currentScrollOffset());
  }

  void _setReplyTarget(int? postId, String label) {
    setState(() {
      _replyTargetId = postId;
      _replyTargetLabel = label;
    });
  }

  String _replyToName(ForumReply reply, ForumPostFloor floor) {
    if (reply.parentPostId == null) return "";
    if (reply.parentPostId == floor.id) {
      return floor.author.username;
    }
    for (final entry in floor.replies) {
      if (entry.id == reply.parentPostId) {
        return entry.author.username;
      }
    }
    return "";
  }

  List<ForumContentBlock> _effectiveBlocks(ForumReply reply) {
    if (reply.contentBlocks.isNotEmpty) {
      return reply.contentBlocks;
    }
    if (reply.bodyText.trim().isNotEmpty) {
      return [ForumContentBlock.paragraph(reply.bodyText)];
    }
    return const [];
  }

  void _toggleBlockedContent(int postId) {
    setState(() {
      if (_expandedBlockedIds.contains(postId)) {
        _expandedBlockedIds.remove(postId);
      } else {
        _expandedBlockedIds.add(postId);
      }
    });
  }

  Future<void> _pickReplyImages() async {
    if (!_requireAuth("请先登录后再上传回复图片")) return;
    if (_replyImageUrls.length >= 4) {
      context.showInfoMessage("单条回复最多上传 4 张图片");
      return;
    }
    final picker = ImagePicker();
    final files = await picker.pickMultiImage();
    if (files.isEmpty || !mounted) return;
    setState(() => _uploadingImages = true);
    try {
      for (final file in files.take(4 - _replyImageUrls.length)) {
        final url =
            await context.read<ApiClient>().uploadForumImage(File(file.path));
        if (!mounted) return;
        setState(() => _replyImageUrls.add(url));
      }
      if (mounted) {
        context.showSuccessMessage("回复图片上传完成");
      }
    } catch (error) {
      if (mounted) {
        context.showOperationError(error, fallback: "图片上传失败，请稍后再试");
      }
    } finally {
      if (mounted) {
        setState(() => _uploadingImages = false);
      }
    }
  }

  Future<void> _submitReply() async {
    if ((_replyController.text.trim().isEmpty && _replyImageUrls.isEmpty) ||
        _submitting) {
      return;
    }
    if (!_requireAuth("请先登录后再回复")) return;
    setState(() => _submitting = true);
    try {
      final contentBlocks = <Map<String, dynamic>>[
        if (_replyController.text.trim().isNotEmpty)
          {
            "type": "paragraph",
            "text": _replyController.text.trim(),
          },
        ..._replyImageUrls.map(
          (imageUrl) => {
            "type": "image",
            "imageUrl": imageUrl,
          },
        ),
      ];
      await context.read<ApiClient>().createReply(
            threadId: widget.threadId,
            bodyText: _replyController.text.trim(),
            contentBlocks: contentBlocks,
            parentPostId: _replyTargetId,
          );
      _replyController.clear();
      setState(() {
        _replyImageUrls.clear();
      });
      _setReplyTarget(null, "");
      await _reloadPreservingPosition();
      if (mounted) {
        context.showSuccessMessage("回复成功");
      }
    } catch (error) {
      if (mounted) {
        context.showOperationError(error, fallback: "回复失败，请稍后再试");
      }
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  Future<void> _toggleThreadLike() async {
    final detail = _detail;
    if (detail == null) return;
    if (!_requireAuth("请先登录后再点赞")) return;
    try {
      final wasLiked = detail.viewerHasLiked;
      await context.read<ApiClient>().toggleThreadLike(detail.id);
      await _reloadPreservingPosition();
      if (mounted) {
        context.showSuccessMessage(wasLiked ? "已取消点赞" : "点赞成功");
      }
    } catch (error) {
      if (mounted) {
        context.showOperationError(error, fallback: "点赞失败，请稍后再试");
      }
    }
  }

  Future<void> _toggleFavorite() async {
    final detail = _detail;
    if (detail == null) return;
    if (!_requireAuth("请先登录后再收藏")) return;
    try {
      final wasFavorited = detail.viewerHasFavorited;
      await context.read<ApiClient>().toggleThreadFavorite(
            detail.id,
            enabled: !wasFavorited,
          );
      await _reloadPreservingPosition();
      if (mounted) {
        context.showSuccessMessage(wasFavorited ? "已取消收藏" : "收藏成功");
      }
    } catch (error) {
      if (mounted) {
        context.showOperationError(error, fallback: "收藏操作失败，请稍后再试");
      }
    }
  }

  Future<void> _togglePostLike(ForumReply post) async {
    if (!_requireAuth("请先登录后再点赞")) return;
    try {
      final wasLiked = post.viewerHasLiked;
      await context.read<ApiClient>().togglePostLike(post.id);
      await _reloadPreservingPosition();
      if (mounted) {
        context.showSuccessMessage(wasLiked ? "已取消点赞" : "点赞成功");
      }
    } catch (error) {
      if (mounted) {
        context.showOperationError(error, fallback: "点赞失败，请稍后再试");
      }
    }
  }

  void _openUser(ForumUserBadge user) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => UserProfileScreen(userId: user.id)),
    );
  }

  Widget _buildAuthorHeader({
    required ForumUserBadge user,
    required String trailing,
    VoidCallback? onReply,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        InkWell(
          borderRadius: BorderRadius.circular(30),
          onTap: () => _openUser(user),
          child: ForumAvatar(
              name: user.username, avatarUrl: user.avatarUrl, radius: 18),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: InkWell(
            borderRadius: BorderRadius.circular(18),
            onTap: () => _openUser(user),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Text(user.username),
            ),
          ),
        ),
        if (onReply != null)
          TextButton(onPressed: onReply, child: const Text("回复")),
        Text(trailing, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final detail = _detail;
    return Scaffold(
      appBar: AppBar(title: const Text("帖子详情")),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : detail == null
              ? const Center(child: Text("帖子不存在"))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(16),
                    children: [
                      Text(detail.title,
                          style: Theme.of(context).textTheme.headlineSmall),
                      const SizedBox(height: 8),
                      Text(detail.summary),
                      const SizedBox(height: 12),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          InkWell(
                            borderRadius: BorderRadius.circular(40),
                            onTap: () => _openUser(detail.author),
                            child: ForumAvatar(
                                name: detail.author.username,
                                avatarUrl: detail.author.avatarUrl,
                                radius: 22),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: InkWell(
                              borderRadius: BorderRadius.circular(18),
                              onTap: () => _openUser(detail.author),
                              child: Padding(
                                padding:
                                    const EdgeInsets.symmetric(vertical: 2),
                                child: Text(detail.author.username),
                              ),
                            ),
                          ),
                          Text(
                              "${detail.replyCount} 回复 · ${detail.likeCount} 赞"),
                        ],
                      ),
                      if (detail.song != null) ...[
                        const SizedBox(height: 14),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(20),
                            color: Theme.of(context)
                                .colorScheme
                                .surfaceContainerHighest
                                .withValues(alpha: 0.38),
                          ),
                          child: Row(
                            children: [
                              ForumNetworkImage(
                                url: detail.song!.coverUrl,
                                width: 64,
                                height: 64,
                                borderRadius: BorderRadius.circular(16),
                                icon: Icons.music_note_outlined,
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(detail.song!.title,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis),
                                    Text(
                                        "${detail.song!.difficultyLabel} · ${detail.song!.level ?? "?"}星"),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(height: 16),
                      ForumContentBlocks(blocks: detail.contentBlocks),
                      Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: [
                          FilledButton.tonal(
                            onPressed: _toggleThreadLike,
                            child:
                                Text(detail.viewerHasLiked ? "已点赞主题" : "点赞主题"),
                          ),
                          FilledButton.tonal(
                            onPressed: _toggleFavorite,
                            child: Text(
                                detail.viewerHasFavorited ? "已收藏主题" : "收藏主题"),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      Text("楼层回复",
                          style: Theme.of(context).textTheme.titleLarge),
                      const SizedBox(height: 12),
                      ...detail.posts.map(
                        (floor) {
                          final expanded =
                              _expandedBlockedIds.contains(floor.id);
                          return Card(
                            child: Padding(
                              padding: const EdgeInsets.all(14),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  _buildAuthorHeader(
                                    user: floor.author,
                                    trailing:
                                        "#${floor.floorNo} · ${floor.createdAt.toLocal()}",
                                    onReply: () {
                                      if (!_requireAuth("请先登录后再回复")) return;
                                      _setReplyTarget(floor.id,
                                          "回复 ${floor.author.username} 的楼层");
                                    },
                                  ),
                                  const SizedBox(height: 10),
                                  if (floor.isBlockedAuthor && !expanded)
                                    BlockedContentNotice(
                                      expanded: false,
                                      onToggle: () =>
                                          _toggleBlockedContent(floor.id),
                                    )
                                  else ...[
                                    if (floor.isBlockedAuthor)
                                      Padding(
                                        padding:
                                            const EdgeInsets.only(bottom: 10),
                                        child: BlockedContentNotice(
                                          expanded: true,
                                          onToggle: () =>
                                              _toggleBlockedContent(floor.id),
                                        ),
                                      ),
                                    ForumContentBlocks(
                                        blocks: _effectiveBlocks(floor)),
                                  ],
                                  const SizedBox(height: 12),
                                  Wrap(
                                    spacing: 12,
                                    runSpacing: 8,
                                    children: [
                                      TextButton(
                                        onPressed: () => _togglePostLike(floor),
                                        child: Text(floor.viewerHasLiked
                                            ? "已赞 ${floor.likeCount}"
                                            : "点赞 ${floor.likeCount}"),
                                      ),
                                    ],
                                  ),
                                  if (floor.replies.isNotEmpty) ...[
                                    const Divider(height: 24),
                                    ...floor.replies.map(
                                      (reply) {
                                        final replyExpanded =
                                            _expandedBlockedIds
                                                .contains(reply.id);
                                        final replyToName =
                                            _replyToName(reply, floor);
                                        return Padding(
                                          padding:
                                              const EdgeInsets.only(bottom: 14),
                                          child: Container(
                                            padding: const EdgeInsets.all(12),
                                            decoration: BoxDecoration(
                                              borderRadius:
                                                  BorderRadius.circular(18),
                                              color: Theme.of(context)
                                                  .colorScheme
                                                  .surfaceContainerHighest
                                                  .withValues(alpha: 0.35),
                                            ),
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                _buildAuthorHeader(
                                                  user: reply.author,
                                                  trailing: reply.createdAt
                                                      .toLocal()
                                                      .toString(),
                                                  onReply: () {
                                                    if (!_requireAuth(
                                                        "请先登录后再回复")) {
                                                      return;
                                                    }
                                                    _setReplyTarget(reply.id,
                                                        "回复 ${reply.author.username} 的消息");
                                                  },
                                                ),
                                                if (replyToName.isNotEmpty)
                                                  Padding(
                                                    padding:
                                                        const EdgeInsets.only(
                                                            top: 8, bottom: 6),
                                                    child: Text(
                                                        "回复 @$replyToName"),
                                                  ),
                                                const SizedBox(height: 8),
                                                if (reply.isBlockedAuthor &&
                                                    !replyExpanded)
                                                  BlockedContentNotice(
                                                    expanded: false,
                                                    onToggle: () =>
                                                        _toggleBlockedContent(
                                                            reply.id),
                                                  )
                                                else ...[
                                                  if (reply.isBlockedAuthor)
                                                    Padding(
                                                      padding:
                                                          const EdgeInsets.only(
                                                              bottom: 10),
                                                      child:
                                                          BlockedContentNotice(
                                                        expanded: true,
                                                        onToggle: () =>
                                                            _toggleBlockedContent(
                                                                reply.id),
                                                      ),
                                                    ),
                                                  ForumContentBlocks(
                                                      blocks: _effectiveBlocks(
                                                          reply)),
                                                ],
                                                Align(
                                                  alignment:
                                                      Alignment.centerRight,
                                                  child: TextButton(
                                                    onPressed: () =>
                                                        _togglePostLike(reply),
                                                    child: Text(reply
                                                            .viewerHasLiked
                                                        ? "已赞 ${reply.likeCount}"
                                                        : "点赞 ${reply.likeCount}"),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        );
                                      },
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                      if (detail.posts.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 16),
                          child: Center(child: Text("还没有回复，抢个沙发吧")),
                        ),
                      const SizedBox(height: 8),
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text("发表回复",
                                  style:
                                      Theme.of(context).textTheme.titleLarge),
                              const SizedBox(height: 8),
                              Text(
                                _replyTargetLabel.isEmpty
                                    ? "对主题发表你的观点或继续补充攻略。"
                                    : _replyTargetLabel,
                              ),
                              const SizedBox(height: 12),
                              TextField(
                                controller: _replyController,
                                minLines: 4,
                                maxLines: 6,
                                decoration: const InputDecoration(
                                  hintText: "输入回复内容，可使用 @用户名 提及其他鼓友",
                                  border: OutlineInputBorder(),
                                ),
                              ),
                              const SizedBox(height: 12),
                              Wrap(
                                spacing: 12,
                                runSpacing: 12,
                                children: [
                                  OutlinedButton.icon(
                                    onPressed: _uploadingImages
                                        ? null
                                        : _pickReplyImages,
                                    icon: const Icon(Icons.image_outlined),
                                    label: Text(_uploadingImages
                                        ? "上传中..."
                                        : "添加图片（${_replyImageUrls.length}/4）"),
                                  ),
                                  if (_replyTargetId != null)
                                    TextButton(
                                      onPressed: () =>
                                          _setReplyTarget(null, ""),
                                      child: const Text("取消定向回复"),
                                    ),
                                ],
                              ),
                              if (_replyImageUrls.isNotEmpty) ...[
                                const SizedBox(height: 12),
                                Wrap(
                                  spacing: 12,
                                  runSpacing: 12,
                                  children: [
                                    for (final url in _replyImageUrls)
                                      Stack(
                                        clipBehavior: Clip.none,
                                        children: [
                                          SizedBox(
                                            width: 112,
                                            height: 112,
                                            child: ForumNetworkImage(
                                              url: url,
                                              fit: BoxFit.cover,
                                              borderRadius:
                                                  BorderRadius.circular(18),
                                              icon: Icons.image_outlined,
                                            ),
                                          ),
                                          Positioned(
                                            top: -8,
                                            right: -8,
                                            child: IconButton.filledTonal(
                                              onPressed: () => setState(() =>
                                                  _replyImageUrls.remove(url)),
                                              icon: const Icon(Icons.close,
                                                  size: 18),
                                            ),
                                          ),
                                        ],
                                      ),
                                  ],
                                ),
                              ],
                              const SizedBox(height: 14),
                              FilledButton(
                                onPressed: detail.isLocked || _uploadingImages
                                    ? null
                                    : _submitReply,
                                child: Text(
                                  detail.isLocked ? "当前帖子已锁定" : "发布回复",
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
    );
  }
}
