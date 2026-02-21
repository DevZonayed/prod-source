import "dotenv/config";
import { freestyle } from "freestyle-sandboxes";

await freestyle.serverless.deployments
  .create({
    repo: "3905181a-008e-401c-a4c0-77af586e34f9",
    domains: ["test-deployment-1.commit-repo.style.dev"],
    build: true,
  })
  .then(console.log);
