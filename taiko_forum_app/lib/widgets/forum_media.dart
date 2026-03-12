import "package:flutter/material.dart";

class ForumNetworkImage extends StatelessWidget {
  const ForumNetworkImage({
    super.key,
    required this.url,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.borderRadius,
    this.icon = Icons.image_outlined,
  });

  final String url;
  final double? width;
  final double? height;
  final BoxFit fit;
  final BorderRadius? borderRadius;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final placeholder = DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: borderRadius,
        gradient: const LinearGradient(
          colors: [Color(0xFFFFF2E3), Color(0xFFF5E0C7)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: SizedBox(
        width: width ?? double.infinity,
        height: height ?? 200,
        child: Center(
          child: Icon(
            icon,
            color: Theme.of(context).colorScheme.primary,
          ),
        ),
      ),
    );

    if (url.trim().isEmpty) {
      return placeholder;
    }

    final image = Image.network(
      url,
      width: width,
      height: height,
      fit: fit,
      errorBuilder: (_, __, ___) => placeholder,
      loadingBuilder: (context, child, progress) {
        if (progress == null) return child;
        return placeholder;
      },
    );

    if (borderRadius == null) {
      return image;
    }
    return ClipRRect(
      borderRadius: borderRadius!,
      child: image,
    );
  }
}

class ForumAvatar extends StatelessWidget {
  const ForumAvatar({
    super.key,
    required this.name,
    required this.avatarUrl,
    this.radius = 20,
  });

  final String name;
  final String avatarUrl;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return ClipOval(
      child: SizedBox(
        width: radius * 2,
        height: radius * 2,
        child: ForumNetworkImage(
          url: avatarUrl,
          width: radius * 2,
          height: radius * 2,
          fit: BoxFit.cover,
          icon: Icons.person_outline,
          borderRadius: BorderRadius.circular(radius),
        ),
      ),
    );
  }
}
