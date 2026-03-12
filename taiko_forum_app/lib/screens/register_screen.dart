import "dart:async";

import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "../services/api_client.dart";
import "../services/auth_controller.dart";
import "../widgets/app_message_helper.dart";

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _usernameController = TextEditingController();
  final _emailController = TextEditingController();
  final _codeController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _sendingCode = false;
  bool _submitting = false;
  bool _rememberCredentials = true;
  int _cooldown = 0;
  Timer? _timer;

  @override
  void dispose() {
    _timer?.cancel();
    _usernameController.dispose();
    _emailController.dispose();
    _codeController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  void _startCooldown() {
    _timer?.cancel();
    setState(() => _cooldown = 60);
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_cooldown <= 1) {
        timer.cancel();
        setState(() => _cooldown = 0);
        return;
      }
      setState(() => _cooldown -= 1);
    });
  }

  Future<void> _sendCode() async {
    final email = _emailController.text.trim();
    if (email.isEmpty || _sendingCode || _cooldown > 0) {
      if (email.isEmpty) {
        context.showInfoMessage("请先输入邮箱");
      }
      return;
    }
    setState(() => _sendingCode = true);
    try {
      await context.read<ApiClient>().sendRegisterCode(email);
      if (mounted) context.showSuccessMessage("验证码已发送，请检查邮箱");
      _startCooldown();
    } catch (error) {
      if (mounted) {
        context.showOperationError(error, fallback: "验证码发送失败，请稍后再试");
      }
    } finally {
      if (mounted) {
        setState(() => _sendingCode = false);
      }
    }
  }

  Future<void> _submit() async {
    if (_submitting) return;
    final apiClient = context.read<ApiClient>();
    final authController = context.read<AuthController>();
    final username = _usernameController.text.trim();
    final email = _emailController.text.trim();
    final code = _codeController.text.trim();
    final password = _passwordController.text;
    final confirmPassword = _confirmPasswordController.text;
    if ([username, email, code, password, confirmPassword]
        .any((value) => value.isEmpty)) {
      context.showInfoMessage("请先填写完整注册信息");
      return;
    }
    if (password != confirmPassword) {
      context.showInfoMessage("两次输入的密码不一致");
      return;
    }
    setState(() => _submitting = true);
    try {
      await apiClient.register(
        username: username,
        email: email,
        code: code,
        password: password,
      );
      await authController.login(
        identifier: username,
        password: password,
        rememberCredentials: _rememberCredentials,
      );
      if (mounted) context.showSuccessMessage("注册并登录成功");
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (error) {
      if (mounted) {
        context.showOperationError(error, fallback: "注册失败，请检查输入后重试");
      }
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("注册账号")),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text("注册社区账号", style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 12),
          TextField(
            controller: _usernameController,
            decoration: const InputDecoration(
                labelText: "用户名", border: OutlineInputBorder()),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(
                labelText: "邮箱", border: OutlineInputBorder()),
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: TextField(
                  controller: _codeController,
                  decoration: const InputDecoration(
                      labelText: "邮箱验证码", border: OutlineInputBorder()),
                ),
              ),
              const SizedBox(width: 12),
              FilledButton.tonal(
                onPressed: _sendingCode || _cooldown > 0 ? null : _sendCode,
                child: Text(_cooldown > 0 ? "${_cooldown}s 后重发" : "发送验证码"),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _passwordController,
            obscureText: true,
            decoration: const InputDecoration(
                labelText: "密码", border: OutlineInputBorder()),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _confirmPasswordController,
            obscureText: true,
            decoration: const InputDecoration(
                labelText: "确认密码", border: OutlineInputBorder()),
          ),
          const SizedBox(height: 8),
          SwitchListTile.adaptive(
            value: _rememberCredentials,
            onChanged: (value) => setState(() => _rememberCredentials = value),
            contentPadding: EdgeInsets.zero,
            title: const Text("记住用户名和密码"),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _submitting ? null : _submit,
            child: Text(_submitting ? "注册中..." : "注册并登录"),
          ),
        ],
      ),
    );
  }
}
