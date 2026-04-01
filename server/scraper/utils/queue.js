    const queue = [];

    export function addJob(job) {
    queue.push(job);
    }

    export async function processQueue() {
    while (queue.length > 0) {
        const job = queue.shift();
        await job();
    }
    }