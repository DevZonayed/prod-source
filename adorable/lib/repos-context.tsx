"use client";

import { createContext, useContext } from "react";
import type { RepoItem } from "@/lib/repo-types";

type ReposContextValue = {
  repos: RepoItem[];
  onSelectProject: (repoId: string) => void;
};

const ReposContext = createContext<ReposContextValue>({
  repos: [],
  onSelectProject: () => {},
});

export const ReposProvider = ReposContext.Provider;

export const useRepos = () => useContext(ReposContext);
