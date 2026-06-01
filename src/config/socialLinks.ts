export interface DeveloperConfig {
  portfolioUrl: string;
  contactEmail: string;
  linkedinUrl: string;
  githubUrl: string;
  instagramUrl?: string;
  developerName: string;
}

export const socialLinks: DeveloperConfig = {
  developerName: "Lead Financial Software Architect",
  portfolioUrl: "https://example.com/portfolio",
  contactEmail: "developer@example.com",
  linkedinUrl: "https://linkedin.com/in/example-profile",
  githubUrl: "https://github.com/example-username",
  instagramUrl: "https://instagram.com/example-profile"
};
