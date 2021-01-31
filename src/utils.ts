import {GitHub} from "@actions/github/lib/utils";

export function dumpingClient(delegate: InstanceType<typeof GitHub>, debug: (message: string) => void): InstanceType<typeof GitHub> {
    delegate.hook.before("request", async (options) => {
        debug(`Requesting ${options.url}`);
    });

    delegate.hook.after("request", async (options) => {
        debug(`Requested ${options.url}`);
    });
    
    return delegate;
}