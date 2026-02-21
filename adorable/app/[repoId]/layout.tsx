import { RepoWorkspaceShell } from "./repo-workspace-shell";

export default async function RepoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ repoId: string }>;
}) {
  const { repoId } = await params;

  return <RepoWorkspaceShell repoId={repoId}>{children}</RepoWorkspaceShell>;
}
