import "dart:io";
import "dart:typed_data";

import "package:flutter/material.dart";
import "package:image_picker/image_picker.dart";
import "package:provider/provider.dart";

import "../models/forum_models.dart";
import "../services/api_client.dart";
import "../services/auth_controller.dart";
import "../widgets/app_message_helper.dart";
import "../widgets/forum_media.dart";

class AccountProfileScreen extends StatefulWidget {
  const AccountProfileScreen({super.key});

  @override
  State<AccountProfileScreen> createState() => _AccountProfileScreenState();
}

class _AccountProfileScreenState extends State<AccountProfileScreen> {
  final _bindingController = TextEditingController();
  bool _loading = true;
  bool _working = false;
  AccountProfilePayload? _profile;
  Uint8List? _myDonBytes;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _bindingController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final api = context.read<ApiClient>();
    setState(() => _loading = true);
    try {
      final profile = await api.fetchAccountProfile();
      Uint8List? myDon;
      if (profile.currentBinding != null) {
        try {
          myDon = await api.fetchMyDonImage();
        } catch (_) {}
      }
      if (!mounted) return;
      setState(() {
        _profile = profile;
        _myDonBytes = myDon;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pickAvatar() async {
    final api = context.read<ApiClient>();
    final auth = context.read<AuthController>();
    final file = await ImagePicker().pickImage(source: ImageSource.gallery);
    if (file == null) return;
    setState(() => _working = true);
    try {
      final avatarUrl = await api.uploadAvatar(File(file.path));
      final profile = _profile;
      if (profile != null) {
        await auth.updateUser(
          AccountSummary(
            id: profile.user.id,
            username: profile.user.username,
            email: profile.user.email,
            avatarUrl: avatarUrl,
          ),
        );
      }
      if (!mounted) return;
      context.showSuccessMessage("头像已更新");
      await _load();
    } catch (error) {
      if (mounted) {
        context.showOperationError(error, fallback: "头像上传失败，请稍后再试");
      }
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  Future<void> _removeAvatar() async {
    setState(() => _working = true);
    try {
      await context.read<ApiClient>().removeAvatar();
      if (!mounted) return;
      context.showSuccessMessage("头像已恢复默认");
      await _load();
    } catch (error) {
      if (mounted) {
        context.showOperationError(error, fallback: "头像恢复失败，请稍后再试");
      }
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  Future<void> _prepareBinding() async {
    if (_bindingController.text.trim().isEmpty) {
      context.showInfoMessage("请输入鼓众 ID");
      return;
    }
    setState(() => _working = true);
    try {
      await context
          .read<ApiClient>()
          .startBindingVerification(_bindingController.text.trim());
      if (!mounted) return;
      context.showSuccessMessage("已记录当前称号，请前往鼓众广场修改后回来确认");
      await _load();
    } catch (error) {
      if (mounted) {
        context.showOperationError(error, fallback: "绑定验证发起失败，请稍后再试");
      }
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  Future<void> _confirmBinding(String taikoId) async {
    setState(() => _working = true);
    try {
      await context.read<ApiClient>().confirmBindingVerification(taikoId);
      if (!mounted) return;
      context.showSuccessMessage("绑定成功");
      _bindingController.clear();
      await _load();
    } catch (error) {
      if (mounted) {
        context.showOperationError(error, fallback: "绑定确认失败，请稍后再试");
      }
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  Future<void> _switchBinding(int bindingId) async {
    setState(() => _working = true);
    try {
      await context.read<ApiClient>().switchCurrentBinding(bindingId);
      if (!mounted) return;
      context.showSuccessMessage("当前绑定已切换");
      await _load();
    } catch (error) {
      if (mounted) {
        context.showOperationError(error, fallback: "绑定切换失败，请稍后再试");
      }
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  Future<void> _removeBinding(AccountBinding binding) async {
    setState(() => _working = true);
    try {
      await context.read<ApiClient>().removeBinding(
            bindingId: binding.id,
            force: (_profile?.bindings.length ?? 0) <= 1,
          );
      if (!mounted) return;
      context.showSuccessMessage("绑定已删除");
      await _load();
    } catch (error) {
      if (mounted) {
        context.showOperationError(error, fallback: "绑定删除失败，请稍后再试");
      }
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile = _profile;
    return Scaffold(
      appBar: AppBar(title: const Text("个人资料")),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : profile == null
              ? const Center(child: Text("资料加载失败"))
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          children: [
                            ForumAvatar(
                              radius: 34,
                              name: profile.user.username,
                              avatarUrl: profile.user.avatarUrl,
                            ),
                            const SizedBox(height: 12),
                            Text(profile.user.username,
                                style: Theme.of(context).textTheme.titleLarge),
                            const SizedBox(height: 12),
                            Wrap(
                              spacing: 12,
                              runSpacing: 12,
                              alignment: WrapAlignment.center,
                              children: [
                                OutlinedButton(
                                  onPressed: _working ? null : _pickAvatar,
                                  child: const Text("上传头像"),
                                ),
                                OutlinedButton(
                                  onPressed: _working ? null : _removeAvatar,
                                  child: const Text("恢复默认头像"),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (_myDonBytes != null)
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(12, 12, 12, 14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text("我的小咚",
                                  style:
                                      Theme.of(context).textTheme.titleMedium),
                              const SizedBox(height: 10),
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(22),
                                  color: Theme.of(context)
                                      .colorScheme
                                      .surfaceContainerHighest
                                      .withValues(alpha: 0.45),
                                ),
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(18),
                                  child: Image.memory(
                                    _myDonBytes!,
                                    height: 260,
                                    fit: BoxFit.contain,
                                    filterQuality: FilterQuality.high,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    const SizedBox(height: 12),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text("绑定鼓众 ID",
                                style: Theme.of(context).textTheme.titleMedium),
                            const SizedBox(height: 12),
                            TextField(
                              controller: _bindingController,
                              decoration: const InputDecoration(
                                labelText: "输入鼓众 ID",
                                border: OutlineInputBorder(),
                              ),
                            ),
                            const SizedBox(height: 12),
                            FilledButton(
                              onPressed: _working ? null : _prepareBinding,
                              child: const Text("开始绑定验证"),
                            ),
                            if (profile.pendingBinding != null) ...[
                              const SizedBox(height: 12),
                              Card(
                                color: Theme.of(context)
                                    .colorScheme
                                    .surfaceContainerHighest,
                                child: ListTile(
                                  title: Text(
                                      "待确认 ID：${profile.pendingBinding!.taikoId}"),
                                  subtitle: Text(
                                      profile.pendingBinding!.originalTitle),
                                  trailing: FilledButton.tonal(
                                    onPressed: _working
                                        ? null
                                        : () => _confirmBinding(
                                            profile.pendingBinding!.taikoId),
                                    child: const Text("确认绑定"),
                                  ),
                                ),
                              ),
                            ],
                            const SizedBox(height: 12),
                            ...profile.bindings.map(
                              (binding) => Card(
                                margin: const EdgeInsets.only(bottom: 10),
                                child: ListTile(
                                  title: Text(binding.taikoId),
                                  subtitle: Text(
                                    binding.verifiedTitle == null
                                        ? "未验证称号"
                                        : "称号：${binding.verifiedTitle}",
                                  ),
                                  trailing: Wrap(
                                    spacing: 8,
                                    children: [
                                      if (!binding.isCurrent)
                                        TextButton(
                                          onPressed: _working
                                              ? null
                                              : () =>
                                                  _switchBinding(binding.id),
                                          child: const Text("切换"),
                                        ),
                                      TextButton(
                                        onPressed: _working
                                            ? null
                                            : () => _removeBinding(binding),
                                        child: const Text("删除"),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
    );
  }
}
