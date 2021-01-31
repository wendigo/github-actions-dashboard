import {components} from "@octokit/openapi-types";

export type Workflow = components["schemas"]["workflow"];
export type Workflows = Workflow[];
export type WorkflowRun = components["schemas"]["workflow-run"];
export type WorkflowRuns = WorkflowRun[];
export type RunJob = components["schemas"]["job"]
export type RunJobs = RunJob[];

export interface ActionsConfig {
    owner: string
    repository: string
    cacheDir: string
    cacheWorkflows?: boolean
    cacheWorkflowRuns?: boolean
    cacheRunJobs?: boolean
}

export interface Actions {
    getWorkflows(): Promise<Workflows>

    getWorkflow(workflowId: number): Promise<Workflow>

    getCompletedWorkflowRuns(workflowId: number, branch?: string, event?: string, limit?: number): Promise<WorkflowRuns>

    getRunJobs(runId: number): Promise<RunJobs>
}