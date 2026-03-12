import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "../models/forum_models.dart";
import "../services/api_client.dart";
import "../widgets/forum_page_view.dart";
import "../widgets/forum_thread_tile.dart";
import "thread_detail_screen.dart";
import "user_profile_screen.dart";

class SectionsScreen extends StatefulWidget {
  const SectionsScreen({super.key});

  @override
  State<SectionsScreen> createState() => _SectionsScreenState();
}

class _SectionsScreenState extends State<SectionsScreen> {
  bool _loading = true;
  List<ForumSection> _sections = const [];
  ForumSection? _selected;
  ThreadListPayload? _threads;
  String _sort = "latest";

  @override
  void initState() {
    super.initState();
    _loadSections();
  }

  Future<void> _loadSections() async {
    final apiClient = context.read<ApiClient>();
    setState(() => _loading = true);
    final sections = await apiClient.fetchSections();
    final selected = _selected == null
        ? (sections.isEmpty ? null : sections.first)
        : sections.firstWhere(
            (item) => item.slug == _selected!.slug,
            orElse: () => sections.isEmpty ? _selected! : sections.first,
          );
    ThreadListPayload? threads;
    if (selected != null) {
      threads =
          await apiClient.fetchThreads(sectionSlug: selected.slug, sort: _sort);
    }
    if (!mounted) return;
    setState(() {
      _sections = sections;
      _selected = selected;
      _threads = threads;
      _loading = false;
    });
  }

  Future<void> _loadThreads() async {
    if (_selected == null) return;
    final apiClient = context.read<ApiClient>();
    setState(() => _loading = true);
    final threads =
        await apiClient.fetchThreads(sectionSlug: _selected!.slug, sort: _sort);
    if (!mounted) return;
    setState(() {
      _threads = threads;
      _loading = false;
    });
  }

  void _openUser(ForumUserBadge user) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => UserProfileScreen(userId: user.id)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: ForumPageView(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: _loadThreads,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 6, 16, 16),
                  children: [
                    Text("论坛版块",
                        style: Theme.of(context).textTheme.headlineSmall),
                    const SizedBox(height: 12),
                    GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: _sections.length,
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 4,
                        crossAxisSpacing: 10,
                        mainAxisSpacing: 10,
                        childAspectRatio: 1.0,
                      ),
                      itemBuilder: (context, index) {
                        final section = _sections[index];
                        final selected = section.slug == _selected?.slug;
                        return GestureDetector(
                          onTap: () async {
                            setState(() => _selected = section);
                            await _loadThreads();
                          },
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 180),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 12),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(20),
                              color: selected
                                  ? const Color(0xFFD84A34)
                                  : Theme.of(context)
                                      .colorScheme
                                      .surfaceContainerHighest,
                            ),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  section.name,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    color: selected ? Colors.white : null,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13,
                                    height: 1.2,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  "${section.threadCount} 帖",
                                  style: TextStyle(
                                    color: selected ? Colors.white70 : null,
                                    fontSize: 11,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                    const SizedBox(height: 20),
                    Wrap(
                      spacing: 10,
                      children: [
                        ChoiceChip(
                            label: const Text("最新"),
                            selected: _sort == "latest",
                            onSelected: (_) async {
                              _sort = "latest";
                              await _loadThreads();
                            }),
                        ChoiceChip(
                            label: const Text("热帖"),
                            selected: _sort == "hot",
                            onSelected: (_) async {
                              _sort = "hot";
                              await _loadThreads();
                            }),
                        ChoiceChip(
                            label: const Text("精选"),
                            selected: _sort == "featured",
                            onSelected: (_) async {
                              _sort = "featured";
                              await _loadThreads();
                            }),
                      ],
                    ),
                    const SizedBox(height: 12),
                    ...?_threads?.items.map(
                      (thread) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: ForumThreadTile(
                          thread: thread,
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(
                                builder: (_) =>
                                    ThreadDetailScreen(threadId: thread.id)),
                          ),
                          onAuthorTap: () => _openUser(thread.author),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
      ),
    );
  }
}
