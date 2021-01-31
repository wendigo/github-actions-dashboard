import {Actions, ActionsConfig, RunJobs, Workflow, WorkflowRuns, Workflows} from "./actions";
import * as fs from 'fs'
import * as core from "@actions/core";
import { promisify } from "util";

export class CachingActions implements Actions {
    private readonly delegate: Actions;
    private readonly config: ActionsConfig;

    constructor(delegate: Actions, config: ActionsConfig) {
        this.delegate = delegate;
        this.config = config;
    }

    getCompletedWorkflowRuns(workflowId: number, branch = "master", event = "push", limit = 500): Promise<WorkflowRuns> {
        if (!this.config.cacheWorkflowRuns) {
            return this.delegate.getCompletedWorkflowRuns(workflowId, branch, event, limit);
        }

        return this.readWorkflowRunsCache(workflowId, branch, event).catch(_ => this.delegate.getCompletedWorkflowRuns(workflowId, branch, event, limit)
            .then(runJobs => this.writeWorkflowRunsCache(workflowId, branch, event, runJobs).then(_ => runJobs)));
    }

    getRunJobs(runId: number): Promise<RunJobs> {
        if (!this.config.cacheRunJobs) {
            return this.delegate.getRunJobs(runId);
        }

        return this.readRunsCache(runId).catch(_ => this.delegate.getRunJobs(runId)
            .then(runJobs => this.writeRunsCache(runId, runJobs).then(_ => runJobs)));
    }

    getWorkflows(): Promise<Workflows> {
        if (!this.config.cacheWorkflows) {
            return this.delegate.getWorkflows();
        }

        return this.readWorkflowsCache().catch(_ => this.delegate.getWorkflows()
            .then(workflows => this.writeWorkflowsCache(workflows).then(_ => workflows)));
    }

    async getWorkflow(workflowId: number): Promise<Workflow> {
        return this.getWorkflows()
            .then(workflows => workflows.find(workflow => workflow.id == workflowId)!);
    }

    private async writeRunsCache(runId: number, runJobs: RunJobs): Promise<void> {
        const cacheFile = CachingActions.runCacheFile(this.config.cacheDir, runId);
        core.info(`Writing cache for run id: ${runId} into ${cacheFile}`)
        return promisify(fs.writeFile)(cacheFile, JSON.stringify(runJobs));
    }

    private async readRunsCache(runId: number): Promise<RunJobs> {
        const runCacheFile = CachingActions.runCacheFile(this.config.cacheDir, runId);
        core.info(`Reading cache for run id ${runId} from ${runCacheFile}`);

        if (fs.existsSync(runCacheFile)) {
            return promisify(fs.readFile)(runCacheFile, {encoding: "utf-8"})
                .then(content => JSON.parse(content) as RunJobs);
        }

        return Promise.reject(`Cache file ${runCacheFile} does not exist`);
    }

    private async readWorkflowsCache(): Promise<Workflows> {
        const workflowsCacheFile = CachingActions.workflowsCacheFile(this.config.cacheDir);
        core.info(`Reading cache for workflows from ${workflowsCacheFile}`);

        if (fs.existsSync(workflowsCacheFile)) {
            return promisify(fs.readFile)(workflowsCacheFile, {encoding: "utf-8"})
                .then(content => JSON.parse(content) as Workflows);
        }

        return Promise.reject(`Cache file ${workflowsCacheFile} does not exist`);
    }

    private async writeWorkflowsCache(workflows: Workflows): Promise<void> {
        const cacheFile = CachingActions.workflowsCacheFile(this.config.cacheDir);
        core.info(`Writing cache for workflows into ${cacheFile}`)
        return promisify(fs.writeFile)(cacheFile, JSON.stringify(workflows));
    }

    private async readWorkflowRunsCache(workflowId: number, branch: string, event: string): Promise<WorkflowRuns> {
        const workflowRunsCacheFile = CachingActions.workflowRunsCacheFile(this.config.cacheDir, workflowId, branch, event);
        core.info(`Reading cache for workflow ${workflowId} from ${workflowRunsCacheFile}`);

        if (fs.existsSync(workflowRunsCacheFile)) {
            return promisify(fs.readFile)(workflowRunsCacheFile, {encoding: "utf-8"})
                .then(content => JSON.parse(content) as WorkflowRuns);
        }

        return Promise.reject(`Cache file ${workflowRunsCacheFile} does not exist`);
    }

    private async writeWorkflowRunsCache(workflowId: number, branch: string, event: string, runs: WorkflowRuns): Promise<void> {
        const workflowRunsCacheFile = CachingActions.workflowRunsCacheFile(this.config.cacheDir, workflowId, branch, event);
        core.info(`Writing cache for workflow ${workflowId} into ${workflowRunsCacheFile}`)
        return promisify(fs.writeFile)(workflowRunsCacheFile, JSON.stringify(runs));
    }

    private static runCacheFile(cacheDir: string, jobId: number) {
        return `${cacheDir}/run_${jobId}.cache.json`;
    }

    private static workflowsCacheFile(cacheDir: string) {
        return `${cacheDir}/workflows.cache.json`;
    }

    private static workflowRunsCacheFile(cacheDir: string, workflowId: number, branch: string, event: string) {
        return `${cacheDir}/workflow_${workflowId}_${branch}_${event}.cache.json`;
    }
}