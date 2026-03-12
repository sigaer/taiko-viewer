import "dart:io";

import "package:flutter/material.dart";
import "package:image_picker/image_picker.dart";
import "package:provider/provider.dart";

import "../models/forum_models.dart";
import "../services/api_client.dart";
import "../services/auth_controller.dart";
import "../widgets/app_message_helper.dart";
import "../widgets/forum_media.dart";
import "../widgets/forum_page_view.dart";

class ComposerScreen extends StatefulWidget {
  const ComposerScreen({super.key});

  @override
  State<ComposerScreen> createState() => _ComposerScreenState();
}

class _ComposerScreenState extends State<ComposerScreen> {
  final _titleController = TextEditingController();
  final _summaryController = TextEditingController();
  final _bodyController = TextEditingController();
  final _tagsController = TextEditingController();
  final _songIdController = TextEditingController();
  final _levelController = TextEditingController();
  bool _loading = true;
  bool _submitting = false;
  String _sectionSlug = "score-guides";
  String _threadType = "guide";
  String _difficultyType = "4";
  List<ForumSection> _sections = const [];
  final List<String> _imageUrls = [];

  @override
  void dispose() {
    _titleController.dispose();
    _summaryController.dispose();
    _bodyController.dispose();
    _tagsController.dispose();
    _songIdController.dispose();
    _levelController.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    _loadSections();
  }

  Future<void> _loadSections() async {
    final sections = await context.read<ApiClient>().fetchSections();
    if (!mounted) return;
    setState(() {
      _sections = sections;
      if (sections.isNotEmpty) {
        _sectionSlug = sections.first.slug;
      }
      _loading = false;
    });
  }

  Future<void> _pickImage() async {
    if (!context.read<AuthController>().isAuthenticated) {
      context.showInfoMessage("请先登录后再上传图片");
      return;
    }
    final picker = ImagePicker();
    final files = await picker.pickMultiImage();
    if (files.isEmpty || !mounted) return;
    for (final file in files) {
      try {
        final url =
            await context.read<ApiClient>().uploadForumImage(File(file.path));
        if (!mounted) return;
        setState(() => _imageUrls.add(url));
      } catch (error) {
        context.showOperationError(error, fallback: "图片上传失败，请稍后再试");
      }
    }
    if (_imageUrls.isNotEmpty) {
      context.showSuccessMessage("图片上传完成");
    }
  }

  Future<void> _submit() async {
    if (_submitting) return;
    if (!context.read<AuthController>().isAuthenticated) {
      context.showInfoMessage("请先登录后再发帖");
      return;
    }
    if (_titleController.text.trim().isEmpty ||
        _bodyController.text.trim().isEmpty) {
      context.showInfoMessage("请先填写标题和正文");
      return;
    }
    setState(() => _submitting = true);
    try {
      final contentBlocks = <Map<String, dynamic>>[
        {
          "type": "paragraph",
          "text": _bodyController.text.trim(),
        },
        ..._imageUrls.map((url) => {
              "type": "image",
              "imageUrl": url,
            }),
      ];
      await context.read<ApiClient>().createThread(
            sectionSlug: _sectionSlug,
            threadType: _threadType,
            title: _titleController.text.trim(),
            summary: _summaryController.text.trim(),
            tags: _tagsController.text
                .split(RegExp(r"[\s,，#]+"))
                .where((item) => item.trim().isNotEmpty)
                .map((item) => item.trim())
                .toList(),
            songId: _songIdController.text.trim().isEmpty
                ? null
                : _songIdController.text.trim(),
            difficultyType: _difficultyType,
            level: _levelController.text.trim().isEmpty
                ? null
                : _levelController.text.trim(),
            contentBlocks: contentBlocks,
          );
      if (!mounted) return;
      context.showSuccessMessage("帖子已发布");
      _titleController.clear();
      _summaryController.clear();
      _bodyController.clear();
      _tagsController.clear();
      _songIdController.clear();
      _levelController.clear();
      setState(() => _imageUrls.clear());
    } catch (error) {
      if (!mounted) return;
      context.showOperationError(error, fallback: "发帖失败，请稍后再试");
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    if (!auth.isAuthenticated) {
      return Scaffold(
        body: ForumPageView(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.lock_outline, size: 44),
                  const SizedBox(height: 12),
                  Text("登录后才能发布主题。",
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  Text("请先到“我的”页面登录或注册账号。",
                      style: Theme.of(context).textTheme.bodyMedium),
                ],
              ),
            ),
          ),
        ),
      );
    }
    if (_loading) {
      return const Scaffold(
          body: ForumPageView(
        child: Center(child: CircularProgressIndicator()),
      ));
    }
    return Scaffold(
      body: ForumPageView(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 6, 16, 16),
          children: [
            Text("发布新帖", style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              initialValue: _sectionSlug,
              items: _sections
                  .map((item) => DropdownMenuItem<String>(
                      value: item.slug, child: Text(item.name)))
                  .toList(),
              onChanged: (value) =>
                  setState(() => _sectionSlug = value ?? _sectionSlug),
              decoration: const InputDecoration(
                  labelText: "版块", border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _threadType,
              items: const [
                DropdownMenuItem(value: "discussion", child: Text("讨论")),
                DropdownMenuItem(value: "guide", child: Text("攻略")),
                DropdownMenuItem(value: "achievement", child: Text("战报")),
                DropdownMenuItem(value: "official", child: Text("公告")),
              ],
              onChanged: (value) =>
                  setState(() => _threadType = value ?? _threadType),
              decoration: const InputDecoration(
                  labelText: "帖子类型", border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            TextField(
                controller: _titleController,
                decoration: const InputDecoration(
                    labelText: "标题", border: OutlineInputBorder())),
            const SizedBox(height: 12),
            TextField(
                controller: _summaryController,
                decoration: const InputDecoration(
                    labelText: "摘要", border: OutlineInputBorder())),
            const SizedBox(height: 12),
            TextField(
                controller: _tagsController,
                decoration: const InputDecoration(
                    labelText: "标签", border: OutlineInputBorder())),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _songIdController,
                    decoration: const InputDecoration(
                        labelText: "曲目 ID", border: OutlineInputBorder()),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _difficultyType,
                    items: const [
                      DropdownMenuItem(value: "1", child: Text("简单")),
                      DropdownMenuItem(value: "2", child: Text("普通")),
                      DropdownMenuItem(value: "3", child: Text("困难")),
                      DropdownMenuItem(value: "4", child: Text("魔王")),
                      DropdownMenuItem(value: "5", child: Text("里谱")),
                    ],
                    onChanged: (value) => setState(
                        () => _difficultyType = value ?? _difficultyType),
                    decoration: const InputDecoration(
                        labelText: "难度", border: OutlineInputBorder()),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _levelController,
                    decoration: const InputDecoration(
                        labelText: "星级", border: OutlineInputBorder()),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _bodyController,
              maxLines: 10,
              decoration: const InputDecoration(
                  labelText: "正文", border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _pickImage,
              icon: const Icon(Icons.image_outlined),
              label: const Text("上传正文图片"),
            ),
            if (_imageUrls.isNotEmpty) ...[
              const SizedBox(height: 12),
              Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  for (final url in _imageUrls)
                    Stack(
                      clipBehavior: Clip.none,
                      children: [
                        SizedBox(
                          width: 120,
                          height: 120,
                          child: ForumNetworkImage(
                            url: url,
                            fit: BoxFit.cover,
                            borderRadius: BorderRadius.circular(18),
                            icon: Icons.image_outlined,
                          ),
                        ),
                        Positioned(
                          top: -8,
                          right: -8,
                          child: IconButton.filledTonal(
                            onPressed: () =>
                                setState(() => _imageUrls.remove(url)),
                            icon: const Icon(Icons.close, size: 18),
                          ),
                        ),
                      ],
                    ),
                ],
              ),
            ],
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _submitting ? null : _submit,
              child: Text(_submitting ? "发布中..." : "发布帖子"),
            ),
          ],
        ),
      ),
    );
  }
}
