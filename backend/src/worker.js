import { config } from './config.js';
import { claimNext, processVideo } from './services/processor.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let stopping = false;
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => (stopping = true));

console.log('Worker started, polling for uploaded videos...');
while (!stopping) {
  try {
    const job = await claimNext();
    if (job) await processVideo(job);
    else await sleep(config.workerPollMs);
  } catch (err) {
    console.error('Worker loop error:', err);
    await sleep(config.workerPollMs);
  }
}
process.exit(0);
