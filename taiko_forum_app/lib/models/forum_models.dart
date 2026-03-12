class ForumSection {
  const ForumSection({
    required this.id,
    required this.slug,
    required this.name,
    required this.description,
    required this.icon,
    required this.accentColor,
    required this.threadCount,
    required this.postCount,
    this.featuredThreadCount = 0,
  });

  final int id;
  final String slug;
  final String name;
  final String description;
  final String icon;
  final String accentColor;
  final int threadCount;
  final int postCount;
  final int featuredThreadCount;

  factory ForumSection.fromJson(Map<String, dynamic> json) => ForumSection(
        id: json["id"] as int? ?? 0,
        slug: json["slug"] as String? ?? "",
        name: json["name"] as String? ?? "",
        description: json["description"] as String? ?? "",
        icon: json["icon"] as String? ?? "",
        accentColor: json["accentColor"] as String? ?? "#d84a34",
        threadCount: json["threadCount"] as int? ?? 0,
        postCount: json["postCount"] as int? ?? 0,
        featuredThreadCount: json["featuredThreadCount"] as int? ?? 0,
      );
}

class ForumUserBadge {
  const ForumUserBadge({
    required this.id,
    required this.username,
    required this.avatarUrl,
    required this.role,
    required this.roleLabel,
    required this.taikoIdMasked,
    required this.verifiedTitle,
    required this.verifiedTitleplateId,
  });

  final int id;
  final String username;
  final String avatarUrl;
  final String role;
  final String roleLabel;
  final String taikoIdMasked;
  final String? verifiedTitle;
  final int? verifiedTitleplateId;

  factory ForumUserBadge.fromJson(Map<String, dynamic> json) => ForumUserBadge(
        id: json["id"] as int? ?? 0,
        username: json["username"] as String? ?? "",
        avatarUrl: json["avatarUrl"] as String? ?? "",
        role: json["role"] as String? ?? "user",
        roleLabel: json["roleLabel"] as String? ?? "鼓友",
        taikoIdMasked: json["taikoIdMasked"] as String? ?? "未绑定",
        verifiedTitle: json["verifiedTitle"] as String?,
        verifiedTitleplateId: json["verifiedTitleplateId"] as int?,
      );
}

class ForumSongSummary {
  const ForumSongSummary({
    required this.id,
    required this.title,
    required this.coverUrl,
    required this.difficultyLabel,
    required this.level,
  });

  final int id;
  final String title;
  final String coverUrl;
  final String difficultyLabel;
  final int? level;

  factory ForumSongSummary.fromJson(Map<String, dynamic> json) =>
      ForumSongSummary(
        id: json["id"] as int? ?? 0,
        title: json["title"] as String? ?? "",
        coverUrl: json["coverUrl"] as String? ?? "",
        difficultyLabel: json["difficultyLabel"] as String? ?? "",
        level: json["level"] as int?,
      );
}

class ForumThreadCard {
  const ForumThreadCard({
    required this.id,
    required this.title,
    required this.summary,
    required this.threadType,
    required this.coverImageUrl,
    required this.tags,
    required this.section,
    required this.author,
    required this.song,
    required this.isPinned,
    required this.isFeatured,
    required this.isLocked,
    required this.status,
    required this.likeCount,
    required this.replyCount,
    required this.viewCount,
    required this.createdAt,
    required this.viewerHasLiked,
    required this.viewerHasFavorited,
  });

  final int id;
  final String title;
  final String summary;
  final String threadType;
  final String coverImageUrl;
  final List<String> tags;
  final ForumSection section;
  final ForumUserBadge author;
  final ForumSongSummary? song;
  final bool isPinned;
  final bool isFeatured;
  final bool isLocked;
  final String status;
  final int likeCount;
  final int replyCount;
  final int viewCount;
  final DateTime createdAt;
  final bool viewerHasLiked;
  final bool viewerHasFavorited;

  factory ForumThreadCard.fromJson(Map<String, dynamic> json) =>
      ForumThreadCard(
        id: json["id"] as int? ?? 0,
        title: json["title"] as String? ?? "",
        summary: json["summary"] as String? ?? "",
        threadType: json["threadType"] as String? ?? "discussion",
        coverImageUrl: json["coverImageUrl"] as String? ?? "",
        tags: (json["tags"] as List<dynamic>? ?? const [])
            .map((item) => item.toString())
            .toList(),
        section: ForumSection.fromJson(
            json["section"] as Map<String, dynamic>? ??
                const <String, dynamic>{}),
        author: ForumUserBadge.fromJson(
            json["author"] as Map<String, dynamic>? ??
                const <String, dynamic>{}),
        song: json["song"] == null
            ? null
            : ForumSongSummary.fromJson(json["song"] as Map<String, dynamic>),
        isPinned: json["isPinned"] as bool? ?? false,
        isFeatured: json["isFeatured"] as bool? ?? false,
        isLocked: json["isLocked"] as bool? ?? false,
        status: json["status"] as String? ?? "published",
        likeCount: json["likeCount"] as int? ?? 0,
        replyCount: json["replyCount"] as int? ?? 0,
        viewCount: json["viewCount"] as int? ?? 0,
        createdAt: DateTime.tryParse(json["createdAt"] as String? ?? "") ??
            DateTime.fromMillisecondsSinceEpoch(0),
        viewerHasLiked: json["viewerHasLiked"] as bool? ?? false,
        viewerHasFavorited: json["viewerHasFavorited"] as bool? ?? false,
      );
}

class ForumContentBlock {
  const ForumContentBlock.paragraph(this.text)
      : type = "paragraph",
        imageUrl = null,
        caption = null;

  const ForumContentBlock.image({
    required this.imageUrl,
    this.caption,
  })  : type = "image",
        text = null;

  final String type;
  final String? text;
  final String? imageUrl;
  final String? caption;

  factory ForumContentBlock.fromJson(Map<String, dynamic> json) {
    final type = json["type"] as String? ?? "paragraph";
    if (type == "image") {
      return ForumContentBlock.image(
        imageUrl: json["imageUrl"] as String? ?? "",
        caption: json["caption"] as String?,
      );
    }
    return ForumContentBlock.paragraph(json["text"] as String? ?? "");
  }

  Map<String, dynamic> toJson() {
    if (type == "image") {
      return {
        "type": "image",
        "imageUrl": imageUrl,
        if (caption?.isNotEmpty == true) "caption": caption,
      };
    }
    return {
      "type": "paragraph",
      "text": text ?? "",
    };
  }
}

class ForumReply {
  const ForumReply({
    required this.id,
    required this.parentPostId,
    required this.rootPostId,
    required this.bodyText,
    required this.contentBlocks,
    required this.likeCount,
    required this.createdAt,
    required this.author,
    required this.viewerHasLiked,
    required this.isBlockedAuthor,
  });

  final int id;
  final int? parentPostId;
  final int? rootPostId;
  final String bodyText;
  final List<ForumContentBlock> contentBlocks;
  final int likeCount;
  final DateTime createdAt;
  final ForumUserBadge author;
  final bool viewerHasLiked;
  final bool isBlockedAuthor;

  factory ForumReply.fromJson(Map<String, dynamic> json) => ForumReply(
        id: json["id"] as int? ?? 0,
        parentPostId: json["parentPostId"] as int?,
        rootPostId: json["rootPostId"] as int?,
        bodyText: json["bodyText"] as String? ?? "",
        contentBlocks: (json["contentBlocks"] as List<dynamic>? ?? const [])
            .map((item) =>
                ForumContentBlock.fromJson(item as Map<String, dynamic>))
            .toList(),
        likeCount: json["likeCount"] as int? ?? 0,
        createdAt: DateTime.tryParse(json["createdAt"] as String? ?? "") ??
            DateTime.fromMillisecondsSinceEpoch(0),
        author: ForumUserBadge.fromJson(
            json["author"] as Map<String, dynamic>? ??
                const <String, dynamic>{}),
        viewerHasLiked: json["viewerHasLiked"] as bool? ?? false,
        isBlockedAuthor: json["isBlockedAuthor"] as bool? ?? false,
      );
}

class ForumPostFloor extends ForumReply {
  const ForumPostFloor({
    required super.id,
    required super.parentPostId,
    required super.rootPostId,
    required this.floorNo,
    required super.bodyText,
    required super.contentBlocks,
    required super.likeCount,
    required super.createdAt,
    required super.author,
    required super.viewerHasLiked,
    required super.isBlockedAuthor,
    required this.replies,
  });

  final int floorNo;
  final List<ForumReply> replies;

  factory ForumPostFloor.fromJson(Map<String, dynamic> json) => ForumPostFloor(
        id: json["id"] as int? ?? 0,
        parentPostId: json["parentPostId"] as int?,
        rootPostId: json["rootPostId"] as int?,
        floorNo: json["floorNo"] as int? ?? 0,
        bodyText: json["bodyText"] as String? ?? "",
        contentBlocks: (json["contentBlocks"] as List<dynamic>? ?? const [])
            .map((item) =>
                ForumContentBlock.fromJson(item as Map<String, dynamic>))
            .toList(),
        likeCount: json["likeCount"] as int? ?? 0,
        createdAt: DateTime.tryParse(json["createdAt"] as String? ?? "") ??
            DateTime.fromMillisecondsSinceEpoch(0),
        author: ForumUserBadge.fromJson(
            json["author"] as Map<String, dynamic>? ??
                const <String, dynamic>{}),
        viewerHasLiked: json["viewerHasLiked"] as bool? ?? false,
        isBlockedAuthor: json["isBlockedAuthor"] as bool? ?? false,
        replies: (json["replies"] as List<dynamic>? ?? const [])
            .map((item) => ForumReply.fromJson(item as Map<String, dynamic>))
            .toList(),
      );
}

class ForumThreadDetail extends ForumThreadCard {
  const ForumThreadDetail({
    required super.id,
    required super.title,
    required super.summary,
    required super.threadType,
    required super.coverImageUrl,
    required super.tags,
    required super.section,
    required super.author,
    required super.song,
    required super.isPinned,
    required super.isFeatured,
    required super.isLocked,
    required super.status,
    required super.likeCount,
    required super.replyCount,
    required super.viewCount,
    required super.createdAt,
    required super.viewerHasLiked,
    required super.viewerHasFavorited,
    required this.contentBlocks,
    required this.posts,
  });

  final List<ForumContentBlock> contentBlocks;
  final List<ForumPostFloor> posts;

  factory ForumThreadDetail.fromJson(Map<String, dynamic> json) =>
      ForumThreadDetail(
        id: json["id"] as int? ?? 0,
        title: json["title"] as String? ?? "",
        summary: json["summary"] as String? ?? "",
        threadType: json["threadType"] as String? ?? "discussion",
        coverImageUrl: json["coverImageUrl"] as String? ?? "",
        tags: (json["tags"] as List<dynamic>? ?? const [])
            .map((item) => item.toString())
            .toList(),
        section: ForumSection.fromJson(
            json["section"] as Map<String, dynamic>? ??
                const <String, dynamic>{}),
        author: ForumUserBadge.fromJson(
            json["author"] as Map<String, dynamic>? ??
                const <String, dynamic>{}),
        song: json["song"] == null
            ? null
            : ForumSongSummary.fromJson(json["song"] as Map<String, dynamic>),
        isPinned: json["isPinned"] as bool? ?? false,
        isFeatured: json["isFeatured"] as bool? ?? false,
        isLocked: json["isLocked"] as bool? ?? false,
        status: json["status"] as String? ?? "published",
        likeCount: json["likeCount"] as int? ?? 0,
        replyCount: json["replyCount"] as int? ?? 0,
        viewCount: json["viewCount"] as int? ?? 0,
        createdAt: DateTime.tryParse(json["createdAt"] as String? ?? "") ??
            DateTime.fromMillisecondsSinceEpoch(0),
        viewerHasLiked: json["viewerHasLiked"] as bool? ?? false,
        viewerHasFavorited: json["viewerHasFavorited"] as bool? ?? false,
        contentBlocks: (json["contentBlocks"] as List<dynamic>? ?? const [])
            .map((item) =>
                ForumContentBlock.fromJson(item as Map<String, dynamic>))
            .toList(),
        posts: (json["posts"] as List<dynamic>? ?? const [])
            .map(
                (item) => ForumPostFloor.fromJson(item as Map<String, dynamic>))
            .toList(),
      );
}

class ForumNotification {
  const ForumNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.isRead,
    required this.createdAt,
    required this.threadId,
    required this.postId,
    required this.actor,
  });

  final int id;
  final String type;
  final String title;
  final String body;
  final bool isRead;
  final DateTime createdAt;
  final int? threadId;
  final int? postId;
  final ForumUserBadge? actor;

  factory ForumNotification.fromJson(Map<String, dynamic> json) =>
      ForumNotification(
        id: json["id"] as int? ?? 0,
        type: json["type"] as String? ?? "system",
        title: json["title"] as String? ?? "",
        body: json["body"] as String? ?? "",
        isRead: json["isRead"] as bool? ?? false,
        createdAt: DateTime.tryParse(json["createdAt"] as String? ?? "") ??
            DateTime.fromMillisecondsSinceEpoch(0),
        threadId: json["threadId"] as int?,
        postId: json["postId"] as int?,
        actor: json["actor"] == null
            ? null
            : ForumUserBadge.fromJson(json["actor"] as Map<String, dynamic>),
      );
}

class ForumHomePayload {
  const ForumHomePayload({
    required this.sections,
    required this.featuredThreads,
    required this.hotThreads,
    required this.latestGuides,
    required this.announcements,
    required this.currentUser,
    required this.unreadNotificationCount,
  });

  final List<ForumSection> sections;
  final List<ForumThreadCard> featuredThreads;
  final List<ForumThreadCard> hotThreads;
  final List<ForumThreadCard> latestGuides;
  final List<ForumThreadCard> announcements;
  final ForumUserBadge? currentUser;
  final int unreadNotificationCount;

  factory ForumHomePayload.fromJson(Map<String, dynamic> json) =>
      ForumHomePayload(
        sections: (json["sections"] as List<dynamic>? ?? const [])
            .map((item) => ForumSection.fromJson(item as Map<String, dynamic>))
            .toList(),
        featuredThreads: (json["featuredThreads"] as List<dynamic>? ?? const [])
            .map((item) =>
                ForumThreadCard.fromJson(item as Map<String, dynamic>))
            .toList(),
        hotThreads: (json["hotThreads"] as List<dynamic>? ?? const [])
            .map((item) =>
                ForumThreadCard.fromJson(item as Map<String, dynamic>))
            .toList(),
        latestGuides: (json["latestGuides"] as List<dynamic>? ?? const [])
            .map((item) =>
                ForumThreadCard.fromJson(item as Map<String, dynamic>))
            .toList(),
        announcements: (json["announcements"] as List<dynamic>? ?? const [])
            .map((item) =>
                ForumThreadCard.fromJson(item as Map<String, dynamic>))
            .toList(),
        currentUser: json["currentUser"] == null
            ? null
            : ForumUserBadge.fromJson(
                json["currentUser"] as Map<String, dynamic>),
        unreadNotificationCount: json["unreadNotificationCount"] as int? ?? 0,
      );
}

class ThreadListPayload {
  const ThreadListPayload({
    required this.total,
    required this.page,
    required this.pageSize,
    required this.sort,
    required this.items,
  });

  final int total;
  final int page;
  final int pageSize;
  final String sort;
  final List<ForumThreadCard> items;

  factory ThreadListPayload.fromJson(Map<String, dynamic> json) =>
      ThreadListPayload(
        total: json["total"] as int? ?? 0,
        page: json["page"] as int? ?? 1,
        pageSize: json["pageSize"] as int? ?? 0,
        sort: json["sort"] as String? ?? "latest",
        items: (json["items"] as List<dynamic>? ?? const [])
            .map((item) =>
                ForumThreadCard.fromJson(item as Map<String, dynamic>))
            .toList(),
      );
}

class NotificationListPayload {
  const NotificationListPayload({
    required this.total,
    required this.unreadCount,
    required this.items,
  });

  final int total;
  final int unreadCount;
  final List<ForumNotification> items;

  factory NotificationListPayload.fromJson(Map<String, dynamic> json) =>
      NotificationListPayload(
        total: json["total"] as int? ?? 0,
        unreadCount: json["unreadCount"] as int? ?? 0,
        items: (json["items"] as List<dynamic>? ?? const [])
            .map((item) =>
                ForumNotification.fromJson(item as Map<String, dynamic>))
            .toList(),
      );
}

class AccountSummary {
  const AccountSummary({
    required this.id,
    required this.username,
    required this.email,
    required this.avatarUrl,
  });

  final int id;
  final String username;
  final String email;
  final String avatarUrl;

  factory AccountSummary.fromJson(Map<String, dynamic> json) => AccountSummary(
        id: json["id"] as int? ?? 0,
        username: json["username"] as String? ?? "",
        email: json["email"] as String? ?? "",
        avatarUrl: json["avatarUrl"] as String? ?? "",
      );
}

class AccountBinding {
  const AccountBinding({
    required this.id,
    required this.taikoId,
    required this.isCurrent,
    required this.verifiedTitle,
    required this.verifiedTitleplateId,
    required this.createdAt,
    required this.updatedAt,
  });

  final int id;
  final String taikoId;
  final bool isCurrent;
  final String? verifiedTitle;
  final int? verifiedTitleplateId;
  final DateTime createdAt;
  final DateTime updatedAt;

  factory AccountBinding.fromJson(Map<String, dynamic> json) => AccountBinding(
        id: json["id"] as int? ?? 0,
        taikoId: json["taikoId"] as String? ?? "",
        isCurrent: json["isCurrent"] as bool? ?? false,
        verifiedTitle: json["verifiedTitle"] as String?,
        verifiedTitleplateId: json["verifiedTitleplateId"] as int?,
        createdAt: DateTime.tryParse(json["createdAt"] as String? ?? "") ??
            DateTime.fromMillisecondsSinceEpoch(0),
        updatedAt: DateTime.tryParse(json["updatedAt"] as String? ?? "") ??
            DateTime.fromMillisecondsSinceEpoch(0),
      );
}

class PendingBinding {
  const PendingBinding({
    required this.taikoId,
    required this.originalTitle,
    required this.originalTitleplateId,
    required this.expiresAt,
  });

  final String taikoId;
  final String originalTitle;
  final int originalTitleplateId;
  final DateTime expiresAt;

  factory PendingBinding.fromJson(Map<String, dynamic> json) => PendingBinding(
        taikoId: json["taikoId"] as String? ?? "",
        originalTitle: json["originalTitle"] as String? ?? "",
        originalTitleplateId: json["originalTitleplateId"] as int? ?? 0,
        expiresAt: DateTime.tryParse(json["expiresAt"] as String? ?? "") ??
            DateTime.fromMillisecondsSinceEpoch(0),
      );
}

class AccountVerificationStatus {
  const AccountVerificationStatus({
    required this.emailVerified,
    required this.taikoVerified,
  });

  final bool emailVerified;
  final bool taikoVerified;

  factory AccountVerificationStatus.fromJson(Map<String, dynamic> json) =>
      AccountVerificationStatus(
        emailVerified: json["emailVerified"] as bool? ?? false,
        taikoVerified: json["taikoVerified"] as bool? ?? false,
      );
}

class AccountProfilePayload {
  const AccountProfilePayload({
    required this.user,
    required this.bindings,
    required this.currentBinding,
    required this.pendingBinding,
    required this.verificationStatus,
  });

  final AccountSummary user;
  final List<AccountBinding> bindings;
  final AccountBinding? currentBinding;
  final PendingBinding? pendingBinding;
  final AccountVerificationStatus verificationStatus;

  String? get currentBindingTaikoId => currentBinding?.taikoId;

  factory AccountProfilePayload.fromJson(Map<String, dynamic> json) =>
      AccountProfilePayload(
        user: AccountSummary.fromJson(
            json["user"] as Map<String, dynamic>? ?? const <String, dynamic>{}),
        bindings: (json["bindings"] as List<dynamic>? ?? const [])
            .map(
                (item) => AccountBinding.fromJson(item as Map<String, dynamic>))
            .toList(),
        currentBinding: json["currentBinding"] == null
            ? null
            : AccountBinding.fromJson(
                json["currentBinding"] as Map<String, dynamic>),
        pendingBinding: json["pendingBinding"] == null
            ? null
            : PendingBinding.fromJson(
                json["pendingBinding"] as Map<String, dynamic>),
        verificationStatus: AccountVerificationStatus.fromJson(
            json["verificationStatus"] as Map<String, dynamic>? ??
                const <String, dynamic>{}),
      );
}

class ForumPreferences {
  const ForumPreferences({
    required this.recordHistoryEnabled,
  });

  final bool recordHistoryEnabled;

  factory ForumPreferences.fromJson(Map<String, dynamic> json) =>
      ForumPreferences(
        recordHistoryEnabled: json["recordHistoryEnabled"] as bool? ?? true,
      );
}

class ForumMeStats {
  const ForumMeStats({
    required this.threadCount,
    required this.repliedThreadCount,
    required this.favoriteCount,
    required this.historyCount,
    required this.followerCount,
    required this.followingCount,
    required this.blockedCount,
  });

  final int threadCount;
  final int repliedThreadCount;
  final int favoriteCount;
  final int historyCount;
  final int followerCount;
  final int followingCount;
  final int blockedCount;

  factory ForumMeStats.fromJson(Map<String, dynamic> json) => ForumMeStats(
        threadCount: json["threadCount"] as int? ?? 0,
        repliedThreadCount: json["repliedThreadCount"] as int? ?? 0,
        favoriteCount: json["favoriteCount"] as int? ?? 0,
        historyCount: json["historyCount"] as int? ?? 0,
        followerCount: json["followerCount"] as int? ?? 0,
        followingCount: json["followingCount"] as int? ?? 0,
        blockedCount: json["blockedCount"] as int? ?? 0,
      );
}

class ForumMeSummary {
  const ForumMeSummary({
    required this.user,
    required this.forumBadge,
    required this.currentBinding,
    required this.pendingBinding,
    required this.verificationStatus,
    required this.unreadNotificationCount,
    required this.myDonUrl,
    required this.stats,
    required this.preferences,
  });

  final AccountSummary user;
  final ForumUserBadge forumBadge;
  final AccountBinding? currentBinding;
  final PendingBinding? pendingBinding;
  final AccountVerificationStatus verificationStatus;
  final int unreadNotificationCount;
  final String? myDonUrl;
  final ForumMeStats stats;
  final ForumPreferences preferences;

  factory ForumMeSummary.fromJson(Map<String, dynamic> json) => ForumMeSummary(
        user: AccountSummary.fromJson(
            json["user"] as Map<String, dynamic>? ?? const <String, dynamic>{}),
        forumBadge: ForumUserBadge.fromJson(
            json["forumBadge"] as Map<String, dynamic>? ??
                const <String, dynamic>{}),
        currentBinding: json["currentBinding"] == null
            ? null
            : AccountBinding.fromJson(
                json["currentBinding"] as Map<String, dynamic>),
        pendingBinding: json["pendingBinding"] == null
            ? null
            : PendingBinding.fromJson(
                json["pendingBinding"] as Map<String, dynamic>),
        verificationStatus: AccountVerificationStatus.fromJson(
            json["verificationStatus"] as Map<String, dynamic>? ??
                const <String, dynamic>{}),
        unreadNotificationCount: json["unreadNotificationCount"] as int? ?? 0,
        myDonUrl: json["myDonUrl"] as String?,
        stats: ForumMeStats.fromJson(json["stats"] as Map<String, dynamic>? ??
            const <String, dynamic>{}),
        preferences: ForumPreferences.fromJson(
            json["preferences"] as Map<String, dynamic>? ??
                const <String, dynamic>{}),
      );
}

class ForumRelationship {
  const ForumRelationship({
    required this.isSelf,
    required this.isFollowing,
    required this.isFollowedBy,
    required this.isBlocked,
    required this.isBlockedBy,
  });

  final bool isSelf;
  final bool isFollowing;
  final bool isFollowedBy;
  final bool isBlocked;
  final bool isBlockedBy;

  factory ForumRelationship.fromJson(Map<String, dynamic> json) =>
      ForumRelationship(
        isSelf: json["isSelf"] as bool? ?? false,
        isFollowing: json["isFollowing"] as bool? ?? false,
        isFollowedBy: json["isFollowedBy"] as bool? ?? false,
        isBlocked: json["isBlocked"] as bool? ?? false,
        isBlockedBy: json["isBlockedBy"] as bool? ?? false,
      );
}

class ForumUserStats {
  const ForumUserStats({
    required this.threadCount,
    required this.followerCount,
    required this.followingCount,
  });

  final int threadCount;
  final int followerCount;
  final int followingCount;

  factory ForumUserStats.fromJson(Map<String, dynamic> json) => ForumUserStats(
        threadCount: json["threadCount"] as int? ?? 0,
        followerCount: json["followerCount"] as int? ?? 0,
        followingCount: json["followingCount"] as int? ?? 0,
      );
}

class ForumUserProfile {
  const ForumUserProfile({
    required this.user,
    required this.relationship,
    required this.stats,
    required this.latestThreads,
  });

  final ForumUserBadge user;
  final ForumRelationship relationship;
  final ForumUserStats stats;
  final List<ForumThreadCard> latestThreads;

  factory ForumUserProfile.fromJson(Map<String, dynamic> json) =>
      ForumUserProfile(
        user: ForumUserBadge.fromJson(
            json["user"] as Map<String, dynamic>? ?? const <String, dynamic>{}),
        relationship: ForumRelationship.fromJson(
            json["relationship"] as Map<String, dynamic>? ??
                const <String, dynamic>{}),
        stats: ForumUserStats.fromJson(json["stats"] as Map<String, dynamic>? ??
            const <String, dynamic>{}),
        latestThreads: (json["latestThreads"] as List<dynamic>? ?? const [])
            .map((item) =>
                ForumThreadCard.fromJson(item as Map<String, dynamic>))
            .toList(),
      );
}

class ForumRelationshipItem {
  const ForumRelationshipItem({
    required this.user,
    required this.createdAt,
    required this.mutualFollow,
  });

  final ForumUserBadge user;
  final DateTime createdAt;
  final bool mutualFollow;

  factory ForumRelationshipItem.fromJson(Map<String, dynamic> json) =>
      ForumRelationshipItem(
        user: ForumUserBadge.fromJson(
            json["user"] as Map<String, dynamic>? ?? const <String, dynamic>{}),
        createdAt: DateTime.tryParse(json["createdAt"] as String? ?? "") ??
            DateTime.fromMillisecondsSinceEpoch(0),
        mutualFollow: json["mutualFollow"] as bool? ?? false,
      );
}

class RelationshipListPayload {
  const RelationshipListPayload({
    required this.total,
    required this.page,
    required this.pageSize,
    required this.items,
  });

  final int total;
  final int page;
  final int pageSize;
  final List<ForumRelationshipItem> items;

  factory RelationshipListPayload.fromJson(Map<String, dynamic> json) =>
      RelationshipListPayload(
        total: json["total"] as int? ?? 0,
        page: json["page"] as int? ?? 1,
        pageSize: json["pageSize"] as int? ?? 0,
        items: (json["items"] as List<dynamic>? ?? const [])
            .map((item) =>
                ForumRelationshipItem.fromJson(item as Map<String, dynamic>))
            .toList(),
      );
}
