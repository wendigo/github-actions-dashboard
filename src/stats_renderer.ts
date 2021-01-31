import * as Handlebars from "handlebars";
import * as fs from "fs";
import { promisify } from "util";
import * as core from "@actions/core";
import {JobStats, WorkflowStats} from "./stats";
import {calculateRatio, durationBetween, formatDuration} from "./stats_utils";
import pLimit from "p-limit";
import sanitize from "sanitize-filename";

const templateCache: Record<string, string> = {};
const concurrencyLimit = pLimit(4);

export class StatsRenderer {
    private readonly outputDir: string;
    private readonly templateDir: string;
    private readonly handlebars: typeof Handlebars;

    constructor(templateDir: string, outputDir: string) {
        this.templateDir = templateDir;
        this.outputDir = outputDir;
        this.handlebars = Handlebars.create();
        this.handlebars.registerHelper("ratio", calculateRatio);
        this.handlebars.registerHelper("formatDuration", formatDuration);
        this.handlebars.registerHelper("durationBetween", durationBetween);
    }

    renderWorkflowStats(stats: WorkflowStats): Promise<string> {
        const outputName = `workflow_${stats.workflow.id}.html`;
        return this.renderTemplate("workflow_stats", outputName, stats);
    }

    renderJobStats(stats: JobStats[]): Promise<string[]> {
        const outputFileName = (workflowId: number, name: string): string => sanitize(`workflow_${workflowId}_job_${name}.html`);
        return Promise.all(stats.map(job => this.renderTemplate("job_stats", outputFileName(job.workflow.id, job.name), job)));
    }

    renderWorkflowRunsStats(stats: WorkflowStats): Promise<string> {
        const outputName = `workflow_${stats.workflow.id}_runs.html`;
        return this.renderTemplate("workflow_runs", outputName, stats);
    }

    private readTemplate(template: string): Promise<HandlebarsTemplateDelegate> {
        const templateFile = `${this.templateDir}/${template}.html`;
        if (!fs.existsSync(templateFile)) {
            return Promise.reject(`Could not find ${templateFile} template`);
        }

        return this.readOrGetTemplate(templateFile)
            .then(content => this.handlebars.compile(content));
    }

    private readOrGetTemplate(templateFile: string): Promise<string> {
        if (templateCache[templateFile]) {
            return Promise.resolve(templateCache[templateFile]);
        }

        core.info(`Reading template ${templateFile}`);

        return promisify(fs.readFile)(templateFile, {encoding: "utf-8"})
            .then(content => {
                templateCache[templateFile] = content;
                return content;
            });
    }

    private renderTemplate(template: string, outputFilename: string, content: any): Promise<string> {
        return concurrencyLimit(() => this.readTemplate(template)
            .then(template => template(content))
            .then(content => this.writeOutputFile(outputFilename, content)));
    }

    private writeOutputFile(filename: string, content: string): Promise<string> {
        const outputFilename = `${this.outputDir}/${filename}`;
        console.log(`Rendering output file ${outputFilename}`);
        return promisify(fs.writeFile)(outputFilename, content).then(_ => outputFilename);
    }
}