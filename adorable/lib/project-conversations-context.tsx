"use client";

import { createContext, useContext } from "react";

export type ProjectConversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type ProjectConversationsContextValue = {
  repoId: string | null;
  conversations: ProjectConversation[];
  onSelectConversation: (conversationId: string) => void;
};

const ProjectConversationsContext =
  createContext<ProjectConversationsContextValue>({
    repoId: null,
    conversations: [],
    onSelectConversation: () => {},
  });

export const ProjectConversationsProvider =
  ProjectConversationsContext.Provider;

export const useProjectConversations = () =>
  useContext(ProjectConversationsContext);
