import {RunJob, RunJobs, Workflow, WorkflowRun, WorkflowRuns} from "./actions";
import * as moment from "moment";

export interface ConclusionStats {
    count: number
    success: number
    failure: number
    cancelled: number
    skipped?: number
    timedOut?: number
    neutral?: number
}

export interface WorkflowStats {
    repository: string
    workflow: Workflow
    conclusions: ConclusionStats
    jobsConclusions: Record<string, ConclusionStats>
    runStats: RunStats[]
    runs: WorkflowRuns
}

export interface RunStats {
    run: WorkflowRun
    jobs: RunJobs
    firstStarted: RunJob
    lastStarted: RunJob
    firstCompleted: RunJob
    lastCompleted: RunJob
    queuedTime: string
    completionTime: string
    conclusion: string
    conclusions: Record<string, string>
    conclusionsStats: ConclusionStats
}

export interface JobStats {
    name: string
    workflow: Workflow
    runs: JobRun[]
}

export interface JobRun {
    run: WorkflowRun
    job: RunJob
}