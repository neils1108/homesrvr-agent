export default {
    homesrvrUrl: 'http://localhost:4321',

    agentToken: '866176a759b6fc847043eaa417d227a63494f3340db3914938a2b0fd0d1ffe27',

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