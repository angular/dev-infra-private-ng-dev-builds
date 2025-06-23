/**
 * @license
 * Copyright Google LLC
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { GoogleGenAI } from '@google/genai';
import { readFile, writeFile } from 'fs/promises';
import { SingleBar, Presets } from 'cli-progress';
import { DEFAULT_MODEL, DEFAULT_TEMPERATURE, DEFAULT_API_KEY } from './consts.js';
import assert from 'node:assert';
import { Log } from '../utils/logging.js';
import glob from 'fast-glob';
/** Yargs command builder for the command. */
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
/** Yargs command handler for the command. */
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
        '', // Extra new line at the end.
    ].join('\n'));
    progressBar.start(files.length, 0);
    // Kicks off the maximum number of concurrent requests and ensures that as many requests as
    // possible are running at the same time. This is preferrable to chunking, because it allows
    // the requests to keep running even if there's one which is taking a long time to resolve.
    while (files.length > 0 || running.size > 0) {
        // Fill up to maxConcurrency
        while (files.length > 0 && running.size < options.maxConcurrency) {
            const file = files.shift();
            const task = processFile(file).finally(() => running.delete(task));
            running.add(task);
        }
        // Wait for any task to finish
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
/**
 * Applies a prompt to a specific file's content.
 * @param ai Instance of the GenAI SDK.
 * @param model Model to use for the prompt.
 * @param temperature Temperature for the promp.
 * @param content Content of the file.
 * @param prompt Prompt to be run.
 */
async function applyPrompt(ai, model, temperature, content, prompt) {
    // The schema ensures that the API returns a response in the format that we expect.
    const responseSchema = {
        type: 'object',
        properties: {
            content: { type: 'string', description: 'Changed content of the file' },
        },
        required: ['content'],
        additionalProperties: false,
        $schema: 'http://json-schema.org/draft-07/schema#',
    };
    // Note that technically we can batch multiple files into a single `generateContent` call.
    // We don't do it, because it increases the risk that we'll hit the output token limit which
    // can corrupt the entire response. This way one file failing won't break the entire run.
    const response = await ai.models.generateContent({
        model,
        contents: [{ text: prompt }, { text: content }],
        config: {
            responseMimeType: 'application/json',
            responseSchema,
            temperature,
            // We need as many output tokens as we can get.
            maxOutputTokens: Infinity,
            // We know that we'll only use one candidate so we can save some processing.
            candidateCount: 1,
            // Guide the LLM towards following our schema.
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
/** CLI command module. */
export const MigrateModule = {
    builder,
    handler,
    command: 'migrate',
    describe: 'Apply a prompt-based AI migration over a set of files',
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlncmF0ZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL25nLWRldi9haS9taWdyYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRztBQUVILE9BQU8sRUFBQyxXQUFXLEVBQUMsTUFBTSxlQUFlLENBQUM7QUFFMUMsT0FBTyxFQUFDLFFBQVEsRUFBRSxTQUFTLEVBQUMsTUFBTSxhQUFhLENBQUM7QUFDaEQsT0FBTyxFQUFDLFNBQVMsRUFBRSxPQUFPLEVBQUMsTUFBTSxjQUFjLENBQUM7QUFDaEQsT0FBTyxFQUFDLGFBQWEsRUFBRSxtQkFBbUIsRUFBRSxlQUFlLEVBQUMsTUFBTSxhQUFhLENBQUM7QUFDaEYsT0FBTyxNQUFNLE1BQU0sYUFBYSxDQUFDO0FBQ2pDLE9BQU8sRUFBQyxHQUFHLEVBQUMsTUFBTSxxQkFBcUIsQ0FBQztBQUN4QyxPQUFPLElBQUksTUFBTSxXQUFXLENBQUM7QUF1QjdCLDZDQUE2QztBQUM3QyxTQUFTLE9BQU8sQ0FBQyxJQUFVO0lBQ3pCLE9BQU8sSUFBSTtTQUNSLE1BQU0sQ0FBQyxRQUFRLEVBQUU7UUFDaEIsSUFBSSxFQUFFLFFBQVE7UUFDZCxLQUFLLEVBQUUsR0FBRztRQUNWLFdBQVcsRUFBRSx1REFBdUQ7UUFDcEUsWUFBWSxFQUFFLElBQUk7S0FDbkIsQ0FBQztTQUNELE1BQU0sQ0FBQyxPQUFPLEVBQUU7UUFDZixJQUFJLEVBQUUsUUFBUTtRQUNkLEtBQUssRUFBRSxHQUFHO1FBQ1YsV0FBVyxFQUFFLDRDQUE0QztRQUN6RCxZQUFZLEVBQUUsSUFBSTtLQUNuQixDQUFDO1NBQ0QsTUFBTSxDQUFDLE9BQU8sRUFBRTtRQUNmLElBQUksRUFBRSxRQUFRO1FBQ2QsS0FBSyxFQUFFLEdBQUc7UUFDVixXQUFXLEVBQUUsZ0NBQWdDO1FBQzdDLE9BQU8sRUFBRSxhQUFhO0tBQ3ZCLENBQUM7U0FDRCxNQUFNLENBQUMsZ0JBQWdCLEVBQUU7UUFDeEIsSUFBSSxF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QUksTUFBMEIsQ0FBQztJQUUvQixJQUFJLENBQUM7UUFDSCxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQXNCLENBQUM7SUFDakQsQ0FBQztJQUFDLE1BQU0sQ0FBQztRQUNQLE1BQU0sSUFBSSxLQUFLLENBQ2IsdUVBQXVFO1lBQ3JFLDREQUE0RDtZQUM1RCxhQUFhO1lBQ2IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUNwQyxDQUFDO0lBQ0osQ0FBQztJQUVELElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDcEIsTUFBTSxJQUFJLEtBQUssQ0FDYiw2RUFBNkU7WUFDM0UsaURBQWlEO1lBQ2pELElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FDbEMsQ0FBQztJQUNKLENBQUM7SUFFRCxPQUFPLE1BQU0sQ0FBQyxPQUFPLENBQUM7QUFDeEIsQ0FBQztBQUVELDBCQUEwQjtBQUMxQixNQUFNLENBQUMsTUFBTSxhQUFhLEdBQStCO0lBQ3ZELE9BQU87SUFDUCxPQUFPO0lBQ1AsT0FBTyxFQUFFLFNBQVM7SUFDbEIsUUFBUSxFQUFFLHVEQUF1RDtDQUNsRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTENcbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7R29vZ2xlR2VuQUl9IGZyb20gJ0Bnb29nbGUvZ2VuYWknO1xuaW1wb3J0IHtBcmd2LCBBcmd1bWVudHMsIENvbW1hbmRNb2R1bGV9IGZyb20gJ3lhcmdzJztcbmltcG9ydCB7cmVhZEZpbGUsIHdyaXRlRmlsZX0gZnJvbSAnZnMvcHJvbWlzZXMnO1xuaW1wb3J0IHtTaW5nbGVCYXIsIFByZXNldHN9IGZyb20gJ2NsaS1wcm9ncmVzcyc7XG5pbXBvcnQge0RFRkFVTFRfTU9ERUwsIERFRkFVTFRfVEVNUEVSQVRVUkUsIERFRkFVTFRfQVBJX0tFWX0gZnJvbSAnLi9jb25zdHMuanMnO1xuaW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydCc7XG5pbXBvcnQge0xvZ30gZnJvbSAnLi4vdXRpbHMvbG9nZ2luZy5qcyc7XG5pbXBvcnQgZ2xvYiBmcm9tICdmYXN0LWdsb2InO1xuXG4vKiogQ29tbWFuZCBsaW5lIG9wdGlvbnMuICovXG5leHBvcnQgaW50ZXJmYWNlIE9wdGlvbnMge1xuICAvKiogUHJvbXB0IHRoYXQgc2hvdWxkIGJlIGFwcGxpZWQuICovXG4gIHByb21wdDogc3RyaW5nO1xuXG4gIC8qKiBHbG9iIG9mIGZpbGVzIHRoYXQgdGhlIHByb21wdCBzaG91bGQgYXBwbHkgdG8uICovXG4gIGZpbGVzOiBzdHJpbmc7XG5cbiAgLyoqIE1vZGVsIHRoYXQgc2hvdWxkIGJlIHVzZWQgdG8gYXBwbHkgdGhlIHByb21wdC4gKi9cbiAgbW9kZWw6IHN0cmluZztcblxuICAvKiogVGVtcGVyYXR1cmUgZm9yIHRoZSBtb2RlbC4gKi9cbiAgdGVtcGVyYXR1cmU6IG51bWJlcjtcblxuICAvKiogTWF4aW11bSBudW1iZXIgb2YgY29uY3VycmVudCBBUEkgcmVxdWVzdHMuICovXG4gIG1heENvbmN1cnJlbmN5OiBudW1iZXI7XG5cbiAgLyoqIEFQSSBrZXkgdG8gdXNlIHdoZW4gbWFraW5nIHJlcXVlc3RzLiAqL1xuICBhcGlLZXk/OiBzdHJpbmc7XG59XG5cbi8qKiBZYXJncyBjb21tYW5kIGJ1aWxkZXIgZm9yIHRoZSBjb21tYW5kLiAqL1xuZnVuY3Rpb24gYnVpbGRlcihhcmd2OiBBcmd2KTogQXJndjxPcHRpb25zPiB7XG4gIHJldHVybiBhcmd2XG4gICAgLm9wdGlvbigncHJvbXB0Jywge1xuICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICBhbGlhczogJ3AnLFxuICAgICAgZGVzY3JpcHRpb246ICdQYXRoIHRvIHRoZSBmaWxlIGNvbnRhaW5nIHRoZSBwcm9tcHQgdGhhdCB3aWxsIGJlIHJ1bicsXG4gICAgICBkZW1hbmRPcHRpb246IHRydWUsXG4gICAgfSlcbiAgICAub3B0aW9uKCdmaWxlcycsIHtcbiAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgYWxpYXM6ICdmJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnR2xvYiBmb3IgdGhlIGZpbGVzIHRoYXQgc2hvdWxkIGJlIG1pZ3JhdGVkJyxcbiAgICAgIGRlbWFuZE9wdGlvbjogdHJ1ZSxcbiAgICB9KVxuICAgIC5vcHRpb24oJ21vZGVsJywge1xuICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICBhbGlhczogJ20nLFxuICAgICAgZGVzY3JpcHRpb246ICdNb2RlbCB0byB1c2UgZm9yIHRoZSBtaWdyYXRpb24nLFxuICAgICAgZGVmYXVsdDogREVGQVVMVF9NT0RFTCxcbiAgICB9KVxuICAgIC5vcHRpb24oJ21heENvbmN1cnJlbmN5Jywge1xuICAgICAgdHlwZTogJ251bWJlcicsXG4gICAgICBkZWZhdWx0OiAyNSxcbiAgICAgIGRlc2NyaXB0aW9uOlxuICAgICAgICAnTWF4aW11bSBudW1iZXIgb2YgY29uY3VycmVudCByZXF1ZXN0cyB0byB0aGUgQVBJLiBIaWdoZXIgbnVtYmVycyBtYXkgaGl0IHVzYWdlcyBsaW1pdHMnLFxuICAgIH0pXG4gICAgLm9wdGlvbigndGVtcGVyYXR1cmUnLCB7XG4gICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgIGFsaWFzOiAndCcsXG4gICAgICBkZWZhdWx0OiBERUZBVUxUX1RFTVBFUkFUVVJFLFxuICAgICAgZGVzY3JpcHRpb246ICdUZW1wZXJhdHVyZSBmb3IgdGhlIG1vZGVsLiBMb3dlciB0ZW1wZXJhdHVyZSByZWR1Y2VzIHJhbmRvbW5lc3MvY3JlYXRpdml0eScsXG4gICAgfSlcbiAgICAub3B0aW9uKCdhcGlLZXknLCB7XG4gICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgIGFsaWFzOiAnYScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBrZXkgdXNlZCB3aGVuIG1ha2luZyBjYWxscyB0byB0aGUgR2VtaW5pIEFQSScsXG4gICAgfSk7XG59XG5cbi8qKiBZYXJncyBjb21tYW5kIGhhbmRsZXIgZm9yIHRoZSBjb21tYW5kLiAqL1xuYXN5bmMgZnVuY3Rpb24gaGFuZGxlcihvcHRpb25zOiBBcmd1bWVudHM8T3B0aW9ucz4pIHtcbiAgY29uc3QgYXBpS2V5ID0gb3B0aW9ucy5hcGlLZXkgfHwgREVGQVVMVF9BUElfS0VZO1xuXG4gIGFzc2VydChcbiAgICBhcGlLZXksXG4gICAgW1xuICAgICAgJ05vIEFQSSBrZXkgY29uZmlndXJlZC4gQSBHZW1pbmkgQVBJIGtleSBtdXN0IGJlIHNldCBhcyB0aGUgYEdFTUlOSV9BUElfS0VZYCBlbnZpcm9ubWVudCAnICtcbiAgICAgICAgJ3ZhcmlhYmxlLCBvciBwYXNzZWQgaW4gdXNpbmcgdGhlIGAtLWFwaS1rZXlgIGZsYWcuJyxcbiAgICAgICdGb3IgaW50ZXJuYWwgdXNlcnMsIHNlZSBnby9haXN0dWRpby1hcGlrZXknLFxuICAgIF0uam9pbignXFxuJyksXG4gICk7XG5cbiAgY29uc3QgW2ZpbGVzLCBwcm9tcHRdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgIGdsb2IoW29wdGlvbnMuZmlsZXNdKSxcbiAgICByZWFkRmlsZShvcHRpb25zLnByb21wdCwgJ3V0Zi04JyksXG4gIF0pO1xuXG4gIGlmIChmaWxlcy5sZW5ndGggPT09IDApIHtcbiAgICBMb2cuZXJyb3IoYE5vIGZpbGVzIG1hdGNoZWQgdGhlIHBhdHRlcm4gXCIke29wdGlvbnMuZmlsZXN9XCJgKTtcbiAgICBwcm9jZXNzLmV4aXQoMSk7XG4gIH1cblxuICBjb25zdCBhaSA9IG5ldyBHb29nbGVHZW5BSSh7YXBpS2V5fSk7XG4gIGNvbnN0IHByb2dyZXNzQmFyID0gbmV3IFNpbmdsZUJhcih7fSwgUHJlc2V0cy5zaGFkZXNfZ3JleSk7XG4gIGNvbnN0IGZhaWx1cmVzOiB7bmFtZTogc3RyaW5nOyBlcnJvcjogc3RyaW5nfVtdID0gW107XG4gIGNvbnN0IHJ1bm5pbmcgPSBuZXcgU2V0PFByb21pc2U8dm9pZD4+KCk7XG5cbiAgTG9nLmluZm8oXG4gICAgW1xuICAgICAgYEFwcGx5aW5nIHByb21wdCBmcm9tICR7b3B0aW9ucy5wcm9tcHR9IHRvICR7ZmlsZXMubGVuZ3RofSBmaWxlcyhzKS5gLFxuICAgICAgYFVzaW5nIG1vZGVsICR7b3B0aW9ucy5tb2RlbH0gd2l0aCBhIHRlbXBlcmF0dXJlIG9mICR7b3B0aW9ucy50ZW1wZXJhdHVyZX0uYCxcbiAgICAgICcnLCAvLyBFeHRyYSBuZXcgbGluZSBhdCB0aGUgZW5kLlxuICAgIF0uam9pbignXFxuJyksXG4gICk7XG4gIHByb2dyZXNzQmFyLnN0YXJ0KGZpbGVzLmxlbmd0aCwgMCk7XG5cbiAgLy8gS2lja3Mgb2ZmIHRoZSBtYXhpbXVtIG51bWJlciBvZiBjb25jdXJyZW50IHJlcXVlc3RzIGFuZCBlbnN1cmVzIHRoYXQgYXMgbWFueSByZXF1ZXN0cyBhc1xuICAvLyBwb3NzaWJsZSBhcmUgcnVubmluZyBhdCB0aGUgc2FtZSB0aW1lLiBUaGlzIGlzIHByZWZlcnJhYmxlIHRvIGNodW5raW5nLCBiZWNhdXNlIGl0IGFsbG93c1xuICAvLyB0aGUgcmVxdWVzdHMgdG8ga2VlcCBydW5uaW5nIGV2ZW4gaWYgdGhlcmUncyBvbmUgd2hpY2ggaXMgdGFraW5nIGEgbG9uZyB0aW1lIHRvIHJlc29sdmUuXG4gIHdoaWxlIChmaWxlcy5sZW5ndGggPiAwIHx8IHJ1bm5pbmcuc2l6ZSA+IDApIHtcbiAgICAvLyBGaWxsIHVwIHRvIG1heENvbmN1cnJlbmN5XG4gICAgd2hpbGUgKGZpbGVzLmxlbmd0aCA+IDAgJiYgcnVubmluZy5zaXplIDwgb3B0aW9ucy5tYXhDb25jdXJyZW5jeSkge1xuICAgICAgY29uc3QgZmlsZSA9IGZpbGVzLnNoaWZ0KCkhO1xuICAgICAgY29uc3QgdGFzayA9IHByb2Nlc3NGaWxlKGZpbGUpLmZpbmFsbHkoKCkgPT4gcnVubmluZy5kZWxldGUodGFzaykpO1xuICAgICAgcnVubmluZy5hZGQodGFzayk7XG4gICAgfVxuXG4gICAgLy8gV2FpdCBmb3IgYW55IHRhc2sgdG8gZmluaXNoXG4gICAgaWYgKHJ1bm5pbmcuc2l6ZSA+IDApIHtcbiAgICAgIGF3YWl0IFByb21pc2UucmFjZShydW5uaW5nKTtcbiAgICB9XG4gIH1cblxuICBwcm9ncmVzc0Jhci5zdG9wKCk7XG5cbiAgZm9yIChjb25zdCB7bmFtZSwgZXJyb3J9IG9mIGZhaWx1cmVzKSB7XG4gICAgTG9nLmluZm8oJy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0nKTtcbiAgICBMb2cuaW5mbyhgJHtuYW1lfSBmYWlsZWQgdG8gbWlncmF0ZTpgKTtcbiAgICBMb2cuaW5mbyhlcnJvcik7XG4gIH1cblxuICBMb2cuaW5mbyhgXFxuRG9uZSDwn46JYCk7XG5cbiAgaWYgKGZhaWx1cmVzLmxlbmd0aCA+IDApIHtcbiAgICBMb2cuaW5mbyhgJHtmYWlsdXJlcy5sZW5ndGh9IGZpbGUocykgZmFpbGVkLiBTZWUgbG9ncyBhYm92ZSBmb3IgbW9yZSBpbmZvcm1hdGlvbi5gKTtcbiAgfVxuXG4gIGFzeW5jIGZ1bmN0aW9uIHByb2Nlc3NGaWxlKGZpbGU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgcmVhZEZpbGUoZmlsZSwgJ3V0Zi04Jyk7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBhcHBseVByb21wdChhaSwgb3B0aW9ucy5tb2RlbCwgb3B0aW9ucy50ZW1wZXJhdHVyZSwgY29udGVudCwgcHJvbXB0KTtcbiAgICAgIGF3YWl0IHdyaXRlRmlsZShmaWxlLCByZXN1bHQpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGZhaWx1cmVzLnB1c2goe25hbWU6IGZpbGUsIGVycm9yOiAoZSBhcyBFcnJvcikudG9TdHJpbmcoKX0pO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBwcm9ncmVzc0Jhci5pbmNyZW1lbnQoKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBBcHBsaWVzIGEgcHJvbXB0IHRvIGEgc3BlY2lmaWMgZmlsZSdzIGNvbnRlbnQuXG4gKiBAcGFyYW0gYWkgSW5zdGFuY2Ugb2YgdGhlIEdlbkFJIFNESy5cbiAqIEBwYXJhbSBtb2RlbCBNb2RlbCB0byB1c2UgZm9yIHRoZSBwcm9tcHQuXG4gKiBAcGFyYW0gdGVtcGVyYXR1cmUgVGVtcGVyYXR1cmUgZm9yIHRoZSBwcm9tcC5cbiAqIEBwYXJhbSBjb250ZW50IENvbnRlbnQgb2YgdGhlIGZpbGUuXG4gKiBAcGFyYW0gcHJvbXB0IFByb21wdCB0byBiZSBydW4uXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGFwcGx5UHJvbXB0KFxuICBhaTogR29vZ2xlR2VuQUksXG4gIG1vZGVsOiBzdHJpbmcsXG4gIHRlbXBlcmF0dXJlOiBudW1iZXIsXG4gIGNvbnRlbnQ6IHN0cmluZyxcbiAgcHJvbXB0OiBzdHJpbmcsXG4pOiBQcm9taXNlPHN0cmluZz4ge1xuICAvLyBUaGUgc2NoZW1hIGVuc3VyZXMgdGhhdCB0aGUgQVBJIHJldHVybnMgYSByZXNwb25zZSBpbiB0aGUgZm9ybWF0IHRoYXQgd2UgZXhwZWN0LlxuICBjb25zdCByZXNwb25zZVNjaGVtYSA9IHtcbiAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICBjb250ZW50OiB7dHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnQ2hhbmdlZCBjb250ZW50IG9mIHRoZSBmaWxlJ30sXG4gICAgfSxcbiAgICByZXF1aXJlZDogWydjb250ZW50J10sXG4gICAgYWRkaXRpb25hbFByb3BlcnRpZXM6IGZhbHNlLFxuICAgICRzY2hlbWE6ICdodHRwOi8vanNvbi1zY2hlbWEub3JnL2RyYWZ0LTA3L3NjaGVtYSMnLFxuICB9O1xuXG4gIC8vIE5vdGUgdGhhdCB0ZWNobmljYWxseSB3ZSBjYW4gYmF0Y2ggbXVsdGlwbGUgZmlsZXMgaW50byBhIHNpbmdsZSBgZ2VuZXJhdGVDb250ZW50YCBjYWxsLlxuICAvLyBXZSBkb24ndCBkbyBpdCwgYmVjYXVzZSBpdCBpbmNyZWFzZXMgdGhlIHJpc2sgdGhhdCB3ZSdsbCBoaXQgdGhlIG91dHB1dCB0b2tlbiBsaW1pdCB3aGljaFxuICAvLyBjYW4gY29ycnVwdCB0aGUgZW50aXJlIHJlc3BvbnNlLiBUaGlzIHdheSBvbmUgZmlsZSBmYWlsaW5nIHdvbid0IGJyZWFrIHRoZSBlbnRpcmUgcnVuLlxuICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGFpLm1vZGVscy5nZW5lcmF0ZUNvbnRlbnQoe1xuICAgIG1vZGVsLFxuICAgIGNvbnRlbnRzOiBbe3RleHQ6IHByb21wdH0sIHt0ZXh0OiBjb250ZW50fV0sXG4gICAgY29uZmlnOiB7XG4gICAgICByZXNwb25zZU1pbWVUeXBlOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICByZXNwb25zZVNjaGVtYSxcbiAgICAgIHRlbXBlcmF0dXJlLFxuICAgICAgLy8gV2UgbmVlZCBhcyBtYW55IG91dHB1dCB0b2tlbnMgYXMgd2UgY2FuIGdldC5cbiAgICAgIG1heE91dHB1dFRva2VuczogSW5maW5pdHksXG4gICAgICAvLyBXZSBrbm93IHRoYXQgd2UnbGwgb25seSB1c2Ugb25lIGNhbmRpZGF0ZSBzbyB3ZSBjYW4gc2F2ZSBzb21lIHByb2Nlc3NpbmcuXG4gICAgICBjYW5kaWRhdGVDb3VudDogMSxcbiAgICAgIC8vIEd1aWRlIHRoZSBMTE0gdG93YXJkcyBmb2xsb3dpbmcgb3VyIHNjaGVtYS5cbiAgICAgIHN5c3RlbUluc3RydWN0aW9uOlxuICAgICAgICBgUmV0dXJuIG91dHB1dCBmb2xsb3dpbmcgdGhlIHN0cnVjdHVyZWQgb3V0cHV0IHNjaGVtYS4gYCArXG4gICAgICAgIGBSZXR1cm4gYW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlIG5ldyBjb250ZW50cyBvZiB0aGUgY2hhbmdlZCBmaWxlLmAsXG4gICAgfSxcbiAgfSk7XG5cbiAgY29uc3QgdGV4dCA9IHJlc3BvbnNlLnRleHQ7XG5cbiAgaWYgKCF0ZXh0KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBObyByZXNwb25zZSBmcm9tIHRoZSBBUEkuIFJlc3BvbnNlOlxcbmAgKyBKU09OLnN0cmluZ2lmeShyZXNwb25zZSwgbnVsbCwgMikpO1xuICB9XG5cbiAgbGV0IHBhcnNlZDoge2NvbnRlbnQ/OiBzdHJpbmd9O1xuXG4gIHRyeSB7XG4gICAgcGFyc2VkID0gSlNPTi5wYXJzZSh0ZXh0KSBhcyB7Y29udGVudDogc3RyaW5nfTtcbiAgfSBjYXRjaCB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgJ0ZhaWxlZCB0byBwYXJzZSByZXN1bHQgYXMgSlNPTi4gVGhpcyBjYW4gaGFwcGVuIGlmIGlmIG1heGltdW0gb3V0cHV0ICcgK1xuICAgICAgICAndG9rZW4gc2l6ZSBoYXMgYmVlbiByZWFjaGVkLiBUcnkgdXNpbmcgYSBkaWZmZXJlbnQgbW9kZWwuICcgK1xuICAgICAgICAnUmVzcG9uc2U6XFxuJyArXG4gICAgICAgIEpTT04uc3RyaW5naWZ5KHJlc3BvbnNlLCBudWxsLCAyKSxcbiAgICApO1xuICB9XG5cbiAgaWYgKCFwYXJzZWQuY29udGVudCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICdDb3VsZCBub3QgZmluZCBjb250ZW50IGluIHBhcnNlZCBBUEkgcmVzcG9uc2UuIFRoaXMgY2FuIGluZGljYXRlIGEgcHJvYmxlbSAnICtcbiAgICAgICAgJ3dpdGggdGhlIHJlcXVlc3QgcGFyYW1ldGVycy4gUGFyc2VkIHJlc3BvbnNlOlxcbicgK1xuICAgICAgICBKU09OLnN0cmluZ2lmeShwYXJzZWQsIG51bGwsIDIpLFxuICAgICk7XG4gIH1cblxuICByZXR1cm4gcGFyc2VkLmNvbnRlbnQ7XG59XG5cbi8qKiBDTEkgY29tbWFuZCBtb2R1bGUuICovXG5leHBvcnQgY29uc3QgTWlncmF0ZU1vZHVsZTogQ29tbWFuZE1vZHVsZTx7fSwgT3B0aW9ucz4gPSB7XG4gIGJ1aWxkZXIsXG4gIGhhbmRsZXIsXG4gIGNvbW1hbmQ6ICdtaWdyYXRlJyxcbiAgZGVzY3JpYmU6ICdBcHBseSBhIHByb21wdC1iYXNlZCBBSSBtaWdyYXRpb24gb3ZlciBhIHNldCBvZiBmaWxlcycsXG59O1xuIl19