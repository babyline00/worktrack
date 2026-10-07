// Leave tab — list + create request
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/api_client.dart';
import '../core/constants.dart';
import '../models/models.dart';

class LeaveTab extends StatefulWidget {
  const LeaveTab({super.key});

  @override
  State<LeaveTab> createState() => _LeaveTabState();
}

class _LeaveTabState extends State<LeaveTab> {
  List<LeaveRequest> _requests = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadRequests();
  }

  Future<void> _loadRequests() async {
    setState(() => _isLoading = true);
    try {
      final res = await ApiClient().dio.get('/mobile/notifications');
      // For now, leave requests aren't in the mobile API — use a placeholder
      setState(() { _requests = []; _isLoading = false; });
    } catch (e) {
      setState(() { _requests = []; _isLoading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Leave Requests'),
        actions: [IconButton(icon: const Icon(Icons.add), onPressed: () => _showCreateDialog(context))],
      ),
      body: _isLoading
        ? const Center(child: CircularProgressIndicator())
        : _requests.isEmpty
          ? Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              const Icon(Icons.event_busy, size: 48, color: AppColors.textMuted),
              const SizedBox(height: 16),
              const Text('No leave requests', style: TextStyle(color: AppColors.textSecondary)),
              const SizedBox(height: 8),
              ElevatedButton(onPressed: () => _showCreateDialog(context), child: const Text('Request Leave')),
            ])
          : ListView(padding: const EdgeInsets.all(16), children: _requests.map((r) => Card(child: ListTile(
              title: Text('${r.type} • ${r.days} day${r.days > 1 ? "s" : ""}', style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Text('${r.from} → ${r.to}\n${r.reason ?? "—"}'),
              trailing: Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(color: r.status == 'approved' ? AppColors.successSoft : r.status == 'rejected' ? AppColors.dangerSoft : AppColors.warningSoft, borderRadius: BorderRadius.circular(12)),
                child: Text(r.status.toUpperCase(), style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: r.status == 'approved' ? AppColors.success : r.status == 'rejected' ? AppColors.danger : AppColors.warning)),
              ),
            )).toList()),
    );
  }

  void _showCreateDialog(BuildContext context) {
    final typeCtrl = TextEditingController(text: 'ANNUAL');
    final reasonCtrl = TextEditingController();
    DateTime? fromDate;
    DateTime? toDate;

    showDialog(context: context, builder: (ctx) => StatefulBuilder(builder: (ctx, setState) => AlertDialog(
      title: const Text('Request Leave'),
      content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
        DropdownButtonFormField(value: typeCtrl.text, decoration: const InputDecoration(labelText: 'Leave Type'),
          items: ['ANNUAL', 'SICK', 'UNPAID', 'EMERGENCY'].map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
          onChanged: (v) => typeCtrl.text = v ?? 'ANNUAL'),
        const SizedBox(height: 12),
        ListTile(title: const Text('From Date'), subtitle: Text(fromDate?.toString().split(' ')[0] ?? 'Select date'),
          trailing: const Icon(Icons.calendar_today), onTap: () async {
            final d = await showDatePicker(context: ctx, firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 365)));
            if (d != null) setState(() => fromDate = d);
          }),
        ListTile(title: const Text('To Date'), subtitle: Text(toDate?.toString().split(' ')[0] ?? 'Select date'),
          trailing: const Icon(Icons.calendar_today), onTap: () async {
            final d = await showDatePicker(context: ctx, firstDate: fromDate ?? DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 365)));
            if (d != null) setState(() => toDate = d);
          }),
        const SizedBox(height: 12),
        TextField(controller: reasonCtrl, decoration: const InputDecoration(labelText: 'Reason'), maxLines: 2),
      ])),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
        ElevatedButton(onPressed: () async {
          if (fromDate != null && toDate != null) {
            try {
              await ApiClient().dio.post('/leaves', data: {
                'employeeId': context.read<AuthProvider>().user?.employeeId,
                'type': typeCtrl.text,
                'from': fromDate!.toIso8601String().split('T')[0],
                'to': toDate!.toIso8601String().split('T')[0],
                'reason': reasonCtrl.text,
              });
              if (ctx.mounted) { Navigator.pop(ctx); ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Leave request submitted'), backgroundColor: AppColors.success)); }
            } catch (e) {
              if (ctx.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to submit'), backgroundColor: AppColors.danger));
            }
          }
        }, child: const Text('Submit')),
      ],
    )));
  }
}

// Need AuthProvider import for employeeId
import '../providers/auth_provider.dart';
