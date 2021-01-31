import {ConclusionStats} from "./stats"
import moment from "moment/moment";

export function formatConclusions(stats: ConclusionStats): string {
    const successRatio = calculateRatio(stats.success, stats.count);
    const failureRatio = calculateRatio(stats.count - stats.success, stats.count);

    return `success: ${successRatio}%, failure: ${failureRatio}%`;
}

export function calculateRatio(value: number, total: number): number {
    return Math.round(value * 10000 / total) / 100;
}

export function durationBetween(from: string | null, to: string | null): string {
    if (from == null || to == null) {
        return "n/a";
    }

    return formatDuration(moment.duration(moment(from).diff(moment(to))).abs());
}

export function formatDuration(value: moment.Duration): string {
    return toHHMMSS(value.asSeconds());
}

function toHHMMSS(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor(seconds / 60) % 60
    const secs = seconds % 60

    return [hours, minutes, secs]
        .map(v => v < 10 ? "0" + v : v)
        .filter((v,i) => v !== "00" || i > 0)
        .join(":")
}