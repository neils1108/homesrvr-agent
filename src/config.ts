export default {
    // URL of Homesrvr dashboard
    homesrvrUrl: 'http://localhost:4321',
    
    // Agent token
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
