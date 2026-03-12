import "package:flutter/material.dart";

import "../models/forum_models.dart";
import "forum_media.dart";

class ForumContentBlocks extends StatelessWidget {
  const ForumContentBlocks({
    super.key,
    required this.blocks,
  });

  final List<ForumContentBlock> blocks;

  @override
  Widget build(BuildContext context) {
    if (blocks.isEmpty) {
      return const SizedBox.shrink();
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final block in blocks)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: block.type == "image"
                ? ForumNetworkImage(
                    url: block.imageUrl ?? "",
                    fit: BoxFit.cover,
                    borderRadius: BorderRadius.circular(20),
                    icon: Icons.image_outlined,
                  )
                : Text(
                    block.text ?? "",
                    style: Theme.of(context)
                        .textTheme
                        .bodyLarge
                        ?.copyWith(height: 1.8),
                  ),
          ),
      ],
    );
  }
}

class BlockedContentNotice extends StatelessWidget {
  const BlockedContentNotice({
    super.key,
    required this.expanded,
    required this.onToggle,
  });

  final bool expanded;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        color: Theme.of(context)
            .colorScheme
            .surfaceContainerHighest
            .withValues(alpha: 0.55),
      ),
      child: Row(
        children: [
          const Icon(Icons.visibility_off_outlined),
          const SizedBox(width: 10),
          const Expanded(child: Text("该内容来自已屏蔽用户，默认已折叠。")),
          TextButton(
            onPressed: onToggle,
            child: Text(expanded ? "收起" : "展开"),
          ),
        ],
      ),
    );
  }
}
