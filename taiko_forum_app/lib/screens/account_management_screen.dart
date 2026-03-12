import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "../app_shell.dart";
import "../services/api_client.dart";
import "../services/auth_controller.dart";
import "../widgets/app_message_helper.dart";

class AccountManagementScreen extends StatefulWidget {
  const AccountManagementScreen({super.key, required this.email});

  final String email;

  @override
  State<AccountManagementScreen> createState() =>
      _AccountManagementScreenState();
}

class _AccountManagementScreenState extends State<AccountManagementScreen> {
  final _emailController = TextEditingController();
  final _codeController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _sendingCode = false;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _emailController.text = widget.email;
  }

  @override
  void dispose() {
    _emailController.dispose();
    _codeController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _sendCode() async {
    if (_sendingCode || _emailController.text.trim().isEmpty) return;
    setState(() => _sendingCode = true);
    try {
      await context
          .read<ApiClient>()
          .sendResetPasswordCode(_emailController.text.trim());
      if (mounted) context.showSuccessMessage("验证码已发送，请检查邮箱");
    } catch (error) {
      if (mounted) {
        context.showOperationError(error, fallback: "验证码发送失败，请稍后再试");
      }
    } finally {
      if (mounted) setState(() => _sendingCode = false);
    }
  }

  Future<void> _resetPassword() async {
    if (_submitting) return;
    if (_emailController.text.trim().isEmpty ||
        _codeController.text.trim().isEmpty ||
        _passwordController.text.isEmpty) {
      context.showInfoMessage("请填写邮箱、验证码和新密码");
      return;
    }
    setState(() => _submitting = true);
    try {
      await context.read<ApiClient>().resetPassword(
            email: _emailController.text.trim(),
            code: _codeController.text.trim(),
            password: _passwordController.text,
          );
      if (mounted) context.showSuccessMessage("密码已重置");
      _codeController.clear();
      _passwordController.clear();
    } catch (error) {
      if (mounted) {
        context.showOperationError(error, fallback: "密码重置失败，请稍后再试");
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    return Scaffold(
      appBar: AppBar(title: const Text("账号管理")),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: SwitchListTile.adaptive(
              value: auth.rememberCredentials,
              title: const Text("记住用户名和密码"),
              subtitle: const Text("下次打开 App 时自动填充登录信息"),
              onChanged: (value) async {
                await auth.setRememberedCredentials(
                  enabled: value,
                  identifier: auth.rememberedIdentifier,
                  password: auth.rememberedPassword,
                );
                if (!context.mounted) return;
                context.showSuccessMessage(value ? "已开启记忆登录信息" : "已关闭记忆登录信息");
              },
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text("当前邮箱", style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  Text(widget.email),
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
                  Text("密码重置", style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _emailController,
                    decoration: const InputDecoration(
                      labelText: "邮箱",
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _codeController,
                          decoration: const InputDecoration(
                            labelText: "验证码",
                            border: OutlineInputBorder(),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      OutlinedButton(
                        onPressed: _sendingCode ? null : _sendCode,
                        child: Text(_sendingCode ? "发送中..." : "发送验证码"),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _passwordController,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: "新密码",
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: _submitting ? null : _resetPassword,
                    child: Text(_submitting ? "提交中..." : "重置密码"),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          FilledButton.tonal(
            onPressed: () async {
              await context.read<AuthController>().logout();
              if (!context.mounted) return;
              context.showSuccessMessage("已退出登录");
              Navigator.of(context).pushAndRemoveUntil(
                MaterialPageRoute(
                  builder: (_) => const AppShell(initialIndex: 4),
                ),
                (_) => false,
              );
            },
            child: const Text("退出登录"),
          ),
        ],
      ),
    );
  }
}
