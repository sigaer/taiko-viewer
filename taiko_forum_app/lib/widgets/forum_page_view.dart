import "package:flutter/material.dart";

class ForumPageView extends StatelessWidget {
  const ForumPageView({
    super.key,
    required this.child,
  });

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: true,
      bottom: false,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
            child: Container(
              height: 14,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFFD84A34), Color(0xFFF08A24)],
                ),
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
          Expanded(child: child),
        ],
      ),
    );
  }
}
