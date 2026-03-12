import "package:flutter/material.dart";
import "package:package_info_plus/package_info_plus.dart";

class VersionInfoScreen extends StatefulWidget {
  const VersionInfoScreen({super.key});

  @override
  State<VersionInfoScreen> createState() => _VersionInfoScreenState();
}

class _VersionInfoScreenState extends State<VersionInfoScreen> {
  PackageInfo? _info;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final info = await PackageInfo.fromPlatform();
    if (!mounted) return;
    setState(() => _info = info);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("版本信息")),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: ListTile(
              title: const Text("应用版本"),
              subtitle: Text(_info == null ? "读取中..." : _info!.version),
            ),
          ),
          Card(
            child: ListTile(
              title: const Text("内部构建号"),
              subtitle: Text(_info?.buildNumber ?? "读取中..."),
            ),
          ),
          Card(
            child: const ListTile(
              title: Text("论坛域名"),
              subtitle: Text("https://forum.sakura-bot.cn"),
            ),
          ),
          Card(
            child: ListTile(
              title: const Text("包名"),
              subtitle: Text(_info?.packageName ?? "读取中..."),
            ),
          ),
        ],
      ),
    );
  }
}
