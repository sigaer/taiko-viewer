import "package:flutter/material.dart";

import "../models/forum_models.dart";
import "forum_media.dart";

class ForumThreadTile extends StatelessWidget {
  const ForumThreadTile({
    super.key,
    required this.thread,
    this.onTap,
    this.onAuthorTap,
  });

  final ForumThreadCard thread;
  final VoidCallback? onTap;
  final VoidCallback? onAuthorTap;

  String get _threadTypeLabel {
    switch (thread.threadType) {
      case "guide":
        return "攻略";
      case "achievement":
        return "战报";
      case "official":
        return "公告";
      default:
        return "讨论";
    }
  }

  Color get _accent {
    final normalized = thread.section.accentColor.replaceFirst("#", "");
    return Color(int.parse("FF$normalized", radix: 16));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: BorderSide(color: _accent.withValues(alpha: 0.12)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  Chip(
                      label: Text(thread.section.name),
                      backgroundColor: _accent.withValues(alpha: 0.12)),
                  Chip(label: Text(_threadTypeLabel)),
                  if (thread.isPinned) const Chip(label: Text("置顶")),
                  if (thread.isFeatured) const Chip(label: Text("加精")),
                  if (thread.isLocked) const Chip(label: Text("锁帖")),
                  if (thread.viewerHasFavorited) const Chip(label: Text("已收藏")),
                ],
              ),
              const SizedBox(height: 12),
              Text(thread.title, style: theme.textTheme.titleLarge),
              const SizedBox(height: 8),
              Text(
                thread.summary,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.bodyMedium
                    ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
              ),
              if (thread.tags.isNotEmpty) ...[
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: thread.tags
                      .map((tag) => Text("#$tag",
                          style: theme.textTheme.labelMedium
                              ?.copyWith(color: _accent)))
                      .toList(),
                ),
              ],
              if (thread.song != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(18),
                    color: theme.colorScheme.surfaceContainerHighest
                        .withValues(alpha: 0.45),
                  ),
                  child: Row(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(14),
                        child: ForumNetworkImage(
                          url: thread.song!.coverUrl,
                          width: 54,
                          height: 54,
                          fit: BoxFit.cover,
                          borderRadius: BorderRadius.circular(14),
                          icon: Icons.music_note_outlined,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(thread.song!.title,
                                maxLines: 1, overflow: TextOverflow.ellipsis),
                            Text(
                              "${thread.song!.difficultyLabel} · ${thread.song!.level ?? "?"}星",
                              style: theme.textTheme.bodySmall,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 14),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  InkWell(
                    borderRadius: BorderRadius.circular(30),
                    onTap: onAuthorTap,
                    child: ForumAvatar(
                      name: thread.author.username,
                      avatarUrl: thread.author.avatarUrl,
                      radius: 20,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: InkWell(
                      borderRadius: BorderRadius.circular(18),
                      onTap: onAuthorTap,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 2),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(thread.author.username,
                                maxLines: 1, overflow: TextOverflow.ellipsis),
                            Text(
                              "${thread.author.taikoIdMasked}${thread.author.verifiedTitle == null ? "" : " · ${thread.author.verifiedTitle}"}",
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.bodySmall,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 12,
                runSpacing: 8,
                children: [
                  Text("${thread.replyCount} 回复",
                      style: theme.textTheme.bodySmall),
                  Text("${thread.likeCount} 赞",
                      style: theme.textTheme.bodySmall),
                  Text("${thread.viewCount} 浏览",
                      style: theme.textTheme.bodySmall),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
