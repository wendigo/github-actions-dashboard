import * as core from "@actions/core";
import { getOctokit } from "@actions/github";
import {RestActions} from './rest_actions'
import {dumpingClient} from './utils'
import {CachingActions} from "./caching_actions";
import {ActionsConfig} from "./actions";
import {StatsBuilder} from "./stats_builder";
import {StatsRenderer} from "./stats_renderer";

async function run(): Promise<void> {
  try {
    const authToken = core.getInput("token");
    const [owner, repository] = core.getInput("repository").split("/");
    const cacheDir = core.getInput("cachedir");
    const octokit = dumpingClient(getOctokit(authToken, {}), core.debug);

    const config : ActionsConfig = {owner, repository, cacheDir, cacheRunJobs: true, cacheWorkflows: true, cacheWorkflowRuns: true};
    const fetcher = new CachingActions(new RestActions(octokit, config), config);
    const statsBuilder = new StatsBuilder(core.getInput("repository"), fetcher);
    const stats = await statsBuilder.getWorkflowStats(1392268, "master", "push", 1000);
    const jobStats = await statsBuilder.getJobsStats(1392268, "master", "push", 1000);

    const writer = new StatsRenderer("./templates", "./output");
    console.log(await writer.renderWorkflowStats(stats));
    console.log(await writer.renderWorkflowRunsStats(stats));
    console.log(await writer.renderJobStats(jobStats));

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
