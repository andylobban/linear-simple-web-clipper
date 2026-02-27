import { getAccessToken } from '../auth/auth.js';

const GRAPHQL_URL = 'https://api.linear.app/graphql';

async function graphql(query, variables = {}) {
  const token = await getAccessToken();
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status}`);
  }

  const data = await response.json();

  if (data.errors && data.errors.length > 0) {
    throw new Error(data.errors.map(e => e.message).join(', '));
  }

  return data.data;
}

export async function fetchTeams() {
  const data = await graphql(`
    query {
      teams {
        nodes {
          id
          name
        }
      }
    }
  `);
  return data.teams.nodes;
}

export async function fetchProjects(teamId) {
  const data = await graphql(
    `
    query FetchProjects($teamId: String!) {
      team(id: $teamId) {
        projects {
          nodes {
            id
            name
          }
        }
      }
    }
  `,
    { teamId }
  );
  return data.team.projects.nodes;
}

export async function fetchTeamDetails(teamId) {
  const data = await graphql(
    `
    query FetchTeamDetails($teamId: String!) {
      team(id: $teamId) {
        states {
          nodes {
            id
            name
            type
            position
          }
        }
        members {
          nodes {
            id
            name
            displayName
          }
        }
        labels {
          nodes {
            id
            name
          }
        }
      }
    }
  `,
    { teamId }
  );
  return data.team;
}

export async function createIssue({ title, description, teamId, projectId, priority, stateId, assigneeId, labelIds }) {
  const input = {
    title,
    description,
    teamId,
    priority: priority !== undefined ? priority : 0
  };

  if (projectId) input.projectId = projectId;
  if (stateId) input.stateId = stateId;
  if (assigneeId) input.assigneeId = assigneeId;
  if (labelIds && labelIds.length > 0) input.labelIds = labelIds;

  const data = await graphql(
    `
    mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          identifier
          title
          url
        }
      }
    }
  `,
    { input }
  );

  if (!data.issueCreate.success) {
    throw new Error('Issue creation failed');
  }

  return data.issueCreate.issue;
}
