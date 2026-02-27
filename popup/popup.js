import { isAuthenticated, authenticate, logout } from '../auth/auth.js';
import { fetchTeams, fetchProjects, fetchTeamDetails, createIssue } from '../api/linear.js';
import { getPreferences, savePreferences } from '../utils/storage.js';

// DOM refs
const viewAuth = document.getElementById('view-auth');
const viewMain = document.getElementById('view-main');
const btnConnect = document.getElementById('btn-connect');
const btnLogout = document.getElementById('btn-logout');
const btnCreate = document.getElementById('btn-create');
const issueTitle = document.getElementById('issue-title');
const contentPreview = document.getElementById('content-preview');
const selectTeam = document.getElementById('select-team');
const selectProject = document.getElementById('select-project');
const selectPriority = document.getElementById('select-priority');
const selectStatus = document.getElementById('select-status');
const selectAssignee = document.getElementById('select-assignee');
const selectLabels = document.getElementById('select-labels');
const statusDiv = document.getElementById('status');
const warningBanner = document.getElementById('warning-banner');

let pageUrl = '';

function showStatus(message, type) {
  statusDiv.innerHTML = message;
  statusDiv.className = `status ${type}`;
  statusDiv.classList.remove('hidden');
}

function hideStatus() {
  statusDiv.classList.add('hidden');
}

function setLoading(loading) {
  btnCreate.disabled = loading;
  btnCreate.textContent = loading ? 'Creating…' : 'Create Issue';
}

async function injectContentScripts(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['lib/readability.js', 'lib/turndown.js', 'content/content.js']
  });
}

async function loadPageContent() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error('No active tab');

    // Try sending a message; if no content script is present, inject and retry
    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTENT' });
    } catch {
      await injectContentScripts(tab.id);
      response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTENT' });
    }

    if (!response || !response.success) {
      throw new Error(response?.error || 'Content script returned failure');
    }

    issueTitle.value = response.pageTitle || '';
    contentPreview.value = response.markdown || '';
    pageUrl = response.pageUrl || tab.url || '';
  } catch (err) {
    // Graceful fallback for chrome:// pages, PDFs, etc.
    warningBanner.classList.remove('hidden');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      issueTitle.value = tab?.title || '';
      pageUrl = tab?.url || '';
    } catch {
      // ignore
    }
  }
}

function populateSelect(selectEl, items, defaultValue, emptyLabel = 'None', defaultToFirst = true) {
  const currentVal = selectEl.value;
  selectEl.innerHTML = '';

  const noneOpt = document.createElement('option');
  noneOpt.value = '';
  noneOpt.textContent = emptyLabel;
  selectEl.appendChild(noneOpt);

  for (const item of items) {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = item.name;
    selectEl.appendChild(opt);
  }

  const preferred = defaultValue || currentVal;
  if (preferred && selectEl.querySelector(`option[value="${preferred}"]`)) {
    selectEl.value = preferred;
  } else if (defaultToFirst && items.length > 0) {
    selectEl.value = items[0].id;
  } else {
    selectEl.value = '';
  }
}

async function loadTeams(lastTeamId) {
  selectTeam.innerHTML = '<option value="">Loading…</option>';
  try {
    const teams = await fetchTeams();
    populateSelect(selectTeam, teams, lastTeamId, '— select team —');
  } catch (err) {
    selectTeam.innerHTML = '<option value="">Error loading teams</option>';
    console.error('fetchTeams failed:', err);
  }
}

function defaultStateId(states) {
  // Pick the first state by position in the "unstarted" type; fallback to first overall
  const unstarted = states
    .filter(s => s.type === 'unstarted')
    .sort((a, b) => a.position - b.position);
  return unstarted.length > 0 ? unstarted[0].id : (states[0]?.id || '');
}

async function loadTeamData(teamId, prefs = {}) {
  if (!teamId) {
    selectProject.innerHTML = '<option value="">None</option>';
    selectStatus.innerHTML = '<option value="">—</option>';
    selectAssignee.innerHTML = '<option value="">Unassigned</option>';
    selectLabels.innerHTML = '';
    return;
  }

  selectProject.innerHTML = '<option value="">Loading…</option>';
  selectStatus.innerHTML = '<option value="">Loading…</option>';
  selectAssignee.innerHTML = '<option value="">Loading…</option>';

  try {
    const [projects, details] = await Promise.all([
      fetchProjects(teamId),
      fetchTeamDetails(teamId)
    ]);

    populateSelect(selectProject, projects, prefs.last_project_id, 'None');

    // States — sorted by position
    const states = [...details.states.nodes].sort((a, b) => a.position - b.position);
    populateSelect(selectStatus, states, prefs.last_state_id || defaultStateId(states), '—');

    // Members
    const members = details.members.nodes.slice().sort((a, b) =>
      (a.displayName || a.name).localeCompare(b.displayName || b.name)
    );
    populateSelect(selectAssignee, members.map(m => ({ id: m.id, name: m.displayName || m.name })), prefs.last_assignee_id, 'Unassigned', false);

    // Labels (multi-select — repopulate manually)
    const savedLabels = new Set(prefs.last_label_ids || []);
    selectLabels.innerHTML = '';
    for (const label of details.labels.nodes) {
      const opt = document.createElement('option');
      opt.value = label.id;
      opt.textContent = label.name;
      opt.selected = savedLabels.has(label.id);
      selectLabels.appendChild(opt);
    }
  } catch (err) {
    selectProject.innerHTML = '<option value="">Error</option>';
    selectStatus.innerHTML = '<option value="">Error</option>';
    selectAssignee.innerHTML = '<option value="">Error</option>';
    console.error('loadTeamData failed:', err);
  }
}

async function initMainView() {
  await loadPageContent();

  const prefs = await getPreferences();

  await loadTeams(prefs.last_team_id);
  await loadTeamData(selectTeam.value, prefs);

  selectPriority.value = String(prefs.last_priority ?? 0);
}

function showView(name) {
  viewAuth.classList.add('hidden');
  viewMain.classList.add('hidden');
  btnLogout.classList.add('hidden');

  if (name === 'auth') {
    viewAuth.classList.remove('hidden');
  } else if (name === 'main') {
    viewMain.classList.remove('hidden');
    btnLogout.classList.remove('hidden');
  }
}

// Event: connect
btnConnect.addEventListener('click', async () => {
  btnConnect.disabled = true;
  btnConnect.textContent = 'Connecting…';
  try {
    await authenticate();
    showView('main');
    await initMainView();
  } catch (err) {
    btnConnect.disabled = false;
    btnConnect.textContent = 'Connect to Linear';
    showStatus(`Authentication failed: ${err.message}`, 'error');
    viewAuth.classList.remove('hidden');
  }
});

// Event: logout
btnLogout.addEventListener('click', async () => {
  await logout();
  showView('auth');
  hideStatus();
});

// Event: team change
selectTeam.addEventListener('change', async () => {
  await loadTeamData(selectTeam.value, {});
});

// Event: create issue
btnCreate.addEventListener('click', async () => {
  const title = issueTitle.value.trim();
  const teamId = selectTeam.value;

  if (!title) {
    showStatus('Please enter a title for the issue.', 'error');
    return;
  }
  if (!teamId) {
    showStatus('Please select a team.', 'error');
    return;
  }

  setLoading(true);
  hideStatus();

  try {
    const content = contentPreview.value.trim();
    let description = content;
    if (pageUrl) {
      description += (description ? '\n\n---\n\n' : '') + `**Source:** ${pageUrl}`;
    }

    const projectId = selectProject.value || undefined;
    const priority = parseInt(selectPriority.value, 10);
    const stateId = selectStatus.value || undefined;
    const assigneeId = selectAssignee.value || undefined;
    const labelIds = Array.from(selectLabels.selectedOptions).map(o => o.value);

    const issue = await createIssue({ title, description, teamId, projectId, priority, stateId, assigneeId, labelIds });

    await savePreferences({
      teamId,
      projectId: projectId || null,
      priority,
      stateId: stateId || null,
      assigneeId: assigneeId || null,
      labelIds
    });

    showStatus(
      `Issue created: <a href="${issue.url}" target="_blank">${issue.identifier} – ${issue.title}</a>`,
      'success'
    );
  } catch (err) {
    showStatus(`Error: ${err.message}`, 'error');
  } finally {
    setLoading(false);
  }
});

// Init
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const authed = await isAuthenticated();
    if (authed) {
      showView('main');
      await initMainView();
    } else {
      showView('auth');
    }
  } catch (err) {
    showView('auth');
    console.error('Init error:', err);
  }
});
