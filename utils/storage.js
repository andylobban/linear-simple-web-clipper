const PREFS_KEY = 'linear_clipper_prefs';

export async function getPreferences() {
  const result = await chrome.storage.local.get(PREFS_KEY);
  return result[PREFS_KEY] || {
    last_team_id: null,
    last_project_id: null,
    last_priority: 0,
    last_state_id: null,
    last_assignee_id: null,
    last_label_ids: []
  };
}

export async function savePreferences({ teamId, projectId, priority, stateId, assigneeId, labelIds }) {
  await chrome.storage.local.set({
    [PREFS_KEY]: {
      last_team_id: teamId || null,
      last_project_id: projectId || null,
      last_priority: priority !== undefined ? priority : 0,
      last_state_id: stateId || null,
      last_assignee_id: assigneeId || null,
      last_label_ids: labelIds || []
    }
  });
}
