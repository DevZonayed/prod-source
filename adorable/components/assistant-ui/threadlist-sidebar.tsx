import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { ThreadList } from "@/components/assistant-ui/thread-list";
import { ThreadListPrimitive } from "@assistant-ui/react";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

const AdorableLogo = () => (
  <svg
    viewBox="0 0 347 280"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="size-5"
  >
    <path
      d="M70 267V235.793C37.4932 229.296 13 200.594 13 166.177C13 134.93 33.1885 108.399 61.2324 98.9148C61.9277 51.3467 100.705 13 148.438 13C183.979 13 214.554 34.2582 228.143 64.7527C234.182 63.4301 240.454 62.733 246.89 62.733C295.058 62.733 334.105 101.781 334.105 149.949C334.105 182.845 315.893 211.488 289 226.343V267"
      className="stroke-foreground"
      strokeWidth="25"
      strokeLinecap="round"
    />
    <path
      d="M146 237V267"
      className="stroke-foreground"
      strokeWidth="25"
      strokeLinecap="round"
    />
    <path
      d="M215 237V267"
      className="stroke-foreground"
      strokeWidth="25"
      strokeLinecap="round"
    />
  </svg>
);

export function ThreadListSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarHeader className="relative border-b px-3 py-2.5">
        <ThreadListPrimitive.New asChild>
          <Button
            variant="ghost"
            className="flex h-9 w-full items-center justify-between gap-2 rounded-lg px-2.5 text-muted-foreground hover:text-foreground"
          >
            <span className="flex items-center gap-2">
              <AdorableLogo />
              <span className="text-[13px] font-medium">New Thread</span>
            </span>
            <PlusIcon className="size-3.5" />
          </Button>
        </ThreadListPrimitive.New>
      </SidebarHeader>
      <SidebarContent className="px-1.5 pt-1.5">
        <ThreadList />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
