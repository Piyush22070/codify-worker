import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { client } from '../utils/redisClient.js';
import { Submission } from '../models/submission.model.js';

const sandboxPath = path.join(process.cwd(), 'src/controllers/sandbox');
console.log("Sandbox Path:", sandboxPath);

// Utility: Safe delete
const safeUnlink = (filePath) => {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
};

// Main job processor
const processJob = async (job) => {
  const { code, language, testCases = [], jobId } = job;
  const extension = language === 'cpp' ? 'cpp' : language === 'py' ? 'py' : 'java';
  const filename = `TempCode.${extension}`;
  const filepath = path.join(sandboxPath, filename);

  const results = [];

  for (const { input, expectedOutput } of testCases) {
    const inputPath = path.join(sandboxPath, 'input.txt');
    try {
      fs.writeFileSync(filepath, code.join('\n'));
      if (input) fs.writeFileSync(inputPath, input);

      let command;
      switch (language) {
        case 'py':
          command = `docker run --rm \
            --network=none \
            --memory=128m \
            --cpus=0.5 \
            -v ${sandboxPath}:/app \
            python:3.11 \
            bash -c "cd /app && timeout 5s python runCode.py ${filename} < input.txt"`;
          break;

        case 'cpp':
          command = `docker run --rm \
            --network=none \
            --memory=128m \
            --cpus=0.5 \
            -v ${sandboxPath}:/app \
            gcc:latest \
            bash -c "cd /app && g++ ${filename} -o a.out && timeout 5s ./a.out < input.txt"`;
          break;

        case 'java':
          command = `docker run --rm \
            --network=none \
            --memory=128m \
            --cpus=0.5 \
            -v ${sandboxPath}:/app \
            openjdk:latest \
            bash -c "cd /app && javac ${filename} && timeout 5s java Main < input.txt"`;
          break;

        default:
          results.push({ passed: false, error: `Unsupported language: ${language}` });
          continue;
      }

      const output = await new Promise((resolve) => {
        exec(command, { timeout: 5000 }, (error, stdout, stderr) => {
          safeUnlink(filepath);
          safeUnlink(inputPath);

          const isTimeout =
            (error && error.killed) ||
            (stderr && stderr.includes('command terminated') || stderr.includes('timed out'));

          if (isTimeout) {
            return resolve({
              passed: false,
              output: '',
              expected: expectedOutput.trim(),
              stderr: 'Execution timed out',
              error: 'Execution timed out'
            });
          }

          if (error) {
            return resolve({
              passed: false,
              output: stdout.trim(),
              expected: expectedOutput.trim(),
              stderr: stderr?.trim(),
              error: error.message
            });
          }

          resolve({
            passed: stdout.trim() === expectedOutput.trim(),
            output: stdout.trim(),
            expected: expectedOutput.trim(),
            stderr: stderr?.trim()
          });
        });
      });

      results.push(output);
    } catch (err) { 
      safeUnlink(filepath);
      safeUnlink(inputPath);
      results.push({ passed: false, error: err.message });
    }
  }

  const isAccepted = results.every(r => r.passed === true);
  const status = isAccepted ? 'accepted' : 'rejected';

  console.log(`Job ${jobId} finished with status: ${status}`);

  // Store result in Redis for quick polling
  await client.set(`result:${jobId}`, JSON.stringify({ status, results }), {
    EX: 300
  });

  // Persist result in MongoDB
  try {
    await Submission.findByIdAndUpdate(jobId, {
      status,
      submissionTime: new Date(),
      results 
    });
  } catch (dbErr) {
    console.error(`Failed to update submission ${jobId} in MongoDB:`, dbErr.message);
  }
};

// Redis Queue Listener
const listenQueue = async () => {
  console.log('Worker started and listening on Redis queue...');
  while (true) {
    try {
      const job = await client.brPop('codeQueue', 0);
      if (job) {
        const payload = JSON.parse(job.element);
        await processJob(payload);
      }
    } catch (err) {
      console.error('Error processing job:', err.message);
    }
  }
};

export { listenQueue };
