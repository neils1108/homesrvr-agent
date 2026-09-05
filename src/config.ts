export default {
    homesrvrUrl: 'http://localhost:4321',

    agentToken: '',

    interval: 30_000,

    speedTestInterval: 10 * 60 * 1000,

    // Agent identity
    agentName: 'hostname',

    // What to report
    metrics: {
        cpu: true,
        memory: true,
        disk: true,
        network: true
    }
};
