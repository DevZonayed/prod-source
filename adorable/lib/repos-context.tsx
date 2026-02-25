"use client";

import { createContext, useContext } from "react";
import type { RepoItem } from "@/lib/repo-types";

type ReposContextValue = {
  repos: RepoItem[];
  isLoading: boolean;
  onSelectProject: (repoId: string) => void;
};

const ReposContext = createContext<ReposContextValue>({
  repos: [],
  isLoading: true,
  onSelectProject: () => {},
});

export const ReposProvider = ReposContext.Provider;

export const useRepos = () => useContext(ReposContext);
