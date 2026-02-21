import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmDevServer } from "@freestyle-sh/with-dev-server";
import { VmPtySession } from "@freestyle-sh/with-pty";
import { VmWebTerminal } from "@freestyle-sh/with-ttyd";
import {
  VM_PORT,
  WORKDIR,
  DEV_COMMAND_TERMINAL_PORT,
  TEMPLATE_REPO,
  ADDITIONAL_TERMINALS_PORT,
} from "@/lib/vars";

export type VmRuntimeMetadata = {
  vmId: string;
  previewUrl: string;
  devCommandTerminalUrl: string;
  additionalTerminalsUrl: string;
};

const devCommandPty = new VmPtySession({
  sessionId: "adorable-dev-command",
});

export const adorableVmSpec = new VmSpec({
  with: {
    devCommandPty,
    devServer: new VmDevServer({
      workdir: WORKDIR,
      templateRepo: TEMPLATE_REPO,
      devCommandPty,
    }),
    devCommandTerminal: new VmWebTerminal({
      pty: devCommandPty,
      port: DEV_COMMAND_TERMINAL_PORT,
      theme: {
        background: "#09090b",
      },
    }),
    additionalTerminals: new VmWebTerminal({
      cwd: WORKDIR,
      port: ADDITIONAL_TERMINALS_PORT,
    }),
  },
});

export const createVmForRepo = async (
  repoId: string,
): Promise<VmRuntimeMetadata> => {
  const domain = `${crypto.randomUUID()}-adorable.style.dev`;
  const devCommandTerminalDomain = `dev-command-${domain}`;
  const additionalTerminalsDomain = `terminals-${domain}`;

  const { vmId } = await freestyle.vms.create({
    snapshot: adorableVmSpec,
    recreate: true,
    workdir: WORKDIR,
    persistence: {
      type: "sticky",
    },
    git: {
      repos: [
        {
          path: WORKDIR,
          repo: repoId,
        },
      ],
      config: {
        user: {
          name: "Adorable",
          email: "adorable@freestyle.sh",
        },
      },
    },
    domains: [
      {
        domain,
        vmPort: VM_PORT,
      },
      {
        domain: devCommandTerminalDomain,
        vmPort: DEV_COMMAND_TERMINAL_PORT,
      },
      {
        domain: additionalTerminalsDomain,
        vmPort: ADDITIONAL_TERMINALS_PORT,
      },
    ],
  });

  return {
    vmId,
    previewUrl: `https://${domain}`,
    devCommandTerminalUrl: `https://${devCommandTerminalDomain}`,
    additionalTerminalsUrl: `https://${additionalTerminalsDomain}`,
  };
};
