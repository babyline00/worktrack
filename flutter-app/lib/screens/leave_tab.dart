// Leave tab — list + create request
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../models/leave_request.dart';
import '../providers/auth_provider.dart';

class LeaveTab extends StatefulWidget {
  const LeaveTab({super.key});

  @override
  State<LeaveTab> createState() => LeaveTabState();
}

class LeaveTabState extends State<LeaveTab> {
  List<LeaveRequest> _requests = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadRequests();
  }

  /// Re-fetches requests, e.g. when the tab becomes visible again.
  void reload() => _loadRequests();

  Future<void> _loadRequests() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      // `/leaves` is scoped to managers/admins server-side, so it can 403 for
      // a regular employee. Filter client-side to just the signed-in employee.
      final data = await ApiClient.instance.get('/leaves');
      final me = context.read<AuthProvider>().user?.employeeId;
      final all = ((data['leaves'] as List?) ?? [])
          .map((e) => LeaveRequest.fromJson(e as Map<String, dynamic>))
          .toList();
      _requests = me == null
          ? all
          : all.where((r) => r.employeeId == me).toList();
    } on ApiException catch (e) {
      if (e.statusCode == 403 || e.code == 'FORBIDDEN') {
        _requests = [];
        _error = null; // Not permitted to list company leaves — show empty state.
      } else {
        _requests = [];
        _error = e.message;
      }
    } catch (_) {
      _requests = [];
      _error = 'Failed to load leave requests';
    }
    if (!mounted) return;
    setState(() => _isLoading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Leave Requests'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () => _showCreateDialog(context),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.cloud_off,
                            size: 48, color: AppColors.textMuted),
                        const SizedBox(height: AppSpacing.md),
                        Text(
                          _error!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                              color: AppColors.textSecondary),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        ElevatedButton(
                          onPressed: _loadRequests,
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                )
              : _requests.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.event_busy,
                              size: 48, color: AppColors.textMuted),
                          const SizedBox(height: AppSpacing.md),
                          const Text(
                            'No leave requests',
                            style: TextStyle(color: AppColors.textSecondary),
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          ElevatedButton(
                            onPressed: () => _showCreateDialog(context),
                            child: const Text('Request Leave'),
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadRequests,
                      child: ListView(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        children: _requests.map(_card).toList(),
                      ),
                    ),
    );
  }

  Widget _card(LeaveRequest r) {
    final (bg, fg) = switch (r.status) {
      'approved' => (AppColors.successBg, AppColors.success),
      'rejected' => (AppColors.dangerBg, AppColors.danger),
      _ => (AppColors.warningBg, AppColors.warning),
    };

    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: ListTile(
        title: Text(
          '${r.typeLabel} • ${r.days} day${r.days > 1 ? "s" : ""}',
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Text('${r.dateRange}\n${r.reason ?? "—"}'),
        isThreeLine: r.reason != null,
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            r.status.toUpperCase(),
            style: TextStyle(
                fontSize: 10, fontWeight: FontWeight.w600, color: fg),
          ),
        ),
      ),
    );
  }

  void _showCreateDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => _LeaveRequestDialog(
        onSubmitted: _loadRequests,
      ),
    );
  }
}

/// Owns its [TextEditingController] so it is disposed only after the dialog's
/// exit animation — disposing it from the caller's `whenComplete` tore down a
/// controller that the still-mounted [TextField] was reading.
class _LeaveRequestDialog extends StatefulWidget {
  final Future<void> Function() onSubmitted;

  const _LeaveRequestDialog({required this.onSubmitted});

  @override
  State<_LeaveRequestDialog> createState() => _LeaveRequestDialogState();
}

class _LeaveRequestDialogState extends State<_LeaveRequestDialog> {
  final _reasonCtrl = TextEditingController();
  String _type = 'ANNUAL';
  DateTime? _fromDate;
  DateTime? _toDate;

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  String _fmt(DateTime? d) =>
      d?.toIso8601String().split('T')[0] ?? 'Select date';

  @override
  Widget build(BuildContext context) {
    final messenger = ScaffoldMessenger.of(context);
    final employeeId = context.read<AuthProvider>().user?.employeeId;

    return AlertDialog(
      title: const Text('Request Leave'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            DropdownButtonFormField<String>(
              initialValue: _type,
              decoration: const InputDecoration(labelText: 'Leave Type'),
              items: ['ANNUAL', 'SICK', 'CASUAL', 'UNPAID', 'EMERGENCY']
                  .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                  .toList(),
              onChanged: (v) => setState(() => _type = v ?? 'ANNUAL'),
            ),
            const SizedBox(height: AppSpacing.sm),
            ListTile(
              title: const Text('From Date'),
              subtitle: Text(_fmt(_fromDate)),
              trailing: const Icon(Icons.calendar_today),
              onTap: () async {
                final d = await showDatePicker(
                  context: context,
                  firstDate: DateTime.now(),
                  lastDate:
                      DateTime.now().add(const Duration(days: 365)),
                );
                if (!mounted) return;
                if (d != null) setState(() => _fromDate = d);
              },
            ),
            ListTile(
              title: const Text('To Date'),
              subtitle: Text(_fmt(_toDate)),
              trailing: const Icon(Icons.calendar_today),
              onTap: () async {
                final d = await showDatePicker(
                  context: context,
                  firstDate: _fromDate ?? DateTime.now(),
                  lastDate:
                      DateTime.now().add(const Duration(days: 365)),
                );
                if (!mounted) return;
                if (d != null) setState(() => _toDate = d);
              },
            ),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              controller: _reasonCtrl,
              decoration: const InputDecoration(labelText: 'Reason'),
              maxLines: 2,
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: () async {
            if (_fromDate == null || _toDate == null) {
              messenger.showSnackBar(
                const SnackBar(content: Text('Select both dates')),
              );
              return;
            }
            try {
              await ApiClient.instance.post('/leaves', data: {
                'employeeId': employeeId,
                'type': _type,
                'from': _fmt(_fromDate!),
                'to': _fmt(_toDate!),
                'reason': _reasonCtrl.text,
              });
              if (!mounted) return;
              Navigator.pop(context);
              messenger.showSnackBar(const SnackBar(
                content: Text('Leave request submitted'),
                backgroundColor: AppColors.success,
              ));
              await widget.onSubmitted();
            } catch (e) {
              final msg = e is ApiException
                  ? e.message
                  : 'Failed to submit leave request';
              if (!mounted) return;
              messenger.showSnackBar(SnackBar(
                content: Text(msg),
                backgroundColor: AppColors.danger,
              ));
            }
          },
          child: const Text('Submit'),
        ),
      ],
    );
  }
}