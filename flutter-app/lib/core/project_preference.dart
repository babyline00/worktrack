// Remembers which project an employee last checked in to.
//
// Asking someone to pick a project on every single check-in is friction with no
// purpose: almost always there is one obvious answer — they have exactly one
// active assignment, or they worked the same site yesterday. The picker still
// exists for the genuine cases, but it is no longer the default path.
import 'package:shared_preferences/shared_preferences.dart';

class ProjectPreference {
  ProjectPreference._();
  static final ProjectPreference instance = ProjectPreference._();

  static const _key = 'wt.lastProjectId';

  Future<String?> lastProjectId() async {
    try {
      final p = await SharedPreferences.getInstance();
      return p.getString(_key);
    } catch (_) {
      return null;
    }
  }

  Future<void> setLastProjectId(String? id) async {
    try {
      final p = await SharedPreferences.getInstance();
      if (id == null) {
        await p.remove(_key);
      } else {
        await p.setString(_key, id);
      }
    } catch (_) {
      // A preference that fails to save must not break check-in.
    }
  }
}
