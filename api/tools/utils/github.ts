import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import axios from "axios";
import { z } from "zod";

// GitHub API base URL
const GITHUB_API_URL = "https://api.github.com";
const ORGANIZATION = "Meeting-Baas";

// Helper function to fetch repositories from GitHub
async function fetchRepositories() {
  try {
    const response = await axios.get(
      `${GITHUB_API_URL}/orgs/${ORGANIZATION}/repos`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "MeetingBaas-MCP-Documentation",
        },
      }
    );

    if (response.status !== 200) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Failed to fetch repositories. Status code: ${response.status}`,
          },
        ],
      };
    }

    const repos = response.data.map((repo: any) => ({
      name: repo.name,
      description: repo.description,
      url: repo.html_url,
      stars: repo.stargazers_count,
      language: repo.language,
      isTemplate: repo.is_template,
      visibility: repo.visibility,
    }));

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(repos, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error(`GitHub API error:`, error);

    return {
      content: [
        {
          type: "text" as const,
          text: `Error retrieving repositories. Error: ${errorMessage}`,
        },
      ],
    };
  }
}

// Helper function to fetch README from a repository
async function fetchReadme(repo: string) {
  try {
    const response = await axios.get(
      `${GITHUB_API_URL}/repos/${ORGANIZATION}/${repo}/readme`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "MeetingBaas-MCP-Documentation",
        },
      }
    );

    if (response.status !== 200) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Failed to fetch README for ${repo}. Status code: ${response.status}`,
          },
        ],
      };
    }

    // GitHub API returns the content base64 encoded
    const content = Buffer.from(response.data.content, "base64").toString(
      "utf-8"
    );

    return {
      content: [
        {
          type: "text" as const,
          text: content,
        },
      ],
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error(`GitHub API error when fetching README:`, error);

    return {
      content: [
        {
          type: "text" as const,
          text: `Error retrieving README for ${repo}. Error: ${errorMessage}`,
        },
      ],
    };
  }
}

export function registerGitHubTools(server: McpServer): McpServer {
  // Register a tool for listing all repositories
  server.tool(
    "listRepositories",
    "List all publicly available GitHub repositories from Meeting-Baas organization",
    {},
    async () => {
      return await fetchRepositories();
    }
  );

  // Register a tool for fetching README from a specific repository
  server.tool(
    "getRepositoryReadme",
    "Get README.md file from a specific Meeting-Baas GitHub repository",
    {
      repository: z
        .string()
        .describe("The name of the repository to fetch the README from"),
    },
    async ({ repository }: { repository: string }) => {
      return await fetchReadme(repository);
    }
  );

  return server;
}

export default registerGitHubTools;
