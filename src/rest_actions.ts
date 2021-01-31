import * as core from "@actions/core";
import {GitHub} from "@actions/github/lib/utils";
import {Actions, ActionsConfig, RunJobs, Workflow, WorkflowRuns, Workflows} from "./actions";

export class RestActions implements Actions {
    private client: InstanceType<typeof GitHub>;
    private config: ActionsConfig;

    constructor(client: InstanceType<typeof GitHub>, config: ActionsConfig) {
        this.client = client;
        this.config = config;
    }

    async getWorkflows() : Promise<Workflows> {
        core.info(`Fetching repository ${this.config.owner}/${this.config.repository} workflows`);
        return this.client.paginate(this.client.actions.listRepoWorkflows, {
            owner: this.config.owner,
            repo: this.config.repository
        });
    }

    async getWorkflow(workflowId: number): Promise<Workflow> {
        return this.getWorkflows()
            .then(workflows => workflows.find(workflow => workflow.id == workflowId)!);
    }

    async getCompletedWorkflowRuns(workflowId: number, branch = "master", event = "push", limit = 100) : Promise<WorkflowRuns> {
        core.info(`Fetching runs for repository ${this.config.owner}/${this.config.repository} and workflow id ${workflowId}`)

        let total = 0;

        return this.client.paginate(this.client.actions.listWorkflowRuns, {
            owner: this.config.owner,
            repo: this.config.repository,
            workflow_id: workflowId,
            per_page: 100,
            state: "completed",
            event: event,
            branch: branch
        },
        (response, done) => {
            total += response.data.length;

            if (total >= limit) {
                done();
            }

            return response.data;
        });
    }

    async getRunJobs(runId: number): Promise<RunJobs> {
        core.info(`Fetching jobs for repository ${this.config.owner}/${this.config.repository} and run id ${runId}`);

        return this.client.paginate(this.client.actions.listJobsForWorkflowRun, {
            owner: this.config.owner,
            repo: this.config.repository,
            per_page: 100,
            run_id: runId
        });
    }
}