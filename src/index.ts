import si from 'systeminformation';
import config from './config';

type SpeedTestResult = {
    download: number | null;
    upload: number | null;
    latency: number | null;
};

let speedTestResult: SpeedTestResult = {
    download: null,
    upload: null,
    latency: null
};

let speedTestRunning = false;

async function getLocalIp(): Promise<string | null> {
    try {
        const interfaces = await si.networkInterfaces();

        const activeInterface = interfaces.find(
            (networkInterface) =>
                !networkInterface.internal &&
                networkInterface.ip4 &&
                networkInterface.operstate === 'up'
        );

        return activeInterface?.ip4 || null;

    } catch (error) {
        console.error(
            'Failed to detect local IP:',
            error
        );

        return null;
    }
}

async function measureLatency(): Promise<number | null> {
    const samples: number[] = [];

    for (let i = 0; i < 3; i++) {
        try {
            const start = performance.now();

            const response = await fetch(
                `https://speed.cloudflare.com/__down?bytes=1&t=${Date.now()}-${i}`,
                {
                    method: 'GET',
                    signal: AbortSignal.timeout(5000)
                }
            );

            if (!response.ok) {
                continue;
            }

            await response.arrayBuffer();

            samples.push(
                performance.now() - start
            );

        } catch {
            // Ignore failed samples
        }
    }

    if (samples.length === 0) {
        return null;
    }

    samples.sort(
        (a, b) => a - b
    );

    return Math.round(
        samples[Math.floor(samples.length / 2)]
    );
}

async function measureDownload(): Promise<number | null> {
    const bytes = 25 * 1024 * 1024;

    try {
        const start = performance.now();

        const response = await fetch(
            `https://speed.cloudflare.com/__down?bytes=${bytes}&t=${Date.now()}`,
            {
                method: 'GET',
                signal: AbortSignal.timeout(30000)
            }
        );

        if (!response.ok) {
            return null;
        }

        const buffer = await response.arrayBuffer();

        const elapsed =
            (performance.now() - start) / 1000;

        if (elapsed <= 0 || buffer.byteLength === 0) {
            return null;
        }

        const megabits =
            (buffer.byteLength * 8) / 1_000_000;

        return megabits / elapsed;

    } catch (error) {
        console.error(
            'Download speed test failed:',
            error
        );

        return null;
    }
}

async function measureUpload(): Promise<number | null> {
    const bytes = 10 * 1024 * 1024;

    try {
        const data = new Uint8Array(bytes);

        const start = performance.now();

        const response = await fetch(
            `https://speed.cloudflare.com/__up?t=${Date.now()}`,
            {
                method: 'POST',

                headers: {
                    'Content-Type':
                        'application/octet-stream'
                },

                body: data,

                signal:
                    AbortSignal.timeout(30000)
            }
        );

        if (!response.ok) {
            return null;
        }

        await response.arrayBuffer();

        const elapsed =
            (performance.now() - start) / 1000;

        if (elapsed <= 0) {
            return null;
        }

        const megabits =
            (bytes * 8) / 1_000_000;

        return megabits / elapsed;

    } catch (error) {
        console.error(
            'Upload speed test failed:',
            error
        );

        return null;
    }
}

async function runSpeedTest() {
    if (speedTestRunning) {
        return;
    }

    speedTestRunning = true;

    console.log('');
    console.log(
        'Running internet speed test...'
    );

    try {
        const latency =
            await measureLatency();

        console.log(
            `  Latency: ${
                latency !== null
                    ? `${latency} ms`
                    : 'Unknown'
            }`
        );

        const download =
            await measureDownload();

        console.log(
            `  Download: ${
                download !== null
                    ? `${download.toFixed(2)} Mbps`
                    : 'Unknown'
            }`
        );

        const upload =
            await measureUpload();

        console.log(
            `  Upload: ${
                upload !== null
                    ? `${upload.toFixed(2)} Mbps`
                    : 'Unknown'
            }`
        );

        /*
         * Only replace the stored values when a test
         * successfully returned a value.
         *
         * This means a temporary failed speed test
         * does not erase the last good result.
         */
        speedTestResult = {
            download:
                download ??
                speedTestResult.download,

            upload:
                upload ??
                speedTestResult.upload,

            latency:
                latency ??
                speedTestResult.latency
        };

        console.log(
            'Speed test completed'
        );

    } catch (error) {
        console.error(
            'Speed test failed:',
            error
        );

    } finally {
        speedTestRunning = false;
    }
}

async function sendStats() {
    try {
        const [
            cpu,
            memory,
            os,
            ip
        ] = await Promise.all([
            si.currentLoad(),
            si.mem(),
            si.osInfo(),
            getLocalIp()
        ]);

        const response = await fetch(
            `${config.homesrvrUrl}/api/agent/heartbeat`,
            {
                method: 'POST',

                headers: {
                    'Content-Type':
                        'application/json',

                    'Authorization':
                        `Bearer ${config.agentToken}`
                },

                body: JSON.stringify({
                    name: config.agentName,

                    hostname: os.hostname,

                    ip: ip,

                    os: {
                        platform: os.platform,
                        distro: os.distro,
                        release: os.release,
                        arch: os.arch
                    },

                    cpu: config.metrics.cpu
                        ? cpu.currentLoad
                        : null,

                    memory: config.metrics.memory
                        ? (
                            memory.used /
                            memory.total
                        ) * 100
                        : null,

                    network:
                        config.metrics.network
                            ? {
                                download:
                                    speedTestResult.download,

                                upload:
                                    speedTestResult.upload,

                                latency:
                                    speedTestResult.latency
                            }
                            : null
                })
            }
        );

        if (!response.ok) {
            console.error(
                'Failed to send stats:',
                await response.text()
            );

            return;
        }

        console.log('');
        console.log(
            `[${new Date().toLocaleTimeString()}] Stats sent successfully`
        );

        console.log(
            `  Hostname: ${os.hostname}`
        );

        console.log(
            `  IP: ${ip ?? 'Unknown'}`
        );

        console.log(
            `  OS: ${os.distro}`
        );

        console.log(
            `  CPU: ${cpu.currentLoad.toFixed(1)}%`
        );

        console.log(
            `  Memory: ${(
                (memory.used /
                    memory.total) *
                100
            ).toFixed(1)}%`
        );

        console.log(
            `  Download: ${
                speedTestResult.download !== null
                    ? `${speedTestResult.download.toFixed(2)} Mbps`
                    : 'Unknown'
            }`
        );

        console.log(
            `  Upload: ${
                speedTestResult.upload !== null
                    ? `${speedTestResult.upload.toFixed(2)} Mbps`
                    : 'Unknown'
            }`
        );

        console.log(
            `  Latency: ${
                speedTestResult.latency !== null
                    ? `${speedTestResult.latency} ms`
                    : 'Unknown'
            }`
        );

    } catch (error) {
        console.error(
            'Failed to collect or send stats:',
            error
        );
    }
}

async function start() {
    console.log(
        'Homesrvr Agent started'
    );

    console.log(
        `Agent: ${config.agentName}`
    );

    console.log(
        `Reporting every ${
            config.interval / 1000
        } seconds`
    );

    console.log(
        `Speed test every ${
            config.speedTestInterval /
            1000 /
            60
        } minutes`
    );

    /*
     * Run the first speed test before sending
     * the first heartbeat so the dashboard gets
     * real network values immediately.
     */
    if (config.metrics.network) {
        await runSpeedTest();
    }

    await sendStats();

    setInterval(
        async () => {
            await sendStats();
        },
        config.interval
    );

    if (config.metrics.network) {
        setInterval(
            async () => {
                await runSpeedTest();
            },
            config.speedTestInterval
        );
    }
}

start();