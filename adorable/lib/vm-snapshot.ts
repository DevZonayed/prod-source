import { VmSpec } from "freestyle-sandboxes";

export const snapshot = new VmSpec({
  git: {
    repos: [
      {
        path: "/workspace",
        repo: "https://www.github.com/freestyle-sh/freestyle-next",
      },
    ],
    config: {
      user: {
        name: "Adorable",
        email: "adorable@freestyle.sh",
      },
    },
  },
  additionalFiles: {
    "/etc/adorable/cache-preview.sh": {
      content: `#!/bin/bash
set -euo pipefail

timeout_seconds=60
start_time=$(date +%s)

while true; do
  if curl -sf http://localhost:3000 >/dev/null; then
    break
  fi

  now=$(date +%s)
  if (( now - start_time >= timeout_seconds )); then
    echo "Timed out waiting for dev server on port 3000" >&2
    exit 1
  fi

  sleep 1
done

curl http://localhost:3000 -o /dev/null
`,
    },
  },
  systemd: {
    services: [
      {
        name: "adorable-install",
        exec: ["npm install"],
        mode: "oneshot",
        workdir: "/workspace",
      },
      {
        name: "adorable-run-dev",
        exec: ["npm run dev"],
        mode: "service",
        after: ["adorable-install.service"],
        requires: ["adorable-install.service"],
        workdir: "/workspace",
      },
      {
        name: "adorable-cache-preview",
        exec: ["bash /etc/adorable/cache-preview.sh"],
        mode: "oneshot",
        after: ["adorable-run-dev.service"],
        requires: ["adorable-run-dev.service"],
        workdir: "/workspace",
      },
    ],
  },
});
