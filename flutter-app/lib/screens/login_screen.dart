// Login screen — employee ID + password.
// The tenant/company code is resolved from the build configuration
// (see ApiConstants.companyCode), so employees only supply their own details.
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/constants.dart';
import '../providers/auth_provider.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _employeeId = TextEditingController(text: '987654321');
  final _password = TextEditingController(text: 'admin123');
  bool _obscurePassword = true;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppColors.navy, Color(0xFF1E293B), AppColors.primary],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Logo
                  Container(
                    width: 72, height: 72,
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Icon(Icons.fingerprint, size: 36, color: Colors.white),
                  ),
                  const SizedBox(height: 16),
                  const Text('WORKTRACK', style: TextStyle(
                    color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold,
                  )),
                  const Text('Workforce Management', style: TextStyle(
                    color: Colors.white60, fontSize: 14,
                  )),
                  const SizedBox(height: 40),

                  // Login card
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.2), blurRadius: 20)],
                    ),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Text('Sign In', style: TextStyle(
                            fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.textPrimary,
                          )),
                          const SizedBox(height: 4),
                          const Text('Enter your credentials to continue', style: TextStyle(
                            color: AppColors.textSecondary, fontSize: 13,
                          )),
                          const SizedBox(height: 24),

                          // Employee ID
                          TextFormField(
                            controller: _employeeId,
                            decoration: const InputDecoration(
                              labelText: 'Employee ID',
                              prefixIcon: Icon(Icons.badge_outlined),
                            ),
                            keyboardType: TextInputType.number,
                            validator: (v) => v!.isEmpty ? 'Required' : null,
                          ),
                          const SizedBox(height: 16),

                          // Password
                          TextFormField(
                            controller: _password,
                            obscureText: _obscurePassword,
                            decoration: InputDecoration(
                              labelText: 'Password',
                              prefixIcon: const Icon(Icons.lock_outline),
                              suffixIcon: IconButton(
                                icon: Icon(_obscurePassword ? Icons.visibility_off : Icons.visibility),
                                onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                              ),
                            ),
                            validator: (v) => v!.isEmpty ? 'Required' : null,
                          ),
                          const SizedBox(height: 24),

                          // Error message
                          if (auth.error != null)
                            Container(
                              padding: const EdgeInsets.all(12),
                              margin: const EdgeInsets.only(bottom: 16),
                              decoration: BoxDecoration(
                                color: AppColors.dangerSoft,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.error_outline, color: AppColors.danger, size: 20),
                                  const SizedBox(width: 8),
                                  Expanded(child: Text(auth.error!, style: const TextStyle(color: AppColors.danger, fontSize: 13))),
                                ],
                              ),
                            ),

                          // Login button
                          ElevatedButton(
                            onPressed: auth.isLoading ? null : () async {
                              if (_formKey.currentState!.validate()) {
                                final success = await auth.login(
                                  _employeeId.text.trim(),
                                  _password.text,
                                );
                                if (!success && mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text(auth.error ?? 'Login failed'), backgroundColor: AppColors.danger),
                                  );
                                }
                              }
                            },
                            child: auth.isLoading
                              ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                              : const Text('Sign In'),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  const Text('© 2026 WorkTrack. All rights reserved.', style: TextStyle(
                    color: Colors.white38, fontSize: 12,
                  )),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
