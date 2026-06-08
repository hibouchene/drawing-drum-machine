interface StrudelScheduler {
    getTime(): number;
    seconds_at_cps_change: number;
    num_cycles_at_cps_change: number;
    cps: number;
}

declare module "@strudel/web"{
    export function initStrudel(options: {
        prebake?: () => void;
    }): Promise<{
    scheduler: StrudelScheduler;
    evaluate: (code: any, autostart?: boolean, shouldHush?: boolean) => Promise<any>;
    start: () => void | Promise<void>;
    stop: () => void;
    pause: () => any;
    setCps: (b: any) => any;
    setPattern: (b: any, k?: boolean) => Promise<any>;
    setCode: (b: any) => void;
    toggle: () => any;
    state: {
        schedulerError: undefined;
        evalError: undefined;
        code: string;
        activeCode: string;
        pattern: undefined;
        miniLocations: never[];
        widgets: never[];
        pending: boolean;
        started: boolean;
    };
    }>

    export function samples(sample: string): void

    export function evaluate(code: any, autostart?: boolean, shouldHush?: boolean): Promise<any>

    export function getAudioContext(): AudioContext
}