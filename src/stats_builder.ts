import {Actions, RunJob, RunJobs, Workflow, WorkflowRun, WorkflowRuns} from "./actions";
import pLimit from 'p-limit';
import {ConclusionStats, JobStats, RunStats, WorkflowStats} from "./stats";
import {durationBetween} from "./stats_utils";

const concurrencyLimit = pLimit(4);

export class StatsBuilder {
    private readonly client: Actions;
    private readonly repository: string;

    constructor(repository: string, client: Actions) {
        this.repository = repository;
        this.client = client;
    }

    getWorkflowStats(workflowId: number, branch = "master", event = "push", limit = 250): Promise<WorkflowStats> {
        return this.client.getWorkflow(workflowId)
            .then(workflow => this.client.getCompletedWorkflowRuns(workflowId, branch, event, limit).then(runs => this.calculateWorkflowStats(workflow, runs)));
    }

    getJobsStats(workflowId: number, branch = "master", event = "push", limit = 250): Promise<JobStats[]> {
        return this.getWorkflowStats(workflowId, branch, event, limit).then(stats => {
            const jobNames = [...new Set(stats.runStats.flatMap(runStats => runStats.jobs.map(job => job.name)))];

            return jobNames.map(name => {
                return {
                    name,
                    workflow: stats.workflow,
                    runs: stats.runStats.flatMap(runStat => {
                        return {
                            run: runStat.run,
                            job: runStat.jobs.filter(job => job.name == name).pop()!
                        }
                    })
                }
            });
        });
    }

    private async calculateWorkflowStats(workflow: Workflow, runs: WorkflowRuns): Promise<WorkflowStats> {
        const stats: WorkflowStats = {
            repository: this.repository,
            workflow: workflow,
            conclusions: {
                count: 0,
                success: 0,
                failure: 0,
                cancelled: 0
            },
            runs,
            runStats: [],
            jobsConclusions: {}
        };

        runs.forEach(run => {
            stats.conclusions.count++;

            switch (run.conclusion) {
                case "cancelled":
                    stats.conclusions.cancelled++;
                break;
                case "success":
                    stats.conclusions.success++;
                break;
                case "failure":
                    stats.conclusions.failure++;
                break;
                default:
                    throw new Error(`Unrecognized conclusion ${run.conclusion}`);
            }
        });

        return Promise.resolve(stats).then(runStats => this.calculateRunStats(runs).then(stats => {
                runStats.runStats.push(...stats);
                return runStats;
            })
        ).then(workflowStats => this.calculateWorkflowAggregateStats(workflowStats))
    }

    private calculateWorkflowAggregateStats(workflowStats: WorkflowStats): WorkflowStats
    {
        workflowStats.jobsConclusions

        workflowStats.runStats.forEach(runStats => {
            for (const key in runStats.conclusions) {
                if (!workflowStats.jobsConclusions[key]) {
                    workflowStats.jobsConclusions[key] = {
                        count: 0,
                        success: 0,
                        failure: 0,
                        skipped: 0,
                        cancelled: 0
                    };
                }

                workflowStats.jobsConclusions[key].count++;

                switch (runStats.conclusions[key]) {
                    case "success":
                        workflowStats.jobsConclusions[key].success++;
                    break;
                    case "failure":
                        workflowStats.jobsConclusions[key].failure++;
                    break;
                    case "skipped":
                        workflowStats.jobsConclusions[key].skipped!++;
                    break;
                    case "cancelled":
                        workflowStats.jobsConclusions[key].cancelled++;
                    break;
                    case "timed_out":
                        workflowStats.jobsConclusions[key].timedOut!++;
                    break;
                }
            }
        });

        return workflowStats;
    }

    private calculateRunStats(runs: WorkflowRun[]): Promise<RunStats[]> {
        return Promise.allSettled(runs.map(this.getRunJobsStats.bind(this)))
                .then(StatsBuilder.getOnlySettledRunStats);
    }

    private static getOnlySettledRunStats(results: PromiseSettledResult<RunStats>[]) {
        return results.flatMap(result => {
            if (result.status == "fulfilled") {
                return [result.value];
            }

            if (result.status == "rejected") {
                console.error(`Rejected run stats due to ${result.reason}`);
            }

            return [];
        });
    }

    private getRunJobsStats(run: WorkflowRun): Promise<RunStats>
    {
        // We need to limit concurrency due to Github API limitations
        return concurrencyLimit(() => this.client.getRunJobs(run.id)
            .then(runJobs => this.calculateRunJobsStats(run, runJobs)));
    }

    private calculateRunJobsStats(run: WorkflowRun, jobs: RunJobs): Promise<RunStats> {
        if (jobs.length == 0) {
            return Promise.reject(`Invalid workflow run ${run.id}: empty jobs list`);
        }

        const firstStartedJob = StatsBuilder.firstStartedJob(jobs);
        const lastStartedJob = StatsBuilder.lastStartedJob(jobs);
        const firstCompletedJob = StatsBuilder.firstCompletedJob(jobs);
        const lastCompletedJob = StatsBuilder.lastCompletedJob(jobs);

        const stats = {
            firstCompleted: firstCompletedJob,
            lastCompleted: lastCompletedJob,
            firstStarted: firstStartedJob,
            lastStarted: lastStartedJob,
            queuedTime: StatsBuilder.queuedTime(run, firstStartedJob),
            completionTime: StatsBuilder.completionTime(run, lastCompletedJob),
            conclusion: run.conclusion ? run.conclusion : "unknown",
            conclusions: StatsBuilder.buildJobsConclusionsMap(jobs),
            conclusionsStats: StatsBuilder.calculateJobsConclusionsStats(jobs),
            jobs,
            run
        };

        return Promise.resolve(stats);
    }

    private static firstStartedJob(jobs: RunJobs): RunJob {
        return StatsBuilder.reduceJob(jobs, (left, right) => left.started_at < right.started_at);
    }

    private static firstCompletedJob(jobs: RunJobs): RunJob {
        // @ts-ignore
        return StatsBuilder.reduceJob(jobs, (left, right) => left.completed_at < right.completed_at);
    }

    private static lastCompletedJob(jobs: RunJobs): RunJob {
        // @ts-ignore
        return StatsBuilder.reduceJob(jobs, (left, right) => left.completed_at > right.completed_at);
    }

    private static lastStartedJob(jobs: RunJobs): RunJob {
        return StatsBuilder.reduceJob(jobs, (left, right) => left.started_at > right.started_at);
    }

    private static reduceJob(jobs: RunJobs, compareFunc: (left: RunJob, right: RunJob) => boolean) {
        return jobs.reduce((left, right) => {
            if (compareFunc(left, right)) {
                return left;
            }
            return right;
        });
    }

    private static countJobs(jobs: RunJobs, filterFunc: (job: RunJob) => boolean): number {
        return jobs.filter(filterFunc).length;
    }

    private static queuedTime(run: WorkflowRun, job: RunJob): string {
        return durationBetween(run.created_at, job.started_at);
    }

    private static completionTime(run: WorkflowRun, job: RunJob): string {
        return durationBetween(run.created_at, job.completed_at);
    }

    private static calculateJobsConclusionsStats(jobs: RunJobs): ConclusionStats {
        return {
            count: jobs.length,
            cancelled: StatsBuilder.countJobs(jobs, (job) => job.conclusion == "cancelled"),
            success: StatsBuilder.countJobs(jobs, (job) => job.conclusion == "success"),
            failure: StatsBuilder.countJobs(jobs, (job) => job.conclusion == "failure"),
            skipped: StatsBuilder.countJobs(jobs, (job) => job.conclusion == "skipped"),
            timedOut: StatsBuilder.countJobs(jobs, (job) => job.conclusion == "timed_out"),
            neutral: StatsBuilder.countJobs(jobs, (job) => job.conclusion == "neutral")
        }
    }

    private static buildJobsConclusionsMap(runJobs: RunJobs): Record<string, string> {
        const jobConclusionStats: Record<string, string> = {};

        runJobs.forEach(job => {
           jobConclusionStats[job.name] = job.conclusion!;
        });

        return jobConclusionStats;
    }
}