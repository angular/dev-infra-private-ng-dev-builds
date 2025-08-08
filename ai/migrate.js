import { GoogleGenAI } from '@google/genai';
import { readFile, writeFile } from 'fs/promises';
import { SingleBar, Presets } from 'cli-progress';
import { DEFAULT_MODEL, DEFAULT_TEMPERATURE, DEFAULT_API_KEY } from './consts.js';
import assert from 'node:assert';
import { Log } from '../utils/logging.js';
import glob from 'fast-glob';
function builder(argv) {
    return argv
        .option('prompt', {
        type: 'string',
        alias: 'p',
        description: 'Path to the file containg the prompt that will be run',
        demandOption: true,
    })
        .option('files', {
        type: 'string',
        alias: 'f',
        description: 'Glob for the files that should be migrated',
        demandOption: true,
    })
        .option('model', {
        type: 'string',
        alias: 'm',
        description: 'Model to use for the migration',
        default: DEFAULT_MODEL,
    })
        .option('maxConcurrency', {
        type: 'number',
        default: 25,
        description: 'Maximum number of concurrent requests to the API. Higher numbers may hit usages limits',
    })
        .option('temperature', {
        type: 'number',
        alias: 't',
        default: DEFAULT_TEMPERATURE,
        description: 'Temperature for the model. Lower temperature reduces randomness/creativity',
    })
        .option('apiKey', {
        type: 'string',
        alias: 'a',
        description: 'API key used when making calls to the Gemini API',
    });
}
async function handler(options) {
    const apiKey = options.apiKey || DEFAULT_API_KEY;
    assert(apiKey, [
        'No API key configured. A Gemini API key must be set as the `GEMINI_API_KEY` environment ' +
            'variable, or passed in using the `--api-key` flag.',
        'For internal users, see go/aistudio-apikey',
    ].join('\n'));
    const [files, prompt] = await Promise.all([
        glob([options.files]),
        readFile(options.prompt, 'utf-8'),
    ]);
    if (files.length === 0) {
        Log.error(`No files matched the pattern "${options.files}"`);
        process.exit(1);
    }
    const ai = new GoogleGenAI({ apiKey });
    const progressBar = new SingleBar({}, Presets.shades_grey);
    const failures = [];
    const running = new Set();
    Log.info([
        `Applying prompt from ${options.prompt} to ${files.length} files(s).`,
        `Using model ${options.model} with a temperature of ${options.temperature}.`,
        '',
    ].join('\n'));
    progressBar.start(files.length, 0);
    while (files.length > 0 || running.size > 0) {
        while (files.length > 0 && running.size < options.maxConcurrency) {
            const file = files.shift();
            const task = processFile(file).finally(() => running.delete(task));
            running.add(task);
        }
        if (running.size > 0) {
            await Promise.race(running);
        }
    }
    progressBar.stop();
    for (const { name, error } of failures) {
        Log.info('-------------------------------------');
        Log.info(`${name} failed to migrate:`);
        Log.info(error);
    }
    Log.info(`\nDone 🎉`);
    if (failures.length > 0) {
        Log.info(`${failures.length} file(s) failed. See logs above for more information.`);
    }
    async function processFile(file) {
        try {
            const content = await readFile(file, 'utf-8');
            const result = await applyPrompt(ai, options.model, options.temperature, content, prompt);
            await writeFile(file, result);
        }
        catch (e) {
            failures.push({ name: file, error: e.toString() });
        }
        finally {
            progressBar.increment();
        }
    }
}
async function applyPrompt(ai, model, temperature, content, prompt) {
    const responseSchema = {
        type: 'object',
        properties: {
            content: { type: 'string', description: 'Changed content of the file' },
        },
        required: ['content'],
        additionalProperties: false,
        $schema: 'http://json-schema.org/draft-07/schema#',
    };
    const response = await ai.models.generateContent({
        model,
        contents: [{ text: prompt }, { text: content }],
        config: {
            responseMimeType: 'application/json',
            responseSchema,
            temperature,
            maxOutputTokens: Infinity,
            candidateCount: 1,
            systemInstruction: `Return output following the structured output schema. ` +
                `Return an object containing the new contents of the changed file.`,
        },
    });
    const text = response.text;
    if (!text) {
        throw new Error(`No response from the API. Response:\n` + JSON.stringify(response, null, 2));
    }
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch {
        throw new Error('Failed to parse result as JSON. This can happen if if maximum output ' +
            'token size has been reached. Try using a different model. ' +
            'Response:\n' +
            JSON.stringify(response, null, 2));
    }
    if (!parsed.content) {
        throw new Error('Could not find content in parsed API response. This can indicate a problem ' +
            'with the request parameters. Parsed response:\n' +
            JSON.stringify(parsed, null, 2));
    }
    return parsed.content;
}
export const MigrateModule = {
    builder,
    handler,
    command: 'migrate',
    describe: 'Apply a prompt-based AI migration over a set of files',
};
//# sourceMappingURL=migrate.js.map