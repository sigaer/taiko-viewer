import "dart:io";

import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "../services/api_client.dart";
import "../widgets/app_message_helper.dart";

class FeedbackScreen extends StatefulWidget {
  const FeedbackScreen({super.key});

  @override
  State<FeedbackScreen> createState() => _FeedbackScreenState();
}

class _FeedbackScreenState extends State<FeedbackScreen> {
  final _contentController = TextEditingController();
  final _contactController = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _contentController.dispose();
    _contactController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_submitting) return;
    if (_contentController.text.trim().isEmpty) {
      context.showInfoMessage("请先填写反馈内容");
      return;
    }
    setState(() => _submitting = true);
    try {
      await context.read<ApiClient>().submitFeedback(
            content: _contentController.text.trim(),
            contact: _contactController.text.trim(),
            appVersion: "0.1.0+1",
            platform: Platform.operatingSystem,
          );
      if (!mounted) return;
      context.showSuccessMessage("反馈已提交");
      _contentController.clear();
      _contactController.clear();
    } catch (error) {
      if (mounted) {
        context.showOperationError(error, fallback: "反馈提交失败，请稍后再试");
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("意见反馈")),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: _contentController,
            minLines: 6,
            maxLines: 10,
            decoration: const InputDecoration(
              labelText: "反馈内容",
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _contactController,
            decoration: const InputDecoration(
              labelText: "联系方式（选填）",
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _submitting ? null : _submit,
            child: Text(_submitting ? "提交中..." : "提交反馈"),
          ),
        ],
      ),
    );
  }
}
